# 首版需求与 Shopee API 能力、字段映射

初次核对：2026-10-15；补充核查：2026-10-16。范围：10 月 14 日会议的最高优先级需求，以及用户在本轮确认的规则。通过用户已打开的紫鸟浏览器查阅官方文档，核对 26 个相关接口正文及订单、退货、站内广告三篇开发指南。本文不扩展库存、改价、上架、TK 等后续规划。

**证据等级：接口文档、官方帮助资料与当前菲律宾店铺相关后台页面已核对；真实应用权限、API 实际返回、数据延迟和业务对账尚未实测。** 未自行调用真实店铺 OpenAPI；补充核查只读浏览了卖家后台广告页面，没有开通 Meta、修改广告、店铺授权或发送通知。页面示例只用于理解结构，不代表用户的真实数据。文档中的操作建议不扩大本轮操作授权。

## 1. 结论与功能设计边界

“直接取数”表示接口已定义相应数据，不表示一个接口就完成整项业务，也不表示本项目已接入。

| 首版功能 | 文档层结论 | 对应接口与关键字段 | 设计决定 / 未解决问题 |
|---|---|---|---|
| 订单列表、状态、取消明细 | 可直接取数 | [O1]、[O2]：`order_sn`、`order_status`、取消原因、商品行取消数量 | 已取消与申请取消分开；整单与部分取消分开 |
| 退款列表、退款金额与关联订单 | 可直接取数，有条件字段 | [R1]、[R2]：`return_sn`、`order_sn`、`refund_amount`、`status`、部分退款标记 | 同订单可有多个退款申请；商品退款金额有白名单限制；退款申请不等于资金退款完成 |
| 原始/取消/退款/净销售额、月报 | 有组合实现路径，尚不能固定单一公式 | [O1]、[O2] + [R1]、[R2] + [P1]，账单作核对 | 运费、优惠、未支付、COD、部分取消、跨月退款和净额重复扣减需样本验证 |
| 站内广告原始消耗、广告回报 | 可直接取数并聚合 | [A1]—[A6]：`expense`、GMV、ROAS、日期/小时 | 店铺整体与活动明细分开；经营净销售额与广告归因 GMV 分开 |
| 扣除赠金/回扣后的站内实际花费 | 尚未确认充分字段 | [A7]仅 `total_balance`；[P1]、[P2]有充值/扣款相关数据 | 已确认后台赠金及交易明细来源，尚缺实际使用金额完整样本及对应 OpenAPI；详见第 11 节。不得以余额、充值额代替消耗 |
| 虾皮托管的站外 Meta 花费 | 本轮未确认直接对应接口/字段 | Ads 目录、[P2]、[P3]未给出可直接识别该业务的已确认映射 | 已确认 Seller Centre Meta 产品、独立钱包、每日扣款及日报来源；未确认开放接口/导出字段。详见第 11 节 |
| 达人/联盟佣金 | 可直接取数、组合核对 | [P1]：订单/商品 AMS 佣金；[M1]—[M3]：转化、核验账单 | 平台佣金与 AMS 佣金分开；预估/核验/扣款状态分开；多个来源不能重复累加 |
| 三费合计及费用率 | 本系统计算，完整数据仍有缺口 | 三类费用 / 同口径净销售额 | 任一必要来源未知时，展示“已知费用小计/待补齐”，不冒充完整合计或精确实际费用率 |
| 仅监控在投商品广告 | 文档支持组合实现 | [A1] → [A2] `campaign_status=ongoing` → [A3] | 商品级广告活动可确认；全店推广不能自动假定被此列表完整覆盖 |
| 单对象当天累计花费达到上限 AND ROAS 低于目标 | 商品广告有数据基础；规则由本系统实现 | [A2]、[A3]、[A4] + 本系统规则与采样 | 默认店铺当地当天累计，次日重新累计；比值必须用总 GMV / 总花费重算 |
| 1 小时花费增长超 50% | 小时桶有基础，算法与及时性待验证 | [A3] `date`、`hour`、`expense` | 相邻完整小时可做候选；滚动 60 分钟与小时桶不是同一含义；不能擅自替换会议规则 |
| 30 分钟 ROAS 下降超 30% | 尚未确认足够数据粒度/刷新保证 | [A3]最细明确字段是 `hour`；无已确认分钟桶/源更新时间 | 若小时内数据持续更新，可进一步验证快照方案；增加轮询本身不等于获得 30 分钟数据 |
| Shop GMV Max 的活动/商品表现 | 区间表现可取；小时监控未确认 | [A9]、[A10]：`campaign_id`、`item_id`、`report` | 商品区间指标不等于商品小时指标；已有活动发现/状态覆盖也需验证 |
| 默认继承、自定义规则、飞书通知、告警处理 | 本系统功能 | Shopee 提供输入数据，不提供本项目规则与飞书投递 | 无自定义时自动走统一默认逻辑；飞书首选；短信仅备选；不需要运营填写默认阈值 |

## 2. 订单与取消：接口及字段

### O1 — `GET /api/v2/order/get_order_list`

用途：获取订单标识，历史回补与增量同步入口，不提供完整销售金额。来源：[订单列表][O1]。

| 方向 | 字段（官方类型） | 含义与使用限制 |
|---|---|---|
| 请求 | `time_range_field` string | `create_time` / `update_time`；历史按创建，增量可按更新 |
| 请求 | `time_from`、`time_to` timestamp | 单次范围最大 15 天；这是查询窗口限制，不等于只能访问最近 15 天 |
| 请求 | `page_size` int32、`cursor` string | 每页 1–100；首批空 cursor |
| 请求 | `order_status` string | 可选状态筛选；全量采集不能只取在途/完成订单而漏掉取消 |
| 请求 | `response_optional_fields` string | 列表可选 `order_status` |
| 响应 | `response.order_list[].order_sn` string | 订单标识，关联详情、退款和结算 |
| 响应 | `order_list[].order_status` string | `IN_CANCEL` 与 `CANCELLED` 等不同状态 |
| 响应 | `response.more` boolean、`response.next_cursor` string | more=true 必须继续分页；不能只用第一页做月报 |

`request_order_status_pending` 是迁移兼容参数。请求筛选、响应枚举与开发指南枚举并非完全一致，需保留未知状态及原值，不能把未识别状态归为取消。官方[订单指南][G1]明确：`IN_CANCEL` 是取消申请待处理，`CANCELLED` 才是已取消；`TO_RETURN` 是退货申请待处理。

### O2 — `GET /api/v2/order/get_order_detail`

请求 `order_sn_list`（string，1–50 个订单），通过 `response_optional_fields` 显式请求 `total_amount,item_list,pay_time,buyer_cancel_reason,cancel_by,cancel_reason` 等所需字段。来源：[订单详情][O2]。

以下订单字段位于 `response.order_list[]`，商品字段位于其 `item_list[]`。

| 字段（官方类型） | 能力 / 影响 |
|---|---|
| `order_sn` string、`order_status` string | 订单关联与状态筛选 |
| `region` string、`currency` string、`cod` boolean | 站点、币种、货到付款；不能用 `pay_time` 为空一律排除所有 COD 业务 |
| `create_time`、`update_time` timestamp | 订单创建、最近更新，不是取消/退款支付完成的专用时间 |
| `pay_time` timestamp | 从未支付转为已支付的时间；未支付时可为 NULL |
| `total_amount` float | 买家支付总额，包含买家运费并考虑平台促销抵扣；仅支付后返回。不能直接称商品净销售额 |
| `cancel_by`、`cancel_reason`、`buyer_cancel_reason` string | 谁取消、取消原因；用于明细解释，不提供完整实扣退款台账 |
| `item_id`、`model_id` int64 | 平台商品与规格身份；SKU 文本不能代替稳定主键 |
| `item_sku`、`model_sku` string | 展示/关联卖家 SKU |
| `model_quantity_purchased` int32 | 原购买数量 |
| `model_original_price`、`model_discounted_price` float | 商品原价/折后价格；Bundle Deal 的折后价可按设计返回 0，官方要求改用结算详情取正确价格 |
| `order_item_id` int64、`line_item_id` int64 | 辅助区分促销/订单商品行；优先验证唯一行身份，避免同款重复行误合并 |
| `active_qty`、`cancel_requested_qty`、`cancelled_qty`、`return_requested_qty`、`returned_qty` int32 | 有效、申请取消、已取消、申请退货、已退货数量；数量不是退款金额，申请量不能当完成量 |
| `return_request_due_date` timestamp | 可申请退货的截止时间，不是退款发生日期 |
| `reverse_shipping_fee` float | 逆向运费，不是买家退款金额 |

