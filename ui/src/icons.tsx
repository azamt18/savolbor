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
