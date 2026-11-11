# 全原型功能与 Shopee 接口逐项核对

> 当前实测状态以[66项验证状态与外部限制](shopee-full-verification-status-20261027.md)为准。已完成独立沙箱授权、非空订单、取消前后、待结算收入、跨页游标及授权店铺发现补测，并取得Meta历史非零页面样本。下文“未进行授权/API请求”等描述仅对应最初文档核对时点，不再代表当前任务状态。当前ERP App类型不在广告接口允许列表中，不能仅靠上线此App承诺全域接入。

核对日期：2026-10-27。对象：`apps/web/public/interactive-preview.html` 当前版本，17 个业务路由（包含隐藏页）、登录及公共查询操作。只读核查官方文档与本地源码；未进行店铺授权、API 业务请求、广告修改或消息发送。本文是功能与数据依赖审查，不是接口联调通过报告。

本次共拆分 **66 个功能/操作项**，逐页读取 **40 个相关接口正文**。授权采用现行指南补查，不沿用旧文档中未核对的假设。

## 阅读结论

**不能宣布全部功能已具备完整、可自动化的数据来源。** 店铺授权、订单/退款读取、普通商品广告状态与表现都有明确的官方能力；净销售额等可组合计算。告警规则、认领处置、权限、导出等由本系统实现。仍有费用来源、GMV Max 覆盖、源更新时效、历史事件与商品退款分摊等条件待关闭。

本表区分四种结论：

- **直接**：官方定义了主要输入字段，仍须验证目标 App 权限与店铺实际返回。
- **组合**：多个接口或本地计算可实现，表内列出输入和限制；不要求官方恰好提供同名结果字段。
- **系统**：属于本系统功能，不需要 Shopee 提供同名接口，但依赖自有后端。
- **有缺口**：存在候选路径，但目前证据不足以保证结果、范围或时效。不是断言永远做不了。

“接口文档可用”不等于“当前原型已接入”。原型仍用生成样本、localStorage、模拟授权和通知；正式前后端均须实现。字段名以官方文档为准；本文的本系统字段属于设计建议。

## 1. 店铺列表与授权 `/channels/shops`

| 编号 | 功能/页面字段 | 接口与关键输入字段 | 怎么实现及结论 | 缺项/前端调整 |
|---|---|---|---|---|
| AUTH-01 | 连接新店铺 | [授权指南][AUTH]：`/auth`；`partner_id,auth_type=seller,redirect_uri,response_type=code,state` | **直接＋系统**：后端生成授权链接，卖家在 Shopee 登录确认，回调换 token | 当前手填店名、站点就模拟成功，必须替换为跳转→等待→成功/拒绝/超时/失败；不能将“保存店铺”当授权完成 |
| AUTH-02 | 授权回调 | [T1] `POST /auth/token/get`：`code,partner_id,shop_id` 或 `main_account_id`；返回 `shop_id_list,merchant_id_list,access_token,refresh_token,expire_in` | **直接**：一次性 code 换初始凭据，支持主账号一次授权多个店铺 | code 10 分钟且一次有效；回调校验 state 并绑定当前公司/用户；以返回的真实 ID 建档，不生成随机外部 ID |
| AUTH-03 | 多店发现/补齐 | [T3] `GET /public/get_shops_by_partner`：`page_no,page_size`；`authed_shop_list[].shop_id,region,auth_time,expire_time,more`；[S3] 商家下店铺列表 | **直接＋系统**：分页枚举当前 Partner 已获授权的店铺，再匹配租户与权限 | 不能把 Partner 全部店铺向任意用户展示；SIP 字段表与示例名称存在差异，保留原始数据待联调 |
| AUTH-04 | 店名/站点/店铺类型 | [S1] `GET /shop/get_shop_info`：`shop_name,region,status,is_cb,is_sip,merchant_id`；[S2] `get_profile`：`response.shop_name,shop_logo,description` | **直接**：读取元数据；Local/CB/SIP 决定后续来源选择 | 店铺 `status=NORMAL/BANNED/FROZEN` 与授权状态分开 |
| AUTH-05 | 授权到期提示 | [S1]/[T3] `auth_time,expire_time` | **直接＋系统**：以授权截止时间计算剩余天数；指南允许最长 365 天，卖家可自行选择 | 不能固定授权 30 天；替换原型 `tokenExpiresInDays` 的混合语义 |
| AUTH-06 | access token 自动续期 | [T2] `POST /auth/access_token/get`：`refresh_token,partner_id,shop_id` 或 `merchant_id`；返回新的两种 token 与 `expire_in` | **直接＋系统**：后端提前续期、原子替换新凭据，shop/merchant 各自维护 | access token 通常 4 小时，refresh token 30 天且轮换；不需要运营每 4 小时手工授权；刷新并发锁与失败恢复由后端实现 |
| AUTH-07 | 重新授权 | [AUTH]＋[T1]＋[S1] | **直接＋系统**：重新走授权回调，更新同一真实 shop_id 记录与凭据 | 覆盖前验证同公司关联；用户拒绝或回调失败不能显示成功；保留历史数据与规则 |
| AUTH-08 | 授权撤销/过期检测 | [U1] `get_app_push_config` 的推送类型 1 授权、2 撤销、12 到期；[T2] `shop_access_expired,shop_no_linked,refresh_token_expired,shop_banned` 等错误；[S1] 到期时间 | **组合**：推送＋定期核验＋请求错误归类；停采并显示业务影响 | token 刷新失败不一律等于卖家撤销；当前“模拟过期”只用于演示，生产去除 |
| AUTH-09 | 取消授权（生命周期核对，当前无按钮） | [AUTH] 最新 `/cancel_auth` 链接或卖家中心取消 | **官方有流程**：卖家确认后解除，接收撤销事件 | 不把本地“断开连接”冒充官方撤权；本轮仅核对，不新增取消授权按钮 |
| AUTH-10 | 币种/统计时区 | 订单 [O2] `currency,region`，商品规格 [PR2] `price_info[].currency`，结算 [P1]；[S1] 本轮未发现通用币种/IANA 时区字段 | **组合＋系统**：币种取业务数据并按站点校验；IANA 时区作为店铺配置 | 新店不能一律 `UTC+8`；泰国应使用匹配当地规则的时区；没有订单的新店可先采用经确认的站点配置并标注来源 |
| AUTH-11 | 负责人/最近同步/权限 | 本系统成员表、授权记录、采集任务表 | **系统**：owner 由组织分配；lastSyncAt 来自成功采集记录 | Shopee 不知道本公司运营负责人；“已授权”不等于“数据已同步” |

