import { AE, S, handleTheoryAct, handleFretAct } from "../engine/index.js";
import { thRenderLesson } from "../engine/th-engine.js";

/* 讲解页：th-engine.js 的 thRenderLesson() 产出一整段排版好的课程内容（表格/指板示意图/
   播放按钮/下一课），内容量很大且逐课不同，直接整段复用，不重写——“换皮不换逻辑”。
   只负责渲染 + 把内部 data-act 点击转发给已迁移好的处理函数。 */
export function LessonScreen({
  onBack,
  onEnterQuiz,
}: {
  onBack: () => void;
  onEnterQuiz: () => void;
}) {
  // 和旧版 goBack() 一致：如果这节课是从答题反馈里的"回看讲解"跳进来的，返回应该回到那道题，
  // 而不是退出到"课程"Tab。
  function back() {
    AE.stopAll();
    if (S.lessonFromQuiz && S.q) {
      S.lessonFromQuiz = false;
      onEnterQuiz();
      return;
    }
    onBack();
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) return;
    const act = target.dataset.act || "";
    const btn = { dataset: target.dataset };
    if (act === "th-play") {
      handleTheoryAct("th-play", btn);
      return;
    }
    if (act === "th-next-lesson") {
      handleTheoryAct("th-next-lesson", btn);
      return;
    }
    if (act === "th-practice") {
      handleTheoryAct("th-practice", btn);
      onEnterQuiz();
      return;
    }
    if (act.startsWith("fret-")) {
      handleFretAct(act, btn);
    }
  }

  let html = "";
  try {
    html = thRenderLesson();
  } catch {
    html = "";
  }

  return (
    <section className="page-view legacy-embed">
      <button className="backbtn" onClick={back}>
        ← 返回
      </button>
      {!html ? (
        <div className="card" style={{ marginTop: 14 }}>
          没有找到这节课的内容。
        </div>
      ) : (
        <div onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}
