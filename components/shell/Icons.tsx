import type { SVGProps } from "react";

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

type P = SVGProps<SVGSVGElement>;

export const IconHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconWallet = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    <rect x="3" y="8" width="18" height="11" rx="2" />
    <path d="M16 13.5h2" />
  </svg>
);

export const IconCompare = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 4v16M17 4v16" />
    <path d="M4 8h6M14 16h6" />
  </svg>
);

export const IconFile = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" />
    <path d="M14 3v4h4M9 13h6M9 17h4" />
  </svg>
);

export const IconMore = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconAlert = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4.5 21 19H3z" />
    <path d="M12 10v4M12 16.5v.5" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export const IconArrow = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconRupee = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 5h10M7 9.5h10M15.5 5c0 3.6-2.6 4.5-5.5 4.5h-3l8 9.5" />
  </svg>
);

export const IconShield = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 19 6v6c0 4.2-2.9 7.3-7 8.5-4.1-1.2-7-4.3-7-8.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconSpark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5l2.1 4.9 5.4.5-4.1 3.5 1.2 5.2L12 14.9l-4.6 2.7 1.2-5.2-4.1-3.5 5.4-.5z" />
  </svg>
);
