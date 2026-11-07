import type { Key } from "./i18n";

// runes counts characters the way the server does (code points).
export const runes = (s: string) => [...s].length;

export const MAX_TEXT = 280;
export const MAX_NAME = 40;
export const MAX_TITLE = 80;

type T = (key: Key, vars?: Record<string, string | number>) => string;

export function ago(createdAt: string, now: number, t: T): string {
  const min = Math.floor((now - Date.parse(createdAt)) / 60_000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minutesAgo", { n: min });
  return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// host:port only, for the projector and the invite
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