**授权指南新旧差异**：2026-07-24 更新的官方指南主推 `https://open.shopee.com/auth`，使用 `redirect_uri` 和可选 `state`；同页仍有 `/api/v2/shop/auth_partner` 的旧示例。新工程优先依现行参数表实现，不能将旧 `redirect`、签名示例与新链接参数混拼。正式回调域名须与 Console 配置一致。换 token 示例里 `expire_in` 曾出现像时间戳的样例，但字段定义为有效秒数，刷新接口示例为 14400；须依据真实返回校验，不能把可疑样例直接写死。

## 2. 驾驶舱、销售额、订单与退款

| 编号 | 功能/所在页面 | 接口/关键字段 | 实现与结论 | 缺项/设计边界 |
|---|---|---|---|---|
| SALE-01 | 驾驶舱原始销售额 `/dashboard`；销售分析 `/analytics/sales` | [O1] `order_sn`；[O2] `total_amount,item_list[].model_original_price,model_discounted_price,model_quantity_purchased`；[P1] `order_original_price,order_discounted_price,order_selling_price,original_cost_of_goods_sold` | **组合**：订单列表→详情→必要时结算补价格，形成统一商品销售口径再汇总 | `total_amount` 含运费/优惠，不直接等于商品销售额；套餐折后价可能为 0；未付取消历史原始价可能不完整，要标注缺失 |
| SALE-02 | 取消金额、取消率 | [O2] `order_status,cancel_by,cancel_reason,buyer_cancel_reason,item_list[].cancelled_qty,cancel_requested_qty`；结算商品金额 [P1] | **组合，有条件**：区分申请/已取消与整单/部分取消，以同口径金额形成取消调整 | 无已确认通用历史取消金额字段；不可无条件用单价×取消量；预估取消接口是操作前估值，不是历史事实 |
| SALE-03 | 已确认退款、退款率 | [R1]/[R2] `return_sn,order_sn,refund_amount,currency,status,return_solution,return_refund_type,is_refund_amount_adjusted`；[P1] `return_order_sn_list,order_adjustment` | **组合，有条件**：退款申请去重、关联订单、用结算确认生效金额；仅退款也计入 | 申请不等于资金完成；`create_time/update_time` 不能当资金实际到账时间；有效状态映射需样本核对 |
| SALE-04 | 实际销售额、瀑布图、趋势 | SALE-01～03；[P1] `cost_of_goods_sold` 等最终金额作交叉核对 | **组合**：统一原始额−有效取消−有效退款；或已净额化结算字段直接作净额 | 不对已扣退款的最终净额再扣一次；月归属、运费和优惠政策须统一 |
| SALE-05 | 有效订单数 | [O1]/[O2] `order_sn,order_status,cod,pay_time` 与商品有效量 | **组合**：订单去重后按已确认有效定义计数 | COD 不能因无 pay_time 就一律剔除；未知状态保留；取消、部分取消、全退的计数口径需固定 |
| SALE-06 | 按店铺/站点对比、原币贡献表 | [S1] `region`＋上面订单及费用事实 | **组合＋系统**：以 shop_id、期间、币种聚合；店铺名称下钻沿用条件 | 商家下 SIP/Direct 店铺需处理身份关系，不能把同一交易重复统计 |
| SALE-07 | 自然月/上月/自选期间 | [O1] `time_range_field,time_from,time_to,cursor,more,next_cursor`；[R1] 创建/更新区间、分页 | **组合＋系统**：后端按接口窗口切片同步，再按本地完整事实聚合 | 订单 15 天是单次时间窗口，不是只支持 15 天月报；API 各自历史保留范围需实测/查权限，不承诺任意久远历史 |
| SALE-08 | 跨月退款、旧月份重算 | [O1] 按 update_time 增量；[R1] 按更新时间；[P1] `order_adjustment[].date,amount,adjustment_reason`；[P2]/[P3] 核对 | **组合**：变更落事实表，按选定归属规则重算历史指标 | 仅“近 7 日补数”不能覆盖所有更老订单的晚退；需要更新时间游标、重叠回补和旧单追踪 |
| SALE-09 | 订单列表 `/analytics/orders` | [O1]→[O2] `order_sn,order_status,create_time,update_time,item_list`；[R1]→[R2] | **直接＋组合**：本地联表与检索分页，订单关联多个退款申请 | order_sn 需连同 shop_id 定位；不能只同步 COMPLETED 或一页数据 |
| SALE-10 | 订单抽屉商品/规格/数量 | [O2] `item_id,model_id,item_sku,model_sku,item_name,model_quantity_purchased,model_discounted_price`；[PR1]/[PR2] 补当前商品元数据 | **直接＋系统**：展示交易时商品快照，以稳定 ID 关联内部 SKU | 内部 SKU 是本公司映射；当前商品售价不能回填成历史成交价；SKU 文本不是唯一主键 |
| SALE-11 | 抽屉商品级精确退款冲减 | [R2] `item[].refund_amount`、活动内退款字段；[P1] 商品结算 | **有缺口**：订单总退款有来源，商品精确退款字段仅 Partial Qty RR 白名单可用 | 无精确输入时展示订单级已确认额，商品行写“未提供精确分摊”；若按公式分摊，必须明确为估算，不能伪称平台实退 |
| SALE-12 | 状态与退款处理时间线 | [O2]/[R2] 创建、更新时间、状态、取消原因；[U1] 类型 3 订单变更、[U2]/[U3] 丢失推送 | **组合，有缺口**：接入后用推送＋快照差异记录本地观察事件 | API 当前详情不是完整历史状态日志；首次接入前的每次事件和精确处理时间未确认可回溯，需显示“首次采集/观察到变更” |
| SALE-13 | 原始采集 ID、数据来源追溯 | 公共 `request_id,error,message`＋本地 raw_record_id、采集时间、字段映射版本 | **系统＋直接**：保存接口响应引用与来源链 | rawRecordId 不是官方订单 ID；接口请求时间不等于业务发生时间 |
| SALE-14 | 卡片/图表切换、下钻、筛选 | 上述统一聚合结果；本系统路由 | **系统**：共用同一数据查询，切换不新增平台接口 | 下钻权限仍要后端校验；广告投手可看驾驶舱但无销售分析权限，目前名称下钻会遇权限页，需要允许销售只读或改走其可见明细 |

