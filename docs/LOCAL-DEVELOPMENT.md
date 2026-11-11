# 启动方式说明

团队成员日常开发直接使用 `pnpm dev`，自动连接团队服务，详见 [团队开发说明](TEAM-DEVELOPMENT.md)。下文是维护授权服务等公共后端时使用的独立数据库模式，使用 `pnpm dev:standalone`，不作为团队默认启动方式。

# 本地开发与店铺授权

## 本次交付范围

独立开发入口为 `apps/console`，后端为 `apps/api`。原 `apps/web` 原型与 `deployment/github-pages` 均保留，不作为本次运行服务。用户随后授权部署正式开发版本，部署进度见 [SERVER-DEPLOYMENT.md](SERVER-DEPLOYMENT.md)。

前端使用 Next.js / React / TypeScript、Tailwind CSS 与可复用按钮组件；后端使用 NestJS / TypeScript，数据库为 PostgreSQL 16 / Prisma。Next.js 负责界面和同源 API 转发，NestJS 负责权限、签名、平台请求和凭据管理，浏览器不接触 Partner Key 或 Token。

当前只开放中台登录、店铺列表与授权、授权操作记录。经营分析、广告预警和其他规划功能不在本次实现范围。

## 启动

需要 Node.js 22、pnpm 9，以及本机 PostgreSQL 16 的可执行程序。默认 PostgreSQL 程序目录为 `/opt/homebrew/opt/postgresql@16/bin`，其他安装位置通过 `PG_BIN` 指定。

```sh
pnpm install --frozen-lockfile
pnpm local:setup
pnpm dev:standalone
```

访问 <http://127.0.0.1:3100>，首次管理员登录信息在项目内 `.local/admin-login.txt`，这是中台账号，与 Shopee 账号分开。请始终使用 `127.0.0.1`，不要混用 `localhost`，以免 Origin 和会话不一致。

`local:setup` 为本项目启动独立数据库实例（127.0.0.1:55439），创建开发库与独立测试库并执行迁移，不修改其他数据库服务。已有 `.env.local` 和管理员密码不会被重置。后端仅监听 127.0.0.1:4100，前端将 `/api/*` 转发到后端。开发命令会同时监控 TypeScript 编译和后端重启。

结束开发时先停止前后端进程，再运行 `pnpm local:stop` 停止本项目的数据库。恢复时运行 `pnpm local:setup` 和 `pnpm dev:standalone`。

```sh
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` 使用真实 HTTP、真实 PostgreSQL 测试库与本地 Shopee 模拟服务，不会请求业务店铺，不证明真实平台联调成功。

## 配置 Shopee App

服务端读取 `.env.local` 的 `SHOPEE_APPS_FILE` 指定文件，默认 `.local/shopee-apps.json`。配置结构参考 `config/shopee-apps.example.json`，示例中的 ID 和 Key 均是假值，不能直接使用。实际配置文件权限应保持 0600；修改后重启后端。

每个配置包含：稳定的内部 `id`、展示 `name`、`environment`（live / sandbox）、对应环境的 `partnerId` / `partnerKey`、平台 `baseUrl`。Live 与 Sandbox 凭据不可混用。默认分别使用 `https://partner.shopeemobile.com` 和 `https://partner.test-stable.shopeemobile.com`，也支持对应 `.cn` 域名。普通运行不允许自定义第三方 API 主机。

专用 App 尚未配置时界面显示“尚未配置 Shopee App”，数据库不会插入模拟店铺。不要通过导入其他系统的旧 Token 或轮换其 Refresh Token 来填充页面。

授权回调地址由 `PUBLIC_API_ORIGIN` 生成：

```text
{PUBLIC_API_ORIGIN}/api/v1/shopee/callback?state=本次随机状态
```

本地默认回调源为 `http://127.0.0.1:3100`，需与平台登记域名规则匹配。正式部署将前端与 `/api` 放在同一个 HTTPS 域名，通过反向代理转发。用户最终指定 `https://commerce.aicbec.cn`，已完成公共 DNS、有效证书和正常浏览器登录验证；服务器的 `WEB_ORIGIN` / `PUBLIC_API_ORIGIN` 均已切换到此域名。原 yanzhiedu 入口因接入备案阻断暂停，hualibo 为之前的试验入口。具体进度见服务器部署文档。不应把 GitHub Pages 原型地址填写为实际授权后端。