不能通过“`model_discounted_price × cancelled_qty`”无条件还原取消金额：套餐、优惠券、部分取消重算及未支付订单都可能不适用。订单更新后仍需追踪旧月份订单的取消/退款变化。

### O3 — `POST /api/v2/order/get_estimate_cancel_value`

来源：[预估取消金额][O3]。请求 `order_sn`、`partial_cancel_item_list[]`（`item_id`、`model_id`、`model_quantity`；促销相关 `order_item_id`、`promotion_group_id`）。返回 `cancel_value_price`（string）。

**这是提交部分取消前的预估金额接口，不能作为历史已取消金额的事实来源。** 本轮只读文档，没有调用此接口或取消订单。

## 3. 退货退款：金额、状态、白名单

### R1 — `GET /api/v2/returns/get_return_list`

来源：[退款列表][R1]。请求 `page_no`、`page_size`（最大 100），可用 `create_time_from/to`、`update_time_from/to`、`status` 等筛选。创建/更新窗口最大 15 天，文档要求 `update_time_from >= create_time_from`。创建时间描述写作 order create time，而返回 create_time 描述为退款申请创建，二者语义需样本确认。`page_no` 的分页说明同时提到页码与 offset，首值语义需实测，不能硬编码后漏数。

主要返回 `response.return[]`：`return_sn`、`order_sn`、`refund_amount`（float）、`currency`、`status`、`create_time`、`update_time`、`item[]`、`return_solution`、`return_refund_type`、部分退款标记；`response.more` 表示还有分页。

### R2 — `GET /api/v2/returns/get_return_detail`

来源：[退款详情][R2]、[退货退款指南][G2]。请求 `return_sn`。以下字段位于 `response`，嵌套路径显式标出。

| 字段（官方类型） | 能力 / 设计影响 |
|---|---|
| `return_sn`、`order_sn` string | 一个订单可对应多个 return_sn；按退款申请去重，不能每单只保留一个 |
| `refund_amount` float、`currency` string | 申请记录中的退款金额；仍须结合状态/结算判断是否进入已生效退款 |
| `status` string | 指南枚举：`REQUESTED`、`ACCEPTED`、`CANCELLED`、`JUDGING`、`CLOSED`、`PROCESSING`、`SELLER_DISPUTE` |
| `create_time`、`update_time` timestamp | 申请创建/更新；不能假称专用退款支付完成时间 |
| `return_solution` int32 | 0 退货退款，1 仅退款；不能要求退款必须有退货物流 |
| `return_refund_type` string | `RRBOC` / `RRAOC`：订单完成前/后发起；完成订单仍可能再退款 |
| `is_partial_quantity_return` boolean | 是否只退部分数量 |
| `is_refund_amount_adjusted` boolean | 实退金额是否低于最大可退金额，不能只按整件售价推算 |
| `item[].item_id`、`item[].model_id` int64；`item[].amount` int32 | 对应商品、规格与数量 |
| `item[].item_price` float | 商品价格；不能在有优惠、调整时直接视作每项实际退款 |
| `item[].refund_amount` float | **仅 Partial Qty RR 白名单店铺有此商品退款金额**。文档提示不可用时参考 item_price，但不能据此声称已获精确商品退款分摊 |
| `activity[].refund_amount` string | 套餐活动退款金额，亦有 Partial Qty RR 白名单条件；与顶层退款不是独立费用，不能重复相加 |
| `negotiation.latest_offer_amount` float | 最新协商报价，不是已退款金额 |
| `seller_compensation.compensation_amount` float | 给卖家的赔偿，须与退给买家的钱分开 |
| `return_refund_request_type` int32 | 0 普通、1 运输中、2 当场拒收；不应只识别一种退货路径 |

指南说明“同意仅退款”会变为 ACCEPTED；本轮文档未给出可通用当作资金支付完成时间的字段。不能只见 ACCEPTED/CLOSED 的字面名称就定财务入账规则。应通过已知全退、部分退、拒绝/取消申请样本与结算核对后，确定哪些状态和金额进入净额。

页面存在 `reverse_logistics_status` 参数表与 `reverse_logistic_status` 示例/更新日志的拼写差异。首版财务计算不依赖此字段；如后续展示物流，先用真实响应核实，不自行改名当官方字段。

## 4. 结算和账单：补足金额、佣金及事后调整

### P1 — `GET /api/v2/payment/get_escrow_detail`

来源：[结算详情][P1]。请求 `order_sn`。返回 `response.order_sn`、`return_order_sn_list[]` 与 `order_income`。下表未另说明的字段位于 `response.order_income`。

| 字段（官方类型） | 官方含义与首版用途 |
|---|---|
| `buyer_total_amount` float | 买家结账时支付总额快照；不是净销售额 |
| `order_original_price`、`order_discounted_price`、`order_selling_price` float | 订单原价、折后价、售价相关金额，促销/套餐语义不同；需选定统一业务口径 |
| `original_cost_of_goods_sold` float | 官方写的是买家对商品支付的金额，不能因为英文名将其当采购成本 |
| `cost_of_goods_sold` float | 官方写的是该单商品最终买家支付金额，作为净商品金额候选核对；不能再无条件扣一次退款 |
| `drc_adjustable_refund` float | 争议中心调整退款额，不必然覆盖全部退款情形 |
| `seller_return_refund` float | 官方表述为部分退货时退给卖家的金额；不能仅凭字段名当作买家退款直接减去 |
| `items[].item_id`、`model_id`、`line_item_id` int64 | 关联商品、规格和行 |
| `items[].quantity_purchased` int32 | 数量 |
| `items[].original_price`、`selling_price`、`discounted_price` float | 结算商品价格，其中 `discounted_price` 在数量 >1 时已是该商品小计，不能再乘数量；可补订单接口套餐价格缺口 |
| `voucher_from_seller`、`voucher_from_shopee`、`coins` 等 float | 优惠/抵扣组成，决定毛额与净额口径，不能混同广告赠金 |
| `buyer_paid_shipping_fee`、`actual_shipping_fee`、`reverse_shipping_fee` float | 运费组成；商品销售额与运费应分开 |
| `commission_fee` float | Shopee 平台交易佣金，**不是达人佣金** |
| `order_ams_commission_fee` float | 整单联盟佣金，可对接会议要求的订单费用明细取数 |
| `items[].ams_commission_fee` float | 商品联盟佣金；与整单 AMS 费用为上下级口径，不能一起累加 |
| `order_adjustment[].amount` float、`date` timestamp、`currency` string、`adjustment_reason` string | 订单后续调整，可包含退货、物流、营销、支付等原因；不能全部算作退款 |
| `total_adjustment_amount`、`escrow_amount_after_adjustment` float | 调整合计及调整后卖家入账，用于核对，不是商品销售额 |
| `escrow_amount` float | 预计给卖家的结算额，完成前可变化，已包含多种费用；不能替代销售额再扣一遍营销费 |
| `ads_escrow_top_up_fee_or_technical_support_fee` float | 可能是广告自动充值、技术支持费或流量增长费，随站点/卖家类型变化；**充值不是当期广告消耗，也不是赠金抵扣** |
| `pay_per_sale` float | 按成交付费广告费，官方给出归因完成订单销售额/目标 ROI 的定义；须验证目标店铺适用和与现有 expense 的重叠，不能遗漏或重复计算 |