## 3. 营销费用 `/analytics/marketing-costs` 与驾驶舱费用卡片

| 编号 | 功能 | 对应接口/字段 | 实现与结论 | 仍缺什么 |
|---|---|---|---|---|
| COST-01 | 站内广告总消耗、日/月汇总 | [A5]/[A6] 店铺 CPC `expense,date`；[A3]/[A4] 活动 `metrics_list[].expense,date,hour`；[A9]/[A10] GMS `report.expense` | **直接＋组合**：按期间聚合，店铺汇总与活动明细交叉核对 | 明确 CPC/GMS 与按成交收费 `pay_per_sale` 的覆盖和重叠，不能把两个聚合口径直接相加 |
| COST-02 | 赠金到账额 | [A7] 仅 `total_balance,data_timestamp`；[P2] 钱包交易、[P1] 结算仅作候选核对 | **有缺口**：现有已读 OpenAPI 没有确认可完整识别广告赠金发放、失效、撤回明细 | 已查 Ads/Payment 目录；官方帮助确认 My Account 下有使用历史及 Consumption Type，尚未映射为 OpenAPI；不能由总余额反推出赠金到账 |
| COST-03 | 当期实际使用赠金 | 需免费余额 F0/F1、发放 G、其他调整 J、失效 X、撤回 V；总消耗 E | **组合候选，有缺口**：`U=F0+G+J−X−V−F1` | [A7] 未拆付费/免费余额；[P2] 是卖家钱包，不自动等于完整广告额度台账；须拿齐公式输入，到账额不能替代使用额 |
| COST-04 | 现金承担广告费 | COST-01/03；付费余额变动作为交叉核对 | **组合候选，有缺口**：`现金广告费=E−U`，退款口径一致 | 只有总余额、充值或总消耗时无法唯一求解；不把缺失赠金按 0 算 |
| COST-05 | Shopee 代投 Meta 费用 | [P2] `transaction_type,amount,money_flow,status,create_time,reason`；[P3] `cost_header,scenario,remark,amount,currency`；官方 Meta 日报/独立钱包作为替代来源 | **有缺口**：本轮官方目录未找到已确认 Meta 消耗专用 OpenAPI；日报或完整独立钱包可补 | Paid Ads 扣款类型不等于 Meta；报表文件 API 是否含此项尚无文件样本。不能把 Meta 自有广告账户 API 当成虾皮代投账户已开放 |
| COST-06 | 达人/联盟佣金（订单入口） | [P1] `order_income.order_ams_commission_fee,items[].ams_commission_fee` | **直接＋组合**：按订单取整单或商品佣金，选择一个层级去重 | `commission_fee` 是平台交易佣金；非达人佣金。结算发生前数值/覆盖需验证 |
| COST-07 | 佣金核验、扣款和账单 | [M1] `order_brand_commission,verified_status,items[].item_brand_commission,seller_service_fee`；请求可按 `deduction_status,deduction_method,ams_deduction_time_*` 筛选；[M2] `validation_id,validation_month,online_bill.*`；[M3] 明细 | **直接＋组合**：订单预估、核验、实际扣费分层对照；P1 是 AMS 权限拿不到时的候选 | AMS 专属 App 类型；税/服务费/AMS Credit/退款冲回需明确，M1/P1/M2 不能重复相加；请求过滤字段不假定都是响应字段 |
| COST-08 | 已知费用小计/完整合计/费用率 | 三类同口径费用＋SALE-04 | **系统＋组合**：来源齐才算完整合计与比率；未知则已知小计 | 分母 0/负数、不同币种、不同归属期间不能给普通精确百分比 |
| COST-09 | 币种折算 USD/CNY | 订单/退款 `currency`；[P1] SIP 汇率；[P7] payout `from_currency,payout_currency,exchange_rate` | **系统＋外部依赖缺口**：原币保留，采用经确认的会计/汇率来源折算 | payout FX 只用于该笔汇款，不是所有站点每日 USD/CNY 汇率；当前 FX_RATES 是固定样本，需要来源、日期和版本 |

