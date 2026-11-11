# 四工具团队本地开发

## 开始使用

准备 Node.js 22、pnpm 9.12.0、Git。项目放在公司的私有 Git 仓库。成员拉取后，在项目根目录执行：

```sh
pnpm dev
```

`pnpm dev` 会自动安装锁定依赖、生成 Prisma 客户端、编译 Nest 后端，并同时启动本地 Nest 和 Next，不需要另外执行团队启动脚本。打开 http://127.0.0.1:3100/login，用共用的**中台账号**登录。在“店铺接口联调”选择店铺并读取商品、翻页、查看详情。第一次安装需要联网；3100 和 4100 端口需空闲。Ctrl+C 停止服务。更换电脑或重启本地后重新登录中台账号，正常情况下不需重新授权 Shopee。

本地无需 PostgreSQL、Shopee 开发者账号、Partner Key、Access Token、Refresh Token 或生产数据库连接串。`.env.local` 属于独立后端开发模式，团队启动不加载它。若要改团队服务地址，复制 `.env.team.example` 为 `.env.team`，只修改 HTTPS 地址。

## 共用中台账号

团队直接使用现有共用中台账号登录，不再创建开发账号，也不再逐人分配店铺或工具权限。“开发账号与店铺权限”页面、菜单和管理API已移除。登录后可读取系统已授权店铺。

同一账号可在多台电脑同时登录，各自获得独立会话。普通退出只撤销当前会话，不影响其他同事，也不会撤销Shopee店铺授权。账号统一停用会影响所有人；调用日志显示同一个账号，无法区分个人。当前每账号每分钟60次读取，由使用者共享。

## 调用关系

本地浏览器 → 本地 Next → 本地 Nest（工具逻辑）→ 团队服务器接入层 → Shopee。

服务器统一保存加密的店铺凭据，统一续期。各电脑的中台登录会话与 Shopee 授权分离；远端登录凭据只存本地 Nest 内存，浏览器只收 HttpOnly 本地会话 Cookie。服务器的调用会话持久化为哈希，8小时到期，可即时撤销。切换电脑不会改变服务器保存的店铺授权。店铺撤销授权、App权限变更、服务器或网络不可用仍会影响调用，不承诺永不掉线。

本地服务绑定127.0.0.1；访问时请使用127.0.0.1而不是localhost。远端只接受白名单只读接口，不接受任意URL、路径、Partner参数或凭据。管理员现有Cookie和来源校验保持有效。

## 本轮开放范围

| 能力 | 远端路径（前缀 `/api/v1/development`） | 业务参数 |
|---|---|---|
| 登录、退出、身份 | POST `/login`、POST `/logout`、GET `/me` | 登录使用 email/password；服务端持有返回会话 |
| 获准店铺 | GET `/shops` | 无 |
| 商品列表 | GET `/shops/:connectionId/read/get_item_list` | offset、page_size（1—100）、item_status；默认NORMAL |
| 商品详情 | GET `.../get_item_base_info` | item_id_list，逗号分隔，1—50个 |
| 多规格 | GET `.../get_model_list` | item_id |
| 类目 | GET `.../get_category` | language可选 |
| 属性 | GET `.../get_attribute_tree` | category_id、language可选 |
| 品牌 | GET `.../get_brand_list` | category_id、offset、page_size、status |
| 上架限制 | GET `.../get_item_limit` | 无 |
| 物流渠道 | GET `.../get_channel_list` | 无 |

本轮验收以真实商品列表和详情为准；其余读取接口已接入白名单，具体市场参数与实际返回在对应工具开发时逐个联调。接口失败返回安全错误和请求ID，不把凭据或平台原始错误写入日志。每中台账号每分钟最多60次读取。分页下一页应采用平台返回的 `next_offset`。

**当前只读。**图片/视频上传、创建或更新商品、跨市场发布尚未开放，需随工具实现请求适配、权限、预览确认、真实结果核验。ERP类别覆盖不等于每个写入接口已完成联调。当前可以开始工具开发和真实商品读取；真实发布验收还需各工具独立完成。

## 四工具代码分工

保留 `apps/web/public/interactive-preview.html` 原型作为参考，不在原型上开发业务。正式前端在 `apps/console/src/app/tools/` 下按工具新增目录；后端在 `apps/api/src/tools/` 下按工具新增 Nest 模块。目录对应：

- `selection`：FastMoss导入、分析评分、仿真跟卖。
- `listing-images`：Listing组图生成与应用。
- `localization`：文案本地化与目标市场上架。
- `short-video`：短视频生成，具体平台接入和流程由凯宏补充。

四个模块当前未实现。公共授权、续期、签名、团队账号、样式和路由入口由主干维护；各人建立自己的功能分支，PR集成，避免直接改公共层。正式UI沿用原型风格，操作按钮靠右，表格操作列固定右侧。

本地 Nest 模块注入 `TeamShopClient`（`apps/api/src/team-client.ts`）。通过 `read(localSessionId, connectionId, operation, query)` 访问商品，身份从请求的HttpOnly Cookie取得，不能由前端自由提交另一人的sessionId。挂载模块时导入 `team-main.ts` 的本地模块，保留Host/Origin校验；共享服务器的授权层不随个人代码运行。

成员需要自己的工具数据库时另行配置本地开发库，不连接生产数据库，不复制生产Token表。Nest模块对团队API的登录/读调用可用测试提供者验证；不能用模拟成功代替真实Shopee接口验收。

## Git和交接

只向公司私有仓库提交源码、锁文件、示例配置和文档。`.local/`、`.env.local`、`.env.team`、`.playwright-cli/`、`output/`、`specs/verification/`、Token、密钥、数据库备份不提交。现有 `deployment/github-pages` 是独立公开原型仓库，不能把后端项目推送到它。

`node scripts/export-team-source.mjs` 生成经过目录白名单挑选的交接源码压缩包（不含依赖、账号和真实调用证据）。接收方解压后执行同一启动命令。仓库URL和共用中台账号由公司内部提供，凭据不写入Git或源码包。

生产升级采用独立release目录、迁移前数据库备份和current符号链接切换；不能覆盖ShopConnection凭据、AES密钥或旧App。遇到授权失效先由管理员检查店铺状态，成员不自行重新授权来解决本地问题。
