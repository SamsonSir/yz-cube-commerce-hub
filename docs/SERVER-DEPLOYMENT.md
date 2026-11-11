# 中台服务器部署

## 当前部署（2026-11-11）

- 正式入口：**https://commerce.aicbec.cn**，公共 DNS A 记录指向 **47.98.47.222**。
- 服务器：`hualibo_cubec`，Ubuntu 22.04 / x86_64。
- 发布目录：`/opt/yz-commerce/releases/20261111-ui-04`；运行链接：`/opt/yz-commerce/current`。
- 独立用户：`yz-hub`。前端监听 `127.0.0.1:3100`，后端监听 `127.0.0.1:4100`，PostgreSQL 16 只监听本机 5432。
- systemd：`yz-commerce-api`、`yz-commerce-web`，已启用自动启动和失败重启。
- Nginx：`/etc/nginx/sites-available/yz-commerce-aicbec`，源码配置为 `deployment/server/nginx-aicbec.conf`。
- Let’s Encrypt 证书：`/etc/letsencrypt/live/commerce.aicbec.cn/`，当前有效期至 2027-02-09。`certbot.timer` 已启用；续期部署钩子检查并重新加载 Nginx。

根域名 aicbec.cn 的已有网站、既有教学站点及 FRP 服务保留。原型文件未修改。

## 私有配置

`/etc/yz-commerce/app.env` 保存数据库连接、Token 加密密钥和登录配置；`/etc/yz-commerce/shopee-apps.json` 保存 App 凭据，权限 root:yz-hub / 0640。初始管理员信息位于 `/etc/yz-commerce/admin-login.txt`；独立审核账号凭据位于 `/etc/yz-commerce/shopee-review-login.json`，两者 root / 0600。密码、Partner Key 和 Token 不进入文档或仓库。

首次部署脚本 `provision.mjs` 默认使用 `https://commerce.aicbec.cn`，也接受显式 HTTPS `HUB_ORIGIN`。重复执行保留已有配置和加密密钥；不能用它接管已有业务数据库。服务器现有 Origin 已切换至 aicbec。切换前配置在 `/etc/yz-commerce/app.env.before-aicbec` 留存。数据库备份必须同时保存加密密钥；备份恢复演练尚未完成。

## 已完成验证

- 公共 DNS、有效 TLS、正常域名下浏览器登录和店铺管理页通过；未使用域名解析覆盖或忽略证书错误。
- 会话读取、Secure/HttpOnly/SameSite Cookie、无效授权回调失败提示、退出后会话失效通过；服务器跨来源写入拒绝通过。
- 独立审核账号最终密码已实测登录、连接入口展示及退出；未插入模拟业务店铺。
- `certbot renew --cert-name commerce.aicbec.cn --dry-run` 成功，续期后钩子已配置。
- Nginx 配置检查通过；既有教学与 FRP 配置散列保持一致，服务仍 active。
- 两份 HTML 原型基线保持不变。真实域名截图：`output/local-development/shops-aicbec-https.png`。

上述部署检查之外，现已通过 CUBE ERP 完成真实授权，详见下文。

## Shopee Live 申请与后续

现有 **YZ Cube Commerce Hub / App 247909 / ERP System** 已实际提交 Live 申请，详情页与 App List 分别读回审核中，列表状态 **Go Live process Review**。产品地址和 Test / Live Redirect URL Domain 均为 `https://commerce.aicbec.cn`。申请使用独立审核账号与实际部署截图，Buyer PII 关闭。详见 [Live 申请记录](SHOPEE-LIVE-APPLICATION.md)。

服务器已新增现有 **CUBE ERP（App 218180 / Online / Live Partner 2010185）** 正式凭据。按用户后续要求，已移除中台的 App 247909 Sandbox 配置，当前仅启用 CUBE ERP Live，新增店铺默认使用该应用；平台上的 App 247909 和申请记录保留。用户亲自完成授权后，API 返回 **Home Monitor_PH（618217104 / PH）**，授权码交换、Token 加密落库、店铺读取及真实续期均成功；中台状态 CONNECTED。z_sweet 尚未验收，不能把紫鸟窗口名作为实际店铺身份。

正式回调已改为中台域名，测试回调保留旧值；不重置密钥、不导入旧 Token。紫鸟拦截中台新域名，本次将平台回调交回原普通浏览器会话完成验证；紫鸟自动回跳未通过。独立审核账号已停用、会话撤销，App 247909 的审核账号因此不再可用。详见 [正式授权验收](SHOPEE-LIVE-AUTHORIZATION.md)。授权阶段完成后停止，不开展商品发布。

团队自助账号管理及数据库备份恢复演练尚未完成，不作为已交付能力。

## 旧域名说明

`commerce.yanzhiedu.cn` 曾返回阿里云接入备案拦截；`commerce.hualibo.cn` 曾完成服务器 HTTPS 测试但未配置公共 DNS。当前统一使用 aicbec 入口，不再要求上述域名作为此次 Live 申请前提，也不改动它们的根域名业务。


## 当前前端

2026-11-11 已将已开发的店铺授权页及公共框架按 HTML 原型对齐：240px 可折叠侧栏、品牌区、纹理背景、顶部查询区、酒红卡片边线、表格密度及页脚。单一 CUBE ERP 下不再展示应用选择。窄屏默认折叠菜单，查询标签与控件保持同行，表格独立横向滚动，操作列固定于右侧；查询与卡片操作按钮右对齐。尚未开发的原型业务菜单继续隐藏，不把原型模拟业务直接作为正式功能。
