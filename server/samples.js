"use strict";
/* 自定义音源：上传采样（标注根音音高），同名多条构成一个音源的多采样音区。 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { db, SAMPLES_DIR } = require("./db");
const { requireAuth } = require("./auth");

const MAX_FILE = 8 * 1024 * 1024;
const MAX_PER_USER = 60;
const OK_MIME = /^audio\/(wav|x-wav|wave|mpeg|mp3|ogg|webm|flac|aac|mp4|x-m4a)$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SAMPLES_DIR),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || "") || ".bin").slice(0, 8).replace(/[^.\w]/g, "");
      cb(null, crypto.randomBytes(12).toString("hex") + ext);
    }
  }),
  limits: { fileSize: MAX_FILE },
  fileFilter: (req, file, cb) => cb(null, OK_MIME.test(file.mimetype))
});

const router = express.Router();
router.use(requireAuth);

const rowToJson = r => ({
  id: r.id, name: r.name, role: r.role, rootMidi: r.root_midi,
  url: "/api/samples/file/" + r.id, createdAt: r.created_at
});

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM samples WHERE user_id=? ORDER BY name, root_midi").all(req.user.id);
  res.json({ samples: rows.map(rowToJson) });
});

router.post("/", upload.single("file"), (req, res) => {
  if(!req.file) return res.status(400).json({ error: "没有收到音频文件（支持 wav / mp3 / ogg / flac / m4a）" });
  const name = String(req.body.name || "").trim().slice(0, 40);
  const role = ["bass", "chord", "any"].includes(req.body.role) ? req.body.role : "any";
  const rootMidi = parseInt(req.body.rootMidi, 10);
  const bad = msg => { fs.unlink(req.file.path, ()=>{}); res.status(400).json({ error: msg }); };
  if(!name) return bad("音源名不能为空");
  if(!(rootMidi >= 24 && rootMidi <= 84)) return bad("采样音高超出范围");
  const count = db.prepare("SELECT COUNT(*) n FROM samples WHERE user_id=?").get(req.user.id).n;
  if(count >= MAX_PER_USER) return bad("采样数量已达上限 " + MAX_PER_USER);
  const info = db.prepare(
    `INSERT INTO samples(user_id, name, role, root_midi, filename, mime, created_at)
     VALUES(?,?,?,?,?,?,?)`)
    .run(req.user.id, name, role, rootMidi, req.file.filename, req.file.mimetype, Date.now());
  const row = db.prepare("SELECT * FROM samples WHERE id=?").get(info.lastInsertRowid);
  res.json({ ok: true, sample: rowToJson(row) });
});

router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM samples WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if(!row) return res.status(404).json({ error: "采样不存在" });
  db.prepare("DELETE FROM samples WHERE id=?").run(row.id);
  fs.unlink(path.join(SAMPLES_DIR, row.filename), ()=>{});
  res.json({ ok: true });
});

router.get("/file/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM samples WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if(!row) return res.status(404).end();
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(path.join(SAMPLES_DIR, row.filename));
});

module.exports = { router };
