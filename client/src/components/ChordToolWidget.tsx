import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import {
  TH_ROOTS12,
  TH_CH,
  THCT_GROUPS,
  thNm,
  thChordToolTones,
  thChordToolMarks,
  fretboardHtml,
} from "../engine/index.js";

/* 和弦工具：常驻小浮窗，点开才查和弦用的音（级数优先，选根音后再给字母音名）和它们在
   整条指板上的所有位置。防误触设计：
   1) 默认收起成一个小圆按钮，不是铺开的面板——不会挡住下面的内容，不小心碰到也只是
      移动/点一下按钮本身，不会触发下面应用的其他操作；
   2) 按住拖动一段距离才算"拖拽重定位"，位移很小则当成"点击"——这样手抖、长按误触不
      会被当成一次有效点击，轻点也不会被漏判成拖拽而展开失败；
   3) 展开后点面板外或按 Esc 关闭；
   4) 练习答题（quiz/warmup）过程中由上层传 hidden=true 整个隐藏，避免答题时误触。 */

const DRAG_THRESHOLD = 6; // px，低于这个位移不算拖拽，只当一次点击
const FAB_SIZE = 52;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

interface DragState {
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  moved: boolean;
}

export function ChordToolWidget({ hidden }: { hidden: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rootIdx, setRootIdx] = useState(0);
  const [quality, setQuality] = useState("maj");
  const dragRef = useRef<DragState | null>(null);

  // 默认停在右下角、底部导航上方；只在第一次挂载时算一次初始位置
  useEffect(() => {
    if (pos) return;
    setPos({
      x: window.innerWidth - FAB_SIZE - 18,
      y: window.innerHeight - FAB_SIZE - 96,
    });
  }, [pos]);

  // 转屏/缩放窗口后把按钮夹回可见范围，避免飞出屏幕外够不到
  useEffect(() => {
    function onResize() {
      setPos((p) =>
        p && {
          x: clamp(p.x, 4, window.innerWidth - FAB_SIZE - 4),
          y: clamp(p.y, 4, window.innerHeight - FAB_SIZE - 4),
        }
      );
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true;
    if (!d.moved) return;
    setPos({
      x: clamp(d.baseX + dx, 4, window.innerWidth - FAB_SIZE - 4),
      y: clamp(d.baseY + dy, 4, window.innerHeight - FAB_SIZE - 4),
    });
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    // 位移没超过阈值才当一次点击：避开"拖拽到一半手指没动稳"被误判成点击展开，
    // 也避开"只是想拖拽、轻轻碰了一下"被当成有效操作
    if (d && !d.moved) setExpanded((v) => !v);
  }

  const root = TH_ROOTS12[rootIdx];
  const tones = useMemo(() => thChordToolTones(root, quality), [root, quality]);
  const fbHtml = useMemo(() => {
    const { tun, marks } = thChordToolMarks(root, quality);
    return fretboardHtml({ tun, marks, wide: true, enabled: () => false });
  }, [root, quality]);

  if (hidden || !pos) return null;

  return (
    <>
      <button
        className="chord-tool-fab"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label="和弦工具"
        aria-expanded={expanded}
      >
        <Icon name="fretboard" size={22} />
      </button>
      {expanded && (
        <div className="chord-tool-backdrop" onMouseDown={() => setExpanded(false)}>
          <div
            className="chord-tool-panel"
            role="dialog"
            aria-modal="true"
            aria-label="和弦工具"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="chord-tool-head">
              <span>和弦工具</span>
              <button className="close-btn" onClick={() => setExpanded(false)} aria-label="关闭">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="chord-tool-roots" role="group" aria-label="根音">
              {TH_ROOTS12.map((r, i) => (
                <button
                  key={i}
                  className={"chord-tool-chip" + (i === rootIdx ? " active" : "")}
                  onClick={() => setRootIdx(i)}
                >
                  {thNm(r)}
                </button>
              ))}
            </div>

            {THCT_GROUPS.map((g) => (
              <div className="chord-tool-qgroup" key={g.label}>
                <span className="chord-tool-glabel">{g.label}</span>
                <div className="chord-tool-qlist" role="group" aria-label={g.label}>
                  {g.keys.map((k) => (
                    <button
                      key={k}
                      className={"chord-tool-chip" + (k === quality ? " active" : "")}
                      onClick={() => setQuality(k)}
                      title={TH_CH[k].zh}
                    >
                      {thNm(root) + TH_CH[k].sym}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="chord-tool-notes">
              {tones.map((t, i) => (
                <span className="chord-tool-note" key={i}>
                  <b>{t.lab}</b>
                  {t.name}
                </span>
              ))}
            </div>

            <div className="chord-tool-fretboard legacy-embed" dangerouslySetInnerHTML={{ __html: fbHtml }} />
          </div>
        </div>
      )}
    </>
  );
}
