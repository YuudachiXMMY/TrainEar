import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "practice"
  | "book"
  | "user"
  | "play"
  | "flame"
  | "clock"
  | "headphones"
  | "fretboard"
  | "chevron"
  | "close"
  | "check";

const icons: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.8 12 3l9 7.8" />
      <path d="M5.5 9.5V21h13V9.5M9.5 21v-6h5v6" />
    </>
  ),
  practice: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5c3-.8 5-.2 8 1.5v15c-3-1.7-5-2.3-8-1.5v-15ZM20 4.5c-3-.8-5-.2-8 1.5v15c3-1.7 5-2.3 8-1.5v-15Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c.5-5 3-7 8-7s7.5 2 8 7" />
    </>
  ),
  play: <path d="m9 6 9 6-9 6V6Z" />,
  flame: (
    <path d="M13.5 2.5c.8 4-2.8 5-1.3 8.2.6-1.3 1.7-2 3-3.3 2 1.8 3.3 4.2 3.3 6.8a6.5 6.5 0 0 1-13 0c0-3.8 2.5-7 5.5-9-.2 2.7 1 3.8 2 4.6" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z" />
    </>
  ),
  fretboard: (
    <path d="M4 5h16M4 10h16M4 15h16M4 20h16M7 3v19M12 3v19M17 3v19" />
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}
