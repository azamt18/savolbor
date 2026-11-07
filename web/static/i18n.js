// Shared by the participant and presenter pages: strings, language toggle,
// a fetch helper and a tiny element builder. Loaded before app.js / host.js.
(function () {
  const strings = {
    uz: {
      title: "Savol bor",
      askPlaceholder: "Savolingizni yozing…",
      namePlaceholder: "Ismingiz (ixtiyoriy)",
      send: "Yuborish",
      charsLeft: "{n} belgi qoldi",
      top: "Koʻp ovoz",
      newest: "Yangi",
      answered: "Javob berilgan",
      edited: "tahrirlangan",
      edit: "Tahrirlash",
      save: "Saqlash",
      cancel: "Bekor qilish",
      delete: "Oʻchirish",
      confirmDelete: "Savol oʻchirilsinmi?",
      vote: "Ovoz berish",
      nowAnswering: "Hozir javob berilmoqda",
      empty: "Hali savol yoʻq. Birinchi boʻlib soʻrang.",
      offline: "Aloqa uzildi. Qayta ulanmoqda…",
      anonymous: "Anonim",
      err_empty: "Savol matnini yozing.",
      err_too_long: "Savol 280 belgidan oshmasin.",
      err_not_found: "Bu savol endi mavjud emas.",
      err_not_owner: "Faqat oʻz savolingizni oʻzgartira olasiz.",
      err_answered: "Javob berilgan savolni tahrirlab boʻlmaydi.",
      err_forbidden: "Bu sahifa faqat taqdimotchi uchun.",
      err_bad_request: "Soʻrov notoʻgʻri. Sahifani yangilang.",
      err_internal: "Serverda xatolik. Qayta urinib koʻring.",
      hostTitle: "Savollarni boshqarish",
      markAnswered: "Javob berildi",
      unmarkAnswered: "Javobsiz deb belgilash",
      hide: "Yashirish",
      unhide: "Koʻrsatish",
      highlight: "Hozir javob beraman",
      unhighlight: "Belgini olish",
      export: "Markdown yuklab olish",
      projector: "Proyektor rejimi",
      exitProjector: "Proyektordan chiqish",
      joinAt: "Savol berish uchun skanerlang yoki oching:",
      hidden: "yashirilgan",
      count: "{total} ta savol, {open} tasi javobsiz",
    },
    en: {
      title: "Savol bor",
      askPlaceholder: "Type your question…",
      namePlaceholder: "Your name (optional)",
      send: "Send",
      charsLeft: "{n} characters left",
      top: "Top",
      newest: "Newest",
      answered: "Answered",
      edited: "edited",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Delete this question?",
      vote: "Upvote",
      nowAnswering: "Now answering",
      empty: "No questions yet. Ask the first one.",
      offline: "Connection lost. Reconnecting…",
      anonymous: "Anonymous",
      err_empty: "Write your question first.",
      err_too_long: "Questions can be up to 280 characters.",
      err_not_found: "This question no longer exists.",
      err_not_owner: "You can only change your own questions.",
      err_answered: "Answered questions can't be edited.",
      err_forbidden: "This page is for the presenter only.",
      err_bad_request: "Bad request. Reload the page.",
      err_internal: "Server error. Try again.",
      hostTitle: "Manage questions",
      markAnswered: "Mark answered",
      unmarkAnswered: "Mark unanswered",
      hide: "Hide",
      unhide: "Unhide",
      highlight: "Answer now",
      unhighlight: "Clear highlight",
      export: "Download markdown",
      projector: "Projector mode",
      exitProjector: "Exit projector",
      joinAt: "Scan or open to ask a question:",
      hidden: "hidden",
      count: "{total} questions, {open} unanswered",
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  let lang = store.get("savolbor_lang") === "en" ? "en" : "uz";
  const listeners = [];

  function t(key, vars) {
    let s = strings[lang][key] ?? strings.uz[key] ?? key;
    for (const [k, v] of Object.entries(vars || {})) s = s.replace("{" + k + "}", v);
    return s;
  }

  function applyI18n(root) {
    root = root || document;
    document.documentElement.lang = lang;
    root.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
    root.querySelectorAll("[data-lang]").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.lang === lang)));
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "uz";
    store.set("savolbor_lang", lang);
    applyI18n();
    listeners.forEach((fn) => fn(lang));
  }

  async function api(method, path, body) {
    try {
      const res = await fetch(path, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      if (res.status !== 204) data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { error: "internal" } };
    }
  }

  function errorText(code) {
    return t("err_" + (code || "internal"));
  }

  // h builds an element. Strings become text nodes, never html.
  function h(tag, props, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      n.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }

  // runes counts characters the way the server does (code points, not utf-16 units).
  function runes(s) { return [...s].length; }

  function byTop(a, b) {
    return b.votes - a.votes || Date.parse(a.createdAt) - Date.parse(b.createdAt);
  }
  function byNewest(a, b) {
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  }

  // live keeps a page in sync. It prefers the sse stream; if no snapshot
  // arrives within 4s (a proxy is buffering it), it switches to polling.
  function live(query, onView, setOffline) {
    let polling = null;
    let streamed = false;
    const es = new EventSource("/api/events" + query);
    es.onmessage = (e) => {
      streamed = true;
      setOffline(false);
      onView(JSON.parse(e.data));
    };
    es.onerror = () => { if (!polling) setOffline(true); };

    async function poll() {
      const res = await api("GET", "/api/view" + query);
      setOffline(!res.ok);
      if (res.ok) onView(res.data);
    }
    setTimeout(() => {
      if (streamed) return;
      es.close();
      poll();
      polling = setInterval(poll, 2000);
    }, 4000);

    // refresh is called after the page's own actions so polling feels instant
    return { refresh() { if (polling) poll(); } };
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });
  document.addEventListener("DOMContentLoaded", () => applyI18n());

  window.savolbor = {
    t, setLang, applyI18n, api, errorText, h, runes, byTop, byNewest, store, live,
    get lang() { return lang; },
    onLang(fn) { listeners.push(fn); },
  };
})();