## 4. 在投广告、详情与规则

| 编号 | 功能/页面 | 接口/关键字段 | 实现与结论 | 缺项/设计约束 |
|---|---|---|---|---|
| AD-01 | 发现广告活动 `/ads/active` | [A1] `campaign_list[].campaign_id,ad_type,has_next_page` | **直接**：分页发现 shop 下活动 | 活动 ID 与 shop_id 组合；原型 AD-PH-901 是样本 ID，不是官方 ID |
| AD-02 | 仅显示在投广告 | [A2] `campaign_list[].common_info.campaign_status` | **直接＋系统**：普通商品活动筛 `ongoing`，排除 paused/ended/deleted 等 | 列表本身 A1 不带状态；未知状态单独处理；广告明细健康状态不来自 Shopee 风险枚举 |
| AD-03 | 活动名称、关联商品、关联 SKU 数 | [A2] `common_info.ad_name,item_id_list`、`auto_product_ads_info[].item_id,product_name,status`；[PR1]/[PR2] 商品/规格 | **组合**：活动→平台 item→model/SKU 映射 | `item_id_list` 是商品，不是规格 SKU；前端宜显示“关联商品数”，不能把商品数直接叫 SKU 数 |
| AD-04 | 平台预算与平台目标 | [A2] `common_info.campaign_budget`、`auto_bidding_info.roas_target` | **直接，有语义条件**：读平台设置，0 预算表示不限额 | 字段描述仅 campaign budget，未充分保证每日预算；原型“每日预算(展示)”应改“平台预算”或本系统“每日预算参考”；与预警目标分开 |
| AD-05 | 当地当天累计花费/ROAS | [A3] `metrics_list[].date,hour,expense,broad_gmv,broad_roi`；[A4] 日表现 | **组合**：取当地当日，花费求和，ROAS=同归因总 GMV/总花费 | 活动字段 `broad_roi` 与店铺接口 `broad_roas` 名称不同；零花费不除零；不平均小时 ROAS |
| AD-06 | 小时消耗/回报趋势 `/ads/detail` | [A3] `hour,date,expense,broad_gmv,direct_gmv,broad_roi,direct_roi` | **直接＋系统**：保存时序并绘图，可区分 broad/direct | 字段存在不保证实时；迟到归因会回补，图表需允许重算与标记缺样 |
| AD-07 | 30 分钟 ROAS 下滑 | [A3]/[A4] 当日累计 GMV、expense＋本地定时快照 | **组合候选，有时效缺口**：`R(t)=GMV(t)/E(t)`，比较 `R(t)` 与 `R(t−30m)` | 不需要强求分钟桶，但源必须在窗口内更新。累计回报变化不等于“这 30 分钟新投放独立 ROAS”；实际源延迟待采样 |
| AD-08 | 1 小时消耗增长 | [A3] 小时桶，或累计快照差分 | **组合，有基准待定**：比较相邻完整小时；或两个滚动小时窗口 | 累计同比一小时前与两个区间环比不是同一规则；本轮不替用户定比较基准；零基准、跨午夜和负修正单独处理 |
| AD-09 | 默认规则无需填阈值 `/ads/rules` | AD-07/08 输入＋本系统规则表 | **系统＋组合**：无覆盖自动继承统一底层规则 | 默认规则运行依赖可比快照；当前仅草案、未运行，不能呈现“投放健康”作为已验证结论 |
| AD-10 | 自定义预算参考、花费上限、目标 ROAS；AND 触发 | AD-05＋本系统 `ruleMode,spendCap,targetRoas,budgetReference,version` | **系统**：当地当日花费≥上限且 ROAS<目标；保存、恢复默认、启停、版本均自建 | 保存提醒规则不调用 edit_ads，不修改平台预算；日累计次日重置、历史快照保留 |
| AD-11 | 按商品/规格配置规则 | [A2] 活动商品关系；[A10] GMS item 表现 | **有粒度缺口**：只有计划指标时只支持计划规则；有商品独立表现时再支持商品规则 | 多商品计划不能将整计划花费复制给每个 SKU；GMS item_id 也不是 model_id；规格级独立消耗尚未确认 |
| AD-12 | GMV Max 活动/商品表现 | [A9] `campaign_id,report.expense,broad_gmv,broad_roi`；[A10] `result_list[].item_id,report.*,total,has_next_page` | **直接区间表现＋组合快照候选**：固定起点重复查询可尝试日内快照 | 单次区间最长 3 个月、起点最早当前前 6 个月；指南区分 Item GMV Max 和 Shop GMV Max，不能把两者都归作未知；item 接口只返回有表现商品，无表现不等于未在投 |
| AD-13 | GMV Max 在投状态/完整覆盖 | [A9]/[A10] 不提供已确认状态；[A2] 范围能否覆盖目标 GMS 活动待验证 | **有缺口**：需官方明确状态查询路径或有权限的后台状态补充 | 区间历史有消耗不证明当前 ongoing；不能宣称普通商品活动接口已覆盖全部广告产品 |
| AD-14 | 广告余额/自动充值等连接参考 | [A7] `total_balance,data_timestamp`；[A8] `auto_top_up,campaign_surge,data_timestamp` | **直接**：仅供账户/开关诊断 | A8 没有“全店正在投放”通用开关，不可用其替代 campaign_status；A7 时间戳是余额快照时间，不能当表现源更新时间 |
| AD-15 | 风险状态/数据延迟标签 | 本地规则结果＋sourceTime/fetchedAt＋接口错误 | **系统**：记录判断依据、样本质量、规则版本 | 源没有更新时间时应标“采集时间/时效未验证”，不能以 HTTP 成功时间冒充源刚更新 |

