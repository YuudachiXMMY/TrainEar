import { Icon, type IconName } from "../icons";

export interface StageItem {
  tag: string;
  title: string;
  subtitle: string;
  progress: number;
  color: string;
  icon: IconName;
  modeKey: string;
  levelIdx: number;
}

export interface WeekItem {
  day: string;
  value: number;
  done: boolean;
}

export interface HomeData {
  greeting: string;
  streakDays: number;
  heroTitle: string;
  heroDesc: string;
  heroDurationLabel: string;
  stages: StageItem[];
  week: WeekItem[];
  weekAccuracyPct: number;
  insightText: string;
}

export function HomeView({
  data,
  onStart,
  onViewAll,
}: {
  data: HomeData;
  onStart: (modeKey: string, levelIdx: number) => void;
  onViewAll: () => void;
}) {
  const heroMode = data.stages[0];
  return (
    <>
      <section className="greeting">
        <div>
          <p className="eyebrow">{data.greeting}</p>
          <h1>
            让低音更有<span>方向感</span>
          </h1>
        </div>
        <div className="streak">
          <Icon name="flame" size={20} />
          <strong>{data.streakDays}</strong>
          <span>天连续</span>
        </div>
      </section>

      <section className="hero-card">
        <div className="hero-copy">
          <div className="session-label">
            <span>今日训练</span>
            <span className="dot" />
            {data.heroDurationLabel}
          </div>
          <h2>
            {data.heroTitle.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p>{data.heroDesc}</p>
          <button
            className="primary-btn"
            disabled={!heroMode}
            onClick={() => heroMode && onStart(heroMode.modeKey, heroMode.levelIdx)}
          >
            <span className="play-disc">
              <Icon name="play" size={18} />
            </span>
            开始今日训练
          </button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orb" />
          <div className="bass-neck">
            {[0, 1, 2, 3].map((string) => (
              <i key={string} />
            ))}
            <b className="note n1">1</b>
            <b className="note n2">5</b>
            <b className="note n3">6</b>
          </div>
          <div className="waveform">
            {[22, 44, 30, 62, 83, 48, 70, 35, 56, 26, 46, 20].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </section>

      <div className="content-grid">
        <section className="section-card path-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">学习路径</span>
              <h3>继续你的练习</h3>
            </div>
            <button className="text-btn" onClick={onViewAll}>
              查看全部 <Icon name="chevron" size={16} />
            </button>
          </div>
          <div className="stage-list">
            {data.stages.map((stage) => (
              <button
                className="stage-row"
                key={stage.title}
                onClick={() => onStart(stage.modeKey, stage.levelIdx)}
              >
                <span className="stage-icon" style={{ color: stage.color, background: `${stage.color}18` }}>
                  <Icon name={stage.icon} />
                </span>
                <span className="stage-copy">
                  <small>{stage.tag}</small>
                  <strong>{stage.title}</strong>
                  <em>{stage.subtitle}</em>
                </span>
                <span className="stage-progress">
                  <span>
                    <b>{stage.progress}%</b>
                    <i style={{ background: stage.color, width: `${stage.progress}%` }} />
                  </span>
                  <Icon name="chevron" size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="section-card weekly-card">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">本周节奏</span>
              <h3>保持练习</h3>
            </div>
            <span className="accuracy">
              {data.weekAccuracyPct}%<small>正确率</small>
            </span>
          </div>
          <div className="bar-chart">
            {data.week.map((item) => (
              <div
                className={`bar-column ${item.done ? "done" : ""}`}
                key={item.day}
                role="img"
                aria-label={`${item.day}：${item.done ? item.value + "% 正确率" : "未练习"}`}
              >
                <div className="bar-track">
                  <span style={{ height: `${item.value}%` }} />
                </div>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
          <div className="insight">
            <span>
              <Icon name="flame" size={18} />
            </span>
            <p>{data.insightText}</p>
          </div>
        </section>
      </div>
    </>
  );
}
