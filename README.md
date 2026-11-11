# 团队开发入口（2026-11-11）

正式主体为 Next.js/React 前端 + NestJS 后端。团队本地启动：

```sh
pnpm dev
```

访问 http://127.0.0.1:3100/login ，使用共用中台账号。服务器统一管理已授权店铺，本地不需要店铺密钥或生产数据库。

操作、分工、开放接口与权限边界见 [团队开发说明](docs/TEAM-DEVELOPMENT.md)。四工具业务尚待分别开发，当前开放真实商品读取。原型文件保持独立，只作为对照。

以下保留历史规划，不能当作正式后端已实现清单。

---

# 颜值立方 (YZ GROUP) · 跨境电商经营运营中台 (V1 前端与契约基线)

> 对应文档：《跨境电商运营中台：总体架构与 MVP V1 规划 (V0.2)》与《完整菜单与功能清单 (V0.2)》

> **2026-10-15 实际状态**：当前可交互成果是 `apps/web/public/interactive-preview.html` 静态模拟原型；17 个业务 TSX 路由仍为标题占位，缺少可构建的 Web 应用配置与依赖。以下为设计与路由规划，不代表已实现。首版范围与逐项核对见 [首版范围确认与前端核对](specs/v1-scope-and-frontend-audit.md)。

## 1. 品牌视觉与设计令牌体系（匹配“顏值立方 E-COMMERCE / YZ GROUP”Logo）

| 视觉维度 | 提取自 Logo 的特征 | 落地设计令牌 (`tokens.css` / Tailwind) |
|---|---|---|
| 品牌主色（印章勃艮第红） | `(YZ)` / `(LF)` 圆章、`E-COMMERCE` 与 `YZ GROUP` 深红 | `yz.burgundy: #7C2529` / 悬停 `#611B1E` / 浅底 `#FDF3F3` |
| 导航与框架色（玄墨黑） | “顏值立方”厚重衬线笔画与等轴测立方体黑线 | `yz.ink: #121316` + 等轴测立方体几何暗纹侧边栏 |
| 工作台背景（宣纸暖白） | Logo 外轮廓白色贴纸留白对比 | `yz.ivory: #F6F4EF` + 纯白卡片 `#FFFFFF` + 暖灰分割线 `#E4E0D7` |
| 字体层级 | 书法高对比度宋刻体 + 现代几何英文字母 | 标题采用 `Noto Serif SC`，数据与金额采用 `Inter` + `JetBrains Mono (tabular-nums)` |

## 2. V1 全部 17 个页面路由与 OpenAPI 契约映射表

| 菜单编号 | 页面名称 | 前端路由 | 对应 OpenAPI 契约端点 |
|---|---|---|---|
| 01.01 | 经营驾驶舱 | `/dashboard` | `GET /api/v1/dashboard` |
| 01.02 | 预警待办 | `/workbench/alerts` | `GET/PATCH /api/v1/alert-events` |
| 02.01 | 销售额分析 | `/analytics/sales` | `GET /api/v1/analytics/sales` |
| 02.02 | 订单与退款分析 | `/analytics/orders` | `GET /api/v1/analytics/orders` |
| 02.03 | 营销费用分析 | `/analytics/marketing-costs` | `GET /api/v1/analytics/marketing-costs` |
| 02.04 | 指标核对与差异 | `/analytics/reconciliation` | `GET /api/v1/analytics/reconciliation` |
| 03.01 | 在投广告监控 | `/ads/active` | `GET /api/v1/ads?status=ONGOING` |
| 03.02 | 广告详情 | `/ads/[adId]` (`/ads/detail`) | `GET /api/v1/ads/{adId}` |
| 03.03 | 预警规则管理 | `/ads/rules` | `GET/PUT /api/v1/ad-rules` |
| 03.04 | 预警事件记录 | `/ads/alerts` | `GET /api/v1/alert-events` |
| 04.01 | 店铺列表与授权 | `/channels/shops` | `GET /api/v1/shops` |
| 04.02 | 平台数据能力与连接状态 | `/channels/capabilities` | `GET /api/v1/capabilities` |
| 05.01 | 数据同步任务 | `/data/sync-jobs` | `GET/POST /api/v1/sync-jobs` |
| 05.02 | 指标字典与数据质量 | `/data/metrics` | `GET /api/v1/metric-definitions` |
| 06.01 | 成员、角色与店铺权限 | `/settings/access` | `GET /api/v1/access/members` |
| 06.02 | 通知渠道设置 | `/settings/notifications` | `GET/PUT /api/v1/notification-settings` |
| 06.03 | 业务参数与操作日志 | `/settings/audit` | `GET /api/v1/audit-logs` |
