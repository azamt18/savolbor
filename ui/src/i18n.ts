import { useSyncExternalStore } from "react";

export type Lang = "uz" | "en";

const uz = {
  title: "Savol bor",
  askPlaceholder: "Savolingizni yozing…",
  namePlaceholder: "Ismingiz (ixtiyoriy)",
  addName: "Ism qoʻshish",
  send: "Yuborish",
  sent: "Yuborildi",
  charsLeft: "{n} belgi qoldi",
  top: "Top savollar",
  newest: "Yangi",
  mine: "Meniki",
  you: "siz",
  justNow: "hozirgina",
  minutesAgo: "{n} daq oldin",
  answered: "Javob berilgan",
  answeredCount: "Javob berilgan ({n})",
  edited: "tahrirlangan",
  edit: "Tahrirlash",
  save: "Saqlash",
  cancel: "Bekor qilish",
  delete: "Oʻchirish",
  more: "Boshqa amallar",
  confirmDelete: "Savol oʻchirilsinmi?",
  vote: "Ovoz berish",
  voted: "Ovoz berdingiz",
  nowAnswering: "Hozir javob berilmoqda",
  empty: "Hali savol yoʻq. Birinchi boʻlib soʻrang.",
  emptyMine: "Siz hali savol bermadingiz.",
  offline: "Aloqa yoʻq. Qayta ulanmoqda…",
  anonymous: "Anonim",
  err_empty: "Savol matnini yozing.",
  err_too_long: "Savol 280 belgidan oshmasin.",
  err_not_found: "Bu savol endi mavjud emas.",
  err_not_owner: "Faqat oʻz savolingizni oʻzgartira olasiz.",
  err_answered: "Javob berilgan savolni tahrirlab boʻlmaydi.",
  err_forbidden: "Bu sahifa faqat taqdimotchi uchun.",
  err_bad_request: "Soʻrov notoʻgʻri. Sahifani yangilang.",
  err_internal: "Serverda xatolik. Qayta urinib koʻring.",
  err_network: "Aloqa yoʻq. Qayta urinib koʻring.",
  hostTitle: "Savollarni boshqarish",
  queue: "Navbat",
  hidden: "Yashirilgan",
  connected: "{n} kishi ulangan",
  markAnswered: "Javob berildi",
  unmarkAnswered: "Javobsiz deb belgilash",
  hide: "Yashirish",
  unhide: "Koʻrsatish",
  answerNow: "Hozir javob beraman",
  doneNext: "Tayyor, keyingisi",
  unhighlight: "Navbatga qaytarish",
  export: "Savollarni yuklab olish",
  exportHint: "Markdown fayl (.md)",
  projector: "Proyektor",
  exitProjector: "Proyektordan chiqish",
  sessionTitle: "Sessiya nomi",
  sessionTitlePlaceholder: "Sessiya nomini yozing",
  next: "Keyingi",
  nothingNow: "Hozir hech qaysi savolga javob berilmayapti.",
  queueEmpty: "Navbatda savol yoʻq.",
  inviteHeadline: "Savolingiz bormi?",
  scanToAsk: "Skanerlang yoki shu manzilni oching",
  wifiName: "Wi-Fi: {name}",
  enlargeQr: "QR kodni kattalashtirish",
  close: "Yopish",
  firstHint: "Savolingizni yozing, boshqalarning savoliga ovoz bering",
  dismiss: "Yopish",
  shortcuts: "j/k — tanlash · enter — javob berish · n — tayyor, keyingisi · x — yashirish · p — proyektor",
};

type Key = keyof typeof uz;

const en: Record<Key, string> = {
  title: "Savol bor",
  askPlaceholder: "Type your question…",
  namePlaceholder: "Your name (optional)",
  addName: "Add your name",
  send: "Send",
  sent: "Sent",
  charsLeft: "{n} characters left",
  top: "Top",
  newest: "New",
  mine: "Mine",
  you: "you",
  justNow: "just now",
  minutesAgo: "{n} min ago",
  answered: "Answered",
  answeredCount: "Answered ({n})",
  edited: "edited",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  more: "More actions",
  confirmDelete: "Delete this question?",
  vote: "Upvote",
  voted: "You upvoted",
  nowAnswering: "Now answering",
  empty: "No questions yet. Ask the first one.",
  emptyMine: "You haven't asked anything yet.",
  offline: "Offline. Reconnecting…",
  anonymous: "Anonymous",
  err_empty: "Write your question first.",
  err_too_long: "Questions can be up to 280 characters.",
  err_not_found: "This question no longer exists.",
  err_not_owner: "You can only change your own questions.",
  err_answered: "Answered questions can't be edited.",
  err_forbidden: "This page is for the presenter only.",
  err_bad_request: "Bad request. Reload the page.",
  err_internal: "Server error. Try again.",
  err_network: "No connection. Try again.",
  hostTitle: "Manage questions",
  queue: "Queue",
  hidden: "Hidden",
  connected: "{n} connected",
  markAnswered: "Mark answered",
  unmarkAnswered: "Mark unanswered",
  hide: "Hide",
  unhide: "Unhide",
  answerNow: "Answer now",
  doneNext: "Done, next",
  unhighlight: "Back to queue",
  export: "Download questions",
  exportHint: "Markdown file (.md)",
  projector: "Projector",
  exitProjector: "Exit projector",
  sessionTitle: "Session title",
  sessionTitlePlaceholder: "Name this session",
  next: "Next",
  nothingNow: "Nothing is being answered right now.",
  queueEmpty: "The queue is empty.",
  inviteHeadline: "Got a question?",
  scanToAsk: "Scan or open this address",
  wifiName: "Wi-Fi: {name}",
  enlargeQr: "Enlarge QR code",
  close: "Close",
  firstHint: "Ask, and upvote others",
  dismiss: "Dismiss",
  shortcuts: "j/k — select · enter — answer now · n — done, next · x — hide · p — projector",
};

export type { Key };
export const dict: Record<Lang, Record<Key, string>> = { uz, en };

export function format(s: string, vars?: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
}

const storage = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};
export { storage };

let lang: Lang = storage.get("savolbor_lang") === "en" ? "en" : "uz";
const listeners = new Set<() => void>();

export function setLang(next: Lang) {
  lang = next;
  storage.set("savolbor_lang", next);
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function translate(l: Lang, key: Key, vars?: Record<string, string | number>): string {
  return format(dict[l][key] ?? dict.uz[key] ?? key, vars);
}

// errorKey maps a server error code to its message, unknown codes to internal.
export function errorKey(code: string): Key {
  const k = ("err_" + code) as Key;
  return k in uz ? k : "err_internal";
}

export function useT() {
  const l = useSyncExternalStore(subscribe, () => lang);
  return {
    lang: l,
    setLang,
    t: (key: Key, vars?: Record<string, string | number>) => translate(l, key, vars),
  };
}