多项金额仅适用于 non-CB-SIP-affiliate 店铺；SIP 相关有 `_pri`、`pri_currency`、`aff_currency`、`exchange_rate`。跨站汇总须核实币种，不得直接相加。`seller_product_rebate` / `net_commission_fee` 等部分字段仅 BR 本土，含义为商品/平台费用返还，不能当通用广告回扣。

### P2 — `GET /api/v2/payment/get_wallet_transaction_list`

来源：[钱包交易][P2]。**仅本土店铺**。请求分页及最多 15 天创建时间窗口，可筛选 `transaction_type`、`money_flow`。

- `response.transaction_list[]` 中有 `status`（FAILED/COMPLETED/PENDING/INITIAL）、`transaction_type`、`amount` float、`current_balance` float、`create_time` int、`order_sn`、`refund_sn`、`money_flow`、`reason`、`description`；`response.more` 控制分页。
- 文档列出 `PAID_ADS_CHARGE=450`、`PAID_ADS_REFUND=451`、`AFFILIATE_ADS_SELLER_FEE=455`、对应退费 456、`AFFILIATE_FEE_DEDUCT=460`。
- 这些能提供现金流核对候选，但“Paid Ads”不是已确认 Meta 专属标识；钱包扣款也不自动等于按广告消耗日期确认的费用。不能把 450 直接重命名为 Meta 花费，或把 451 都当赠金返还。

### P3 — `POST /api/v2/payment/get_billing_transaction_info`

来源：[跨境账单交易][P3]。**仅跨境卖家**。请求 `billing_transaction_info_type`（1 待发放 / 2 已发放）、`encrypted_payout_ids`（最多 100，来自 payout info）、`cursor`、`page_size`（最多 100）。这是读取账单的 POST，本轮未发出实际请求。

响应 `response.transactions` 定义了 `amount` float、`currency` string、`order_sn` string、`cost_header`、`scenario`、`remark`、`level`（Order/Shop）、`billing_transaction_type`、`billing_transaction_status`；另有 `more`、`next_cursor`。可核对完成后退款等调整。示例有 Refund Amount/Return Refund After Order Completed，但尚未确认完整费用类型枚举、交易唯一键及专用退款完成日期。参数表 `order_sn` 的说明错写为币种，属于文档问题，不能据此改变字段用途。

### P4/P5/P6 — 结算列表与收入视图

| 接口 | 请求与字段 | 能力边界 |
|---|---|---|
| [P4] `GET /payment/get_escrow_list` | `release_time_from/to`、分页；`response.escrow_list[].order_sn,payout_amount,escrow_release_time`，`response.more` | 按结算释放时间找订单与结算额，不等于按下单月份销售额 |
| [P5] `GET /payment/get_income_overview` | 可选 `income_status`；`response.total_income.pending_amount,to_release_amount,released_amount`、`latest_payout_date` | 当前收入概览，官方明确**不支持历史收入结果查询**；不能给自然月销售报表直接供数 |
| [P6] `GET /payment/get_income_detail` | `date_from/to`、`income_status`、`cursor`、`page_size`；收入记录含 `order_sn,currency,estimated_escrow_amount,released_amount,creation_date,actual_payout_time` 与分页 cursor | 日期仅对 Released 生效，按发放日，跨度不能超过 14 天；Pending/To Release 返回当前记录，不能当历史期间筛选 |

以上路径前均为 `/api/v2`。P6 的示例将列表置于顶层 `income_detail_list.list[]`，分页为 `income_detail_list.next_page`，与参数表的层级展示不完全一致；真实返回前不据此生成声称已验证的 SDK。

## 5. 广告：监控对象与指标粒度

### A1/A2 — 发现商品广告活动、读取在投状态和设置

[A1] `GET /api/v2/ads/get_product_level_campaign_id_list`：请求 `ad_type`（all/auto/manual）、`offset`、`limit`；返回 `response.shop_id,region,has_next_page,campaign_list[].ad_type,campaign_id`。**它自身不返回在投状态**，需再取 A2。

[A2] `GET /api/v2/ads/get_product_level_campaign_setting_info`：请求 `campaign_id_list`（最多 100）、`info_type_list`（1 Common / 2 Manual / 3 Auto Bidding / 4 Auto Product）。

| 响应路径（在 `response.campaign_list[]` 下） | 类型 | 对应功能 |
|---|---|---|
| `campaign_id` | int64 | 活动主键，必须与 shop_id 一起定位 |
| `common_info.ad_name,ad_type` | string | 广告名称、auto/manual 类型 |
| `common_info.campaign_status` | string | ongoing/scheduled/ended/paused/deleted/closed；在投监控选 ongoing |
| `common_info.campaign_budget` | float | 活动预算，**0 表示不限额**；该字段正文没有充分定义为本项目“每日预算”，不能擅自等同 |
| `common_info.campaign_duration.start_time/end_time` | int64 | 活动持续时间；end_time=0 表示不限结束日 |
| `common_info.bidding_method,campaign_placement` | string | 出价方式与 search/discovery/all 投放位置 |
| `common_info.item_id_list` | int64[] | 自动选品可能 0–多个商品，手动选品恰好 1 个；仅是关联关系，不提供逐 SKU 消耗 |
| `auto_bidding_info.roas_target` | float | 平台自动竞价的目标 ROAS，只在适用类型存在；不等于本系统告警目标 |
| `auto_product_ads_info[].item_id,product_name,status` | int64/string/string | 商品及 learning/ongoing/paused/ended/unavailable 状态；商品状态和活动状态分开 |

**配置对象建议**：先以“店铺＋活动 campaign_id”作为可验证的监控身份；单商品活动可同时展示商品信息。多商品活动不能将活动花费复制到每个商品并生成重复告警。全店推广另设对象类型，并按已验证能力开放商品规则。订单 `model_id` 的存在不能证明广告有规格级表现。

### A3/A4 — 商品广告活动的小时 / 每日表现

[A3] `GET /api/v2/ads/get_product_campaign_hourly_performance`：`performance_date`（示例 DD-MM-YYYY）、`campaign_id_list`（最多 100）。

[A4] `GET /api/v2/ads/get_product_campaign_daily_performance`：`start_date`、`end_date`、`campaign_id_list`（最多 100）。

两者响应：`response[]` → `shop_id,region,campaign_list[]` → `campaign_id,ad_type,campaign_placement,ad_name,metrics_list[]`。下表是 metrics_list 中的首版相关字段。

| 字段（官方类型） | 定义 / 影响 |
|---|---|
| `date` string、`hour` int32（仅 A3） | 日与小时桶；无已确认分钟桶字段 |
| `expense` float | 广告花费，没有在此表中拆分付费/免费额度消耗 |
| `impression`、`clicks` int64 | 曝光与点击，可解释低样本表现 |
| `broad_gmv` float | 点击广告后 7 天内购买店铺商品的归因销售额 |
| `direct_gmv` float | 点击广告后 7 天内购买所推广商品的归因销售额 |
| `broad_roi`、`direct_roi` float | 文档明确定义为 ROAS：归因 GMV / expense；不是利润 ROI |
| `broad_order`、`direct_order` int64 | 归因购买次数/转化，不应只因名字含 order 就与经营订单口径混用 |
| `broad_order_amount`、`direct_order_amount` int64 | 归因售出商品数量，**不是订单金额** |
| `broad_cir`、`direct_cir` float | ACOS，expense / 对应 GMV ×100% |

