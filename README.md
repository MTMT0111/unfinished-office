# 烂尾事务所 · 再走一小段

一个关于和项目好好告别的像素游戏。带上项目资料出发，在解谜中经过六个关卡；真实的 GitHub 提交会成为途中回看的日记，最后把已经完成的事收好，也决定未完成的部分要带走还是留在站台。

## 先试玩

[打开公网试玩版](https://mtmt0111.github.io/unfinished-office-play/)。这是面向玩家的静态版本，包含样例、浏览器支持的本地材料选择、手动整理和完整游戏。要用本机 GitHub 登录态读取仓库或调用 API，请运行下面的完整版本。

## 在电脑运行完整版本

需要 Node.js 24。若要导入 GitHub 仓库，还需安装 GitHub CLI 并登录。首次运行时，在项目目录打开 PowerShell：

```powershell
npm ci
npm start
```

然后打开 <http://127.0.0.1:4188/>。Windows 也可以在安装依赖后双击 `启动事务所.cmd`。macOS 或 Linux 用户在克隆下来的项目目录执行相同的 `npm ci`、`npm start` 命令即可。

导入项目可选择本地文件夹、搜索或粘贴 GitHub 仓库，也可手动填写。GitHub 读取复用本机 `gh` 登录权限；API 分析默认使用 DeepSeek，也支持 OpenAI 兼容接口。API 分析是可选步骤，整理结果需要自己核对。要改代码时，另开终端运行 `npm run dev`，访问 <http://127.0.0.1:5173/>；本地 API 服务需同时运行。

## 玩法与项目边界

- 方向键或 WASD 移动；`X` 切换角色，`Z` 撤销，`Y` 重做。手机可用屏幕方向键。
- 每关的机关和行李对应项目资料；已读取的 GitHub 提交可按日期、说明和文件变化回看。没有证据的经历会留白，不会编造成就。
- 这是轻量项目档案整理，不是完整代码审计：不会运行、修改或删除导入的项目，也不会验证项目是否真的构建成功。
- 只有点击分析后，已勾选的文字材料才会发送到所配置的 API。文件内容和页面填写的密钥不会写入浏览器存储；请先检查材料中是否含有不打算发送的内容。
- 关卡通关只代表这段游戏旅程结束，不代表项目完工。刷新会清除当前旅程和未下载的个人回忆。

## 参与共创

源码仓库为私有仓库。获邀后可克隆并创建分支：

```powershell
git clone https://github.com/MTMT0111/unfinished-office.git
cd unfinished-office
npm ci
npm test
npm run build
```

修改后请先运行 `npm test` 和 `npm run build`，再提交分支并发起 Pull Request。`npm test` 使用 Node.js 内置测试运行器；浏览器端到端脚本依赖本机 Playwright 与 Edge，具体环境见 `tests/` 脚本。

目前已邀请 **Yongzhi Li（[@chnoorlee](https://github.com/chnoorlee)）** 作为共创伙伴；GitHub 邀请仍需对方接受后才能访问私有源码。

## 开发与设计

```powershell
npm test
npm run build
```

`npm run build` 生成 `dist/` 和可离线双击的 `打开试玩.html`。主要代码位于 `src/`，本地 GitHub/API 服务在 `server.mjs`，关卡与故事设计见 [DESIGN-JOURNEY.md](DESIGN-JOURNEY.md)，原创素材说明见 [ASSETS.md](ASSETS.md)。运行环境或端口可通过 `UNFINISHED_OFFICE_PORT` 调整。

**比赛与署名：**当前版本是由 Codex 按主创要求协助实现的原型，不是 Kiro 现场开发成果。若用于 Kiro 比赛，请按[官方活动规则](https://builderx.csdn.net/activity-site/kiro/index)完成并记录符合要求的 Kiro 创作，不要把当前版本描述为 Kiro 开发。代码提交应保留实际作者与共同作者信息；无需在项目中保存邮箱等个人信息。
