# J-Rock 练耳训练器

Bass 手专用的分阶段听力训练器，对应《Bassline 学习方法论与练习路线》第三部分（阶段 0 到 3）。题库直接使用 J-Pop / J-Rock 高频套路：王道、小室、卡农、Axis、悲怆循环、下行线、丸サ、平行调借用。

## 功能

- 阶段 0 热身：drone 加唱级数音型，数字跟随高亮
- 阶段 1 根音追踪（4 档）：级数听辨（三八度电贝斯目标音、5/6m 加权、1 级防背音高）、根音走向、终止式
- 阶段 2 性质听辨（4 档）：三度对比、三和弦、属七、七和弦家族，答错可 A/B 对比听
- 阶段 3 套路整体识别（5 档）：套路池递增、套路变奏（随机调加变奏伴奏）、调外和弦侦测（副属 / 借用 4m / b6 b7，带全调内版 A/B 对比）
- 音色：默认**采样电贝斯**（Karoryfer「Black And Blue Basses」真实录音，CC0，逐半音采样加双 round robin 轮换），另有 Karplus-Strong 建模电贝斯、减法合成贝斯、clean 电吉他、EP 键盘，以及**自定义采样音源**（上传单音、标注音名、就近变调铺满全音域）
- 账号与云同步：注册（邮箱验证码）、密码或邮箱验证码登录，进度与音源存服务器，换设备续练
- 过关线：每档近 20 题正确率 90%；进度页有每日题量、连续天数、最常混淆统计

## 运行

```bash
npm install
npm start          # http://localhost:8321
```

数据（SQLite 数据库与上传的采样）存在 `data/` 目录，已被 git 忽略；备份整个 `data/` 即备份全部账号与进度。

邮件：默认「console 模式」，注册和登录的验证码直接打印在运行 `npm start` 的终端里。要真实发信，复制 `.env.example` 为 `.env` 并填入 SMTP 配置。

不起服务、直接双击打开 `public/index.html` 也能用（离线模式）：训练功能完整，仅无账号、云同步和自定义音源。

## 测试

```bash
npm test           # 起真实服务，Playwright 全流程：注册验证、答题同步、上传采样、切换音源
```

需要本机可用的 Chromium，路径可用环境变量 `CHROMIUM_PATH` 指定。

## 结构

```
server/          Express + better-sqlite3：auth（scrypt 密码、验证码、cookie 会话）、progress、samples
public/
  js/theory.js   乐理数据与题库（套路 / 终止式 / 调外侦测 / 走向）
  js/audio.js    Web Audio 引擎：KS 拨弦合成、采样播放器、乐句生成与 voice leading
  js/api.js      服务端 API 客户端（file:// 打开自动进入离线模式）
  js/app.js      状态、出题规则、界面、云同步
tests/e2e.mjs    端到端测试
legacy/          拆分前的单文件版本（v3），可独立使用
```

## 部署（IthacaServer / trainear.jadynwu.com）

本应用按 IthacaServer v2 的 git-source 单容器模式部署，配置放在 IthacaServer 仓库的 `apps/trainear/`（app.env、docker-compose.yml、config/Dockerfile）。要点：

- 服务端支持两个部署环境变量：`TRUST_PROXY=1`（Traefik 反代后信任 X-Forwarded-*，限速取真实 IP）、`SECURE_COOKIES=1`（会话 cookie 加 Secure，仅 HTTPS 下发）。本地开发不设即可。
- 健康检查端点 `GET /api/health`，容器 healthcheck 与平台探活共用。
- SQLite 与上传采样都在 `DATA_DIR`（容器内 `/data`，宿主 `apps/trainear/data/app`），`ops backup` 直接打包，无需独立数据库 dump（`DB_TYPE=""`）。
- SMTP 留空时验证码打印在容器日志（`ops logs` 查看）；配好 SMTP 环境变量后真实发信。

日常操作（开发者视角）：推代码到 `main` 后 `ssh trainear 'ops deploy'`，然后 `ops status` / `ops logs` 验证；备份 `ops backup`。

## 音源

内置采样电贝斯来自 Karoryfer Samples「Black And Blue Basses」（CC0 公有领域），取 dark black 贝斯常规拨奏 mf 力度层的两个 round robin，逐半音覆盖 MIDI 25 到 54，重复音自动轮换 RR。文件在 `public/samples/bass/`，处理说明见该目录的 README。file:// 离线打开时无法加载采样，自动回退建模电贝斯。

自定义音源：音源管理里上传单音采样（wav / mp3 / ogg / flac / m4a，单个不超过 8MB）。支持一次多选，文件名形如 `E1.wav`、`A#1.wav`、`Db2.wav` 会自动识别音高；同一个音源名的多个音构成音区，播放时就近变调。上传后在首页或任意答题页把「贝斯」或「和弦」音色切过去即可。

用 Guitar Pro 自制音源：GP 里建一条 bass 轨，从 E1 起每隔固定秒数半音上行（如 120 BPM 每小节一个全音符 = 2 秒一个音），选好 RSE 音色导出 16-bit WAV，然后：

```bash
python3 tools/slice-samples.py export.wav --start E1 --interval 2
```

会切出按音名命名的单音 wav，去网页里一次全选上传即可。注意 GP 的 RSE 音色版权归 Arobas Music，自用没问题，公开分发这些采样要谨慎。