其他指标有 `ctr,cr,cpc,direct_cr,cpdc`。特别是 `cpc` 在此接口说明写为 cost per conversion，不能只凭缩写显示为每次点击成本；首版核心不依赖这个有歧义字段。

累计 ROAS 应为 `sum(相同归因口径 GMV) / sum(expense)`，不能相加或平均各小时 ROAS。expense=0、缺数据时不生成伪造的 0 或无穷大；数据被修订时应回补历史，不只追加。

页面错误码说明支持今天及最早六个月前的日期；A4 未在参数正文充分解释单次最大查询跨度，需验证。小时桶不是刷新 SLA，未核实延迟、当小时更新方式、时区、归因回补前，不承诺实时 30 分钟判断。默认 1h/50%、30m/30% 保留为需求，接口未验证的规则显示“待启用”，不能静默改为另一套算法。

### A5/A6 — 店铺整体 CPC 广告表现

[A5] `GET /api/v2/ads/get_all_cpc_ads_hourly_performance`：`performance_date`；响应 `response[]` 的 `date,hour,expense,direct_gmv,broad_gmv,direct_roas,broad_roas` 及曝光/点击等。

[A6] `GET /api/v2/ads/get_all_cpc_ads_daily_performance`：`start_date,end_date`；响应同类指标，按日，无 hour。

**没有 campaign_id/item_id 的整体报表，不可拆成单活动指标。** 可作店铺总费用和活动汇总对照；不默认它一定覆盖全店 GMV Max 等全部产品，覆盖关系需实测。月报不能只汇总“当前在投”活动，否则已结束/暂停活动的历史费用会被漏掉。

目录中的“coming offline soon”前缀对应 `create_auto_product_ads` / `edit_auto_product_ads`，本轮没有证据说 A6 即将下线；不要因相邻菜单文字误判。

### A7/A8 — 余额、开关

- [A7] `GET /api/v2/ads/get_total_balance` → `response.data_timestamp` timestamp、`total_balance` float：付费＋免费广告额度总余额。**无独立 paid/free 使用明细**，时间戳只属于该余额接口，不能作为 A3 的数据更新时间。
- [A8] `GET /api/v2/ads/get_shop_toggle_info` → `response.data_timestamp`、`auto_top_up` boolean、`campaign_surge` boolean。分别为自动充值和价格优化开关，**不是广告活动在投状态**，也不是全店 GMV Max 的完整状态接口。

### A9/A10 — Shop GMV Max 活动/商品区间表现

来源：[全店推广活动表现][A9]、[商品表现][A10]、[广告指南][G3]。

- 两接口均为 POST：`/api/v2/ads/get_gms_campaign_performance`、`/api/v2/ads/get_gms_item_performance`。
- 请求 `campaign_id` 可选；`start_date/end_date` 必填，DD-MM-YYYY；请求参数表称跨度最大 3 个月，开始日最早六个月前；但 A9 错误表又写最大 1 个月、起止日相同报错，与同日示例冲突，不能当作已验证限制。A10 有 `offset`、`limit`（默认 50，最大 100）。
- A9：`response.campaign_id` + `report`。A10：`response.campaign_id,result_list[].item_id,report`，另有 `total,has_next_page`，只返回有表现的商品，按 item_id 排序。
- report 定义 `expense,broad_gmv,broad_roi,direct_roi`、曝光、点击、转化等。没有已确认 `hour`、分钟或逐日明细数组；按查询区间返回，不能宣称已支持商品小时预警。
- 指南区分 Item GMV Max（商品）和 Shop GMV Max（店铺，每店 1 条、系统选品）。它们不能仅依赖 auto/manual 标签完全区分。A9 可不传 campaign_id 并返回 response.campaign_id，是已有活动 ID 的发现候选；是否返回当前活动/如何处理历史活动仍须样本验证。状态读取、平台预算和目标读取覆盖也未确认。
- A10 有 item_id 级区间效果，但无 model_id 级效果。缺少某商品记录可能是“无表现”，也可能是采集不完整，需结合分页/成功状态判断。

## 6. 联盟佣金：转化、核验与已扣款必须分开

### M1 — `GET /api/v2/ams/get_conversion_report`

来源：[转化报表][M1]。用于订单—商品—达人—活动的佣金解释。

请求：`page_no,page_size`（最多 500，且 page_no×page_size≤10000）；可按 `order_sn,item_id,affiliate_id`、`verified_status`、`order_status` 等筛选；时间字段包括 `place_order_time_start/end`、`order_completed_time_start/end`、`conversion_completed_time_start/end`、`ams_deduction_time_start/end`。多组时间范围按交集；描述称最大查询跨度 3 个月。

| 响应（在 `response.list[]` 下） | 类型 | 首版用途与限制 |
|---|---|---|
| `order_sn,order_status,verified_status` | string | 订单与核验状态，保留原值 |
| `place_order_time,order_completed_time,conversion_completed_time` | string | 返回示例为日期时间字符串，不是请求使用的 timestamp；解析时需验证时区 |
| `affiliate_id`、`affiliate_name` | int64/string | 达人识别与解释 |
| `order_brand_commission` | string | 卖家承担的整单佣金；以金额解析，不按整数/二进制浮点草率累计 |
| `channel`、`seller_campaign_type`（在 items 下）、`campaign_partner` | string | 渠道、活动类型与合作方；不代表虾皮托管 Meta 广告花费 |
| `items[].item_id,model_id` | int64 | 商品与规格身份 |
| `items[].price,purchase_value` | int64 | 官方指定为分/最小货币单位，不能当主币单位与其他接口直接相加 |
| `items[].item_brand_commission` | string | 商品卖家佣金；与整单总额不重复相加 |
| `items[].item_brand_commission_to_affiliate/to_mcn` | string | 分给达人与 MCN 的组成，不在总额之外再加一次 |
| `items[].seller_service_fee`、`seller_service_fee_rate` | string | 服务费及费率，文档给出前者=商品佣金×费率；是否纳入会议“达人佣金费用”需统一 |
| `items[].refund_amount` | string | 退款参考字段；M1 对“order/item”的文字表述有歧义，不替代全店退款源 |

响应另有 `total_count,has_more`。请求支持 `deduction_status`（PendingDeduction/Deducted）及 `deduction_method`（OrderEscrow/SellerWallet/AutoAdjustment/SVSPaymentLink/OfflineSettlement/AMSCredit），但本轮响应字段表未明确逐行返回这些状态，不能设计成必有逐行实扣时间/金额。

文档描述“最多 500 页”与 page_no×page_size≤10000 并存；实施前以实际约束验证，按时间切片避免截断。请求核验枚举用 Unverified/Valid/Invalid，响应说明又写 Unverified/Verified，需保留原始值并验证映射。

### M2 — `GET /api/v2/ams/get_validation_list`

来源：[月度核验账单][M2]。已展开核对 Request Parameters，官方明确显示 `No Request Parameters Set`：除公共鉴权参数外，未定义业务查询参数；响应也未定义分页元数据。不能自行添加月份过滤或分页请求字段。返回 `response.validation_list[]`：

- `validation_id` string、`validation_month` int32（YYYYMM）、`payment_method` int32（1 Online/2 Offline）、`campaign_source` string（ShopeeManaged/Seller）。
- `online_bill.total_amount` float：月度佣金合计；`deducted_amount` float：已扣；`pending_amount` int64：待扣；`ams_credit_deducted_amount` float：AMS 额度支付。
- `online_bill.bill_status` int32：1 Pending，2 Completed，3 In process，4 To pay via payment link，5 Manual completed，6 To Be Settled Offline。
- `offline_bills[]`：`order_place_month`、`commission_amount`（税前）、`commission_amount_after_tax`、`ams_credit_deducted_amount`、`total_amount`。文档定义 total_amount=税后佣金＋AMS额度支付；不能再次加 AMS 额度。