## 5. 告警、通知、管理与公共功能

| 编号 | 原型功能/路由 | Shopee 依赖/字段 | 结论与要实现的自有接口 |
|---|---|---|---|
| SYS-01 | 预警待办 `/workbench/alerts`、历史 `/ads/alerts` | 广告状态与快照来自 AD-01～08；没有本项目 alert_id/风险等级字段 | **系统**：规则 Worker 生成事件、去重冷却，保存触发证据/规则版本；`GET /alert-events`；两页读同一事件库 |
| SYS-02 | 告警认领、处置备注、解决 | 无需 Shopee 写接口 | **系统**：认领/解决命令、处理人/时间、并发与权限校验、审计。关闭本系统告警不等于暂停广告 |
| SYS-03 | 通知配置 `/settings/notifications`、静默、冷却、按店铺/级别路由 | 无需 Shopee；依赖本地告警与飞书通知渠道 | **系统＋第三方**：配置/投递任务/重试。机器人请求成功只能证明渠道接受，不能冒充已读；原型“送达回执”需按渠道真实能力命名。首版飞书，短信备用不启用 |
| SYS-04 | 测试通知、发送结果 | 无需 Shopee；当前原型模拟函数没有网络调用 | **系统＋第三方**：正式后端测试发送及实际返回记录；本轮未发送；不将“演示通知结果”当测试通过 |
| SYS-05 | 平台接入配置与能力 `/channels/capabilities` | 接口权限、返回 error/message/request_id、字段支持情况 | **系统＋组合**：按 App/店铺/站点/数据域维护能力记录；一次 shop_info 成功不代表 Ads/AMS/Payment 都可用 |
| SYS-06 | 检测连接 | [S1] 与对应数据域的只读最小请求 | **组合＋系统**：分别记录授权、字段/权限、API 可达性，且说明空数据/无权限/失败的区别 | 
| SYS-07 | 同步任务 `/data/sync-jobs`、任务进度/成功失败数 | 各域分页与时间区间；公共 error/message/request_id | **系统**：任务队列、进度、游标、耗时、重试由自己的 Worker 记录，不是 Shopee 返回本项目 taskId |
| SYS-08 | 手动重试/补数、跨期退款重算 | [O1]/[R1] 更新时间、[P1]/[P3] 调整 | **组合＋系统**：异步 202＋taskId、幂等重放、分页切片、重新聚合；不能只刷新页面或无差别重算最近 7 天 |
| SYS-09 | 授权/订单推送和丢失消息恢复（后台依赖） | [U1] `callback_url,live_push_status,blocked_shop_id,push_config_on_list`；[U2] `push_message_list[].code,timestamp,data,has_next_page,last_message_id`；[U3] `last_message_id` | **直接＋系统**：真实处理落库后再确认消费；丢失消息仅近 3 天最早 100 条，持续读取/确认。超过窗口仍靠增量/回补，不能只依赖推送 |
| SYS-10 | 指标核对与差异 `/analytics/reconciliation` | [P1]/[P2]/[P3]、[P4]/[P6]/[P7] 及 [M2]/[M3]；新增 [P8]～[P11] 报表文件候选 | **组合**：系统值与同口径平台参考值比较；没有与 Seller Centre 所有面板完全一致的通用 GMV 接口。拿不到同口径文件时差异不能伪造精确对比 |
| SYS-11 | 复核签注/差异原因/审核状态 | 无需 Shopee 写接口 | **系统**：保存 reviewer/reason/status/版本/时间；原型复核不是平台确认 |
| SYS-12 | 指标字典与数据质量 `/data/metrics`、锁定/升版 | 无需 Shopee 直接接口；引用已核对字段与公式 | **系统**：口径版本、发布、重算影响、缺失标记。默认趋势基准未定时不能标为已验证生产规则 |
| SYS-13 | 成员、角色与店铺权限 `/settings/access` | 授权店铺列表仅供可绑定资源；组织权限由本系统管理 | **系统**：用户登录/会话、组织、成员、角色、店铺范围和按钮权限；前端隐藏不代替服务端检查 |
| SYS-14 | 业务参数与操作日志 `/settings/audit` | 可关联 request_id；其余系统自己产生 | **系统**：规则/授权/核对/通知配置操作审计，日志脱敏不保存明文 token；Shopee API Access Log 不代替本公司操作审计 |
| SYS-15 | 顶部店铺/站点/日期/币种查询、刷新 | 本地已同步事实＋上游数据域 | **系统**：统一条件和查询接口；刷新报表查询与“立即采集”分开定义，不每次点击就全量请求平台；广告当地当日不随经营报表期间变化 |
| SYS-16 | CSV 导出 | 与当前查询相同事实来源，无需 Shopee 导出接口 | **系统**：后台权限、同筛选条件/口径/原币/完整性标记；当前原型只导经营汇总 CSV，不是各页面任意明细导出已实现 |
| SYS-17 | 登录/角色切换/重置模拟数据 | 无需 Shopee；平台授权与本系统登录是两套身份 | **系统**：正式登录鉴权另行实现；角色快速切换、重置样本、模拟过期属于演示功能，生产关闭；不能用 Shopee 授权替代公司账号登录 |

