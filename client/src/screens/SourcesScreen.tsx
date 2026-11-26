import { useRef, useState } from "react";
import { API, AE, Samples, noteNameOct, type SampleEntry } from "../engine/index.js";

/* 自定义音源页：手写 JSX 重排 legacy renderSources()/handleSources()/midiFromFilename()
   （app.js 766~802、978~1035行），上传/试听/删除逻辑逐字照搬，只是把拼 HTML 换成
   JSX + 本地 state。 */
export function midiFromFilename(fn: string): number | null {
  const m = String(fn).match(/([A-Ga-g])([#b♯♭]?)(-?\d)/);
  if (!m) return null;
  const base: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const letter = base[m[1].toLowerCase()];
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] === "b" || m[2] === "♭" ? -1 : 0;
  const midi = letter + acc + (parseInt(m[3], 10) + 1) * 12;
  return midi >= 24 && midi <= 84 ? midi : null;
}

const NOTE_OPTS: number[] = [];
for (let m = 28; m <= 64; m++) NOTE_OPTS.push(m);

export function SourcesScreen({ onBack, onGoAuth }: { onBack: () => void; onGoAuth: () => void }) {
  const [, bump] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("any");
  const [rootMidi, setRootMidi] = useState(40);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!API.user) {
    return (
      <section className="page-view legacy-embed">
        <button className="backbtn" onClick={onBack}>
          ← 返回
        </button>
        <div className="card" style={{ textAlign: "center", padding: 28, maxWidth: 440, margin: "26px auto" }}>
          <div className="sub">自定义音源保存在你的账号里，先登录再上传。</div>
          <button style={{ marginTop: 14 }} onClick={onGoAuth}>
            去登录 / 注册
          </button>
        </div>
      </section>
    );
  }

  const allNames = [...new Set(Samples.list.map((s) => s.name))];

  async function upload() {
    if (busy) return;
    const files = fileRef.current?.files ? [...fileRef.current.files] : [];
    if (!name) {
      setMsg("先给音源起个名字");
      return;
    }
    if (!files.length) {
      setMsg("先选择音频文件");
      return;
    }
    const jobs: { f: File; midi: number }[] = [];
    for (const f of files) {
      let midi = midiFromFilename(f.name);
      if (midi === null && files.length === 1) midi = rootMidi;
      if (midi === null) {
        setMsg("无法从文件名识别音高：" + f.name + "（改名成 E1.wav 这类，或一次只传一个并用下拉指定）");
        return;
      }
      jobs.push({ f, midi });
    }
    setBusy(true);
    let done = 0;
    let fail = "";
    try {
      for (const j of jobs) {
        setMsg("上传中 " + (done + 1) + "/" + jobs.length + "：" + j.f.name);
        const fd = new FormData();
        fd.append("name", name);
        fd.append("role", role);
        fd.append("rootMidi", String(j.midi));
        fd.append("file", j.f);
        const r = await API.uploadSample(fd);
        if (r.ok) done++;
        else {
          fail = r.error || "上传失败";
          break;
        }
      }
      const ls = await API.listSamples();
      if (ls.samples) Samples.setList(ls.samples);
      setMsg(fail ? "已上传 " + done + "/" + jobs.length + "，中断于：" + fail : "已上传 " + done + " 个采样到「" + name + "」");
      bump((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function preview(s: SampleEntry) {
    AE.ensure();
    await Samples.preload(s.name);
    AE.stopAll(true);
    const ctx = AE.ctx as AudioContext;
    const group = ctx.createGain();
    group.connect(AE.master as AudioNode);
    AE.group = group;
    AE.sample(group, ctx.currentTime + 0.05, 1.8, s.rootMidi, 1, s.name);
  }

  async function del(id: number) {
    const r = await API.deleteSample(id);
    if (r.ok) {
      const ls = await API.listSamples();
      Samples.setList(ls.samples || []);
      bump((n) => n + 1);
    } else {
      setMsg(r.error || "删除失败");
    }
  }

  return (
    <section className="page-view legacy-embed">
      <button className="backbtn" onClick={onBack}>
        ← 返回
      </button>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>上传采样</h3>
        <div className="sub small" style={{ marginBottom: 10 }}>
          录干净的单音（wav / mp3 等），同一个音源名可以传多个音，播放时就近变调。
          支持一次选多个文件：按文件名自动识别音高（如 E1.wav、A#1.wav、Db2.wav）；单个文件也可以用右边的下拉手动指定。
        </div>
        <div className="row" style={{ gap: 10 }}>
          <input
            type="text"
            placeholder="音源名（如 我的P-Bass）"
            aria-label="音源名"
            style={{ flex: 1, minWidth: 150 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            list="srcNames"
          />
          <datalist id="srcNames">
            {allNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="音源用途">
            <option value="any">贝斯和和弦都可用</option>
            <option value="bass">仅作贝斯音色</option>
            <option value="chord">仅作和弦音色</option>
          </select>
          <label className="small muted">
            这个音是{" "}
            <select value={rootMidi} onChange={(e) => setRootMidi(parseInt(e.target.value, 10))}>
              {NOTE_OPTS.map((m) => (
                <option key={m} value={m}>
                  {noteNameOct(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 10 }}>
          <input type="file" ref={fileRef} accept="audio/*" multiple aria-label="选择音频文件" style={{ flex: 1 }} disabled={busy} />
          <button onClick={upload} disabled={busy}>
            上传
          </button>
        </div>
        {msg && (
          <div className="small" role="status" aria-live="polite" style={{ marginTop: 8, color: "var(--accent)" }}>
            {msg}
          </div>
        )}
      </div>

      {!allNames.length && (
        <div className="note-box">
          还没有采样。建议第一步：录你贝斯的空弦 E1、A1、D2、G2 各一个音传上来，然后在任意答题页把「贝斯」音色切成它。
        </div>
      )}

      {allNames.map((n) => {
        const rows = Samples.groupSamples(n);
        const roleLabel = { any: "贝斯/和弦通用", bass: "仅贝斯", chord: "仅和弦" }[rows[0]?.role as string] || "";
        return (
          <div className="dex-item" key={n}>
            <div className="row">
              <div className="grow">
                <span className="deg">{n}</span> <span className="muted small">{rows.length} 个采样 · {roleLabel}</span>
              </div>
            </div>
            {rows.map((s) => (
              <div className="row" style={{ marginTop: 8, paddingLeft: 4 }} key={s.id}>
                <button className="playmini" onClick={() => preview(s)} aria-label={"试听：" + n + " " + noteNameOct(s.rootMidi)}>
                  ▶
                </button>
                <span className="small sub" style={{ width: 56 }}>
                  {noteNameOct(s.rootMidi)}
                </span>
                <span className="grow" />
                <button style={{ color: "var(--bad)", fontSize: 12, padding: "5px 10px" }} onClick={() => del(s.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}