授权必须在同一浏览器、保持中台登录的情况下于 10 分钟内完成。若在紫鸟中授权，先用紫鸟打开本地中台并登录，再点击连接；从其他浏览器复制回调链接不能代替原会话验证。

## 实现的闭环

1. 中台管理员登录，建立 8 小时服务端会话；Cookie 为 HttpOnly / SameSite=Lax，HTTPS 下为 Secure。
2. 发起授权，生成与会话、App 身份及环境绑定的一次性状态，服务端签名生成 `shop/auth_partner` URL。
3. 回调校验会话、状态、有效期、参数，原子领取状态；使用 `auth/token/get` 交换凭据，AES-256-GCM 加密后入库。
4. 调用 `shop/get_shop_info` 获取店铺名称与站点。读取失败保留已保存的凭据，页面明确显示失败原因，支持重新验证。
5. 每分钟检查将于 15 分钟内到期的访问凭据，通过 `auth/access_token/get` 轮换并保存新的两种 Token。行级租约避免并发重复续期；临时失败保留凭据重试，凭据失效显示需重新授权。
6. 同一 App 与店铺重新授权更新原连接，不生成重复店铺。保存 Partner ID 与环境，防止配置被替换后将旧 Token 发给另一个 App。
7. 管理员可查看最近 50 条授权、验证、续期记录；响应和记录均不返回 Key、Token 或原始授权码。

当前处理店铺维度授权；主账号 / 商家维度批量店铺接入与后续业务数据同步不在本次验收范围。“访问凭据有效至”是 Access Token 到期时间，不是店铺授权最终截止日期。

## 2026-11-11 平台现场核查

通过已登录紫鸟查看 [专用 ERP App](https://open.shopee.cn/console/app/247909)：现名 `YZ Cube Commerce Hub`（原名 `YZ Hub API Verify ERP`），状态 Developing，Test Partner ID 为 1250314；详情页未显示 Live 凭据，Test Redirect URL Domain 为 `-`。

最初打开 Go-Live 表单时确认：需提交可访问的产品网址、产品测试账号与密码、介绍、界面截图、正式回调域名和 IT 资产声明，经 Shopee 审核后获得 Live Partner ID / Key。当时仅查看，随后按用户明确要求修改上述专用 App 的名称。正式部署完成后，已于 2026-11-11 提交此 App 的 Live 申请，App List 已读回 `Go Live process Review`，详见 [Live 申请记录](SHOPEE-LIVE-APPLICATION.md)。其他 App 未改动。

现有真实店铺可以作为授权对象，无需新开店。正式域名和申请资料已完成，专用 App 的 Live 凭据尚待审核发放。因此**本地模拟闭环及公网中台登录已验证，专用 App 的真实店铺授权尚未验收**。审核通过后，停用审核账号并撤销审核会话，再配置该 App 的 Live 凭据，以现有店铺走授权→回调→落库→店铺读取→刷新凭据的真实链路。该外部条件不能用模拟测试或中台登录代替。

用户已指定使用有业务数据的 **z_sweet** 店铺进行真实联调，并明确继续复用现有编号 247909 的专用 App，不新建。正式产品名称为 **YZ Cube Commerce Hub（颜值立方运营中台）**。

## 凭据与数据

`.env.local`、`.local`、真实平台证据 `output` / `specs/verification` 均不应提交到代码仓库。加密密钥和数据库要一起保留；丢失密钥将无法解密已授权店铺凭据。数据库只绑定本机，当前登录限流是单进程实现。公网环境须在 HTTPS、代理、备份与真实授权验收完成后才算交付。


## 最新正式授权结果（覆盖上方申请阶段状态）

用户进一步授权使用已 Online 的 CUBE ERP（App 218180 / Partner 2010185）。本次由用户确认授权的真实店铺为 **Home Monitor_PH（618217104 / PH）**，已完成正式回调、Token 加密保存、店铺读取及真实续期，连接正常。不是 z_sweet，z_sweet 尚未验收。App 247909 的申请单独保留，正式业务接入不再等待它的审核。审核账号已停用，当前生产配置仅启用 CUBE ERP Live，原 YZ Sandbox 已从中台移除；单一应用时直接连接，不再要求用户选择应用。

紫鸟拦截中台新域名，此次使用普通浏览器发起会话、紫鸟授权、回调交回原会话的方式验证；紫鸟自动回跳仍需要官方域名加白。详见 [正式授权验收](SHOPEE-LIVE-AUTHORIZATION.md)。
