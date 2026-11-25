import { useEffect, useRef } from "react";
import {
  S,
  AE,
  submitAnswer,
  runFeedbackAction,
  playCurrent,
  startQuestion,
  levelStat,
  recent20Rate,
  thFbAction,
  handleTheoryAct,
  handleFretAct,
  renderFretQuiz,
  fretAfterRender,
} from "../engine/index.js";
import { thRenderQuiz } from "../engine/th-engine.js";

/* 答题页：原生出题（S.q.kind=root/seq/quality/cadence/outside/variant/pattern）手写 JSX
   （选项形状统一、明确——value/label/sub，没有 .html/.visual 这类需要整段复用 HTML 的情况）；
   乐理课出题（S.q.theory）和指板出题（S.q.fret）各课程/题型的题面差异很大（表格/示意图/
   节奏格/五度圈……），直接复用已迁移好的 thRenderQuiz()/renderFretQuiz() 整段 HTML + 委托点击，
   不重新画一遍——“换皮不换逻辑”。出题/判分/讲解逻辑全部来自 engine，这里只负责渲染和转发点击。 */

function dispatchEmbedAct(
  e: React.MouseEvent<HTMLDivElement>,
  onOpenLesson: (id: string) => void
) {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!target) return;
  const act = target.dataset.act || "";
  const btn = { dataset: target.dataset };
  if (act === "answer") {
    submitAnswer(parseInt(target.dataset.i || "0", 10));
    return;
  }
  if (act === "next") {
    AE.ensure();
    startQuestion();
    return;
  }
  if (act === "replay") {
    AE.ensure();
    playCurrent(false);
    return;
  }
  if (act === "replay-slow") {
    AE.ensure();
    playCurrent(true);
    return;
  }
  if (act === "fb") {
    AE.ensure();
    runFeedbackAction(target.dataset.fb || "");
    return;
  }
  if (act === "th-fb") {
    AE.ensure();
    thFbAction(target.dataset.fb || "");
    return;
  }
  if (act === "th-play") {
    handleTheoryAct("th-play", btn);
    return;
  }
  if (act === "th-lesson") {
    handleTheoryAct("th-lesson", btn);
    onOpenLesson(target.dataset.id || "");
    return;
  }
  if (act.startsWith("fret-")) {
    handleFretAct(act, btn);
    return;
  }
}

