// Participant page: ask, upvote, edit and delete own questions, live list.
(function () {
  const { t, api, errorText, h, runes, byTop, byNewest, store, live } = window.savolbor;
  const MAX = 280;
  const $ = (id) => document.getElementById(id);

  let view = { questions: [] };
  let sort = store.get("savolbor_sort") === "newest" ? "newest" : "top";
  // while someone edits or confirms a delete, snapshots are held back so the
  // open editor is not wiped by a rebuild
  let editing = null; // { id, draft }
  let confirming = null; // id
  let rowError = null; // { id, text }

  // ---- composer ----
  const text = $("text"), name = $("name"), send = $("send"), counter = $("counter"), askError = $("askError");
  name.value = store.get("savolbor_name") || "";

  function updateCounter() {
    const left = MAX - runes(text.value.trim());
    counter.textContent = t("charsLeft", { n: left });
    counter.classList.toggle("over", left < 0);
    send.disabled = left < 0 || text.value.trim() === "";
  }
  text.addEventListener("input", () => { askError.textContent = ""; updateCounter(); });
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("ask").requestSubmit();
  });
  name.addEventListener("change", () => store.set("savolbor_name", name.value.trim()));

  $("ask").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    send.disabled = true;
    const res = await api("POST", "/api/questions", { text: text.value, name: name.value });
    if (res.ok) {
      sync.refresh();
      text.value = "";
      askError.textContent = "";
    } else {
      askError.textContent = errorText(res.data && res.data.error);
    }
    updateCounter();
  });

  // ---- tabs ----
  document.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => {
      sort = b.dataset.sort;
      store.set("savolbor_sort", sort);
      render();
    }));

  // ---- actions ----
  async function act(id, method, path, body) {
    const res = await api(method, path, body);
    rowError = res.ok ? null : { id, text: errorText(res.data && res.data.error) };
    if (res.ok) sync.refresh();
    if (!res.ok) render();
    return res.ok;
  }

  function release() {
    editing = null;
    confirming = null;
    render();
  }

  // ---- rendering ----
  function voteButton(q) {
    return h("button", {
      type: "button", class: "vote", "aria-pressed": String(q.voted), disabled: q.voted || q.answered,
      "aria-label": t("vote") + " (" + q.votes + ")",
      onclick: () => act(q.id, "POST", "/api/questions/" + q.id + "/vote"),
    }, h("span", { class: "vote-n", text: String(q.votes) }));
  }

  function meta(q) {
    return h("p", { class: "meta" },
      h("span", { class: "who", text: q.name || t("anonymous") }),
      q.edited ? h("span", { class: "tag", text: t("edited") }) : null,
      q.mine ? h("span", { class: "tag mine", text: "✓" }) : null);
  }

  function ownActions(q) {
    if (!q.mine) return null;
    if (confirming === q.id) {
      return h("div", { class: "actions confirm" },
        h("span", { text: t("confirmDelete") }),
        h("button", { type: "button", class: "danger", text: t("delete"),
          onclick: async () => { confirming = null; await act(q.id, "DELETE", "/api/questions/" + q.id); release(); } }),
        h("button", { type: "button", text: t("cancel"), onclick: release }));
    }
    return h("div", { class: "actions" },
      q.answered ? null : h("button", { type: "button", text: t("edit"),
        onclick: () => { editing = { id: q.id, draft: q.text }; render(true); focusEditor(); } }),
      h("button", { type: "button", text: t("delete"),
        onclick: () => { confirming = q.id; render(true); } }));
  }

  function editor(q) {
    const area = h("textarea", { class: "edit-text", rows: "3", "aria-label": t("edit") });
    area.value = editing.draft;
    const left = h("span", { class: "counter" });
    const save = h("button", { type: "button", class: "primary", text: t("save") });
    const sync = () => {
      editing.draft = area.value;
      const n = MAX - runes(area.value.trim());
      left.textContent = t("charsLeft", { n });
      left.classList.toggle("over", n < 0);
      save.disabled = n < 0 || area.value.trim() === "";
    };
    area.addEventListener("input", sync);
    save.addEventListener("click", async () => {
      if (await act(q.id, "PATCH", "/api/questions/" + q.id, { text: area.value })) release();
    });
    sync();
    return h("div", { class: "editor" }, area,
      h("div", { class: "actions" }, left, save,
        h("button", { type: "button", text: t("cancel"), onclick: release })));
  }

  function focusEditor() {
    const a = document.querySelector(".edit-text");
    if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); }
  }

  function item(q) {
    const body = editing && editing.id === q.id
      ? editor(q)
      : h("p", { class: "text", text: q.text });
    return h("li", { class: "q" + (q.answered ? " is-answered" : "") + (q.id === view.highlighted ? " is-now" : "") },
      voteButton(q),
      h("div", { class: "q-body" }, body, meta(q), ownActions(q),
        rowError && rowError.id === q.id ? h("p", { class: "error", role: "alert", text: rowError.text }) : null));
  }

  function render(force) {
    if ((editing || confirming) && !force) return;
    document.querySelectorAll("[data-sort]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.sort === sort)));

    const qs = view.questions;
    const now = qs.find((q) => q.id === view.highlighted);
    const open = qs.filter((q) => !q.answered && q !== now).sort(sort === "top" ? byTop : byNewest);
    const done = qs.filter((q) => q.answered && q !== now).sort(byNewest);

    const hl = $("highlight");
    hl.hidden = !now;
    hl.replaceChildren(...(now ? [h("p", { class: "badge", text: t("nowAnswering") }), h("ol", { class: "questions" }, item(now))] : []));

    $("list").replaceChildren(...open.map(item));
    $("empty").hidden = qs.length > 0;
    $("answeredBox").hidden = done.length === 0;
    $("answeredCount").textContent = "(" + done.length + ")";
    $("answeredList").replaceChildren(...done.map(item));
  }

  // ---- live updates ----
  let sync = { refresh() {} };
  function connect() {
    sync = live("", (v) => {
      view = v;
      if (editing && !view.questions.some((q) => q.id === editing.id)) editing = null;
      if (confirming && !view.questions.some((q) => q.id === confirming)) confirming = null;
      render();
    }, (off) => { $("offline").hidden = !off; });
  }

  window.savolbor.onLang(() => { updateCounter(); render(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && (editing || confirming)) release(); });
  updateCounter();
  render();
  connect();
})();
