// Presenter page: moderate questions, export, projector mode.
(function () {
  const { t, api, errorText, h, byTop, byNewest, store, live } = window.savolbor;
  const $ = (id) => document.getElementById(id);
  const TOP_ON_PROJECTOR = 5;

  let view = { questions: [] };
  let sort = store.get("savolbor_host_sort") === "newest" ? "newest" : "top";

  document.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => {
      sort = b.dataset.sort;
      store.set("savolbor_host_sort", sort);
      render();
    }));

  async function act(method, path, body) {
    const res = await api(method, path, body);
    $("hostError").textContent = res.ok ? "" : errorText(res.data && res.data.error);
    if (res.ok) sync.refresh();
  }

  // ---- projector mode ----
  function setProjector(on) {
    document.body.classList.toggle("projector", on);
    store.set("savolbor_projector", on ? "1" : "0");
    // only return focus when leaving: a focused exit button would stay
    // visible on the projector
    if (!on) $("projectorOn").focus();
    else document.activeElement.blur();
  }
  $("projectorOn").addEventListener("click", () => setProjector(true));
  $("projectorOff").addEventListener("click", () => setProjector(false));
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof Element && e.target.closest("input, textarea");
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "p") setProjector(!document.body.classList.contains("projector"));
    if (e.key === "Escape") setProjector(false);
  });
  document.body.classList.toggle("projector", store.get("savolbor_projector") === "1");

  // ---- rendering ----
  function votes(q) {
    return h("span", { class: "vote", "aria-label": q.votes + " " + t("vote") },
      h("span", { class: "vote-n", text: String(q.votes) }));
  }

  function meta(q) {
    return h("p", { class: "meta" },
      h("span", { class: "who", text: q.name || t("anonymous") }),
      q.edited ? h("span", { class: "tag", text: t("edited") }) : null,
      q.answered ? h("span", { class: "tag", text: t("answered") }) : null,
      q.hidden ? h("span", { class: "tag", text: t("hidden") }) : null);
  }

  function controls(q) {
    const base = "/api/host/questions/" + q.id;
    const isNow = q.id === view.highlighted;
    return h("div", { class: "actions" },
      h("button", { type: "button", class: isNow ? "primary" : null, "aria-pressed": String(isNow),
        text: t(isNow ? "unhighlight" : "highlight"), disabled: q.hidden,
        onclick: () => act("POST", "/api/host/highlight", { id: isNow ? "" : q.id }) }),
      h("button", { type: "button", text: t(q.answered ? "unmarkAnswered" : "markAnswered"),
        onclick: () => act("POST", base + "/answered", { on: !q.answered }) }),
      h("button", { type: "button", text: t(q.hidden ? "unhide" : "hide"),
        onclick: () => act("POST", base + "/hidden", { on: !q.hidden }) }));
  }

  function item(q) {
    const cls = ["q", q.answered && "is-answered", q.hidden && "is-hidden", q.id === view.highlighted && "is-now"];
    return h("li", { class: cls.filter(Boolean).join(" ") },
      votes(q),
      h("div", { class: "q-body" }, h("p", { class: "text", text: q.text }), meta(q), controls(q)));
  }

  function render() {
    document.querySelectorAll("[data-sort]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.sort === sort)));
    const qs = view.questions;
    const visible = qs.filter((q) => !q.hidden);
    const open = visible.filter((q) => !q.answered);
    $("count").textContent = t("count", { total: visible.length, open: open.length });

    // unanswered first, then answered, then hidden; each group in the chosen order
    const cmp = sort === "top" ? byTop : byNewest;
    const group = (q) => (q.hidden ? 2 : q.answered ? 1 : 0);
    const ordered = [...qs].sort((a, b) => group(a) - group(b) || cmp(a, b));
    $("list").replaceChildren(...ordered.map(item));
    $("empty").hidden = qs.length > 0;

    // projector
    const now = visible.find((q) => q.id === view.highlighted);
    $("pjNow").hidden = !now;
    $("pjNow").replaceChildren(...(now ? [
      h("p", { class: "badge", text: t("nowAnswering") }),
      h("p", { class: "text", text: now.text }),
      now.name ? h("p", { class: "who", text: now.name }) : null,
    ].filter(Boolean) : []));
    const top = open.filter((q) => q !== now).sort(byTop).slice(0, TOP_ON_PROJECTOR);
    $("pjTop").replaceChildren(...top.map((q) =>
      h("li", { class: "q" }, votes(q), h("div", { class: "q-body" }, h("p", { class: "text", text: q.text })))));
    $("pjUrl").textContent = view.joinUrl || location.origin;
    // a new join url means a new qr image; the query busts the browser cache
    const qrSrc = "/qr.png?u=" + encodeURIComponent(view.joinUrl || "");
    if ($("pjQr").getAttribute("src") !== qrSrc) $("pjQr").setAttribute("src", qrSrc);
    // nothing to show yet: let the qr code take the whole screen
    document.querySelector(".projector-view").classList.toggle("pj-empty", !now && top.length === 0);
  }

  let sync = { refresh() {} };
  function connect() {
    sync = live("?view=host", (v) => { view = v; render(); }, (off) => { $("offline").hidden = !off; });
  }

  window.savolbor.onLang(render);
  render();
  connect();
})();
