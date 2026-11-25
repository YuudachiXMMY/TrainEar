import { useState } from "react";
import { AE, S, KEYS, WARMUP_PATTERNS, MAJOR_SCALE } from "../engine/index.js";

/* 热身页：内容不大，手写 JSX。drone 开关/逐行播放的算法原样照抄 legacy
   renderWarmup()/点击处理（app.js 的 "drone"/"warm-play" 分支），只是把原来靠
   querySelector 切 .cur class 的高亮方式换成 React 本地 state。 */
function degLabel(d: number): string {
  if (d === 8) return "1";
  if (d < 0) return "低" + -d;
  return String(d);
}

export function WarmupScreen({ onBack }: { onBack: () => void }) {
  const [droneOn, setDroneOn] = useState(!!S.droneOn);
  const [playingRow, setPlayingRow] = useState<number | null>(null);
  const [curIdx, setCurIdx] = useState<number>(-1);

  const key = KEYS.find((k) => k.name === (S.data.settings as { key?: string }).key) || KEYS[2];
  const tonic3 = 48 + key.pc;

  function back() {
    AE.stopAll();
    S.droneOn = false;
    setDroneOn(false);
    onBack();
  }

  function toggleDrone() {
    AE.ensure();
    const on = AE.toggleDrone(tonic3 - 24, tonic3 - 12);
    S.droneOn = on;
    setDroneOn(on);
  }

  function playRow(i: number) {
    AE.ensure();
    const p = WARMUP_PATTERNS[i];
    const events: unknown[] = [];
    const marks: { t: number; fn: () => void }[] = [];
    p.degs.forEach((d, j) => {
      const semi = d === 8 ? 12 : d < 0 ? MAJOR_SCALE[-d - 1] - 12 : MAJOR_SCALE[d - 1];
      events.push({ t: j, dur: 0.92, midi: tonic3 + semi, voice: "tone", vel: 0.9 });
      marks.push({
        t: j,
        fn: () => {
          setPlayingRow(i);
          setCurIdx(j);
        },
      });
    });
    AE.play(events, {
      bpm: 66,
      marks,
      onEnd: () => {
        setPlayingRow(null);
        setCurIdx(-1);
      },
    });
  }

  return (
    <section className="page-view legacy-embed">
      <button className="backbtn" onClick={back}>
        ← 返回
      </button>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="sub small">
          放着 drone，对它唱<b>数字</b>：先唱再弹确认，唱不准的音程永远听不出来。前期一半时间在唱，不在听。
          <br />
          过关标准：不看琴，能对着 drone 稳定唱准 1、3、4、5、6 之间的任意跳进。
        </div>
      </div>
      <div className="drone-row">
        <button style={{ width: "auto", padding: "0 16px", borderRadius: 10 }} onClick={toggleDrone}>
          {droneOn ? "■ 停止 Drone" : "▶ 播放 Drone"}
        </button>
        <div className="grow small sub">
          持续音 <b>{key.name}</b>（在首页可换调）
        </div>
      </div>
      {WARMUP_PATTERNS.map((p, i) => (
        <div className="pattern-row" key={p.name}>
          <button className="playmini" onClick={() => playRow(i)} aria-label={"播放：" + p.name}>
            ▶
          </button>
          <div className="grow">
            <div className="deg-seq">
              {p.degs.map((d, j) => (
                <span key={j} className={playingRow === i && curIdx === j ? "cur" : ""}>
                  {" " + degLabel(d) + " "}
                </span>
              ))}
            </div>
            <div className="why">
              {p.name} · {p.why}
            </div>
          </div>
        </div>
      ))}
      <div className="note-box" style={{ marginTop: 12 }}>
        琴和嗓子互相校准：弹一个音接着唱出来；先唱一个音再在琴上找到它。这一页的参考音在 {key.name}3 附近，觉得高就低八度唱。
      </div>
    </section>
  );
}
