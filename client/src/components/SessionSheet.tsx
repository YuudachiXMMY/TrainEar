import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";

export interface SessionInfo {
  title: string;
  durationLabel: string;
  countLabel: string;
  difficultyLabel: string;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function SessionSheet({
  session,
  onClose,
  onConfirm,
}: {
  session: SessionInfo;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [started, setStarted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 对话框可访问性：打开时把焦点移进弹层，关闭时还给原来触发它的元素；
  // Esc 关闭；Tab/Shift+Tab 在弹层内循环，不漏到被遮挡的背景内容上。
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeBtn = sheetRef.current?.querySelector<HTMLElement>(".close-btn");
    closeBtn?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div
        className="session-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-sheet-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close-btn" onClick={onClose} aria-label="关闭">
          <Icon name="close" />
        </button>
        {!started ? (
          <>
            <span className="session-art">
              <Icon name="headphones" size={34} />
            </span>
            <p className="eyebrow">准备训练</p>
            <h2 id="session-sheet-title">{session.title}</h2>
            <p className="sheet-desc">戴上耳机，先听整体律动，再把注意力放到最低的音。</p>
            <div className="session-meta">
              <span>
                <Icon name="clock" size={18} />
                {session.durationLabel}
              </span>
              <span>{session.countLabel}</span>
              <span>{session.difficultyLabel}</span>
            </div>
            <button className="primary-btn full" onClick={() => setStarted(true)}>
              <span className="play-disc">
                <Icon name="play" size={18} />
              </span>
              进入训练
            </button>
          </>
        ) : (
          <div className="ready-state">
            <span className="ready-check">
              <Icon name="check" size={38} />
            </span>
            <p className="eyebrow">训练已就绪</p>
            <h2 id="session-sheet-title">先听，再判断</h2>
            <p>即将进入答题界面。</p>
            <button className="primary-btn full" onClick={onConfirm}>
              进入训练
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