export function QuizScreen({
  onBack,
  onOpenLesson,
}: {
  onBack: () => void;
  onOpenLesson: (id: string) => void;
}) {
  const q = S.q;

  function back() {
    AE.stopAll();
    S.screen = "home";
    onBack();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        back();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        AE.ensure();
        playCurrent(false);
        return;
      }
      if (e.key === "Enter") {
        if (S.answered) {
          AE.ensure();
          startQuestion();
        }
        return;
      }
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && S.q?.options && n <= S.q.options.length && !S.answered) {
        submitAnswer(n - 1);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // 只挂载/卸载一次：闭包里用到的 back/AE/playCurrent/startQuestion/submitAnswer
    // 都是稳定的模块导入，S.* 是共享可变对象，每次按键时直接读的是最新值，不存在过期闭包问题。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 注意顺序：q.theory 要先于 q.fret 判断。乐理课里有些题型（如 tb-2 指板音程形状）
  // 会同时把 q.theory=true 和 q.fret=true 都设上（fret 这里只是复用“点指板格子”的
  // 交互标记，q.ext 只有 .click，没有 .render），但渲染必须走 thRenderQuiz()——
  // 真正的“这是不是独立指板模式”判断标准是 isFretMode(S.modeKey)/genQuestion() 的
  // 调度方式，不是题目对象上的 q.fret 这个字段。先查 q.theory 就不会走错分支。
  const isDedicatedFretQuiz = !!q?.fret && !q?.theory;
  const fretHtml = isDedicatedFretQuiz ? renderFretQuiz() : null;
  const embedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isDedicatedFretQuiz) fretAfterRender();
  }, [q, fretHtml, isDedicatedFretQuiz]);

  if (!q) {
    return (
      <section className="page-view legacy-embed">
        <button className="backbtn" onClick={back}>
          ← 返回
        </button>
        <div className="card" style={{ marginTop: 14 }}>
          没有进行中的题目。
        </div>
      </section>
    );
  }

  if (q.theory) {
    const theoryHtml = thRenderQuizSafe();
    return (
      <section className="page-view legacy-embed">
        <button className="backbtn" onClick={back}>
          ← 返回
        </button>
        <div onClick={(e) => dispatchEmbedAct(e, onOpenLesson)} dangerouslySetInnerHTML={{ __html: theoryHtml }} />
      </section>
    );
  }

  if (isDedicatedFretQuiz) {
    return (
      <section className="page-view legacy-embed">
        <button className="backbtn" onClick={back}>
          ← 返回
        </button>
        <div
          ref={embedRef}
          onClick={(e) => dispatchEmbedAct(e, onOpenLesson)}
          dangerouslySetInnerHTML={{ __html: fretHtml || "" }}
        />
      </section>
    );
  }

  // ---- 原生出题（root/seq/quality/cadence/outside/variant/pattern）：手写 JSX ----
  const level = q.level;
  const st = levelStat(level.id);
  const r = recent20Rate(st);
  const dotN = q.dots ? q.dots.length : 0;
  const levelName = (level.name as string | undefined)?.split(" · ")[0] || (level.name as string) || "";
  const narrow = q.kind === "root" || q.kind === "quality";
  const feedback = S.feedback;

  return (
    <section className="page-view legacy-embed">
      <button className="backbtn" onClick={back}>
        ← 返回
      </button>
      <div className="quiz-head">
        <span className="small muted">{levelName}</span>
        <div className="quiz-stats">
          <span>
            近20 <b>{r === null ? "–" : Math.round(r * 100) + "%"}</b>
          </span>
          <span>
            连对 <b>{st.streak}</b>
          </span>
          <span>
            本档 <b>{st.c}/{st.a}</b>
          </span>
          {st.passed && <span style={{ color: "var(--good)" }}>✓ 已过关</span>}
        </div>
      </div>

      <div className="playzone">
        <button
          id="bigplayBtn"
          className={"bigplay" + (S.playing ? " playing" : "")}
          onClick={() => {
            AE.ensure();
            playCurrent(false);
          }}
          title="再听一遍（空格）"
          aria-label="再听一遍"
        >
          ▶
        </button>
        {dotN > 0 && (
          <div id="beatDots" className="beat-dots">
            {Array.from({ length: dotN }, (_, i) => (
              <span key={i} className="beat-dot" />
            ))}
          </div>
        )}
        <div id="playCaption" className="play-caption">
          {q.idle}
        </div>
        <div className="replay-row">
          <button
            onClick={() => {
              AE.ensure();
              playCurrent(false);
            }}
          >
            再听 <span className="kbd">空格</span>
          </button>
          <button
            onClick={() => {
              AE.ensure();
              playCurrent(true);
            }}
          >
            慢速再听
          </button>
        </div>
      </div>

      <div className={"opts" + (narrow ? " narrow" : "")}>
        {(q.options || []).map((o, i) => {
          let cls = "opt";
          if (S.answered) {
            if (o.value === q.answerValue) cls += " correct";
            else if (i === S.chosenIdx) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button key={o.value + "-" + i} className={cls} disabled={S.answered} onClick={() => submitAnswer(i)}>
              <span className="key-hint">{i + 1}</span>
              {o.label}
              {o.sub && <span className="opt-sub">{o.sub}</span>}
            </button>
          );
        })}
      </div>

      {S.answered && feedback && (
        <div className={"feedback " + (feedback.ok ? "ok" : "no")}>
          <div className="fb-title">{(feedback.ok ? "✓ " : "✕ ") + feedback.title}</div>
          <div className="fb-detail" dangerouslySetInnerHTML={{ __html: feedback.detail }} />
          <div className="fb-actions">
            {(feedback.actions || []).map((a) => (
              <button
                key={a.act}
                onClick={() => {
                  AE.ensure();
                  runFeedbackAction(a.act);
                }}
              >
                {a.label}
              </button>
            ))}
            <button
              className="next"
              onClick={() => {
                AE.ensure();
                startQuestion();
              }}
            >
              下一题 <span className="kbd">回车</span>
            </button>
          </div>
        </div>
      )}
      <div className="tiny muted" style={{ textAlign: "center" }}>
        键盘：数字选答案 · 空格再听 · 回车下一题 · Esc 返回
      </div>
    </section>
  );
}

function thRenderQuizSafe(): string {
  try {
    return thRenderQuiz();
  } catch {
    return "";
  }
}
