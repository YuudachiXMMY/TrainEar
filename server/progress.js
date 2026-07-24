"use strict";
/* 进度云同步：整份 JSON 存取，最后写入者胜。 */
const express = require("express");
const { db } = require("./db");
const { requireAuth } = require("./auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const row = db.prepare("SELECT data, updated_at FROM progress WHERE user_id=?").get(req.user.id);
  if(!row) return res.json({ data: null, updatedAt: null });
  let data = null;
  try{ data = JSON.parse(row.data); }catch(e){}
  res.json({ data, updatedAt: row.updated_at });
});

router.put("/", (req, res) => {
  const data = req.body && req.body.data;
  if(!data || typeof data !== "object" || !data.v)
    return res.status(400).json({ error: "进度数据格式不对" });
  const text = JSON.stringify(data);
  if(text.length > 512 * 1024) return res.status(413).json({ error: "进度数据过大" });
  db.prepare(`INSERT INTO progress(user_id, data, updated_at) VALUES(?,?,?)
              ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`)
    .run(req.user.id, text, Date.now());
  res.json({ ok: true, updatedAt: Date.now() });
});

module.exports = { router };