## 6. 需要先关闭的缺口

| 优先级 | 缺口 | 已核查的来源/组合候选 | 没账号能先确认什么 | 需要什么才能关闭 |
|---|---|---|---|---|
| P0 | 一个 App 能否覆盖首版全部域 | 各页 API Permissions；订单/Payment/Ads/AMS 的类型清单不同 | 文档明确存在权限差异，不能只凭店铺授权成功宣布全通 | Console 当前 App 类型、域权限和至少一家目标店铺实际响应；必要时官方工单确认可申请方案 |
| P0 | 商品销售、取消与退款的同口径净额 | O1/O2＋R1/R2＋P1，Local P2 / CB P3 | 可以确定关联键、非重复扣减原则、金额缺失状态与算法 | 已付/未付/COD/部分取消/套餐/跨月/完结后退款样本及平台参考；确定归属政策 |
| P0 | 站内赠金实际使用、现金消耗 | A7 总余额＋费用/报表/独立额度流水候选；余额守恒 | 已确认 A7 没有拆分字段，只有总余额无法唯一求解；公式可先检验 | 付费/免费起止余额、发放、过期、撤回、退款和调整的完整字段，或官方提供准确使用明细 |
| P0 | Shopee 代投 Meta 费用 | 官方产品日报/独立钱包；P2/P3/收入报表候选 | 未找到已确认专用 OpenAPI，不将 paid ads 类型直接认成 Meta | 官方确认接口/交易标识；或有数据店铺日报与交易样本。确认可自动取数还是仅能导入，后者需单独确定首版方式 |
| P0 | 默认 30m/1h 预警的及时性 | A3/A4 小时/日累计快照；GMS A9/A10 区间快照 | 数学可算，源刷新承诺尚未确认 | 持续真实采样与后台对照；低样本/零基准/跨日/迟到归因实验；确认比较基准 |
| P0（若目标店铺使用） | GMV Max 在投筛选与商品粒度 | A9/A10＋A2 范围验证候选 | 区间指标存在；无 item 行不等于没有投放；未确认精确规格级表现 | 有 GMS 店铺实际活动/状态/设置返回，或官方明确覆盖接口；不支持部分类型时明确标注监控范围 |
| P1 | 佣金全量覆盖、实际扣费/额度 | P1＋M1/M2/M3，P2/P3 作核对 | 可优先验证 P1，避免非要 AMS 专属权限；不能重复加总 | 一笔核验/扣款/退款冲回及 AMS Credit 样本，税与服务费规则 |
| P1 | 外币折算来源 | 业务原币、P7 单笔 payout FX、本系统汇率表 | 可确认 payout 汇率不等于通用每日汇率 | 公司确认汇率政策与来源；记录日期版本。无通用汇率时原币展示可先成立 |
| P1 | 商品精确退款和历史时间线 | R2 白名单字段、订单/退款详情、推送日志 | 可确定无权限时降为订单级，接入前历史不能伪造 | 白名单/实际字段，历史事件源是否开放；否则保留受限展示，不阻挡订单级统计 |
| P1 | 平台报表对账文件内容 | P8～P11 官方生成/下载接口 | 已确认任务与文件链接存在；不是“只能人工下载” | 实际文件列、站点/App 支持与期间口径；文件存在不证明含 Meta 或赠金分摊 |

