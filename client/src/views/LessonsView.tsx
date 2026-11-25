import { Icon } from "../icons";

export interface LessonItem {
  id: string;
  title: string;
  subtitle: string;
  done: boolean;
}

export function LessonsView({
  lessons,
  onOpen,
}: {
  lessons: LessonItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="page-view">
      <p className="eyebrow">乐理课程</p>
      <h1>按顺序学完一套乐理体系</h1>
      <div className="section-card path-section">
        <div className="stage-list">
          {lessons.map((lesson) => (
            <button className="stage-row" key={lesson.id} onClick={() => onOpen(lesson.id)}>
              <span className="stage-icon" style={{ color: "#b892ff", background: "#b892ff18" }}>
                <Icon name="book" />
              </span>
              <span className="stage-copy">
                <small>{lesson.done ? "已完成" : "未学习"}</small>
                <strong>{lesson.title}</strong>
                <em>{lesson.subtitle}</em>
              </span>
              <Icon name="chevron" size={19} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
