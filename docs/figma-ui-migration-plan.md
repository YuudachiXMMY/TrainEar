# UI/UX 迁移计划：对齐 Figma Make 原型

- Figma 来源：https://www.figma.com/make/al23ZsI9EdOkLc9oSrUNtf/%E5%88%B6%E4%BD%9C%E6%89%8B%E6%9C%BA%E5%B9%B3%E6%9D%BF%E5%BA%94%E7%94%A8
- 状态：**GATE 1（计划）待用户确认**，确认前不动实现代码。
- 所属流程：`orch-change-feature`（经由 `orch-pipeline` 共享引擎）。

## 0. 定级

最初按 UI/样式改动分类为 `large` tier（跨界面、存在设计盲区）。用户在 GATE 1 讨论中选择了
"迁移到 React + Tailwind + Vite"，这实质上把范围从"换样式"升级为**架构级迁移**，已经超出
`orch-change-feature` 原本"只改行为/样式、不动架构"的量级，但用户已明确拍板，按此执行。
为控制风险：**领域逻辑（拼写引擎 / 指板引擎 / 音频合成 / 账号鉴权）不重写，只原样复用**，
真正的改动集中在渲染、导航、样式这个展示层。

## 1. 现状

- 服务端：`server/*.js`（Express + better-sqlite3）把 `public/` 当静态目录直接托管，没有构建步骤。
  `npm start` 跑 `server/index.js`，默认端口 8321。
- 客户端：纯原生 JS，`public/index.html` 用一串 `<script>` 标签顺序加载：
  `theory.js → audio.js → api.js → fret.js → drills.js → th-engine.js → th-basics.js →
  th-harmony.js → th-advanced.js → th-bassline.js → th-chords.js → app.js`，
  全部是全局函数/全局状态 `S`，`render()` 用字符串拼 HTML 写入 `#app`。
  当前 `render()` 的 `S.screen` 状态机覆盖 8 种屏幕：
  `home / mode / quiz / lesson / warmup / progress / auth / sources`。
- 测试：
  - `node tests/theory.mjs` — Playwright 直接用 `file://` 打开 `public/index.html`，
    `page.evaluate` 调用页面里的全局函数（`thScale`、`thChordNotes` 等）跑拼写引擎/
    各档不变式/界面冒烟断言。**强依赖这些函数以全局变量形式存在。**
  - `npm test`（`tests/e2e.mjs`） — Playwright 全流程：注册验证、答题同步、上传采样、切换音源。
- 现有未提交改动（与本次任务无关，属于之前会话的"乐理 5·和弦与指板"课程，已核实不冲突，
  迁移时需保留其行为）：`public/js/th-chords.js`（新文件）+ `app.css`/`index.html`/`app.js`/
  `th-engine.js`/`README.md` 的少量联动改动。

## 2. Figma 原型内容

Figma 链接是 **Figma Make** 生成的 React + Tailwind v4 原型（非传统设计稿），只包含：

- 深色视觉语言：背景 `#090d16`，卡片面 `#111725` / `#171e2d`，强调色渐变 `#ff7557 → #ff9e58`，
  字体 DM Sans + Noto Sans SC。
- 4 个页面：首页（问候+连续天数+hero 卡片+继续学习列表+本周节奏图）、训练列表（筛选 pills +
  卡片 grid）、进度（统计卡 + 大图表 + 薄弱点）、我的（头像+设置项列表）。
- 导航壳：移动端底部 4 Tab，桌面端（≥900px）侧边栏；断点 600/900/1200px。
- 一个"开始训练"确认底部弹层（session sheet）：先展示说明和时长，点"进入训练"才真正开始。

**没有**覆盖：答题页、乐理课讲解页、指板练习页、热身页、账号登录/注册表单、自定义音源管理 ——
这些是当前应用的核心交互，需要"换皮不换逻辑"的方式自行套用同一视觉语言去补全。

## 3. 本次 GATE 1 已与用户确认的方向

1. **技术路线**：迁移到 React + Tailwind + Vite（而不是在原生 JS 架构上只换 CSS）。
2. **未覆盖页面**：换皮 —— 复用新配色/卡片/按钮等视觉语言，不臆造 Figma 没有的布局，
   交互逻辑和判分规则不变。
3. **导航结构**：改成 4 个底部 Tab（同级切换）：**首页 / 课程 / 训练 / 我的**。
   原"进度"页内容合并进"我的"（profile）里展示，不单独占一个 Tab。