## 7. 对当前原型设计的影响（本轮未修改原型）

1. **授权页必须改流程**：真实授权跳转/回调与失败分支；授权到期和 token 健康分开；店铺同步独立显示。店名/外部 ID 从平台取，负责人由公司分配；时区不统一写 UTC+8。
2. **广告对象必须改术语/限制**：关联商品与规格 SKU 分开；平台预算与每日预算参考分开；本系统告警目标与平台目标分开。多商品计划不能假装能逐 SKU 精确预警。
3. **退款抽屉必须补受限状态**：商品实际退款无白名单字段时不展示伪精确分摊；历史时间线不伪造每次业务变更时间。
4. **已有费用缺项提示继续保留**：不能把 A7 总余额、充值额、赠金到账当成实际使用；Meta 未验证来源不显示已自动接入；完整费用率依赖完整输入。
5. **默认预警继续保留，但启用取决于源时效**：不能因为有小时指标就承诺 30 分钟提醒及时，也不能因无分钟字段就取消组合快照方案。
6. **权限需补一致性**：当前驾驶舱的店铺名称跳销售分析，但广告投手没有该页权限；正式设计需统一下钻去向与权限。前端只隐藏技术菜单，后端仍须逐接口核权。
7. **正式后端契约缺项多于当前摘要**：`specs/openapi.yaml` 未覆盖授权开始/回调/重新授权状态、token 健康、订单单据详情、规则单条启停/恢复默认、告警认领/解决、采集重试、核对签注、指标发布、真实通知测试/投递记录、汇率查询、导出任务等操作与完整 schema。它目前仅是草案，不可直接当成 Gemini 可联调完成的契约；通知摘要还含邮件，与已确认首版飞书方向不一致。

## 8. 最小验证顺序

1. 开发者应用类型/域权限确认 → 测试或真实店铺完成一次授权回调、续期与授权失效链路。
2. 对一店获取正常订单、部分取消/退款、结算，跑通原始额到净额，再核对跨月与佣金。
3. 同店获取普通活动与 GMS（如使用）状态/表现，连续采样验证快照、时区和延迟。
4. 赠金/Meta 各取一份完整流水或日报，按候选公式验证闭合；向官方确认未暴露的来源和接口，不用近似值冒充实际费用。
5. 所有源依赖落实后再验收真实通知、认领处置与导出；这些属于本系统闭环，不由 Shopee 直接完成。

没有数据账号时，本轮完成了功能拆分、官方文档参数/返回核对、已知候选来源补查和设计约束确认；未能关闭的外部依赖均在上表列明。此时不承诺“全自动首版全部已满足”。

