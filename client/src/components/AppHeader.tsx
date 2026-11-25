export function AppHeader({ onAvatarClick }: { onAvatarClick: () => void }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <span>BASSLINE</span>
      </div>
      <button className="avatar" aria-label="个人资料" onClick={onAvatarClick}>
        练<span className="status-dot" />
      </button>
    </header>
  );
}
