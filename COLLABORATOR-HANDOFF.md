# 现场协作者交接

更新：2026-10-21（北京时间）。用户确认沿用《烂尾事务所》，先做一部分，现场由协作者接着完善；这是本轮执行依据，没有收到额外的组委会通知原文。本轮沿用旧准备资料中的脑洞 35%、Kiro 使用 35%、交付 30% 作为准备方向，不把它们或建议演示时长当作重新核实后的现场细则。

## 接手入口

仓库 `MTMT0111/unfinished-office`。接受协作邀请后，在自己的电脑克隆仓库，创建自己的功能分支，不共享账号凭据。

```powershell
git clone https://github.com/MTMT0111/unfinished-office.git
cd unfinished-office
git switch -c onsite/keepsake-preview
npm ci
npm run build
npm start
```

打开 `http://127.0.0.1:4188/`。需要 Node.js 24；`npm run build` 还会生成可双击打开的 `打开试玩.html`，样例流程断网可用。本机 GitHub 导入需要自己登录 `gh`；现场不要展示私人项目或凭据。公网试玩可能晚于源码，不以公网页面判断本分支功能。

## 已有可演示闭环

选“天气 App” → 选“一站同行” → 同行心意选“未完成，也正式告别” → 出发。

将行李推到金框，再让你和伙伴分别走到脚印。可用方向键、X 换人、Z 撤销，卡住可点提示。走完第一关后翻开回忆，进入“亲手整理一件”，选择 README 的去处，再去站台。点击“亲手完成这场告别”，安放未竟之事、选刚才的文件点灯、署名或匿名封存，最后下载纪念票和回忆册。

结果明确显示 `1 / 7 站 · 一站同行`，其余关卡没有被伪装成完成。默认七站可继续完整游玩。演示长短按现场安排，不声称官方规定了几分钟。

## Kiro 接手

已提供 `.kiro/steering/project.md` 和 `.kiro/specs/one-stop-farewell/`。它们是 Codex 写的交接草案；请让 Kiro 实际审阅后再记录其贡献。结构参考 [Kiro Steering](https://kiro.dev/docs/steering/) 与 [Specs](https://kiro.dev/docs/specs/)。

在 Kiro 打开本仓库，提交以下任务：

> 先读项目 steering、one-stop-farewell 的 requirements/design/tasks 和 KIRO-LOG。保持“体面正式告别未完成项目”的主线。先审阅已实现的一站同行；接着只做 tasks 中“灯下物件原件回看”这一项。复用已取得的原件和现有 UI，不联网拉取更多文件、不执行导入代码、不编造提交。给出具体设计后实现、检查原有三幕步骤和减少动态行为，再记录你实际修改的文件与运行结果。不要把已有 Codex 成果登记为你的新实现。

当前这台电脑的 Kiro CLI 能识别登录状态，但模型调用返回账号暂时暂停。需账号本人按支持指引恢复；换 IDE 不能视为问题已解决。不把日志中的邮箱、令牌或原始账户信息提交仓库。

## 验收与交付

`npm test`、`npm run build`；服务启动后运行 `node tests/itinerary-browser.mjs`。浏览器脚本需要可用的 Playwright 与 Edge，可通过 `PLAYWRIGHT_PATH` 和 `EDGE_PATH` 设置路径；没有环境时按上面的流程人工操作，并记“人工检查”而不是声称自动检查通过。

至少保留：真实 Kiro 会话/任务记录、一个可运行提交、短旅程演示截图、可打开的 PNG/HTML。截图使用样例或可公开资料。若网络不可用，使用离线样例先完成展示。

刷新会清空当前旅程；先下载纪念再离开。不要在临场最后阶段引入账号系统、多人联网或新引擎。

### 新增：回声星图

已实现地图微光拾音、纸页升星、告别天空连线和独立星图纪念页。入口为靠近微光后的 E 键 / 触屏按钮；一站与七站都可使用。`src/echo.ts` 管理来源摘录与绘制，`Journey.echoes` 保存当次快照，`tests/echo-browser.mjs` 覆盖试玩闭环。请用真实项目原件继续打磨体验，保留未知内容的留白标识，不把收集数量当成项目完成度。
