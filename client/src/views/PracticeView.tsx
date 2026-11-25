import { useState } from "react";
import { Icon, type IconName } from "../icons";

export interface PracticeItem {
  tag: string;
  title: string;
  subtitle: string;
  progress: number;
  color: string;
  icon: IconName;
}

const FILTERS = ["全部", "练耳", "指板", "乐理"];

export function PracticeView({
  items,
  onStart,
}: {
  items: PracticeItem[];
  onStart: (title: string) => void;
}) {
  const [filter, setFilter] = useState("全部");
  const visible = items.filter((x) => filter === "全部" || x.tag.startsWith(filter));

  return (
    <section className="page-view">
      <p className="eyebrow">训练中心</p>
      <h1>今天想练什么？</h1>
      <div className="filters">
        {FILTERS.map((x) => (
          <button
            key={x}
            className={filter === x ? "active" : ""}
            onClick={() => setFilter(x)}
            aria-pressed={filter === x}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="practice-grid">
        {visible.map((item) => (
          <button className="practice-card" key={item.title} onClick={() => onStart(item.title)}>
            <span className="stage-icon" style={{ color: item.color, background: `${item.color}18` }}>
              <Icon name={item.icon} />
            </span>
            <small>{item.tag}</small>
            <h3>{item.title}</h3>
            <p>{item.subtitle}</p>
            <div className="card-progress">
              <span>
                <i style={{ width: `${item.progress}%`, background: item.color }} />
              </span>
              <b>{item.progress}%</b>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
