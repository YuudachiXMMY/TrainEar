import { Icon } from "../icons";

export interface ProfileStat {
  value: string;
  label: string;
}

export interface ProfileSetting {
  id: string;
  label: string;
}

export function ProfileView({
  name,
  subtitle,
  stats,
  settings,
  onOpenSetting,
}: {
  name: string;
  subtitle: string;
  stats: ProfileStat[];
  settings: ProfileSetting[];
  onOpenSetting: (id: string) => void;
}) {
  return (
    <section className="page-view profile-view">
      <div className="profile-avatar">{name.slice(0, 2)}</div>
      <p className="eyebrow">个人中心</p>
      <h1>{name}</h1>
      <p>{subtitle}</p>

      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="section-card profile-settings">
        {settings.map((s) => (
          <button key={s.id} onClick={() => onOpenSetting(s.id)}>
            {s.label} <Icon name="chevron" />
          </button>
        ))}
      </div>
    </section>
  );
}
