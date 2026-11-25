import { Icon, type IconName } from "../icons";

export function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <span className="nav-icon">
        <Icon name={icon} />
      </span>
      <span>{label}</span>
    </button>
  );
}
