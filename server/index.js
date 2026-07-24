"use strict";
/* J-Rock 练耳训练器 · 服务端入口
   启动：npm start   （默认 http://localhost:8321）
   环境变量：PORT、DATA_DIR、SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM/SMTP_SECURE
   支持根目录 .env 文件（KEY=VALUE 每行一条）。 */
const fs = require("fs");
const path = require("path");

// 极简 .env 加载（不覆盖已有环境变量）
const envPath = path.join(__dirname, "..", ".env");
if(fs.existsSync(envPath)){
  for(const line of fs.readFileSync(envPath, "utf-8").split("\n")){
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if(m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const express = require("express");
require("./db"); // 初始化数据库
const auth = require("./auth");
const progress = require("./progress");
const samples = require("./samples");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "600kb" }));
app.use(auth.sessionMiddleware);

app.use("/api/auth", auth.router);
app.use("/api/progress", progress.router);
app.use("/api/samples", samples.router);

app.use(express.static(path.join(__dirname, "..", "public")));

// 兜底错误处理（multer 超限等）
app.use((err, req, res, next) => {
  if(err && err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "文件超过 8MB 上限" });
  console.error(err);
  res.status(500).json({ error: "服务器内部错误" });
});

const PORT = parseInt(process.env.PORT || "8321", 10);
app.listen(PORT, () => {
  console.log(`练耳训练器已启动: http://localhost:${PORT}`);
  console.log(`邮件模式: ${auth.mailMode() === "smtp" ? "SMTP 真实发送" : "console（验证码打印在本终端）"}`);
});
