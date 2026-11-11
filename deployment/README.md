# 原型发布

- 网页：https://samsonsir.github.io/yz-cube-commerce-hub-prototype/
- 仓库：https://github.com/SamsonSir/yz-cube-commerce-hub-prototype
- 发布目录：`deployment/github-pages`（独立 Git 仓库）
- GitHub Pages：main 分支根目录
- 首次发布：2026-10-29，commit `28ce2d5`，Pages 构建 `40824744305` 成功。
- 已确认线上 HTML、Logo 返回 HTTP 200，SHA256 与发布目录一致；线上浏览器菜单渲染检查通过。

更新时将 `apps/web/public/interactive-preview.html` 同步为发布目录的 `index.html`，核对后在发布仓库提交并推送。仅发布静态演示页面及品牌资源，不上传验证数据、凭据或项目其他目录。