**已支付/已扣不自动等于自有现金支付**。会议说佣金“不用额外处理”，可以保持业务页面简洁，但后端仍要避免状态、含税口径、额度和退款造成错算。

### M3 — `GET /api/v2/ams/get_validation_report`

来源：[核验账单明细][M3]。请求 `validation_id,validation_month,campaign_source,place_order_time_start/end,page_no,page_size`，可按商品/订单/核验状态筛选；分页同样受 10000 条约束。响应 `response.list[]` 的订单、商品、佣金、服务费字段与 M1 大体一致；有 `total_count,has_more`。用来解释 M2 账单，不能与 P1/M1 把同一佣金算三遍。月账期不等于订单归属月。

### M4 — `GET /api/v2/ams/get_performance_data_update_time`

来源：[AMS 数据更新日期][M4]。请求 `marker_type=AmsMarker`；返回 `response.last_report_date`（string，YYYY-MM-DD）。这是 AMS 看板指标的最新日期，不是广告小时表现、结算账单或每条佣金已实扣的更新时间，不能跨接口冒用。

## 7. 店铺信息、权限和时间基准

[S1] `GET /api/v2/shop/get_shop_info` 返回 `shop_name,region,status`、`is_cb` boolean、`is_sip` boolean、`merchant_id` int64、`auth_time,expire_time` timestamp 等。`status` 是 NORMAL/BANNED/FROZEN，不是广告状态。`expire_time` 是店铺授权到期，不能当 access_token 有效期。

本轮已读字段中没有通用 IANA 时区字段。**用户确认的累计周期保持为每店当地自然日，00:00 重置、历史保留**；后端需要维护店铺时区，并验证广告 date/hour 与该时区一致。多时区站点不能只按浏览器时区或固定 UTC+8 计算。经营期间、告警累计日、趋势比较窗是三个独立概念。

文档中的 API Permissions 是“可调用的 App 类型”，不是当前 App 已获准的证明：

| 接口组 | 页面列出的关键适用 App 类型 | 对项目影响 |
|---|---|---|
| O1 / O2 | ERP、Seller In House、Order Management 等；O2 还列 Accounting And Finance | 能读订单不代表能读广告/退款；两页类型清单不完全相同 |
| R1 / R2 | ERP System、Seller In House System、Customer Service、Swam ERP | Ads Service 类型不在本轮退款页清单中 |
| P1—P6 | 主要为 ERP、Seller In House、Accounting And Finance；具体接口另列 PSP 等 | 本土钱包、跨境账单有店铺类型限制 |
| A1—A8 | Seller In House、Marketing、Ads Service、Ads Service App、Ads Facil | 通用 ERP 类型不在这些广告页清单中 |
| A9 / A10 | Seller In House、Ads Service、Ads Service App | 与 A1—A8 的清单也不完全相同 |
| M1—M4 | Affiliate Marketing Solution Management | 不能假定普通 ERP/广告 App 直接有 AMS 报表权限 |

一个 App 能否覆盖全部首版数据必须在开发者控制台和测试店实证。P1 的 AMS 费用是一个可用候选：即使 M1—M4 权限未取得，也可先验证订单结算佣金覆盖度，不把 AMS 专属报表强加成唯一取数方式。

## 8. 给 Gemini 的首版设计约束

以下是**本系统设计要求/建议，不是 Shopee 官方字段**。

1. **经营看板**：原始商品销售、取消、有效退款、净销售拆分；支持自然月/自选日期和同口径明细。毛额与净额字段需携带口径版本及来源，不能一律套 `total_amount−refund_amount`。
2. **退款明细**：保留申请状态、已确认生效金额、部分退款、多个退款申请、金额未核定状态。商品分摊无权限时，订单汇总仍可展示；不伪造 SKU 精确退款额。
3. **营销费用**：站内原始消耗与净实际支出分开；赠金未知显示待核定；Meta 未接入显示未接入。不能以 0 填空后给出完整费用率。
4. **广告列表/详情/规则**：显示店铺、活动 ID、对象类型、关联商品、在投状态、数据粒度及截至时间。区分平台投放预算/目标与本系统告警预算参考/目标；保存告警参数不应自动修改 Shopee 广告。
5. **默认继承**：无自定义配置自动使用统一底层逻辑，默认模式不用填三个参数；自定义规则采用“当天累计花费≥上限 AND 对应 ROAS<目标”。恢复默认应清除覆盖。每日预算参考的必填性不阻挡默认模式。
6. **规则能力**：1h 与 30m 原始需求保留；没有足够源数据时显示待验证/待启用原因。1h 的比较基数、零基数、低样本、跨午夜处理需明确定义；不在本文擅自改动用户的规则。
7. **飞书与处置**：默认飞书；短信仅备选。告警保存规则版本、对象、来源时间窗、源数据快照引用及投递状态。模拟成功不能显示为真实送达。
8. **后台采集**：分页、时间切片、增量重叠回补、限流/失败重试、去重与重新结算更新由后端承担。页面不要求运营手选 API。
9. **能力模型**：按店铺和广告类型记录支持/不支持/未验证；“未验证”不等于“不可能”。源时间、抓取时间、最后成功时间分别保存，不能用抓取时间伪装数据新鲜。
10. **范围**：继续隐藏规划菜单；这些数据能力校验作为首版上线依赖，不扩展成全套 ERP。

## 9. 下一步最小验证清单（真实 API/业务样本尚未执行）

| 顺序 | 使用样本 / 操作 | 通过标准 |
|---|---|---|
| 1 | 核对当前 App 类型、订单/退款/Payment/Ads/AMS 权限与目标店铺 Local/CB/SIP | 每条来源有真实权限结果，不只看文档 App 类型 |
| 2 | 正常、未支付取消、已付取消、COD、部分取消、套餐、多数量、部分退款、完结后退款订单各取样 | 买家支付、商品净额、取消、退款、结算差异可解释；没有优惠分摊或重复扣减错误 |
| 3 | 一个自然月与跨月退款样本 | 确认按原订单归属月重算还是按退款发生月扣减；不能把两种报表混在一起 |
| 4 | 一个 ongoing 商品广告＋一个暂停/结束广告，连续采样小时表现 | 状态正确；expense/GMV 与卖家中心可核对；确认小时内更新、延迟、时区和回补，决定 30m 是否可启用 |
| 5 | 一个 Shop GMV Max 店铺 | 验证活动发现/在投状态/设置读取、活动与商品表现范围，以及是否有可靠小时取数路径 |
| 6 | 有免费额度、ROI 保障回扣、充值和费用退款的账户样本 | 拿到可区分赠金发放、实际使用、过期、回扣和现金消耗的来源；与端端统一口径，不能“充值减返点”直接代替花费 |
| 7 | 开通虾皮托管 Meta 的店铺账单/官方接口确认 | 确认具体产品、endpoint、费用类型/标识、日期、币种、退款及与站内费用是否重叠 |
| 8 | 一笔已核验/已扣佣金和一笔退款佣金 | P1 与 M1/M2/M3 或钱包能够解释差异；确定服务费、税、AMS额度及冲回口径，只入账一次 |

以上验证通过前，Gemini 可以搭建页面、能力提示、缺数据状态与可替换数据层；不能把未验证数据、时效或费用口径写成已上线承诺。

## 10. 官方来源索引

O1—G3 为初次核对的紫鸟文档；A11、G4—G7、B1—B3 为 10 月 16 日补充核查来源。A5 与 O2 的正文也已核对；不是仅从侧栏看到接口名。

