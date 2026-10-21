---
inclusion: always
---

# 烂尾事务所 · 开发约定

本文件由 Codex 于 2026-10-21 整理，供 Kiro 接手使用，不是 Kiro 已执行的证据。

目标：让人以体面、正式、自己决定的方式告别未完成项目。游戏通关不代表项目完成。原件、已确认事实、个人留言与游戏象征要能区分；缺失资料留白。

沿用 TypeScript、Vite、原生 HTML/CSS、Canvas 2D 和现有 Node 服务。入口 `src/main.ts`；规则与旅程 `src/game.ts`；场景 `src/scene.ts`；回忆 `src/memory.ts`；文件遗物 `src/relics.ts`；正式仪式 `src/ritual.ts`；导出 `src/export.ts`。不新增游戏引擎或状态库。

导入材料只按文本/图片处理，不运行导入项目，不读取凭据，不修改源仓库。仅由用户点击分析后，选中的材料发送到用户配置的 API。修改导出时同时检查网页、PNG 与离线 HTML。

当前有默认七站旅程和可选一站同行；两条路线使用相同关卡规则与仪式。未访问章节不能计入成果。一站同行实际走完第一关后到站，临时跳过仍标记提前到站。回看与重播不得推进关卡或篡改已封存的告别记。

运行：Node.js 24，`npm ci`、`npm run build`、`npm start`。检查：`npm test`；本地服务启动后 `node tests/itinerary-browser.mjs`。浏览器脚本可通过 PLAYWRIGHT_PATH、EDGE_PATH、APP_URL 指定环境，不为运行本机脚本随意改依赖。

用户已确认沿用现有项目，赛前准备、现场由协作者完善。按真实时间和实际工具记录工作，不把赛前 Codex 改动算成现场 Kiro 产出。现场任务与记录见 `COLLABORATOR-HANDOFF.md`、`KIRO-LOG.md`。