补充官方业务依据：[站内广告 API 指南](https://open.shopee.com/developer-guide/277) 区分 Item GMV Max 与 Shop GMV Max；[Facebook Ads 产品页](https://ads.shopee.ph/ad-types/1031) 确认由 Shopee Seller Centre 创建账户并充值；[1:1 免费额度说明](https://ads.shopee.ph/learn/faq/577/2097) 确认使用历史有 Consumption Type，但这些页面未提供已确认的对应 OpenAPI 消耗字段。

## 9. 官方来源索引

具体接口参数、返回字段、方法、权限及阅读证据见 [接口逐项核查附录](prototype-full-shopee-api-endpoints-20261027.md)。原有业务金额/公式深度说明继续参考 [首版能力映射](shopee-api-v1-capability-mapping.md) 与 [离线公式验证](shopee-v1-offline-validation.md)。旧文档历史判断与本报告不同的部分，以本次明确列出的核对结论为当前设计参考；本轮没有重跑或冒称真实调用这些离线公式测试。

[AUTH]: https://open.shopee.com/developer-guide/20
[T1]: https://open.shopee.com/documents/v2/v2.public.get_access_token?type=1
[T2]: https://open.shopee.com/documents/v2/v2.public.refresh_access_token?type=1
[T3]: https://open.shopee.com/documents/v2/v2.public.get_shops_by_partner?type=1
[S1]: https://open.shopee.com/documents/v2/v2.shop.get_shop_info?type=1
[S2]: https://open.shopee.com/documents/v2/v2.shop.get_profile?type=1
[S3]: https://open.shopee.com/documents/v2/v2.merchant.get_shop_list_by_merchant?type=1
[O1]: https://open.shopee.com/documents/v2/v2.order.get_order_list?type=1
[O2]: https://open.shopee.com/documents/v2/v2.order.get_order_detail?type=1
[R1]: https://open.shopee.com/documents/v2/v2.returns.get_return_list?type=1
[R2]: https://open.shopee.com/documents/v2/v2.returns.get_return_detail?type=1
[P1]: https://open.shopee.com/documents/v2/v2.payment.get_escrow_detail?type=1
[P2]: https://open.shopee.com/documents/v2/v2.payment.get_wallet_transaction_list?type=1
[P3]: https://open.shopee.com/documents/v2/v2.payment.get_billing_transaction_info?type=1
[P4]: https://open.shopee.com/documents/v2/v2.payment.get_escrow_list?type=1
[P6]: https://open.shopee.com/documents/v2/v2.payment.get_income_detail?type=1
[P7]: https://open.shopee.com/documents/v2/v2.payment.get_payout_info?type=1
[P8]: https://open.shopee.com/documents/v2/v2.payment.generate_income_report?type=1
[P9]: https://open.shopee.com/documents/v2/v2.payment.get_income_report?type=1
[P10]: https://open.shopee.com/documents/v2/v2.payment.generate_income_statement?type=1
[P11]: https://open.shopee.com/documents/v2/v2.payment.get_income_statement?type=1
[A1]: https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_id_list?type=1
[A2]: https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_setting_info?type=1
[A3]: https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_hourly_performance?type=1
[A4]: https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_daily_performance?type=1
[A5]: https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_hourly_performance?type=1
[A6]: https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_daily_performance?type=1
[A7]: https://open.shopee.com/documents/v2/v2.ads.get_total_balance?type=1
[A8]: https://open.shopee.com/documents/v2/v2.ads.get_shop_toggle_info?type=1
[A9]: https://open.shopee.com/documents/v2/v2.ads.get_gms_campaign_performance?type=1
[A10]: https://open.shopee.com/documents/v2/v2.ads.get_gms_item_performance?type=1
[A11]: https://open.shopee.com/documents/v2/v2.ads.get_ads_facil_shop_rate?type=1
[M1]: https://open.shopee.com/documents/v2/v2.ams.get_conversion_report?type=1
[M2]: https://open.shopee.com/documents/v2/v2.ams.get_validation_list?type=1
[M3]: https://open.shopee.com/documents/v2/v2.ams.get_validation_report?type=1
[M4]: https://open.shopee.com/documents/v2/v2.ams.get_performance_data_update_time?type=1
[PR1]: https://open.shopee.com/documents/v2/v2.product.get_item_base_info?type=1
[PR2]: https://open.shopee.com/documents/v2/v2.product.get_model_list?type=1
[U1]: https://open.shopee.com/documents/v2/v2.push.get_app_push_config?type=1
[U2]: https://open.shopee.com/documents/v2/v2.push.get_lost_push_message?type=1
[U3]: https://open.shopee.com/documents/v2/v2.push.confirm_consumed_lost_push_message?type=1
