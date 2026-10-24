const KEY = "fixit_tickets";

const Store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
    save(list) { localStorage.setItem(KEY, JSON.stringify(list)); },
    add(t) {
        const list = this.all();
        const n = String(list.length + 1).padStart(4, "0");
        t.id = "FX-" + n; t.status = t.status || "Pending";
        t.createdAt = Date.now(); t.updatedAt = Date.now();
        list.unshift(t); this.save(list); return t;
    },
    setStatus(id, status) {
        const list = this.all(), t = list.find(x => x.id === id);
        if (t) { t.status = status; t.updatedAt = Date.now(); this.save(list); }
    },
    remove(id) { this.save(this.all().filter(t => t.id !== id)); }
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = ms => new Date(ms).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const who = t => t.role === "Office" ? "Office - " + (t.via || "logged") :
    (t.role || "Student") + ((t.idNo || t.studentNo) ? " - " + (t.idNo || t.studentNo) : "");
const badge = s => `<span class="badge-status st-${s.replace(" ", "-")}">${s}</span>`;

function toast(msg) {
    const wrap = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast align-items-center text-bg-dark border-0 show mb-2";
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div></div>`;
    wrap.appendChild(el); setTimeout(() => el.remove(), 3000);
}

/* ---------- Shared: report form + modals ---------- */
function initReportForm(afterSave) {
    const form = document.getElementById("ticketForm");
    const rm = document.getElementById("reportModal");
    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(form));
        const t = Store.add({
            title: d.title.trim(), building: d.building, location: d.location.trim(),
            category: d.category, urgency: d.urgency, description: d.description.trim(),
            role: d.role || "Office", reporter: (d.reporter || "").trim() || "Maintenance office",
            idNo: (d.idNo || "").trim(), via: d.via || "", status: d.status
        });
        document.getElementById("lastId").textContent = t.id;
        document.getElementById("lastName").textContent = t.reporter.split(" ")[0];
        document.getElementById("lastTitle").textContent = t.title;
        document.getElementById("lastPlace").textContent = t.building + " - " + t.location;
        document.getElementById("lastStatus").innerHTML = badge(t.status);
        document.getElementById("copyId").textContent = "Copy";
        afterSave();
        rm.addEventListener("hidden.bs.modal", () => bootstrap.Modal.getOrCreateInstance("#doneModal").show(), { once: true });
        bootstrap.Modal.getOrCreateInstance(rm).hide();
    });
    const role = document.getElementById("role");
    const syncId = () => {
        const isStudent = role.value === "Student";
        document.getElementById("idWrap").classList.toggle("d-none", !isStudent);
        const idNo = document.getElementById("idNo");
        idNo.required = isStudent;
        if (!isStudent) idNo.value = "";
    };
    if (role) { role.addEventListener("change", syncId); syncId(); }
    rm.addEventListener("hidden.bs.modal", () => { form.reset(); form.classList.remove("was-validated"); if (role) syncId(); });
    document.getElementById("copyId").addEventListener("click", async e => {
        const id = document.getElementById("lastId").textContent;
        try { await navigator.clipboard.writeText(id); e.target.textContent = "Copied"; }
        catch { e.target.textContent = "Press Ctrl+C"; }
    });
    rm.addEventListener("shown.bs.modal", () => document.getElementById("reporter").focus());
}

/* ---------- Student page ---------- */
function initStudent() {
    const body = document.getElementById("rows");
    const search = document.getElementById("search");

    function render() {
        const q = search.value.trim().toLowerCase();
        const list = Store.all().filter(t => !q || (t.id + t.title + t.building + t.location).toLowerCase().includes(q));
        body.innerHTML = list.length ? list.map(t => `
      <tr>
        <td class="tid">${t.id}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div></td>
        <td class="urg-${t.urgency}">${t.urgency}</td>
        <td>${badge(t.status)}</td>
        <td class="small text-secondary">${fmt(t.createdAt)}</td>
      </tr>`).join("")
            : `<tr><td colspan="5" class="empty">No reports yet. Be the first to report a damage.</td></tr>`;
    }

    initReportForm(render);
    search.addEventListener("input", render);
    render();
}

/* ---------- Admin page ---------- */
function initAdmin() {
    const app = document.getElementById("adminApp");

    const body = document.getElementById("rows");
    const fStatus = document.getElementById("fStatus"), fUrg = document.getElementById("fUrg"), search = document.getElementById("search");

    function render() {
        const all = Store.all();
        document.getElementById("cTotal").textContent = all.length;
        document.getElementById("cPending").textContent = all.filter(t => t.status === "Pending").length;
        document.getElementById("cProg").textContent = all.filter(t => t.status === "In progress").length;
        document.getElementById("cFixed").textContent = all.filter(t => t.status === "Fixed").length;

        const q = search.value.trim().toLowerCase();
        const list = all.filter(t =>
            (!fStatus.value || t.status === fStatus.value) &&
            (!fUrg.value || t.urgency === fUrg.value) &&
            (!q || (t.id + t.title + t.building + t.location + t.reporter).toLowerCase().includes(q)));

        body.innerHTML = list.length ? list.map(t => `
      <tr>
        <td class="tid">${t.id}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div>
            <div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)} &bull; ${esc(t.category)}</div>
            ${t.description ? `<div class="small mt-1">${esc(t.description)}</div>` : ""}</td>
        <td class="small">${esc(t.reporter)}<br><span class="text-secondary">${esc(who(t))}</span></td>
        <td class="urg-${t.urgency}">${t.urgency}</td>
        <td>${badge(t.status)}<div class="small text-secondary mt-1">${fmt(t.updatedAt)}</div></td>
        <td class="text-end text-nowrap">
          ${t.status === "Pending" ? `<button class="btn btn-sm btn-outline-primary" data-act="In progress" data-id="${t.id}">Start work</button>` : ""}
          ${t.status !== "Fixed" ? `<button class="btn btn-sm btn-success" data-act="Fixed" data-id="${t.id}">Mark as fixed</button>`
                : `<button class="btn btn-sm btn-outline-secondary" data-act="Pending" data-id="${t.id}">Reopen</button>`}
          <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${t.id}" aria-label="Delete ${t.id}">Delete</button>
        </td>
      </tr>`).join("")
            : `<tr><td colspan="6" class="empty">No tickets match these filters.</td></tr>`;
    }

    body.addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset;
        if (act === "delete") {
            if (!confirm(`Delete ticket ${id}? This can't be undone.`)) return;
            Store.remove(id); toast(`${id} deleted`);
        } else { Store.setStatus(id, act); toast(`${id} marked as ${act.toLowerCase()}`); }
        render();
    });
    [fStatus, fUrg].forEach(el => el.addEventListener("change", render));
    search.addEventListener("input", render);
    window.addEventListener("storage", render);

    initReportForm(render);
    render();
}

document.addEventListener("DOMContentLoaded", () => {
    const p = document.body.dataset.page;
    if (p === "student") initStudent();
    if (p === "admin") initAdmin();
});