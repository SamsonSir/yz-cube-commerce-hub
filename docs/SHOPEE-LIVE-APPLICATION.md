# Shopee Live 申请记录

## App 247909 提交时状态（2026-11-11）

已通过现有 App 的 Go-Live 表单实际提交，先在详情页读到 `Application to go live is under review`，再在 App List 独立读回 `Go Live process Review`。这是已提交、审核中，不是已获批或已完成真实店铺授权。平台页面提示审核结果将在 24 小时内发送到邮箱，该提示不代表保证审批时间。

- App：**YZ Cube Commerce Hub**，App ID **247909**，类别 **ERP System**。
- Test Partner ID：**1250314**。未新建 App，也未修改其他 App。
- 产品地址：**https://commerce.aicbec.cn**。
- Test / Live Redirect URL Domain：均为 **https://commerce.aicbec.cn**。
- 实际回调：`/api/v1/shopee/callback?state=每次授权生成的一次性状态`。
- 服务器与数据库声明 IP：均为 **47.98.47.222**，数据库只监听本机。
- Buyer PII：关闭。当前店铺连接与拟定商品工具不要求买家个人信息。
- 产品测试：使用独立审核账号，未提交正式管理员密码。账号与密码仅在服务器私有配置及 Shopee 申请表中保存，不写入本文件。
- 已上传真实部署界面截图：`output/local-development/live-review-shops.png`。不是 HTML 原型或模拟店铺截图。
- 申请介绍明确区分当前已实现的店铺授权、信息验证、续期及记录，与后续计划的四个商品工具。

## 系统验证

已用正常公共域名完成 HTTPS 登录、店铺管理页、会话及安全 Cookie、无效回调失败提示、退出后会话失效验证。未使用临时 DNS 覆盖或忽略证书错误。审核账号的最终密码另行完成登录、店铺连接按钮展示及登出验证。

有效证书已签发，过期时间 2027-02-09；Certbot 定时续期已启用，续期后执行 Nginx 配置检查并平滑加载。`certbot renew --cert-name commerce.aicbec.cn --dry-run` 已成功。

服务器目前只配置该 App 的 Sandbox 凭据，便于审核查看真实连接入口。Sandbox 不是 Live，界面无模拟店铺，真实业务店铺尚未连接。

## 审核后的步骤

1. 确认平台实际审核状态及该 App 获批的 Live 凭据和权限。
2. 停用独立审核账号、撤销其全部会话，再接入真实业务店铺。当前审核账号临时具有授权管理权限，只用于业务店铺尚未接入的审核阶段。
3. 将该 App 的 Live 凭据写入服务器私有配置，保留已有 Sandbox 的环境隔离，不导入其他 App 的 Token 或轮换旧业务凭据。
4. 以 **z_sweet** 完成真实授权、回调落库、店铺读取及凭据续期验证。
5. 按用户指令停止在店铺授权阶段，不自动开展商品写入或上架测试。

## 后续四个工具的已确认方向

1. FastMoss 同行品类数据导入、AI 分析评分、仿真平台跟卖。
2. image2.6 商品 Listing 组图生成，并应用于仿真平台与真实 Shopee 店铺。
3. 商品文案本地化、跨市场适配及发布至相应真实店铺。
4. 对接现有 AIGC 平台生成商品短视频；具体流程和接入方式由凯宏补充。

这四项不是此前的赠金、Meta 费用、佣金退回和退款核算。用户已提供此前确认的 API→允许 App 类别对照，当前继续沿用 ERP System 申请 Live；实际获批权限、目标店铺资格和真实写入能力仍需后续验收。此次没有实现或发布上述四个商品工具。


## 后续实际接入更新

用户改为授权复用已 Online 的 **CUBE ERP（218180）**，已接通真实店铺 Home Monitor_PH 并完成 Token 续期。当前不依赖本申请通过。为保护真实店铺凭据，原审核账号已停用并撤销全部会话，本表单提交的测试账号不再可用；如继续本申请审核，需要独立隔离的审核访问。App 247909 未取消申请，是否获批需要后续实际查看，不能用 CUBE ERP 的 Online 状态替代。详见 [正式授权验收](SHOPEE-LIVE-AUTHORIZATION.md)。
