# 内置 FastMoss 销量榜

目标：市场调研默认展示仓库 fastmoss 目录内的三份销量榜，用户可以直接切换。

验收：普通入口默认打开 2026-11-18 日榜，可切换 2026 年第 46 周周榜和 2026 年 10 月月榜，每榜 300 款商品；页面和接口均无新增 XLSX 导入入口；筛选、分页、分析及跟卖入口可用；旧榜单仅通过已有来源链接访问，继续隔离不同账号。

非目标：改动榜单原文件、执行真实付费分析或上架、修改冻结路径、部署。

假设：文件名中的 18 日、46 周和 10 月均指 2026 年；11 月 19 日是导出日期。

初始级别：T1，最终以 Diff Gate 为准。

允许路径：fastmoss/*.xlsx、apps/api/src/tools/selection/*、apps/api/test/selection-http.test.ts、apps/console/src/app/tools/selection/*、apps/console/src/lib/selection.ts、scripts/export-team-source.mjs、此台账。

验证：Diff Gate、类型、构建、基线、HTTP 集成、浏览器桌面与窄屏交互。

结果：Diff Gate 通过，实际级别 T2。类型检查、生产构建和原型基线通过。7 项项目测试和 214 项无数据库 API 测试通过。完整测试命令缺少 .env.local，依赖 PostgreSQL 的授权测试未运行。隔离 Chrome 在 1440px 和 360px 验证三个周期切换、键盘焦点、分页、搜索和三个业务弹窗，并检查无页面横向溢出。源码交接压缩包已核对含三份原始表格。