[O1]: https://open.shopee.com/documents/v2/v2.order.get_order_list?module=94&type=1
[O2]: https://open.shopee.com/documents/v2/v2.order.get_order_detail?module=94&type=1
[O3]: https://open.shopee.com/documents/v2/v2.order.get_estimate_cancel_value?module=94&type=1
[R1]: https://open.shopee.com/documents/v2/v2.returns.get_return_list?module=94&type=1
[R2]: https://open.shopee.com/documents/v2/v2.returns.get_return_detail?module=94&type=1
[P1]: https://open.shopee.com/documents/v2/v2.payment.get_escrow_detail?module=94&type=1
[P2]: https://open.shopee.com/documents/v2/v2.payment.get_wallet_transaction_list?module=94&type=1
[P3]: https://open.shopee.com/documents/v2/v2.payment.get_billing_transaction_info?module=94&type=1
[P4]: https://open.shopee.com/documents/v2/v2.payment.get_escrow_list?module=94&type=1
[P5]: https://open.shopee.com/documents/v2/v2.payment.get_income_overview?module=94&type=1
[P6]: https://open.shopee.com/documents/v2/v2.payment.get_income_detail?module=94&type=1
[A1]: https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_id_list?module=117&type=1
[A2]: https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_setting_info?module=117&type=1
[A3]: https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_hourly_performance?module=117&type=1
[A4]: https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_daily_performance?module=117&type=1
[A5]: https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_hourly_performance?module=117&type=1
[A6]: https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_daily_performance?module=117&type=1
[A7]: https://open.shopee.com/documents/v2/v2.ads.get_total_balance?module=117&type=1
[A8]: https://open.shopee.com/documents/v2/v2.ads.get_shop_toggle_info?module=117&type=1
[A9]: https://open.shopee.com/documents/v2/v2.ads.get_gms_campaign_performance?module=117&type=1
[A10]: https://open.shopee.com/documents/v2/v2.ads.get_gms_item_performance?module=117&type=1
[M1]: https://open.shopee.com/documents/v2/v2.ams.get_conversion_report?module=94&type=1
[M2]: https://open.shopee.com/documents/v2/v2.ams.get_validation_list?module=94&type=1
[M3]: https://open.shopee.com/documents/v2/v2.ams.get_validation_report?module=94&type=1
[M4]: https://open.shopee.com/documents/v2/v2.ams.get_performance_data_update_time?module=94&type=1
[S1]: https://open.shopee.com/documents/v2/v2.shop.get_shop_info?module=94&type=1
[G1]: https://open.shopee.cn/developer-guide/229
[G2]: https://open.shopee.cn/developer-guide/227
[G3]: https://open.shopee.cn/developer-guide/277


## 11. 补充核查：缺口的数据来源与最终判断（2026-10-16）

**直接接口核查结论：两项核心需求均有主要数据基础，但“全部由现有开放 API 自动、完整、及时满足”尚未成立。此结论不等于业务不可实现；用户随后明确允许跨接口计算、快照与其他数据源组合，结果导向的补充判断见第 12 节。** 本节将“找到官方数据源”与“字段足够”“能自动取数”“已实测”分开；后台有页面不能冒充已有 OpenAPI。第 1 节仍有效，本节细化缺口，不将缺口视为用户同意删减需求。

### 11.1 站内赠金与 ROAS 保护回扣：已确认后台来源，自动化未闭合

菲律宾官方[ROAS 保护说明][G4]及[赠金说明][G5]确认：回扣以 1:1 免费广告额度发放，通常次周到账；这种额度必须配同额付费额度使用。存在发放、使用及有效期三个不同概念，不能直接用当期到账回扣抵减当期消耗。不同站点、时期的规则须分别核对。

本次只读查看了当前店铺[广告账户][B1]及两个交易子页：

| 实际来源 | 本次确认的页面列名 / 含义 | 对功能的支持与边界 |
|---|---|---|
| 我的账户 → 账户余额 | 总广告余额、充值余额、免费广告额度；按适用广告类型拆分“一般 / 1:1 使用” | 可看余额组成，**这些是余额，不能当历史已用赠金** |
| 我的账户 → 交易明细 → 交易明细 | 交易日期（筛选器显示 GMT+8）、交易类型、金额、备注；有“导出数据”按钮 | 已确认官方台账及导出入口；当前日期范围为空，未取得明细样本或导出文件，不保证文件列名、现金/赠金分摊和历史覆盖完整 |
| 我的账户 → 交易明细 → 免费广告额度 | 金额、有效期、适用广告类型、使用类型、收到日期、来自 | 已确认额度明细页面；当前无数据行，尚不能确定金额代表发放、剩余还是已使用，也未确认逐日实际使用金额 |
| 官方帮助中的 Free Ads Credits History | 说明可从 My Account 查看使用记录；Consumption Type 区分额度消耗类型 | 证明官方有使用历史来源；尚缺目标账户有数据样本，与当前中文页面及导出文件的对应关系仍需核对 |
| `GET /ads/get_total_balance` | `response.total_balance`、`data_timestamp` | 只有付费与免费合计余额，不能补足现金消耗拆分 |

**设计计算候选（须对账后启用）：** 同一账户、币种、广告范围及消耗期间的现金承担消耗 = 总广告消耗 − 该期间实际使用的免费额度，再按源记录处理消耗冲正/退款。后续发放回扣保留独立台账，在实际使用期间抵减；若业务需要按获赔所属周追溯，另定义该口径，不能与现金消耗混在一个指标中。

要关闭此缺口，需要一份同时覆盖付费、普通赠金、1:1 赠金、ROAS 回扣及有效期变化的真实台账/导出样本，确认日期、消耗类型、实际使用额、币种、来源/唯一键，以及可持续取数方式。**目前只确认后台来源，不承诺已支持自动导入，也不新增未经确认的导入功能范围。**

### 11.2 虾皮托管 Meta 花费：产品和官方报表来源已确认，开放 API 未确认

当前店铺[站外流量广告][B2]显示“卖家中心 Meta 广告”，但停在服务开通页；本次未点击“开始使用”。页面“更多”链接指向官方对外资料，再由其中链接进入[菲律宾 Meta 操作指南（2026 年 10 月版）][G6]。这是从真实官方后台追到的原始资料，不以第三方转载作依据。

指南第 11、32、44、46 页确认：Seller Centre Meta 与自有 Meta Ads Manager 是不同管理路径；Meta 使用独立广告额度，交易历史只含 Meta；按前一日消耗每日扣款，报告每日刷新。小时拆分仅明确覆盖曝光、点击、CTR，不能据此承诺小时花费或 ROAS。

| 核对问题 | 结论 |
|---|---|
| 这笔费用是否真实存在、有官方来源？ | 已确认：站外 Meta 效果报告、独立 Meta 钱包和交易历史 |
| 能否复用站内 CPC `expense` 当 Meta 花费？ | 不能这样映射；两者账户/报告分开，且站内接口未定义 Meta 专属字段 |
| 钱包交易 450 / 451 是否已证明是 Meta 消耗/回扣？ | 未证明。不得据名称直接归类；充值、扣款和广告消耗日期也须分开 |
| 是否已经找到 Meta 专属 OpenAPI endpoint 和响应字段？ | 没有。在本次 Ads 目录、Payment 文档及官方资料查证范围内未确认；不等于断言平台绝无定向/白名单接口 |
| 能否直接改接用户自己的 Meta Marketing API？ | 不能假定可行；指南区分两条账户路径，没有证据表明卖家拥有托管账户的 API 权限 |
| 还有什么阻碍字段核对？ | 当前店铺未完成开通，无法进入实际 Meta 报告/钱包；指南未提供足以实现导入的完整列结构，尚缺有数据店铺的报表/账单样本及官方开放能力说明 |

