// inline icons: no icon package, nothing fetched
const base = { width: 20, height: 20, viewBox: "0 0 20 20", "aria-hidden": true, focusable: false } as const;

export const UpIcon = () => (
  <svg {...base}><path d="M10 4l6 8H4z" fill="currentColor" /></svg>
);
export const SendIcon = () => (
  <svg {...base}><path d="M10 16V5M5 9.5L10 4.5l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const MoreIcon = () => (
  <svg {...base}><g fill="currentColor"><circle cx="4.5" cy="10" r="1.7" /><circle cx="10" cy="10" r="1.7" /><circle cx="15.5" cy="10" r="1.7" /></g></svg>
);

// line icons for labels: 20px box, 1.75 stroke, always beside text
const line = { ...base, fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const LogoIcon = () => (
  <svg {...line}>
    <path d="M4 3.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9.5L6 16.5v-3H4A1.5 1.5 0 0 1 2.5 12V5A1.5 1.5 0 0 1 4 3.5z" />
    <path d="M8.6 7.3a1.5 1.5 0 1 1 2.2 1.3c-.5.3-.8.6-.8 1.2M10 11.6v.01" />
  </svg>
);
export const GlobeIcon = () => (
  <svg {...line}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M2.5 10h15M10 2.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5c-2-2-3-4.5-3-7.5s1-5.5 3-7.5z" />
  </svg>
);
export const PersonIcon = () => (
  <svg {...line}>
    <circle cx="10" cy="6.5" r="3" />
    <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
  </svg>
);
export const DownloadIcon = () => (
  <svg {...line}><path d="M10 3v9M6.5 8.5L10 12l3.5-3.5M4 15.5h12" /></svg>
);
export const ScreenIcon = () => (
  <svg {...line}>
    <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
    <path d="M7 17h6M10 13.5V17" />
  </svg>
);
export const CheckIcon = () => (
  <svg {...line}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>
);
export const ExpandIcon = () => (
  <svg {...line}><path d="M12 3.5h4.5V8M16.5 3.5l-5 5M8 16.5H3.5V12M3.5 16.5l5-5" /></svg>
);
