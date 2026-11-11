# CUBE ERP 正式店铺授权验收

## 结果（2026-11-11）

用户授权复用现有 CUBE ERP，并在 Shopee 页面亲自确认授权。中台已经完成正式环境授权码换取 Token、加密保存、店铺信息读取及一次真实 Token 续期，续期后再次读取店铺信息成功。

| 项目 | 实测结果 |
|---|---|
| 中台地址 | https://commerce.aicbec.cn |
| App | CUBE ERP，App ID 218180，ERP System，Online |
| 正式 Partner ID | 2010185 |
| 中台应用标识 | cube-erp-live |
| Shopee 返回店铺 | Home Monitor_PH |
| Shop ID / 市场 | 618217104 / PH |
| 环境 / 连接状态 | live / CONNECTED |
| 授权回调 | TOKEN_SAVED |
| 手动验证 | SHOP_VERIFY / SUCCESS |
| 真实续期 | ok=true，tokenRefreshed=true，TOKEN_REFRESH / SUCCESS |
| 续期后读取 | CONNECTED，lastError=null |

返回店铺是 Home Monitor_PH，不是 z_sweet。此前 z_sweet 紫鸟窗口曾显示 z_sweet 卖家中心，但窗口名称和卖家中心登录态不能替代本次 API 返回的店铺身份。用户确认本次返回地址来自其亲自点击授权；未把 Home Monitor_PH 改名或标记为 z_sweet。z_sweet 本身尚未在中台验收。

## 本次实际路径及限制

1. 普通浏览器登录中台，由正式 CUBE ERP 发起带一次性 state 的授权。
2. 将签名授权链接交给紫鸟窗口，按 Shopee 登录/授权界面完成确认；用户实际点击授权。
3. Shopee 返回中台回调，包含 code、shop_id、state。紫鸟拦截新中台域名，因此本次将原始回调地址交回发起请求的普通浏览器会话，由中台校验 state 和会话、交换授权码。
4. 浏览器店铺管理页显示真实店铺，点击“验证连接”成功，点击“续期”成功；数据库独立检查 Token 非空密文及审计记录。

此次证明真实服务端授权、回调、保存、读取与续期闭环可行。**没有证明紫鸟可以自动访问中台并自动完成回跳**；后续团队使用紫鸟需要通过紫鸟官方域名加白，或全程使用能够访问中台的普通浏览器。普通浏览器从店铺登录开始的完整授权交互尚未单独验收。

## 配置与边界

- Shopee 正式回调域名从 https://oauth.aimemory.dev/ 改为 https://commerce.aicbec.cn，已在保存后的详情页读回；测试回调保留旧值。将来旧系统的新授权/重新授权流程需要适配此变更，不能声称旧回调仍可用。
- 未重置 CUBE ERP 的 Partner Key，未主动撤销已有店铺授权，未导入旧系统 Token；仅使用本次新取得的凭据进行续期。
- 服务器私有配置当前仅启用 CUBE ERP Live。按用户要求已移除中台的原 App 247909 Sandbox 接入配置，新增店铺默认使用 CUBE ERP；平台应用本身及申请记录保留。配置修改前备份为 /etc/yz-commerce/shopee-apps.json.before-cube-erp-live，0600。
- 引入正式业务凭据前，独立审核账号改为 DISABLED、密码替换为不可登录值，全部原会话已撤销。App 247909 的待审核申请不能再依靠该审核账号访问当前业务系统；如继续该申请，需要独立隔离审核访问。
- 无商品创建、图片上传、上架、订单修改或广告修改；四个商品工具未开展实现。
- HTML 原型不变，未改既有教学/FRP服务。

## 验收证据

- 实际管理页截图：output/local-development/shops-cube-erp-live.png。
- 脱敏结构化结果：specs/verification/cube-erp-live-20261111/receipt.json。
- 平台 Key、授权码、state、Cookie 与 Token 均不进入此文档或证据文件。