**Meta 经营统计只需要日/月费用，不需要随站内广告做分钟预警。** 日刷本身不阻挡这部分统计，但应显示统计截至日；仍需核对费用日期、币种、活动/店铺标识、实际消耗、赠金/退款与重复扣款，不能把前一日消耗的次日扣款归错月份。以上是本项目需要验证的字段含义，**不是声称平台已返回这些字段名**。

### 11.3 30 分钟 / 1 小时预警：明确有小时数据，分钟承诺不足

二次完整读取了 [A3]。请求仍为 `performance_date`、`campaign_id_list`；响应为 `response[].campaign_list[].metrics_list[]` 中的 `date,hour,expense,broad_gmv,direct_gmv,broad_roi,direct_roi`。正文未定义分钟、秒级事件、指标更新时间或最大延迟。`request_id` 只用于请求追踪。

另已在紫鸟读取[官方广告 API 发布公告（2024-04-29）][G7]，公告确实称店铺级 CPC 概览为实时数据。**因此不能说所有广告数据都只能次日更新；也不能由店铺级“实时”推导单活动每 30 分钟数据可靠。** 该公告没有为单活动指标给出刷新周期/SLA。

- 当天累计规则：商品广告有可用字段基础；上线前仍需确认当天持续更新、时区和后台对账。
- 相邻完整小时比较：有小时桶基础；这与“任意滚动 60 分钟”不同，比较基数尚须按业务规则定义。
- 30 分钟 ROAS 下降：目前**未满足可承诺上线的证据要求**。若后续验证源数据在小时内连续更新，可研究快照；但历史归因回补会修改 GMV，累计值相减不自动等于该 30 分钟真实转化。
- 当前店铺广告页提示余额耗尽、广告中断，不能作为有表现的在投活动连续采样样本。增加轮询频率或看到页面写“实时”不能替代这个验证。

### 11.4 Shop GMV Max：可尝试发现 ID，尚缺完整状态与小时链路

二次确认 [A9] 的 `campaign_id` 为非必填，返回 `response.campaign_id` 和 `report.expense,broad_gmv,broad_roi` 等区间表现。因此，可用“不带 ID 查询”作为已有 GMS 活动 ID 的发现候选，不能笼统称完全没有发现路径；但尚未实测无活动、暂停、重建/历史活动的返回语义。

本次 [A1] 列表只明确定义 `auto/manual`，未明确覆盖 Shop GMV Max。A9 响应不含 `campaign_status`、预算、目标或 `hour`。即使拿到 ID，也尚未证明可将它传给 [A2]/[A3] 获得完整状态和小时表现。

A9 还有文档冲突：请求表写最大 3 个月、示例起止同日，错误表却写最大 1 个月、同日起止报错并提示改用 hourly API；该通用提示**没有指定 GMS 小时接口**，不能将它当作已经支持的证据。

当前后台“商店全站推广”显示创建引导，无法提供已存在 GMS 活动样本。要完整覆盖“只监控在投广告”，还缺 GMS ID→当前状态→设置→当天/小时表现的实际闭环；不能只根据区间 report 有消耗就推断现在仍在投。

### 11.5 排除的候选与两项首版功能验收

新增核对 [A11] `GET /api/v2/ads/get_ads_facil_shop_rate`（页面标题带重音拼为 `get_ads_fácil_shop_rate`，实际请求路径为 ASCII）。它只返回 `rate` float、`update_at` int64，权限为 Ads Service / Ads Service App / Ads Facil，**不是 Meta 消耗、赠金使用或活动分钟表现接口**。SDK 中若写 POST，不能优先于实际官方正文 GET。

| 首版验收项 | 本轮状态 | 尚缺什么 |
|---|---|---|
| 店铺销售、取消、退款、净额统计 | 主要源字段已满足；准确净额未验收 | 第 9 节订单样本、已生效退款语义及跨月口径对账 |
| 站内总广告消耗 | 源字段已满足 | App 权限、目标广告类型覆盖和金额对账 |
| 排除赠金/回扣后的站内现金消耗 | 官方后台来源已定位；未满足完整自动取数 | 使用额台账/导出样本、现金分摊、持续取数路径 |
| Meta 日/月费用 | 官方产品/日报/钱包已确认；未满足接口字段映射 | 已开通店铺的报表字段及可持续取数方式；开放能力确认 |
| 达人/联盟佣金 | 主要源字段已满足；实际支出未验收 | 核验/实扣/退款冲回、单位、税服务费及来源去重 |
| 三费合计与实际销售费用率 | 尚未完整满足 | 上述必要来源全部齐全且同期间/币种/口径 |
| 商品广告仅在投、当天累计自定义 AND 规则 | 文档数据基础已满足；未实测 | 状态和当前日表现更新、规则计算与通知闭环 |
| 统一默认 1h/30m 异常规则 | 尚未完整满足 | 1h 比较算法；单活动分钟数据/更新延迟验证 |
| Shop GMV Max 纳入所有在投广告监控 | 尚未完整满足 | 当前状态、设置、小时粒度及覆盖验证 |
| 默认无需填写、自定义覆盖、飞书优先 | 本系统可以实现，不依赖 Shopee 提供配置字段 | 实际开发和投递验收；短信维持备选 |

**实施结论：可以据此启动 V1 前端底座，但不能以“所有 API 已验证通过”为前提写死功能。** 经营统计和预警都保留完整目标；未验证数据展示缺口及截至时间，必要来源不齐时不输出精确总费用率，未通过粒度/时效验证的规则不标成已启用。不将后台页面发现自动升级为已确定的抓取方案。

[A11]: https://open.shopee.com/documents/v2/v2.ads.get_ads_facil_shop_rate?module=117&type=1
[G4]: https://ads.shopee.ph/learn/faq/58/2069
[G5]: https://ads.shopee.ph/learn/faq/577/2097
[G6]: https://docs.google.com/presentation/d/1THw0J7gBdMCiNrWH_DCZ_J6b3KQwQyrrOJdcyBqbALw/edit
[G7]: https://open.shopee.com/announcements/893
[B1]: https://seller.shopee.ph/portal/marketing/pas/wallet
[B2]: https://seller.shopee.ph/portal/web-shopping-ads/dashboard
[B3]: https://docs.google.com/presentation/d/13zXmXBFTuZNHzilCLDtcxXkfPljhFs00L32TrpjuL9c/edit


## 12. 按业务结果重新评估：公式、跨源组合与快照（2026-10-16）

用户明确：只要能得到所需业务结果，可以由多个字段计算或组合其他来源，不要求存在同名接口/字段。因此，第 11 节“未确认直接 API”的项目，不应直接归类为“业务未满足”。下面是基于已核对源数据的**设计推导**，不是新增的官方能力声明，也不是已经完成的真实取数验证。

### 12.1 重新判定原则

依次判断：直接取数 → 跨字段/跨接口等价计算 → 定时快照推导 → 后台账单/报表补充。分别标注计算结果、前提、可接受误差及证据。能够严格算出的采用计算；只能得到近似值的标成估算，不把估算混入准确费用。

### 12.2 30 分钟 ROAS 下降：比较两个时点，不必先要求分钟明细

会议文字“ROI 半小时内下降超 30%”存在两种解释，原文未明确要求区间独立 ROAS。本次建议先用第一种作为规则设计候选，待方向确认后固定；不擅自替换业务定义。

| 规则含义 | 计算方式 | 重新判断 |
|---|---|---|
| 当前当天累计 ROAS 比半小时前下降 | `R(t)=当天累计归因 GMV(t)/当天累计花费(t)`；`下降比例=(R(t−30m)−R(t))/R(t−30m)` | **可通过定时快照计算，不需要分钟桶。** 需实测当天数据是否在 30 分钟内有足够更新；跨午夜不直接比较，零花费/零基准单独处理 |
| 最近 30 分钟投放的独立 ROAS 比上一段下降 | 需取得两个区间各自的消耗及相同归因口径的 GMV；不能无条件将两次累计 GMV 相减当作区间新投放产出 | 暂不能保证准确；历史点击的迟到订单/回补可能进入差值，须验证源事件语义 |

