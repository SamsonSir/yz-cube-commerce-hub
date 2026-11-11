# Shopee 全原型接口核查附录

日期：2026-10-27。本轮通过浏览器逐页读取 **40 个不同接口正文**，核对接口方法、参数、返回字段与权限；另读现行授权指南及官方广告帮助。数字是文档页数量，不是 API 调用测试次数。

完整功能判断见 [逐功能对照表](prototype-full-shopee-api-audit-20261027.md)。本附录的字段列表是官方参数表的**扁平字段名索引**，不代表全部字段在同一 JSON 层级，也不代表每个字段对所有店铺必返；嵌套路径与限制以功能对照表和链接正文为准。

## 接口目录

| 引用 | 方法及路径 | 关键用途 |
|---|---|---|
| T1 | [POST `/api/v2/auth/token/get`](https://open.shopee.com/documents/v2/v2.public.get_access_token?type=1) | 授权码换 token；shop/main account |
| T2 | [POST `/api/v2/auth/access_token/get`](https://open.shopee.com/documents/v2/v2.public.refresh_access_token?type=1) | token 轮换续期 |
| T3 | [GET `/api/v2/public/get_shops_by_partner`](https://open.shopee.com/documents/v2/v2.public.get_shops_by_partner?type=1) | 已授权店铺列表 |
| S1 | [GET `/api/v2/shop/get_shop_info`](https://open.shopee.com/documents/v2/v2.shop.get_shop_info?type=1) | 店铺元数据、授权截止、Local/CB/SIP |
| S2 | [GET `/api/v2/shop/get_profile`](https://open.shopee.com/documents/v2/v2.shop.get_profile?type=1) | 店铺名称/Logo 补充 |
| S3 | [GET `/api/v2/merchant/get_shop_list_by_merchant`](https://open.shopee.com/documents/v2/v2.merchant.get_shop_list_by_merchant?type=1) | 商家下授权店铺枚举 |
| O1 | [GET `/api/v2/order/get_order_list`](https://open.shopee.com/documents/v2/v2.order.get_order_list?type=1) | 订单发现、创建/更新增量分页 |
| O2 | [GET `/api/v2/order/get_order_detail`](https://open.shopee.com/documents/v2/v2.order.get_order_detail?type=1) | 订单金额、商品、状态与取消数量 |
| R1 | [GET `/api/v2/returns/get_return_list`](https://open.shopee.com/documents/v2/v2.returns.get_return_list?type=1) | 退款申请发现/更新 |
| R2 | [GET `/api/v2/returns/get_return_detail`](https://open.shopee.com/documents/v2/v2.returns.get_return_detail?type=1) | 退款详情、部分退款与白名单金额 |
| P1 | [GET `/api/v2/payment/get_escrow_detail`](https://open.shopee.com/documents/v2/v2.payment.get_escrow_detail?type=1) | 订单结算、商品价、调整、AMS 佣金 |
| P2 | [GET `/api/v2/payment/get_wallet_transaction_list`](https://open.shopee.com/documents/v2/v2.payment.get_wallet_transaction_list?type=1) | Local 卖家钱包交易核对 |
| P3 | [POST `/api/v2/payment/get_billing_transaction_info`](https://open.shopee.com/documents/v2/v2.payment.get_billing_transaction_info?type=1) | CB 账单明细核对 |
| P4 | [GET `/api/v2/payment/get_escrow_list`](https://open.shopee.com/documents/v2/v2.payment.get_escrow_list?type=1) | 结算释放列表 |
| P6 | [GET `/api/v2/payment/get_income_detail`](https://open.shopee.com/documents/v2/v2.payment.get_income_detail?type=1) | 收入明细，注意日期只对 Released 生效 |
| P7 | [GET `/api/v2/payment/get_payout_info`](https://open.shopee.com/documents/v2/v2.payment.get_payout_info?type=1) | CB payout ID、结算币种与单笔汇率 |
| P8 | [GET `/api/v2/payment/generate_income_report`](https://open.shopee.com/documents/v2/v2.payment.generate_income_report?type=1) | 发起收入 report 文件生成 |
| P9 | [GET `/api/v2/payment/get_income_report`](https://open.shopee.com/documents/v2/v2.payment.get_income_report?type=1) | 获取 report 状态/下载链接 |
| P10 | [GET `/api/v2/payment/generate_income_statement`](https://open.shopee.com/documents/v2/v2.payment.generate_income_statement?type=1) | 发起周/月 income statement |
| P11 | [GET `/api/v2/payment/get_income_statement`](https://open.shopee.com/documents/v2/v2.payment.get_income_statement?type=1) | 获取 statement 状态/下载链接 |
| A1 | [GET `/api/v2/ads/get_product_level_campaign_id_list`](https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_id_list?type=1) | 发现普通商品活动 ID |
| A2 | [GET `/api/v2/ads/get_product_level_campaign_setting_info`](https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_setting_info?type=1) | 活动状态、预算、目标与商品 |
| A3 | [GET `/api/v2/ads/get_product_campaign_hourly_performance`](https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_hourly_performance?type=1) | 普通商品活动小时指标 |
| A4 | [GET `/api/v2/ads/get_product_campaign_daily_performance`](https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_daily_performance?type=1) | 普通商品活动日指标 |
| A5 | [GET `/api/v2/ads/get_all_cpc_ads_hourly_performance`](https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_hourly_performance?type=1) | 店铺 CPC 小时指标 |
| A6 | [GET `/api/v2/ads/get_all_cpc_ads_daily_performance`](https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_daily_performance?type=1) | 店铺 CPC 日指标 |
| A7 | [GET `/api/v2/ads/get_total_balance`](https://open.shopee.com/documents/v2/v2.ads.get_total_balance?type=1) | 广告总余额，未拆付费/免费 |
| A8 | [GET `/api/v2/ads/get_shop_toggle_info`](https://open.shopee.com/documents/v2/v2.ads.get_shop_toggle_info?type=1) | 自动充值/campaign surge 开关 |
| A9 | [POST `/api/v2/ads/get_gms_campaign_performance`](https://open.shopee.com/documents/v2/v2.ads.get_gms_campaign_performance?type=1) | GMS 活动区间表现 |
| A10 | [POST `/api/v2/ads/get_gms_item_performance`](https://open.shopee.com/documents/v2/v2.ads.get_gms_item_performance?type=1) | GMS 商品区间表现 |
| A11 | [GET `/api/v2/ads/get_ads_facil_shop_rate`](https://open.shopee.com/documents/v2/v2.ads.get_ads_facil_shop_rate?type=1) | Ads Facil 费率；不是赠金实际使用记录 |
| M1 | [GET `/api/v2/ams/get_conversion_report`](https://open.shopee.com/documents/v2/v2.ams.get_conversion_report?type=1) | AMS 转化/佣金报表 |
| M2 | [GET `/api/v2/ams/get_validation_list`](https://open.shopee.com/documents/v2/v2.ams.get_validation_list?type=1) | AMS 核验账单 |
| M3 | [GET `/api/v2/ams/get_validation_report`](https://open.shopee.com/documents/v2/v2.ams.get_validation_report?type=1) | 核验账单订单/商品明细 |
| M4 | [GET `/api/v2/ams/get_performance_data_update_time`](https://open.shopee.com/documents/v2/v2.ams.get_performance_data_update_time?type=1) | AMS 报表最新日期 |
| PR1 | [GET `/api/v2/product/get_item_base_info`](https://open.shopee.com/documents/v2/v2.product.get_item_base_info?type=1) | 关联商品名称、item SKU 等 |
| PR2 | [GET `/api/v2/product/get_model_list`](https://open.shopee.com/documents/v2/v2.product.get_model_list?type=1) | 规格 model ID、model SKU、币种 |
| U1 | [GET `/api/v2/push/get_app_push_config`](https://open.shopee.com/documents/v2/v2.push.get_app_push_config?type=1) | 推送配置及授权/订单事件种类 |
| U2 | [GET `/api/v2/push/get_lost_push_message`](https://open.shopee.com/documents/v2/v2.push.get_lost_push_message?type=1) | 近 3 天丢失推送读取 |
| U3 | [POST `/api/v2/push/confirm_consumed_lost_push_message`](https://open.shopee.com/documents/v2/v2.push.confirm_consumed_lost_push_message?type=1) | 丢失推送处理完成后确认消费 |

## 参数与返回字段索引

所有接口均须按页面的 Public/Shop/Merchant 公共签名方式认证；本表不重复公共参数。字段存在不证明当前 App 已获权限。

### T1 · public.get_access_token

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.public.get_access_token?type=1)；POST `/api/v2/auth/token/get`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`、`code`、`shop_id`、`main_account_id`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`shop_id_list`、`merchant_id_list`、`supplier_id_list`、`user_id_list`、`principal_id_list`、`access_token`、`refresh_token`、`expire_in`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management、Brand Portal Service、Payment Service Provider。

### T2 · public.refresh_access_token

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.public.refresh_access_token?type=1)；POST `/api/v2/auth/access_token/get`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`、`refresh_token`、`shop_id`、`merchant_id`、`supplier_id`、`user_id`、`principal_id`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`partner_id`、`principal_id`、`shop_id`、`merchant_id`、`supplier_id`、`user_id`、`access_token`、`refresh_token`、`expire_in`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management、Brand Portal Service、Payment Service Provider。

### T3 · public.get_shops_by_partner

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.public.get_shops_by_partner?type=1)；GET `/api/v2/public/get_shops_by_partner`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`、`page_size`、`page_no`

**返回字段（扁平索引）**：`authed_shop_list`、`region`、`shop_id`、`auth_time`、`expire_time`、`sip_affi_shop_list`、`affi_shop_id`、`request_id`、`more`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management、Brand Portal Service、Payment Service Provider。

### S1 · shop.get_shop_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.shop.get_shop_info?type=1)；GET `/api/v2/shop/get_shop_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`

**返回字段（扁平索引）**：`shop_name`、`region`、`status`、`sip_affi_shops`、`affi_shop_id`、`is_cb`、`request_id`、`auth_time`、`expire_time`、`is_sip`、`is_upgraded_cbsc`、`merchant_id`、`shop_fulfillment_flag`、`is_main_shop`、`is_direct_shop`、`linked_main_shop_id`、`linked_direct_shop_list`、`direct_shop_id`、`direct_shop_region`、`is_one_awb`、`is_mart_shop`、`is_outlet_shop`、`mart_shop_id`、`outlet_shop_info_list`、`outlet_shop_id`、`mart_outlet_structure_type`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Customer Service、Customized APP、Ads Service、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management。

### S2 · shop.get_profile

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.shop.get_profile?type=1)；GET `/api/v2/shop/get_profile`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`

**返回字段（扁平索引）**：`message`、`request_id`、`response`、`shop_logo`、`description`、`shop_name`、`invoice_issuer`、`error`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Customized APP、Ads Service、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management。

### S3 · merchant.get_shop_list_by_merchant

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.merchant.get_shop_list_by_merchant?type=1)；GET `/api/v2/merchant/get_shop_list_by_merchant`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`merchant_id`、`sign`、`page_no`、`page_size`

**返回字段（扁平索引）**：`request_id`、`shop_list`、`shop_id`、`sip_affi_shops`、`affi_shop_id`、`more`

**App 类型**：ERP System、Seller In House System、Product Management、Ads Service、Swam ERP。

### O1 · order.get_order_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.order.get_order_list?type=1)；GET `/api/v2/order/get_order_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`time_range_field`、`time_from`、`time_to`、`page_size`、`cursor`、`order_status`、`response_optional_fields`、`request_order_status_pending`、`logistics_channel_id`

**返回字段（扁平索引）**：`request_id`、`error`、`message`、`response`、`more`、`order_list`、`order_sn`、`order_status`、`booking_sn`、`next_cursor`

**App 类型**：ERP System、Seller In House System、Order Management、Customer Service、Brand Membership、Ads Service、Swam ERP、Livestream Management、Affiliate Marketing Solution Management、Payment Service Provider。

### O2 · order.get_order_detail

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.order.get_order_detail?type=1)；GET `/api/v2/order/get_order_detail`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`order_sn_list`、`request_order_status_pending`、`response_optional_fields`

**返回字段（扁平索引）**：`request_id`、`error`、`message`、`response`、`order_list`、`order_sn`、`region`、`currency`、`cod`、`total_amount`、`pending_terms`、`pending_description`、`order_status`、`shipping_carrier`、`payment_method`、`estimated_shipping_fee`、`message_to_seller`、`create_time`、`update_time`、`days_to_ship`、`ship_by_date`、`buyer_user_id`、`buyer_username`、`recipient_address`、`name`、`phone`、`town`、`district`、`city`、`state`、`zipcode`、`full_address`、`geolocation`、`latitude`、`longitude`、`actual_shipping_fee`、`goods_to_declare`、`note`、`note_update_time`、`item_list`、`item_id`、`item_name`、`item_sku`、`model_id`、`model_name`、`model_sku`、`model_quantity_purchased`、`is_fulfillment_mapping`、`bundle_sku_id`、`components`、`parent_sku_id`、`barcode_upc`、`quantity`、`warehouse_id`、`mapping_type`、`model_original_price`、`model_discounted_price`、`wholesale`、`weight`、`add_on_deal`、`main_item`、`add_on_deal_id`、`promotion_type`、`promotion_id`、`order_item_id`、`line_item_id`、`promotion_group_id`、`image_info`、`image_url`、`product_location_id`、`is_prescription_item`、`error_in_fetching_is_prescription_item`、`consultation_id`、`is_b2c_owned_item`、`promotion_list`、`hot_listing_item`、`active_qty`、`cancel_requested_qty`、`cancelled_qty`、`return_requested_qty`、`returned_qty`、`imei_list`、`pay_time`、`dropshipper`、`dropshipper_phone`、`split_up`、`buyer_cancel_reason`、`cancel_by`、`cancel_reason`、`actual_shipping_fee_confirmed`、`buyer_cpf_id`、`fulfillment_flag`、`pickup_done_time`、`package_list`、`package_number`、`logistics_status`、`logistics_channel_id`、`allow_self_design_awb`、`model_quantity`、`parcel_chargeable_weight`、`group_shipment_id`、`virtual_contact_number`、`package_query_number`、`sorting_group`、`invoice_data`、`number`、`series_number`、`access_key`、`issue_date`、`total_value`、`products_total_value`、`tax_code`、`status`、`pending_reason`、`checkout_shipping_carrier`、`reverse_shipping_fee`、`order_chargeable_weight_gram`、`prescription_check_status`、`pharmacist_name`、`prescription_images`、`prescription_approval_time`、`prescription_rejection_time`、`prescription_reject_reason`、`is_buyer_shop_collection`、`buyer_proof_of_collection`、`edt_from`、`edt_to`、`booking_sn`、`advance_package`、`return_request_due_date`、`payment_info`、`payment_processor_register`、`card_brand`、`transaction_id`、`payment_amount`、`hot_listing_order`、`is_international`、`can_full_cancel_order`、`can_partial_cancel_order`、`buyer_preference_for_partial_cancellation`、`affiliate_sample_type`、`warning`

**App 类型**：ERP System、Seller In House System、Order Management、Accounting And Finance、Customer Service、Brand Membership、Ads Service、Swam ERP、Livestream Management、Affiliate Marketing Solution Management、Payment Service Provider。

### R1 · returns.get_return_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.returns.get_return_list?type=1)；GET `/api/v2/returns/get_return_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`page_no`、`page_size`、`create_time_from`、`create_time_to`、`update_time_from`、`update_time_to`、`status`、`negotiation_status`、`seller_proof_status`、`seller_compensation_status`

**返回字段（扁平索引）**：`request_id`、`error`、`message`、`response`、`more`、`return`、`image`、`reason`、`text_reason`、`reassessed_request_reason`、`return_sn`、`refund_amount`、`currency`、`create_time`、`update_time`、`status`、`due_date`、`tracking_number`、`dispute_reason`、`dispute_text_reason`、`needs_logistics`、`amount_before_discount`、`user`、`username`、`email`、`portrait`、`item`、`model_id`、`name`、`images`、`amount`、`item_price`、`is_add_on_deal`、`is_main_item`、`add_on_deal_id`、`item_id`、`item_sku`、`variation_sku`、`order_sn`、`return_ship_due_date`、`return_seller_due_date`、`negotiation_status`、`seller_proof_status`、`seller_compensation_status`、`return_refund_type`、`return_solution`、`is_seller_arrange`、`is_shipping_proof_mandatory`、`return_refund_request_type`、`validation_type`、`is_arrived_at_warehouse`、`follow_up_action_list`、`qty`、`current_status`、`related_order_sn_list`、`resell_failed_next_step`、`is_partial_quantity_return`、`is_refund_amount_adjusted`、`shipping_fee_responsibility`

**App 类型**：ERP System、Seller In House System、Customer Service、Swam ERP。

### R2 · returns.get_return_detail

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.returns.get_return_detail?type=1)；GET `/api/v2/returns/get_return_detail`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`return_sn`

**返回字段（扁平索引）**：`request_id`、`error`、`message`、`response`、`image`、`buyer_videos`、`thumbnail_url`、`video_url`、`reason`、`text_reason`、`reassessed_request_reason`、`return_sn`、`refund_amount`、`currency`、`create_time`、`update_time`、`status`、`due_date`、`tracking_number`、`dispute_reason`、`dispute_text_reason`、`needs_logistics`、`amount_before_discount`、`user`、`username`、`email`、`portrait`、`item`、`model_id`、`name`、`images`、`amount`、`item_price`、`is_add_on_deal`、`is_main_item`、`add_on_deal_id`、`item_id`、`item_sku`、`variation_sku`、`order_sn`、`return_ship_due_date`、`return_seller_due_date`、`activity`、`activity_id`、`activity_type`、`original_price`、`discounted_price`、`items`、`variation_id`、`quantity_purchased`、`seller_proof`、`seller_proof_status`、`seller_evidence_deadline`、`seller_compensation`、`seller_compensation_status`、`seller_compensation_due_date`、`compensation_amount`、`compensation_amount_list`、`compensation_type`、`negotiation`、`negotiation_status`、`latest_solution`、`latest_offer_amount`、`latest_offer_creator`、`counter_limit`、`offer_due_date`、`logistics_status`、`reverse_logistics_status`、`return_pickup_address`、`address`、`phone`、`town`、`district`、`city`、`state`、`region`、`zipcode`、`virtual_contact_number`、`package_query_number`、`return_address`、`whs_id`、`return_refund_type`、`return_solution`、`is_seller_arrange`、`is_shipping_proof_mandatory`、`has_uploaded_shipping_proof`、`is_reverse_logistics_channel_integrated`、`reverse_logistics_channel_name`、`return_refund_request_type`、`validation_type`、`is_arrived_at_warehouse`、`follow_up_action_list`、`qty`、`current_status`、`related_order_sn_list`、`resell_failed_next_step`、`is_partial_quantity_return`、`is_refund_amount_adjusted`、`shipping_fee_responsibility`、`shipping_fee_responsibility_reason`

**App 类型**：ERP System、Seller In House System、Customer Service、Swam ERP。

### P1 · payment.get_escrow_detail

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_escrow_detail?type=1)；GET `/api/v2/payment/get_escrow_detail`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`order_sn`

**返回字段（扁平索引）**：`response`、`order_sn`、`buyer_user_name`、`return_order_sn_list`、`order_income`、`escrow_amount`、`buyer_total_amount`、`order_original_price`、`original_price`、`order_discounted_price`、`order_selling_price`、`order_seller_discount`、`bcrs_deposit`、`seller_discount`、`shopee_discount`、`voucher_from_seller`、`voucher_from_shopee`、`voucher_from_external_party`、`coins`、`buyer_paid_shipping_fee`、`buyer_transaction_fee`、`cross_border_tax`、`payment_promotion`、`commission_fee`、`service_fee`、`seller_transaction_fee`、`seller_lost_compensation`、`seller_coin_cash_back`、`escrow_tax`、`estimated_shipping_fee`、`final_shipping_fee`、`actual_shipping_fee`、`shipping_fee_sst`、`order_chargeable_weight`、`shopee_shipping_rebate`、`shipping_fee_discount_from_3pl`、`seller_shipping_discount`、`seller_voucher_code`、`drc_adjustable_refund`、`cost_of_goods_sold`、`original_cost_of_goods_sold`、`original_shopee_discount`、`seller_return_refund`、`items`、`item_id`、`item_name`、`item_sku`、`model_id`、`model_name`、`model_sku`、`line_item_id`、`original_price_pri`、`selling_price`、`discounted_price`、`discount_from_coin`、`discount_from_voucher_shopee`、`discount_from_voucher_seller`、`activity_type`、`activity_id`、`is_main_item`、`quantity_purchased`、`is_b2c_shop_item`、`ams_commission_fee`、`is_kit`、`kit_items`、`original_product_id`、`original_model_id`、`total_qty`、`proportional_price`、`promotion_list`、`promotion_type`、`promotion_id`、`escrow_amount_pri`、`buyer_total_amount_pri`、`seller_return_refund_pri`、`commission_fee_pri`、`service_fee_pri`、`drc_adjustable_refund_pri`、`pri_currency`、`aff_currency`、`exchange_rate`、`reverse_shipping_fee`、`reverse_shipping_fee_sst`、`final_product_protection`、`credit_card_promotion`、`credit_card_transaction_fee`、`final_product_vat_tax`、`final_shipping_vat_tax`、`campaign_fee`、`sip_subsidy`、`sip_subsidy_pri`、`rsf_seller_protection_fee_claim_amount`、`shipping_seller_protection_fee_amount`、`final_escrow_product_gst`、`final_escrow_shipping_gst`、`delivery_seller_protection_fee_premium_amount`、`order_adjustment`、`amount`、`date`、`currency`、`adjustment_reason`、`total_adjustment_amount`、`escrow_amount_after_adjustment`、`order_ams_commission_fee`、`buyer_payment_method`、`instalment_plan`、`sales_tax_on_lvg`、`final_return_to_seller_shipping_fee`、`withholding_tax`、`overseas_return_service_fee`、`prorated_coins_value_offset_return_items`、`prorated_shopee_voucher_offset_return_items`、`prorated_seller_voucher_offset_return_items`、`prorated_payment_channel_promo_bank_offset_return_items`、`prorated_payment_channel_promo_shopee_offset_return_items`、`fsf_seller_protection_fee_claim_amount`、`vat_on_imported_goods`、`tenure_info_list`、`payment_channel_name`、`withholding_vat_tax`、`withholding_pit_tax`、`withholding_cit_tax`、`tax_registration_code`、`seller_order_processing_fee`、`buyer_paid_packaging_fee`、`trade_in_bonus_by_seller`、`fbs_fee`、`net_commission_fee`、`net_service_fee`、`net_commission_fee_info_list`、`rule_id`、`fee_amount`、`rule_display_name`、`net_service_fee_info_list`、`category`、`seller_product_rebate`、`commission_fee_offset`、`service_fee_offset`、`pix_discount`、`prorated_pix_discount_offset_return_items`、`ads_escrow_top_up_fee_or_technical_support_fee`、`th_import_duty`、`remaining_voucher`、`pay_per_sale`、`buyer_payment_info`、`buyer_service_fee`、`buyer_tax_amount`、`shopeevip_subtotal`、`icms_tax_amount`、`import_tax_amount`、`initial_buyer_txn_fee`、`insurance_premium`、`iof_tax_amount`、`is_paid_by_credit_card`、`merchant_subtotal`、`seller_voucher`、`shipping_fee`、`shipping_fee_sst_amount`、`shopee_voucher`、`shopee_coins_redeemed`、`trade_in_bonus`、`bulky_handling_fee`、`discount_pix`、`ads_voucher_discount`、`buyer_instant_fee`、`request_id`、`error`、`message`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Customer Service、Brand Membership、Swam ERP、Payment Service Provider。

### P2 · payment.get_wallet_transaction_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_wallet_transaction_list?type=1)；GET `/api/v2/payment/get_wallet_transaction_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`page_no`、`page_size`、`create_time_from`、`create_time_to`、`wallet_type`、`transaction_type`、`money_flow`、`transaction_tab_type`

**返回字段（扁平索引）**：`response`、`transaction_list`、`status`、`transaction_type`、`txn_title`、`amount`、`current_balance`、`create_time`、`order_sn`、`refund_sn`、`withdrawal_type`、`transaction_fee`、`description`、`buyer_name`、`pay_order_list`、`shop_name`、`withdrawal_id`、`reason`、`root_withdrawal_id`、`transaction_tab_type`、`money_flow`、`outlet_shop_name`、`more`、`request_id`、`message`、`error`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P3 · payment.get_billing_transaction_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_billing_transaction_info?type=1)；POST `/api/v2/payment/get_billing_transaction_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`billing_transaction_info_type`、`encrypted_payout_ids`、`cursor`、`page_size`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`transactions`、`amount`、`currency`、`order_sn`、`cost_header`、`scenario`、`remark`、`level`、`billing_transaction_type`、`billing_transaction_status`、`more`、`next_cursor`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP、Payment Service Provider。

### P4 · payment.get_escrow_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_escrow_list?type=1)；GET `/api/v2/payment/get_escrow_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`release_time_from`、`release_time_to`、`page_size`、`page_no`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`escrow_list`、`order_sn`、`payout_amount`、`escrow_release_time`、`more`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P6 · payment.get_income_detail

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_income_detail?type=1)；GET `/api/v2/payment/get_income_detail`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`date_from`、`date_to`、`income_status`、`cursor`、`page_size`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`income_detail_list`、`next_page`、`cursor`、`page_size`、`income_detail_list_item`、`payment_method`、`order_sn`、`description`、`status`、`currency`、`estimated_escrow_amount`、`estimated_payout_time`、`to_release_amount`、`creation_date`、`released_amount`、`actual_payout_time`

**App 类型**：ERP System、Seller In House System、Accounting And Finance。

### P7 · payment.get_payout_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_payout_info?type=1)；GET `/api/v2/payment/get_payout_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`payout_time_from`、`payout_time_to`、`page_size`、`cursor`

**返回字段（扁平索引）**：`message`、`error`、`request_id`、`response`、`payout_list`、`from_currency`、`payout_currency`、`from_amount`、`payout_amount`、`exchange_rate`、`payout_time`、`pay_service`、`payee_id`、`encrypted_payout_id`、`more`、`next_cursor`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P8 · payment.generate_income_report

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.generate_income_report?type=1)；GET `/api/v2/payment/generate_income_report`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`release_time_from`、`release_time_to`

**返回字段（扁平索引）**：`response`、`id`、`error`、`msg`、`request_id`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P9 · payment.get_income_report

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_income_report?type=1)；GET `/api/v2/payment/get_income_report`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`income_report_id`

**返回字段（扁平索引）**：`response`、`id`、`file_name`、`status`、`generated_time`、`file_link`、`error`、`msg`、`request_id`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P10 · payment.generate_income_statement

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.generate_income_statement?type=1)；GET `/api/v2/payment/generate_income_statement`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`release_time_from`、`release_time_to`、`statement_type`

**返回字段（扁平索引）**：`response`、`id`、`error`、`message`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### P11 · payment.get_income_statement

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.payment.get_income_statement?type=1)；GET `/api/v2/payment/get_income_statement`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`income_statement_id`

**返回字段（扁平索引）**：`response`、`id`、`file_name`、`status`、`generated_time`、`file_link`、`error`、`message`

**App 类型**：ERP System、Seller In House System、Accounting And Finance、Swam ERP。

### A1 · ads.get_product_level_campaign_id_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_id_list?type=1)；GET `/api/v2/ads/get_product_level_campaign_id_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`ad_type`、`offset`、`limit`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`shop_id`、`region`、`has_next_page`、`campaign_list`、`ad_type`、`campaign_id`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A2 · ads.get_product_level_campaign_setting_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_product_level_campaign_setting_info?type=1)；GET `/api/v2/ads/get_product_level_campaign_setting_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`info_type_list`、`campaign_id_list`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`shop_id`、`region`、`campaign_list`、`campaign_id`、`common_info`、`ad_type`、`ad_name`、`campaign_status`、`bidding_method`、`campaign_placement`、`campaign_budget`、`campaign_duration`、`start_time`、`end_time`、`item_id_list`、`manual_bidding_info`、`enhanced_cpc`、`selected_keywords`、`keyword`、`status`、`match_type`、`bid_price_per_click`、`discovery_ads_locations`、`location`、`bid_price`、`auto_bidding_info`、`roas_target`、`auto_product_ads_info`、`product_name`、`item_id`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A3 · ads.get_product_campaign_hourly_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_hourly_performance?type=1)；GET `/api/v2/ads/get_product_campaign_hourly_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`performance_date`、`campaign_id_list`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`shop_id`、`region`、`campaign_list`、`campaign_id`、`ad_type`、`campaign_placement`、`ad_name`、`metrics_list`、`hour`、`date`、`impression`、`clicks`、`ctr`、`expense`、`broad_gmv`、`broad_order`、`broad_order_amount`、`broad_roi`、`broad_cir`、`cr`、`cpc`、`direct_order`、`direct_order_amount`、`direct_gmv`、`direct_roi`、`direct_cir`、`direct_cr`、`cpdc`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A4 · ads.get_product_campaign_daily_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_product_campaign_daily_performance?type=1)；GET `/api/v2/ads/get_product_campaign_daily_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`start_date`、`end_date`、`campaign_id_list`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`shop_id`、`region`、`campaign_list`、`campaign_id`、`ad_type`、`campaign_placement`、`ad_name`、`metrics_list`、`date`、`impression`、`clicks`、`ctr`、`expense`、`broad_gmv`、`broad_order`、`broad_order_amount`、`broad_roi`、`broad_cir`、`cr`、`cpc`、`direct_order`、`direct_order_amount`、`direct_gmv`、`direct_roi`、`direct_cir`、`direct_cr`、`cpdc`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A5 · ads.get_all_cpc_ads_hourly_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_hourly_performance?type=1)；GET `/api/v2/ads/get_all_cpc_ads_hourly_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`performance_date`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`hour`、`date`、`impression`、`clicks`、`ctr`、`direct_order`、`broad_order`、`direct_conversions`、`broad_conversions`、`direct_item_sold`、`broad_item_sold`、`direct_gmv`、`broad_gmv`、`expense`、`cost_per_conversion`、`direct_roas`、`broad_roas`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A6 · ads.get_all_cpc_ads_daily_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_all_cpc_ads_daily_performance?type=1)；GET `/api/v2/ads/get_all_cpc_ads_daily_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`start_date`、`end_date`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`date`、`impression`、`clicks`、`ctr`、`direct_order`、`broad_order`、`direct_conversions`、`broad_conversions`、`direct_item_sold`、`broad_item_sold`、`direct_gmv`、`broad_gmv`、`expense`、`cost_per_conversion`、`direct_roas`、`broad_roas`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A7 · ads.get_total_balance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_total_balance?type=1)；GET `/api/v2/ads/get_total_balance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`data_timestamp`、`total_balance`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A8 · ads.get_shop_toggle_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_shop_toggle_info?type=1)；GET `/api/v2/ads/get_shop_toggle_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`data_timestamp`、`auto_top_up`、`campaign_surge`

**App 类型**：Seller In House System、Marketing、Ads Service、Ads Service App、Ads Facil。

### A9 · ads.get_gms_campaign_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_gms_campaign_performance?type=1)；POST `/api/v2/ads/get_gms_campaign_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`campaign_id`、`start_date`、`end_date`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`campaign_id`、`report`、`broad_cir`、`broad_gmv`、`broad_order`、`broad_order_amount`、`broad_roi`、`clicks`、`expense`、`cpc`、`cpdc`、`cr`、`direct_cr`、`direct_cir`、`direct_order`、`direct_order_amount`、`direct_roi`、`impression`

**App 类型**：Seller In House System、Ads Service、Ads Service App。

### A10 · ads.get_gms_item_performance

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_gms_item_performance?type=1)；POST `/api/v2/ads/get_gms_item_performance`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`campaign_id`、`start_date`、`end_date`、`offset`、`limit`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`campaign_id`、`result_list`、`item_id`、`report`、`broad_cir`、`broad_gmv`、`broad_order`、`broad_order_amount`、`broad_roi`、`clicks`、`expense`、`cpc`、`cpdc`、`cr`、`direct_cr`、`direct_cir`、`direct_order`、`direct_order_amount`、`direct_roi`、`impression`、`total`、`has_next_page`

**App 类型**：Seller In House System、Ads Service、Ads Service App。

### A11 · ads.get_ads_facil_shop_rate

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ads.get_ads_facil_shop_rate?type=1)；GET `/api/v2/ads/get_ads_facil_shop_rate`。

**业务请求参数**：正文没有业务参数；仍须公共鉴权参数。

**返回字段（扁平索引）**：`rate`、`update_at`

**App 类型**：Ads Service、Ads Service App、Ads Facil。

### M1 · ams.get_conversion_report

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ams.get_conversion_report?type=1)；GET `/api/v2/ams/get_conversion_report`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`page_no`、`page_size`、`order_sn`、`affiliate_id`、`item_id`、`item_name`、`l1_category_id`、`l2_category_id`、`l3_category_id`、`order_status`、`verified_status`、`buyer_status`、`attr_campaign_id`、`campaign_partner`、`seller_campaign_type`、`deduction_status`、`deduction_method`、`place_order_time_start`、`place_order_time_end`、`order_completed_time_start`、`order_completed_time_end`、`conversion_completed_time_start`、`conversion_completed_time_end`、`ams_deduction_time_start`、`ams_deduction_time_end`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`list`、`order_sn`、`order_status`、`verified_status`、`place_order_time`、`order_completed_time`、`conversion_completed_time`、`affiliate_id`、`affiliate_name`、`affiliate_username`、`linked_mcn`、`order_brand_commission`、`channel`、`order_type`、`buyer_status`、`items`、`item_id`、`item_name`、`model_id`、`l1_category_id`、`l2_category_id`、`l3_category_id`、`promotion_id`、`price`、`qty`、`seller_campaign_type`、`attr_campaign_id`、`purchase_value`、`refund_amount`、`item_brand_commission`、`item_brand_commission_rate_to_affiliate`、`item_brand_commission_to_affiliate`、`item_brand_commission_rate_to_mcn`、`item_brand_commission_to_mcn`、`seller_service_fee_rate`、`seller_service_fee`、`campaign_partner`、`total_count`、`has_more`

**App 类型**：Affiliate Marketing Solution Management。

### M2 · ams.get_validation_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ams.get_validation_list?type=1)；GET `/api/v2/ams/get_validation_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`validation_list`、`validation_id`、`payment_method`、`validation_month`、`campaign_source`、`online_bill`、`total_amount`、`bill_status`、`deducted_amount`、`ams_credit_deducted_amount`、`pending_amount`、`offline_bills`、`order_place_month`、`commission_amount`、`commission_amount_after_tax`

**App 类型**：Affiliate Marketing Solution Management。

### M3 · ams.get_validation_report

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ams.get_validation_report?type=1)；GET `/api/v2/ams/get_validation_report`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`page_no`、`page_size`、`validation_id`、`validation_month`、`campaign_source`、`order_sn`、`l1_category_id`、`l2_category_id`、`l3_category_id`、`item_id`、`item_name`、`verified_status`、`attr_campaign_id`、`place_order_time_start`、`place_order_time_end`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`list`、`order_sn`、`order_status`、`verified_status`、`place_order_time`、`order_completed_time`、`conversion_completed_time`、`affiliate_name`、`affiliate_username`、`linked_mcn`、`campaign_partner`、`order_type`、`order_brand_commission`、`channel`、`affiliate_id`、`buyer_status`、`items`、`item_id`、`item_name`、`model_id`、`l1_category_id`、`l2_category_id`、`l3_category_id`、`promotion_id`、`price`、`qty`、`seller_campaign_type`、`attr_campaign_id`、`purchase_value`、`refund_amount`、`item_brand_commission`、`item_brand_commission_rate_to_affiliate`、`item_brand_commission_to_affiliate`、`item_brand_commission_rate_to_mcn`、`item_brand_commission_to_mcn`、`seller_service_fee_rate`、`seller_service_fee`、`total_count`、`has_more`

**App 类型**：Affiliate Marketing Solution Management。

### M4 · ams.get_performance_data_update_time

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.ams.get_performance_data_update_time?type=1)；GET `/api/v2/ams/get_performance_data_update_time`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`marker_type`

**返回字段（扁平索引）**：`error`、`message`、`request_id`、`response`、`last_report_date`

**App 类型**：Affiliate Marketing Solution Management。

### PR1 · product.get_item_base_info

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.product.get_item_base_info?type=1)；GET `/api/v2/product/get_item_base_info`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`item_id_list`、`need_tax_info`、`need_complaint_policy`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`item_list`、`item_id`、`category_id`、`item_name`、`description`、`item_sku`、`create_time`、`update_time`、`attribute_list`、`attribute_id`、`original_attribute_name`、`is_mandatory`、`attribute_value_list`、`value_id`、`original_value_name`、`value_unit`、`price_info`、`currency`、`original_price`、`current_price`、`inflated_price_of_original_price`、`inflated_price_of_current_price`、`sip_item_price`、`sip_item_price_source`、`local_price`、`local_promotion_price`、`image`、`image_url_list`、`image_id_list`、`image_ratio`、`weight`、`dimension`、`package_length`、`package_width`、`package_height`、`logistic_info`、`logistic_id`、`logistic_name`、`enabled`、`shipping_fee`、`size_id`、`is_free`、`estimated_shipping_fee`、`pre_order`、`is_pre_order`、`days_to_ship`、`wholesales`、`min_count`、`max_count`、`unit_price`、`inflated_price_of_unit_price`、`condition`、`size_chart`、`item_status`、`deboost`、`has_model`、`has_promotion`、`video_info`、`video_url`、`thumbnail_url`、`duration`、`brand`、`brand_id`、`original_brand_name`、`item_dangerous`、`gtin_code`、`size_chart_id`、`promotion_image`、`compatibility_info`、`vehicle_info_list`、`model_id`、`year_id`、`version_id`、`scheduled_publish_time`、`authorised_brand_id`、`ssp_id`、`is_fulfillment_by_shopee`、`tag`、`kit`、`purchase_limit_info`、`min_purchase_limit`、`max_purchase_limit`、`purchase_limit`、`medicine_id`、`certification_info`、`certification_list`、`permit_id`、`certification_no`、`expiry_date`、`certification_proofs`、`image_id`、`ratio`、`file_name`、`image_url`、`complaint_policy`、`warranty_time`、`exclude_entrepreneur_warranty`、`complaint_address_id`、`additional_information`、`tax_info`、`ncm`、`diff_state_cfop`、`csosn`、`origin`、`cest`、`measure_unit`、`invoice_option`、`vat_rate`、`hs_code`、`tax_code`、`tax_type`、`pis`、`cofins`、`icms_cst`、`pis_cofins_cst`、`federal_state_taxes`、`operation_type`、`ex_tipi`、`fci_num`、`recopi_num`、`additional_info`、`group_item_info`、`group_qtd`、`group_unit`、`group_unit_value`、`original_group_price`、`group_gtin_sscc`、`group_grai_gtin_sscc`、`export_cfop`、`description_info`、`extended_description`、`field_list`、`field_type`、`text`、`image_info`、`description_type`、`stock_info_v2`、`summary_info`、`total_reserved_stock`、`total_available_stock`、`seller_stock`、`location_id`、`stock`、`if_saleable`、`shopee_stock`、`advance_stock`、`sellable_advance_stock`、`in_transit_advance_stock`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Custom APP、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management。

### PR2 · product.get_model_list

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.product.get_model_list?type=1)；GET `/api/v2/product/get_model_list`。

**业务请求参数**：`partner_id`、`timestamp`、`access_token`、`shop_id`、`sign`、`item_id`

**返回字段（扁平索引）**：`message`、`warning`、`request_id`、`response`、`tier_variation`、`option_list`、`option`、`image`、`image_id`、`image_url`、`name`、`model`、`price_info`、`currency`、`current_price`、`original_price`、`inflated_price_of_original_price`、`inflated_price_of_current_price`、`sip_item_price`、`sip_item_price_source`、`sip_item_price_currency`、`local_price`、`local_promotion_price`、`model_id`、`promotion_id`、`has_promotion`、`model_sku`、`model_status`、`pre_order`、`is_pre_order`、`days_to_ship`、`stock_info_v2`、`summary_info`、`total_reserved_stock`、`total_available_stock`、`seller_stock`、`location_id`、`stock`、`if_saleable`、`shopee_stock`、`advance_stock`、`sellable_advance_stock`、`in_transit_advance_stock`、`gtin_code`、`weight`、`dimension`、`package_height`、`package_length`、`package_width`、`is_fulfillment_by_shopee`、`ssp_id`、`cssp_id`、`standardise_tier_variation`、`variation_id`、`variation_name`、`variation_group_id`、`variation_option_list`、`variation_option_id`、`variation_option_name`、`error`

**App 类型**：ERP System、Seller In House System、Product Management、Accounting And Finance、Customer Service、Customized APP、Ads Service、Swam ERP、Livestream Management、Ads Facil、Affiliate Marketing Solution Management、Shopee Video Management。

### U1 · push.get_app_push_config

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.push.get_app_push_config?type=1)；GET `/api/v2/push/get_app_push_config`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`

**返回字段（扁平索引）**：`request_id`、`error`、`message`、`response`、`callback_url`、`live_push_status`、`suspended_time`、`blocked_shop_id`、`push_config_on_list`、`push_config_off_list`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Affiliate Marketing Solution Management、Shopee Video Management。

### U2 · push.get_lost_push_message

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.push.get_lost_push_message?type=1)；GET `/api/v2/push/get_lost_push_message`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`、`response`、`push_message_list`、`shop_id`、`code`、`timestamp`、`data`、`has_next_page`、`last_message_id`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Affiliate Marketing Solution Management、Shopee Video Management。

### U3 · push.confirm_consumed_lost_push_message

官方文档：[接口正文](https://open.shopee.com/documents/v2/v2.push.confirm_consumed_lost_push_message?type=1)；POST `/api/v2/push/confirm_consumed_lost_push_message`。

**业务请求参数**：`partner_id`、`timestamp`、`sign`、`last_message_id`

**返回字段（扁平索引）**：`error`、`message`、`warning`、`request_id`

**App 类型**：ERP System、Seller In House System、Product Management、Order Management、Accounting And Finance、Marketing、Customer Service、Brand Membership、Customized APP、Ads Service、Consignment Service System、Custom APP、Swam ERP、Livestream Management、Affiliate Marketing Solution Management、Shopee Video Management。

## 本轮新增确认的边界

- 授权跳转优先采用现行指南的 `/auth`，token 仍为 `/api/v2/auth/token/get` 和 `/api/v2/auth/access_token/get`。授权到期不是 token 到期；主账号批量授权后 shop/merchant token 独立续期。
- `get_total_balance` 的 `data_timestamp` 是余额快照时间；它与总余额都不能提供赠金实际使用额，也不能代表广告表现的源更新时间。
- `get_shop_toggle_info` 只有自动充值等开关，不提供全部活动在投状态。
- Income report/statement 可以自动申请生成并拿文件链接；文件内容是否含目标费用必须以实际文件验证。生成接口虽然是 GET，也会创建报表任务，本轮只读文档，没有调用。
- 官方 2026-09-07 ROAS Protection 帮助说明 Pay Per Sale 逐步迁移为点击付费＋1:1 免费额度回扣；不能用统一 50% 或旧 PPS 公式计算所有广告现金支出。活动是否迁移、免费额度发放与实际使用仍需真实账户核对。
- 未找到 Meta 专用消耗接口，或当前目录没有广告赠金使用明细，并不证明官方永久不提供；通过官方工单或有权限账户验证仍是关闭缺口的步骤。

授权依据：[Authorization and Authentication](https://open.shopee.com/developer-guide/20)。广告赠金依据：[GMV Max ROAS Protection](https://ads.shopee.ph/learn/faq/58/2069)。

## 证据范围

证据包含 40 个接口的官方正文读取结果、当前原型源码路由/操作盘点及授权指南摘录。没有真实 API 返回、授权登录、App 权限核验、报表文件或真实广告连续采样。

原文证据：[接口文档读取记录](verification/shopee-full-audit-20261027/official-endpoints.json)；[授权指南摘录](verification/shopee-full-audit-20261027/authorization-guide-excerpts.json)。