4. **开始训练确认层**：采用 Figma 的底部弹层模式 —— 点训练卡片先弹出说明
   （内容、预计时长、题数），用户点"进入训练"才真正开始答题。

## 4. 分阶段任务清单（task_list）

| # | 阶段 | 内容 | 产出/验收 |
|---|------|------|-----------|
| 0 | 构建脚手架 | 引入 Vite + React 18 + TypeScript + Tailwind v4；`vite build` 产物输出到 `public/`；`server/index.js` 静态托管逻辑不变；新增 `npm run dev`（Vite dev server + `/api` 代理到 Express:8321） | `npm run build` 产出可用的 `public/`，`npm start` 仍能跑通最基本页面 |
| 1 | 设计令牌 | 把 Figma `index.css` 的配色/渐变/字体（DM Sans + Noto Sans SC）搬进 Tailwind 配置 + CSS 变量 | 设计令牌文件 + 字体加载验证 |
| 2 | 引擎原样迁入 | `theory.js / audio.js / api.js / fret.js / drills.js / th-engine.js / th-basics/harmony/advanced/bassline/chords.js` 不改算法，包一层模块导出给 React 调用 | 现有逻辑单测/冒烟仍通过 |
| 3 | App 壳与导航 | TopBar + 移动端底部 4 Tab（首页/课程/训练/我的）+ 桌面侧边栏（≥900px） | 4 个 Tab 可切换，壳子无业务逻辑 |
| 4 | 首页组件 | 问候+连续天数、hero-card（渐变+贝斯指板插画+波形+"开始今日训练"）、继续学习列表、本周节奏图表（数据来自 `S.data`） | 视觉对齐 Figma 截图 |
| 5 | 课程 Tab | 现有"乐理课"讲解页列表换成 Figma 卡片视觉 | 讲解页可进入、已读状态显示正确 |
| 6 | 训练 Tab | "选模式→选档位"两级合并为一层：筛选 pills（全部/练耳/指板/乐理）+ 卡片 grid | 点卡片能定位到正确的模式+档位 |
| 7 | 未覆盖页面换皮 | 答题/讲解/指板/热身等页面只换视觉（卡片/按钮/配色），不改交互和判分逻辑 | 人工走一遍每种题型，行为不变 |
| 8 | 开始训练确认弹层 | 训练卡片 → 说明弹层（内容/时长/题数）→ "进入训练"才真正开始 | 弹层可关闭、确认后进入正确题目 |
| 9 | 我的 Tab | 合并账号云同步（auth）、自定义音源（sources）、进度统计（原 progress 页）到一个 profile 视图 | 原有登录/音源/统计功能均可用 |
| 10 | 响应式 | 按 600/900/1200px 断点适配 | 手机/平板/桌面三种宽度人工核查 |
| 11 | 测试体系适配 | `tests/theory.mjs` 调整引擎函数暴露方式以适配构建产物；`tests/e2e.mjs` 按新 DOM/class 更新选择器，行为断言不变；新增 Tab/弹层的最小测试 | `node tests/theory.mjs` 与 `npm test` 全绿 |
| 12 | 代码评审 + 安全评审 | `code-reviewer`；因涉及登录/账号 UI 入口迁移，加跑 `security-reviewer` | 评审意见清零或已处理 |
| 13 | 提交（GATE 2） | 按阶段分开提交（脚手架/壳与导航/首页/课程训练/答题换皮/我的/测试补强），提交前过一遍 diff 摘要 | 用户确认后逐个提交 |

## 5. 风险与执行约定

- 在独立分支（当前 worktree：`worktree-figma-ui-migration`）上分阶段提交，每阶段完成后至少跑一遍
  `node tests/theory.mjs` 确认引擎没被破坏，再进入下一步，方便随时回退。
- 领域逻辑（拼写/指板/音频/鉴权）不重写、只原样复用；真正的改动集中在渲染、导航、样式层。
- 工作量很大（约 2800 行原生 JS 字符串拼接 + 8 个页面要组件化，还要重整测试基建），
  预计需要多轮实现与测试修复，建议多次提交而非一次性大 PR。

## 6. 下一步

等待用户对本计划（尤其是第 4 节任务清单与第 5 节执行约定）给出 GATE 1 确认后，
从第 0～2 步（脚手架 + 设计令牌 + 引擎原样迁入）开始实现。