例：半小时前当天累计 GMV=8,000、花费=1,000，ROAS=8；当前累计 GMV=9,000、花费=1,800，ROAS=5，下降 37.5%。这个计算足以表达“运营看到的累计广告回报在半小时内明显下滑”，不需要还原每一分钟。数字仅为公式示例。

建议按可用限流及源更新情况设置采样周期，并保存来源、统计日期、抓取时间及累计 GMV/花费。比较同一活动、同一天、同归因口径的快照；实际间隔与数据新鲜度不达标时，不冒充严格的 30 分钟判断。聚合 ROAS 用总 GMV/总花费重算，不平均各小时 ROAS。

**修正第 11 节判断：30 分钟预警已有可实现的快照方案；未关闭的依赖是规则语义和源更新时效，不是一定缺少分钟接口。**

1 小时花费同样可以对累计花费做快照差分：`W(t)=C(t)−C(t−60m)`。若比较相邻两个 60 分钟窗口，则增长比例为 `(W(t)−W(t−60m))/W(t−60m)`，需至少覆盖 120 分钟的记录。若业务指累计花费相对一小时前的增长，则计算 `(C(t)−C(t−60m))/C(t−60m)`；两种触发行为不同，不能混用。跨日需要拼接各日累计，源数据修正导致负差值时应复核。

### 12.3 剔除赠金后的广告费：可用余额守恒反推

同一账户、币种、期间与广告范围内，设：`F0/F1` 为期初/期末免费余额，`G` 为期间赠金发放，`J` 为除发放/消费/失效/撤回外的其他净增加（有正负号），`X` 为失效额度，`V` 为撤回额度：

`实际使用赠金 U = F0 + G + J − X − V − F1`

`现金承担广告消耗候选 = 同期间总广告消耗 E − U`

例如期初赠金 100、期间发放 50、到期失效 20、期末剩余 30，其他变动为 0，则使用赠金 100；若总消耗 300，现金承担候选为 200。不能把赠金余额净减少 70 或发放额 50 当作已使用额。数字仅为公式示例。

另一条独立校验路径：设付费余额为 `P0/P1`，充值为 `T`，消费退回付费余额为 `R`，其他净增加为 `K`，提现/退回支付渠道等非消费减少为 `W`，失效/撤回等非消费减少为 `L`：

`付费额度消费扣减 D = P0 + T + R + K − W − L − P1`

消费退款在费用口径中另行冲减，并核对所属期；充值退款不能当作广告消费退款。若使用退款后净额，必须确保总消耗与赠金使用也采用相同净额口径。

**重新判断：不存在“实际使用赠金”直接字段，也可能精确算出结果。** 当前后台已确认有付费/免费余额和额度/交易页面；仍需验证这些来源能否覆盖完整增减事件、历史起止余额和所需日期精度。仅有 `total_balance` 一个合计数则无法唯一分离现金和赠金；不能一律按总花费的一半算，账户可能混用普通赠金、1:1 赠金和付费额度。

### 12.4 Meta 日/月花费：独立钱包、日报或交易组合均可

优先取后台日报中实际消耗；如果只有独立钱包的余额、充值及交易，可沿用余额守恒求消费扣减，并剔除赠金、退款及非消费调整。若交易已明确标识为按前一天消耗的扣款，可以按其实际消费归属日期汇总，不必要求它来自 Meta 专属开放接口。不能把所有交易日期机械减一天：充值、退款、延迟/补扣需按类型和源记录分别处理。

**重新判断：缺 Meta OpenAPI 不阻挡设计业务实现路径。** 已找到独立钱包、交易历史和日报的官方来源；报表导入或页面只读采集均可作为接入候选。当前店铺未开通，尚缺实际列结构与样本，无法确认公式输入齐全。是否需要自动采集、是否接受首版报表导入，是交付方式选择；本节不默认将人工导入当作已满足全自动统计。

### 12.5 Shop GMV Max：区间累计也可尝试快照，不强制小时接口

[A9] 可不传 ID 获得活动 ID 和区间 report。可验证固定开始日、结束日随当前日期的累计查询是否在日内更新，然后保存 `expense`、`broad_gmv` 快照，计算累计 ROAS 的变化及花费差分。该方案也可能满足风险提醒，无需预先存在 GMS 小时接口。

前提仍是：区间参数实际可用、返回当前活动、日内数据有足够更新，以及能从设置接口或后台读取当前状态。历史区间持续有消耗数值，不能证明当前正在投；最近一段时间没消耗，也不能证明暂停。用近期消耗筛选“有消耗活动”只能作为近似筛选，不能等价替代“只监控在投”。

### 12.6 业务实现可行性修订

| 核心目标 | 可行方案 | 当前应如何标记 |
|---|---|---|
| 剔除取消/退款后的销售额 | 订单状态＋退款＋最终结算组合；最终净额已含退款时不再重复减 | 有实现路径，待样本对账确认净额口径 |
| 站内现金广告费 | 总消耗−实际使用赠金；赠金使用可由余额守恒反推，付费余额作交叉核对 | 有计算路径，待确认完整余额变动输入 |
| Meta 费用 | 日报消耗；或独立钱包/消费交易反推；报表或页面可补开放 API | 有替代来源路径，待有数据账户验证字段及接入方式 |
| 30 分钟 ROAS 下滑 | 同一活动当天累计 ROAS 的时点快照比较 | 有计算方案，待确认规则解释与源更新时效 |
| 1 小时消耗增长 | 小时桶或累计快照差分，再按选定基准比较 | 有计算方案，待确定比较口径并验证时效 |
| Shop GMV Max 风险监控 | 区间表现快照＋设置/后台状态组合 | 有候选方案，待验证当前状态和日内更新 |
| 三费合计及费用率 | 上述费用同口径合计，再除以净销售额 | 计算本身可做；输入齐全和准确性仍须验证 |

**本轮方向：从“找直接字段”改为“证明公式输入齐全、结果符合运营目标”。** 后续验证优先用一个有实际消耗、赠金和退款记录的店铺走通组合计算；只有公式输入仍不足或时效确实达不到时，才认定对应业务需求尚无法满足。当前不应将这些项目笼统写成“不支持”，也不能把候选方案提前标成“已实测满足”。


## 13. 无真实账号验证：已执行结果（2026-10-16）

已执行文档/沙箱前置条件核查，以及参考计算脚本的 51 项构造数据检查（其中含 500 组生成流水的余额守恒实验），全部通过。覆盖赠金/付费余额反推、退款去重、累计 ROAS 快照、预警阈值与 AND 条件、快照可比性、十进制金额和缺数据边界。

**这些是参考公式与约束实验，不是现有产品实现测试，不是真实/沙箱接口调用，不证明源更新时效。** 赠金反推必须有完整余额变动，只有 total_balance 不能唯一拆出现金消耗；累计 ROAS 快照与区间独立 ROAS 的差异已用反例验证。

[官方沙箱指南](https://open.shopee.com/developer-guide/644)确认需要测试 App/账号与授权，支持表列出订单等核心模块；未列出 Ads/AMS/Payment/Returns，不能据此宣称这些模块已经支持沙箱。本次没有创建测试账号或调用沙箱。

逐项结果、实验依据、能先确定的设计边界及剩余真实数据验证见[无账号验证报告](shopee-v1-offline-validation.md)，可重跑脚本见[计算检查](verification/shopee_offline_checks.py)，原始结果见[JSON](verification/shopee-offline-results.json)。
