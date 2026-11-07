const $ = id => document.getElementById(id);
const fmtT = ms => new Date(ms).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const labelOf = o => o.title || o.name || (o.assetId ? an(o.assetId) : "");
const coll = (key, prefix, pad, kind) => ({
    all() { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
    save(l) { localStorage.setItem(key, JSON.stringify(l)); },
    note(o, text) {
        const by = sessionStorage.getItem("fixit_admin_name");
        if (by) text += " (by " + by + ")";
        o.events = (o.events || []).concat({ ts: Date.now(), text });
        if (kind) Log.add({ kind, ref: o.id, text: `${o.id} (${labelOf(o)}) - ${text}` });
    },
    add(o, text) {
        const l = this.all();
        const n = Math.max(0, ...l.map(x => parseInt(x.id.split("-")[1], 10) || 0)) + 1;
        o.id = prefix + "-" + String(n).padStart(pad, "0");
        o.createdAt = o.updatedAt = Date.now(); o.events = [];
        if (text) this.note(o, text);
        l.unshift(o); this.save(l); return o;
    },
    patch(id, p, text) {
        const l = this.all(), o = l.find(x => x.id === id);
        if (o) { Object.assign(o, p, { updatedAt: Date.now() }); if (text) this.note(o, text); this.save(l); }
        return o;
    },
    remove(id, text) {
        const o = this.all().find(x => x.id === id);
        if (o && text) this.note(o, text);
        this.save(this.all().filter(x => x.id !== id));
    }
});
const Tickets = coll("fixit_tickets", "FX", 4, "ticket"), Assets = coll("fixit_assets", "AS", 3, "asset"), Loans = coll("fixit_loans", "BR", 4, "loan"), Log = coll("fixit_log", "LG", 5);
Tickets.setStatus = (id, s) => {
    const msg = { Fixed: "Marked as fixed", "In progress": "Work started", Pending: "Reopened (back to pending)" }[s];
    const t = Tickets.patch(id, { status: s, fixedAt: s === "Fixed" ? Date.now() : null }, msg);
    if (t && s === "Fixed" && t.assetId) {
        const a = Assets.all().find(x => x.id === t.assetId);
        if (a && a.condition === "Damaged") Assets.patch(a.id, { condition: "Good" }, "Condition set to Good after repair " + t.id);
    }
};
/* timeline helpers */
const eventsOf = o => o.events && o.events.length ? o.events : [{ ts: o.createdAt, text: "Created" }];
const tlItems = o => eventsOf(o).map(v => `<li><div>${esc(v.text)}</div><div class="when">${fmtT(v.ts)}</div></li>`).join("");
const tlBtn = (k, id) => `<button type="button" class="tid-link" data-tl="${k}" data-id="${id}">${id}</button><div class="small text-secondary">View timeline</div>`;
const spanTxt = ms => { const h = ms / 36e5; return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + " min" : h < 48 ? h.toFixed(1) + " h" : (h / 24).toFixed(1) + " days"; };
function showTimeline(c, id) {
    const o = c.all().find(x => x.id === id); if (!o) return;
    $("tlTitle").textContent = `${o.id} - ${labelOf(o)}`;
    const bits = [`Added ${fmtT(o.createdAt)}`];
    if (o.fixedAt) bits.push(`Fixed ${fmtT(o.fixedAt)} (after ${spanTxt(o.fixedAt - o.createdAt)})`);
    if (o.returnedAt) bits.push(`Returned ${fmtT(o.returnedAt)}`);
    $("tlSummary").innerHTML = bits.map(esc).join("<br>");
    $("tlBody").innerHTML = tlItems(o);
    bootstrap.Modal.getOrCreateInstance("#timelineModal").show();
}
const Store = Tickets;

/* asset helpers */
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtD = d => d ? new Date(d + "T00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "-";
const assetOf = id => Assets.all().find(a => a.id === id);
const an = id => (assetOf(id) || { name: "(deleted asset)" }).name;
const activeLoan = (aid, sts, skip) => Loans.all().find(l => l.assetId === aid && l.id !== skip && sts.includes(l.status));
const availability = a => activeLoan(a.id, ["Borrowed"]) ? "Borrowed" : activeLoan(a.id, ["Approved"]) ? "Reserved" : a.condition === "Damaged" ? "Under repair" : "Available";
const loanStatus = l => l.status === "Borrowed" && l.due < today() ? "Overdue" : l.status;

function bindRole(roleId, wrapId, inputId) {
    const r = $(roleId); if (!r) return () => { };
    const sync = () => {
        const s = r.value === "Student";
        $(wrapId).classList.toggle("d-none", !s);
        const i = $(inputId); i.required = s; if (!s) i.value = "";
    };
    r.addEventListener("change", sync); sync(); return sync;
}

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
            idNo: (d.idNo || "").trim(), via: d.via || "", status: d.status || "Pending", assetId: d.assetId || "", assignee: "", fixedAt: null
        }, d.role ? `Reported by ${(d.reporter || "").trim()} (${d.role})` : `Logged by ${(d.reporter || "").trim()}${d.via ? " - found by " + d.via.toLowerCase() : ""}`);
        if (d.role) localStorage.setItem("fixit_me", JSON.stringify({ name: (d.reporter || "").trim(), idNo: (d.idNo || "").trim() }));
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
    const syncId = bindRole("role", "idWrap", "idNo");
    if ($("role")) rm.addEventListener("show.bs.modal", () => {
        const u = currentUser(); if (!u) return;
        $("role").value = u.role; $("role").dispatchEvent(new Event("change"));
        $("reporter").value = u.name; $("idNo").value = u.idNo;
        $("role").closest(".row").classList.add("d-none");
    });
    rm.addEventListener("hidden.bs.modal", () => { form.reset(); form.classList.remove("was-validated"); syncId(); });
    document.getElementById("copyId").addEventListener("click", async e => {
        const id = document.getElementById("lastId").textContent;
        try { await navigator.clipboard.writeText(id); e.target.textContent = "Copied"; }
        catch { e.target.textContent = "Press Ctrl+C"; }
    });
    rm.addEventListener("shown.bs.modal", () => ($("reporter").offsetParent ? $("reporter") : $("title")).focus());
    const as = $("assetId");
    if (as) rm.addEventListener("show.bs.modal", () => {
        as.innerHTML = '<option value="">None</option>' + Assets.all().filter(a => !a.archived).map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.tag)})</option>`).join("");
    });
}

/* ---------- Student page ---------- */
function initStudent() {
    const body = document.getElementById("rows");
    const search = document.getElementById("search");

    function render() {
        const q = search.value.trim().toLowerCase();
        const list = Store.all().filter(t => !t.archived && (!q || (t.id + t.title + t.building + t.location).toLowerCase().includes(q)));
        body.innerHTML = list.length ? list.map(t => `
      <tr>
        <td>${tlBtn("t", t.id)}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div></td>
        <td class="urg-${t.urgency}">${t.urgency}</td>
        <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
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
        const all = Store.all().filter(t => !t.archived);
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
        <td>${tlBtn("t", t.id)}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div>
            <div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)} &bull; ${esc(t.category)}${t.assetId ? ` &bull; <span class="tid">${esc(t.assetId)}</span>` : ""}</div>
            ${t.description ? `<div class="small mt-1">${esc(t.description)}</div>` : ""}</td>
        <td class="small">${esc(t.reporter)}<br><span class="text-secondary">${esc(who(t))}</span></td>
        <td class="urg-${t.urgency}">${t.urgency}</td>
        <td>${badge(t.status)}<div class="small text-secondary mt-1">${fmt(t.updatedAt)}</div></td>
        <td class="small">${t.assignee ? esc(t.assignee) : '<span class="text-secondary">Unassigned</span>'}</td>
        <td class="text-end text-nowrap">
          ${t.status !== "Fixed" ? `<button class="btn btn-sm btn-outline-secondary" data-act="assign" data-id="${t.id}">${t.assignee ? "Reassign" : "Assign"}</button>` : ""}
          ${t.status === "Pending" ? `<button class="btn btn-sm btn-outline-primary" data-act="In progress" data-id="${t.id}">Start work</button>` : ""}
          ${t.status !== "Fixed" ? `<button class="btn btn-sm btn-success" data-act="Fixed" data-id="${t.id}">Mark as fixed</button>`
                : `<button class="btn btn-sm btn-outline-secondary" data-act="Pending" data-id="${t.id}">Reopen</button>`}
          <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${t.id}" aria-label="Archive ${t.id}">Archive</button>
        </td>
      </tr>`).join("")
            : `<tr><td colspan="7" class="empty">No tickets match these filters.</td></tr>`;
    }

    body.addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset;
        if (act === "assign") { openAssign(id); return; }
        if (act === "delete") {
            if (!confirm(`Archive ticket ${id}? You can restore it from the History tab.`)) return;
            Store.patch(id, { archived: true, archivedAt: Date.now() }, "Archived"); toast(`${id} archived`);
        } else { Store.setStatus(id, act); toast(`${id} marked as ${act.toLowerCase()}`); }
        render();
    });
    [fStatus, fUrg].forEach(el => el.addEventListener("change", render));
    search.addEventListener("input", render);
    window.addEventListener("storage", render);
    window.renderTickets = render;

    initReportForm(render);
    render();
}

/* ---------- Borrowing (client) ---------- */
function initBorrowClient() {
    const form = $("borrowForm"), modal = $("borrowModal"), body = $("loanRows"), search = $("loanSearch");
    const sync = bindRole("bRole", "bIdWrap", "bId");
    const render = () => {
        const q = search.value.trim().toLowerCase();
        const list = Loans.all().filter(l => !q || (l.id + an(l.assetId) + l.borrower + l.purpose).toLowerCase().includes(q));
        body.innerHTML = list.length ? list.map(l => `
      <tr>
        <td>${tlBtn("l", l.id)}</td>
        <td><div class="fw-semibold">${esc(an(l.assetId))}</div><div class="small text-secondary">${esc(l.purpose)}</div></td>
        <td class="small">${esc(l.borrower)}<br><span class="text-secondary">${esc(l.role)}</span></td>
        <td class="small">${fmtD(l.from)} &rarr; ${fmtD(l.due)}</td>
        <td>${badge(loanStatus(l))}${l.status === "Pending" && Mine.has(l.id) ? ` <button class="btn btn-sm btn-outline-danger ms-1" data-cancel="${l.id}">Cancel</button>` : ""}</td>
      </tr>`).join("") : `<tr><td colspan="5" class="empty">No borrowing requests yet.</td></tr>`;
    };
    modal.addEventListener("show.bs.modal", () => {
        const free = Assets.all().filter(a => !a.archived && availability(a) === "Available");
        $("bAsset").innerHTML = free.length ? '<option value="">Choose equipment...</option>' + free.map(a => `<option value="${a.id}">${esc(a.name)} (${esc(a.tag)}) - ${esc(a.location)}</option>`).join("")
            : '<option value="">No equipment available right now</option>';
        const u = currentUser();
        if (u) {
            $("bRole").value = u.role; $("bRole").dispatchEvent(new Event("change"));
            $("bName").value = u.name; $("bId").value = u.idNo; $("bRole").closest(".row").classList.add("d-none");
        }
        $("bFrom").min = $("bDue").min = today();
        if (!$("bFrom").value) $("bFrom").value = today();
    });
    modal.addEventListener("shown.bs.modal", () => ($("bName").offsetParent ? $("bName") : $("bPurpose")).focus());
    modal.addEventListener("hidden.bs.modal", () => { form.reset(); form.classList.remove("was-validated"); sync(); });
    form.addEventListener("submit", e => {
        e.preventDefault();
        $("bDue").setCustomValidity($("bDue").value && $("bDue").value < $("bFrom").value ? "x" : "");
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(form));
        const l = Loans.add({ assetId: d.asset, borrower: d.name.trim(), role: d.role, idNo: (d.idNo || "").trim(), purpose: d.purpose.trim(), from: d.from, due: d.due, status: "Pending" }, "Request sent by " + d.name.trim() + " (" + d.role + ")");
        bootstrap.Modal.getOrCreateInstance(modal).hide();
        Mine.add(l.id); localStorage.setItem("fixit_me", JSON.stringify({ name: d.name.trim(), idNo: (d.idNo || "").trim() })); toast(`Request ${l.id} sent. Wait for the office to approve it.`);
        bootstrap.Tab.getOrCreateInstance("#tabBorrowBtn").show(); render();
    });
    search.addEventListener("input", render);
    body.addEventListener("click", e => {
        const b = e.target.closest("button[data-cancel]"); if (!b) return;
        if (!confirm(`Cancel request ${b.dataset.cancel}?`)) return;
        Loans.patch(b.dataset.cancel, { status: "Cancelled" }, "Cancelled by the borrower");
        toast(`Request ${b.dataset.cancel} cancelled`); render();
    });
    window.addEventListener("storage", render);
    render();
}

/* ---------- Admin: assign, borrowing, assets, reports ---------- */
/* saved personnel, own requests, CSV export */
const Staff = {
    all() { try { return JSON.parse(localStorage.getItem("fixit_staff")) || []; } catch { return []; } },
    add(n) { const l = this.all(); if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); localStorage.setItem("fixit_staff", JSON.stringify(l.sort())); } },
    remove(n) { localStorage.setItem("fixit_staff", JSON.stringify(this.all().filter(x => x !== n))); }
};
const Mine = {
    all() { try { return JSON.parse(localStorage.getItem("fixit_mine")) || []; } catch { return []; } },
    add(id) { localStorage.setItem("fixit_mine", JSON.stringify(this.all().concat(id))); },
    has(id) { return this.all().includes(id); }
};
function downloadCSV(name, head, rows) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\ufeff" + [head, ...rows].map(r => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${name}-${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function renderChips() {
    $("aChips").innerHTML = Staff.all().map(n => `<span class="badge text-bg-light border fw-normal"><button type="button" class="btn btn-link p-0 text-decoration-none text-dark" data-pick="${esc(n)}">${esc(n)}</button> <button type="button" class="btn btn-link p-0 text-danger text-decoration-none" data-del="${esc(n)}" aria-label="Remove ${esc(n)}">&times;</button></span>`).join("")
        || '<span class="text-secondary small">None yet. A name you assign is saved here.</span>';
}
function openAssign(id) {
    const t = Tickets.all().find(x => x.id === id);
    $("aId").value = id; $("aTitle").textContent = t.id + " - " + t.title; $("aName").value = t.assignee || "";
    $("aList").innerHTML = [...new Set([...Staff.all(), ...Tickets.all().map(x => x.assignee).filter(Boolean)])].map(n => `<option value="${esc(n)}">`).join("");
    renderChips();
    bootstrap.Modal.getOrCreateInstance("#assignModal").show();
}
const tally = (list, f) => list.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});
const bars = obj => {
    const max = Math.max(1, ...Object.values(obj));
    return Object.entries(obj).map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b>${v}</b></div>`).join("")
        || '<p class="text-secondary small mb-0">No data yet.</p>';
};
const tbl = (h, rows) => rows.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="text-secondary small">Nothing recorded yet.</p>';

function initAdminExtras() {
    const modal = id => bootstrap.Modal.getOrCreateInstance(id);


    /* saved personnel chips */
    $("aChips").addEventListener("click", e => {
        const p = e.target.closest("[data-pick]"), x = e.target.closest("[data-del]");
        if (p) $("aName").value = p.dataset.pick;
        if (x) { Staff.remove(x.dataset.del); renderChips(); }
    });

    /* CSV export */
    const csvBtn = (paneId, fn) => {
        const panel = document.querySelector(`#${paneId} section.panel`);
        panel.insertAdjacentHTML("afterbegin", '<div class="text-end mb-2 no-print"><button type="button" class="btn btn-outline-secondary btn-sm">Export CSV</button></div>');
        panel.firstElementChild.firstElementChild.addEventListener("click", fn);
    };
    csvBtn("tabTickets", () => downloadCSV("tickets", ["Ticket", "Damage", "Building", "Room / spot", "Type", "Urgency", "Status", "Reported by", "Role", "ID no.", "Assigned to", "Related asset", "Reported", "Fixed", "Archived", "Details"],
        Tickets.all().map(t => [t.id, t.title, t.building, t.location, t.category, t.urgency, t.status, t.reporter, t.role, t.idNo || t.studentNo || "", t.assignee || "", t.assetId || "", fmtT(t.createdAt), t.fixedAt ? fmtT(t.fixedAt) : "", t.archived ? "Yes" : "", t.description || ""])));
    csvBtn("tabBorrow", () => downloadCSV("borrowing", ["Request", "Equipment", "Borrower", "Role", "ID no.", "Purpose", "Borrow on", "Return by", "Status", "Returned", "Returned as"],
        Loans.all().map(l => [l.id, an(l.assetId), l.borrower, l.role, l.idNo || "", l.purpose, l.from, l.due, loanStatus(l), l.returnedAt ? fmtT(l.returnedAt) : "", l.returnCond || ""])));
    csvBtn("tabAssets", () => downloadCSV("assets", ["ID", "Name", "ID no.", "Category", "Location", "Department", "Condition", "Availability", "Archived"],
        Assets.all().map(a => [a.id, a.name, a.tag, a.category, a.location, a.dept, a.condition, availability(a), a.archived ? "Yes" : ""])));

    /* assign personnel */
    $("assignForm").addEventListener("submit", e => {
        e.preventDefault();
        const id = $("aId").value, name = $("aName").value.trim(), t = Tickets.all().find(x => x.id === id);
        Staff.add(name);
        Tickets.patch(id, { assignee: name, status: t.status === "Pending" ? "In progress" : t.status }, "Assigned to " + name + (t.status === "Pending" ? " (work started)" : ""));
        modal("#assignModal").hide(); toast(`${id} assigned to ${name}`); window.renderTickets();
    });

    /* borrowing */
    function renderLoans() {
        const q = $("lSearch").value.trim().toLowerCase(), st = $("lStatus").value;
        const list = Loans.all().filter(l => (!st || loanStatus(l) === st) && (!q || (l.id + an(l.assetId) + l.borrower + l.purpose).toLowerCase().includes(q)));
        $("loanRows").innerHTML = list.length ? list.map(l => {
            const A = (act, cls, txt) => `<button class="btn btn-sm ${cls}" data-act="${act}" data-id="${l.id}">${txt}</button> `;
            const acts = l.status === "Pending" ? A("approve", "btn-success", "Approve") + A("reject", "btn-outline-danger", "Reject")
                : l.status === "Approved" ? A("release", "btn-outline-primary", "Hand over") + A("reject", "btn-outline-danger", "Cancel")
                    : l.status === "Borrowed" ? A("return", "btn-success", "Mark returned") : "";
            return `<tr>
        <td>${tlBtn("l", l.id)}</td>
        <td><div class="fw-semibold">${esc(an(l.assetId))}</div><div class="small text-secondary">${esc(l.purpose)}</div></td>
        <td class="small">${esc(l.borrower)}<br><span class="text-secondary">${esc(l.role)}${l.idNo ? " - " + esc(l.idNo) : ""}</span></td>
        <td class="small">${fmtD(l.from)} &rarr; ${fmtD(l.due)}${l.returnedAt ? `<br><span class="text-secondary">Returned ${fmt(l.returnedAt)}${l.returnCond ? " (" + l.returnCond + ")" : ""}</span>` : ""}</td>
        <td>${badge(loanStatus(l))}</td>
        <td class="text-end text-nowrap">${acts}</td></tr>`;
        }).join("") : `<tr><td colspan="6" class="empty">No borrowing requests match.</td></tr>`;
    }
    $("loanRows").addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset, l = Loans.all().find(x => x.id === id), a = assetOf(l.assetId);
        if (act === "return") { $("rId").value = id; $("rTitle").textContent = `${id} - ${an(l.assetId)}`; modal("#returnModal").show(); return; }
        if (act === "approve" || act === "release") {
            if (!a) return toast("This asset no longer exists.");
            if (activeLoan(a.id, ["Approved", "Borrowed"], id)) return toast("Another request already holds this item.");
            if (a.condition === "Damaged") return toast("This item is under repair.");
        }
        const next = { approve: "Approved", reject: "Rejected", release: "Borrowed" }[act];
        Loans.patch(id, act === "release" ? { status: next, releasedAt: Date.now() } : { status: next }, { approve: "Approved", reject: l.status === "Approved" ? "Cancelled" : "Rejected", release: "Handed over to borrower" }[act]);
        toast(`${id} ${next.toLowerCase()}`); renderAll();
    });
    $("returnForm").addEventListener("submit", e => {
        e.preventDefault();
        const id = $("rId").value, cond = $("rCond").value, note = $("rNote").value.trim();
        const l = Loans.patch(id, { status: "Returned", returnedAt: Date.now(), returnCond: cond, returnNote: note }, "Returned in " + cond + " condition" + (note ? ": " + note : ""));
        const a = assetOf(l.assetId);
        if (a) {
            Assets.patch(a.id, { condition: cond }, "Condition set to " + cond + " after return " + id);
            if (cond === "Damaged") Tickets.add({
                title: `${a.name} damaged after borrowing`, building: a.location, location: a.location, category: "Equipment", urgency: "Medium",
                description: note || `Returned by ${l.borrower} in damaged condition.`, role: "Office", reporter: "System", idNo: "", via: "Returned item",
                assetId: a.id, assignee: "", fixedAt: null, status: "Pending"
            }, "Created automatically from damaged return " + id);
        }
        modal("#returnModal").hide(); e.target.reset();
        toast(cond === "Damaged" ? `${id} returned. A repair ticket was created.` : `${id} returned`);
        renderAll(); window.renderTickets();
    });

    /* assets */
    function renderAssets() {
        const q = $("sSearch").value.trim().toLowerCase();
        const list = Assets.all().filter(a => !a.archived && (!q || (a.id + a.name + a.tag + a.location + a.dept + a.category).toLowerCase().includes(q)));
        $("assetRows").innerHTML = list.length ? list.map(a => `<tr>
        <td><span class="tid">${a.id}</span><div class="small text-secondary">${esc(a.tag)}</div></td>
        <td><div class="fw-semibold">${esc(a.name)}</div><div class="small text-secondary">${esc(a.category)}</div></td>
        <td class="small">${esc(a.location)}</td><td class="small">${esc(a.dept)}</td>
        <td><select class="form-select form-select-sm" style="min-width:105px" data-cond="${a.id}" aria-label="Condition of ${esc(a.name)}">${["Good", "Fair", "Poor", "Damaged"].map(c => `<option${c === a.condition ? " selected" : ""}>${c}</option>`).join("")}</select></td>
        <td>${badge(availability(a))}</td>
        <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary" data-act="hist" data-id="${a.id}">History</button>
        <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${a.id}">Archive</button></td></tr>`).join("")
            : `<tr><td colspan="7" class="empty">No assets yet. Use "+ Add asset" to record one.</td></tr>`;
    }
    $("assetRows").addEventListener("change", e => {
        if (e.target.matches("select[data-cond]")) { Assets.patch(e.target.dataset.cond, { condition: e.target.value }, "Condition changed to " + e.target.value); renderAll(); }
    });
    $("assetRows").addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset, a = assetOf(id);
        if (act === "del") {
            if (!confirm(`Archive ${a.name} (${a.tag})? You can restore it from the History tab.`)) return;
            Assets.patch(id, { archived: true, archivedAt: Date.now() }, "Archived"); toast(`${a.name} archived`); renderAll(); return;
        }
        const loans = Loans.all().filter(l => l.assetId === id), fixes = Tickets.all().filter(t => t.assetId === id);
        $("histTitle").textContent = `${a.name} (${a.tag})`;
        $("histBody").innerHTML = `<div class="d-flex flex-wrap gap-2 align-items-center mb-3">${badge(availability(a))}
          <span class="small text-secondary">Condition: <b>${a.condition}</b> &bull; ${esc(a.location)} &bull; ${esc(a.dept)}</span></div>
          <h3 class="h6">Usage history (${loans.length})</h3>${tbl(["Request", "Borrower", "Period", "Status", "Returned as"], loans.map(l => [l.id, esc(l.borrower), `${fmtD(l.from)} - ${fmtD(l.due)}`, badge(loanStatus(l)), l.returnCond || "-"]))}
          <h3 class="h6 mt-4">Maintenance records (${fixes.length})</h3>${tbl(["Ticket", "Issue", "Assigned to", "Status", "Logged"], fixes.map(t => [t.id, esc(t.title), esc(t.assignee || "-"), badge(t.status), fmt(t.createdAt)]))}<h3 class="h6 mt-4">Timeline</h3><ol class="tl">${tlItems(a)}</ol>`;
        modal("#historyModal").show();
    });
    $("assetForm").addEventListener("submit", e => {
        e.preventDefault();
        const f = e.target, tag = $("nTag");
        tag.setCustomValidity(Assets.all().some(a => a.tag.toLowerCase() === tag.value.trim().toLowerCase()) ? "dup" : "");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f));
        Assets.add({ name: d.name.trim(), tag: d.tag.trim(), category: d.category, location: d.location.trim(), dept: d.dept.trim(), condition: d.condition }, "Added to inventory (" + d.condition + " condition)");
        modal("#assetModal").hide(); toast(`${d.name.trim()} added to inventory`); renderAll();
    });
    $("assetModal").addEventListener("hidden.bs.modal", () => { $("assetForm").reset(); $("assetForm").classList.remove("was-validated"); });

    /* reports */
    function renderReports() {
        const T = Tickets.all().filter(t => !t.archived), A = Assets.all().filter(a => !a.archived), L = Loans.all(), fixed = T.filter(t => t.status === "Fixed");
        const times = fixed.filter(t => t.fixedAt).map(t => t.fixedAt - t.createdAt);
        const avg = times.length ? times.reduce((x, y) => x + y, 0) / times.length / 36e5 : null;
        const stats = [[T.length, "Issues reported"], [T.length ? Math.round(fixed.length / T.length * 100) + "%" : "-", "Issues fixed"],
        [avg === null ? "-" : avg < 48 ? avg.toFixed(1) + " h" : (avg / 24).toFixed(1) + " days", "Avg. repair time"],
        [A.length, "Assets recorded"], [A.filter(a => availability(a) === "Available").length, "Assets available"], [L.length, "Borrow transactions"]];
        const panel = (title, data) => `<div class="col-md-6"><div class="panel h-100"><h3 class="h6 mb-3">${title}</h3>${bars(data)}</div></div>`;
        const top = Object.fromEntries(Object.entries(tally(L, l => an(l.assetId))).sort((x, y) => y[1] - x[1]).slice(0, 5));
        $("reportBody").innerHTML = `<p class="text-secondary small">Generated ${fmt(Date.now())}</p>
          <div class="row g-3 mb-3">${stats.map(([n, l]) => `<div class="col-6 col-md-4 col-lg-2"><div class="panel stat"><div class="n fs-4">${n}</div><div class="text-secondary small">${l}</div></div></div>`).join("")}</div>
          <div class="row g-3">${panel("Repair progress (by status)", tally(T, t => t.status))}${panel("Issues by type", tally(T, t => t.category))}${panel("Asset conditions", tally(A, a => a.condition))}${panel("Borrowing transactions", tally(L, loanStatus))}${panel("Most borrowed equipment", top)}</div>`;
    }

    /* history: activity log + archive */
    function renderHistory() {
        const q = $("gSearch").value.trim().toLowerCase(), k = $("gKind").value;
        const logs = Log.all().filter(g => (!k || g.kind === k) && (!q || g.text.toLowerCase().includes(q))).slice(0, 200);
        $("logRows").innerHTML = logs.length ? logs.map(g => `<tr><td class="small text-nowrap">${fmtT(g.createdAt)}</td><td><span class="badge text-bg-light border">${{ ticket: "Ticket", asset: "Asset", loan: "Borrowing" }[g.kind]}</span></td><td>${esc(g.text)}</td></tr>`).join("")
            : `<tr><td colspan="3" class="empty">No activity yet.</td></tr>`;
        const arch = [...Tickets.all().filter(t => t.archived).map(t => ({ k: "ticket", o: t, name: t.title })), ...Assets.all().filter(a => a.archived).map(a => ({ k: "asset", o: a, name: `${a.name} (${a.tag})` }))].sort((x, y) => y.o.archivedAt - x.o.archivedAt);
        $("archRows").innerHTML = arch.length ? arch.map(x => `<tr><td><span class="badge text-bg-light border">${x.k === "ticket" ? "Ticket" : "Asset"}</span></td>
          <td><span class="tid">${x.o.id}</span><div class="fw-semibold">${esc(x.name)}</div></td><td class="small">${fmtT(x.o.archivedAt)}</td>
          <td class="text-end text-nowrap"><button class="btn btn-sm btn-success" data-act="restore" data-k="${x.k}" data-id="${x.o.id}">Restore</button>
          <button class="btn btn-sm btn-outline-danger" data-act="purge" data-k="${x.k}" data-id="${x.o.id}">Delete forever</button></td></tr>`).join("")
            : `<tr><td colspan="4" class="empty">Nothing archived.</td></tr>`;
    }
    $("archRows").addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, k, id } = b.dataset, c = k === "ticket" ? Tickets : Assets;
        if (act === "restore") { c.patch(id, { archived: false, archivedAt: null }, "Restored from archive"); toast(`${id} restored`); }
        else {
            if (!confirm(`Delete ${id} forever? This can't be undone. The activity log keeps a record of it.`)) return;
            c.remove(id, "Deleted forever"); toast(`${id} deleted forever`);
        }
        renderAll(); window.renderTickets();
    });
    ["gSearch", "gKind"].forEach(id => $(id).addEventListener("input", renderHistory));
    const renderAll = () => { renderLoans(); renderAssets(); renderReports(); renderHistory(); };
    ["lSearch", "lStatus"].forEach(id => $(id).addEventListener("input", renderLoans));
    $("sSearch").addEventListener("input", renderAssets);
    document.querySelectorAll('#adminTabs [data-bs-toggle="tab"]').forEach(b => b.addEventListener("shown.bs.tab", renderAll));
    window.addEventListener("storage", renderAll);
    renderAll();
}

/* ---------- Client login (accounts are kept in this browser) ---------- */
const Users = {
    all() { try { return JSON.parse(localStorage.getItem("fixit_users")) || []; } catch { return []; } },
    save(l) { localStorage.setItem("fixit_users", JSON.stringify(l)); }
};
const currentUser = () => { const id = localStorage.getItem("fixit_session"); return Users.all().find(u => u.idNo === id) || null; };
async function hashPw(pw, salt) {
    const text = salt + ":" + pw;
    if (window.crypto && crypto.subtle) {
        const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    let h = 5381; for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return "x" + (h >>> 0).toString(16);
}
function addEyes(gate) {
    /* show / hide password (closed eye = hidden, open eye = shown) */
    const svg = p => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const eyeOpen = svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
    const eyeShut = svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>');
    gate.querySelectorAll('input[type="password"]').forEach(inp => {
        const wrap = document.createElement("div"); wrap.className = "pw-wrap";
        inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
        const fb = wrap.nextElementSibling; if (fb && fb.classList.contains("invalid-feedback")) wrap.appendChild(fb);
        const b = document.createElement("button"); b.type = "button"; b.className = "pw-eye";
        const set = shown => { inp.type = shown ? "text" : "password"; b.innerHTML = shown ? eyeOpen : eyeShut; b.setAttribute("aria-label", shown ? "Hide password" : "Show password"); b.setAttribute("aria-pressed", shown); };
        b.reset = () => set(false); b.addEventListener("click", () => set(inp.type === "password")); set(false);
        wrap.appendChild(b);
    });
}
function initAuth() {
    const gate = $("authGate"), app = document.querySelector("main"), nav = document.querySelector(".topbar nav");
    const tag = document.createElement("span"); tag.className = "small me-2 text-nowrap";
    const out = document.createElement("button"); out.type = "button"; out.className = "btn btn-sm btn-outline-light"; out.textContent = "Log out";
    nav.append(tag, out);
    addEyes(gate);
    const apply = () => {
        const u = currentUser();
        gate.classList.toggle("d-none", !!u); app.classList.toggle("d-none", !u);
        nav.querySelectorAll("button[data-bs-toggle]").forEach(b => b.classList.toggle("d-none", !u));
        tag.classList.toggle("d-none", !u); out.classList.toggle("d-none", !u);
        tag.textContent = u ? `${u.name} (${u.role})` : "";
        gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
        window.dispatchEvent(new Event("authchange"));
    };
    const fail = (id, m) => { $(id).textContent = m; $(id).classList.remove("d-none"); };
    $("loginForm").addEventListener("submit", async e => {
        e.preventDefault(); const f = e.target; $("loginErr").classList.add("d-none"); $("loginOk").classList.add("d-none");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f)), id = d.idNo.trim().toLowerCase();
        const u = Users.all().find(x => x.idNo.toLowerCase() === id);
        if (!u || u.pw !== await hashPw(d.password, id)) return fail("loginErr", "Wrong ID number or password.");
        localStorage.setItem("fixit_session", u.idNo); f.reset(); f.classList.remove("was-validated"); apply(); toast("Welcome back, " + u.name);
    });
    $("regForm").addEventListener("submit", async e => {
        e.preventDefault(); const f = e.target; $("regErr").classList.add("d-none");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f)), idNo = d.idNo.trim(), users = Users.all();
        if (users.some(u => u.idNo.toLowerCase() === idNo.toLowerCase())) return fail("regErr", "This ID number already has an account. Try logging in.");
        if (d.password.length < 6) return fail("regErr", "Use a password with at least 6 characters.");
        if (d.password !== d.confirm) return fail("regErr", "The two passwords do not match.");
        users.push({ idNo, name: d.name.trim(), role: d.role, pw: await hashPw(d.password, idNo.toLowerCase()), createdAt: Date.now() });
        Users.save(users); f.reset(); f.classList.remove("was-validated");
        gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
        bootstrap.Tab.getOrCreateInstance('[data-bs-target="#paneLogin"]').show();
        $("lgId").value = idNo; $("loginOk").textContent = "Account created for " + d.name.trim() + ". Please log in."; $("loginOk").classList.remove("d-none");
        $("lgPw").focus();
    });
    out.addEventListener("click", () => { localStorage.removeItem("fixit_session"); apply(); toast("You have been logged out"); });
    apply();
}

/* ---------- Admin login (account is kept in this browser) ---------- */
function initAdminAuth() {
    const gate = $("authGate"), app = document.querySelector("main"), nav = document.querySelector(".topbar nav");
    const tag = document.createElement("span"); tag.className = "small me-2 text-nowrap";
    const out = document.createElement("button"); out.type = "button"; out.className = "btn btn-sm btn-outline-light"; out.textContent = "Log out";
    nav.append(tag, out);
    addEyes(gate);
    const admins = () => { try { return JSON.parse(localStorage.getItem("fixit_admins")) || []; } catch { return []; } };
    const current = () => { const u = sessionStorage.getItem("fixit_admin_session"); return admins().find(a => a.username === u) || null; };
    const fail = (id, m) => { $(id).textContent = m; $(id).classList.remove("d-none"); };
    const apply = () => {
        const u = current(), setup = admins().length === 0;
        gate.classList.toggle("d-none", !!u); app.classList.toggle("d-none", !u);
        nav.querySelectorAll("button[data-bs-toggle]").forEach(b => b.classList.toggle("d-none", !u));
        tag.classList.toggle("d-none", !u); out.classList.toggle("d-none", !u);
        tag.textContent = u ? "Signed in as " + u.name : "";
        $("loginForm").classList.toggle("d-none", setup); $("setupForm").classList.toggle("d-none", !setup);
        $("gateTitle").textContent = setup ? "Set up the admin account" : "Admin sign in";
        $("gateHint").textContent = setup ? "No admin account exists yet. Create the first one." : "Log in to manage tickets, assets, and borrowing.";
        if (u) sessionStorage.setItem("fixit_admin_name", u.name); else sessionStorage.removeItem("fixit_admin_name");
        gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
    };
    $("loginForm").addEventListener("submit", async e => {
        e.preventDefault(); const f = e.target; $("loginErr").classList.add("d-none"); $("loginOk").classList.add("d-none");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f)), id = d.username.trim().toLowerCase();
        const a = admins().find(x => x.username.toLowerCase() === id);
        if (!a || a.pw !== await hashPw(d.password, "admin:" + id)) return fail("loginErr", "Wrong username or password.");
        sessionStorage.setItem("fixit_admin_session", a.username); f.reset(); f.classList.remove("was-validated"); apply(); toast("Welcome, " + a.name);
    });
    $("setupForm").addEventListener("submit", async e => {
        e.preventDefault(); const f = e.target; $("setupErr").classList.add("d-none");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f)), username = d.username.trim();
        if (d.password.length < 6) return fail("setupErr", "Use a password with at least 6 characters.");
        if (d.password !== d.confirm) return fail("setupErr", "The two passwords do not match.");
        localStorage.setItem("fixit_admins", JSON.stringify([{ username, name: d.name.trim(), pw: await hashPw(d.password, "admin:" + username.toLowerCase()), createdAt: Date.now() }]));
        f.reset(); f.classList.remove("was-validated"); apply();
        $("lgId").value = username; $("loginOk").textContent = "Admin account created. Please log in."; $("loginOk").classList.remove("d-none"); $("lgPw").focus();
    });
    out.addEventListener("click", () => { sessionStorage.removeItem("fixit_admin_session"); apply(); toast("You have been logged out"); });
    apply();
}

/* ---------- My history (client) ---------- */
function initHistoryClient() {
    const input = $("hSearch");
    const me = () => { try { return JSON.parse(localStorage.getItem("fixit_me")) || {}; } catch { return {}; } };
    const none = t => `<tr><td colspan="5" class="empty">${t}</td></tr>`;
    const render = () => {
        const u = currentUser();
        input.classList.toggle("d-none", !!u);
        const q = input.value.trim().toLowerCase();
        if (!u && q.length < 3) {
            $("hSummary").textContent = "Type your name or ID number (at least 3 characters) to see your reports and borrowed items.";
            $("htRows").innerHTML = $("hlRows").innerHTML = none("Nothing to show yet."); return;
        }
        const T = Tickets.all().filter(t => !t.archived && (u ? (t.idNo ? t.idNo === u.idNo : t.reporter === u.name) : ((t.reporter || "") + " " + (t.idNo || t.studentNo || "")).toLowerCase().includes(q)));
        const L = Loans.all().filter(l => u ? (l.idNo ? l.idNo === u.idNo : l.borrower === u.name) : ((l.borrower || "") + " " + (l.idNo || "")).toLowerCase().includes(q));
        $("hSummary").textContent = (u ? `Records for ${u.name} (${u.idNo}). ` : "") + `${T.length} damage report${T.length === 1 ? "" : "s"} (${T.filter(t => t.status === "Fixed").length} fixed) and ${L.length} borrowing request${L.length === 1 ? "" : "s"} (${L.filter(l => l.status === "Returned").length} returned).`;
        $("htRows").innerHTML = T.length ? T.map(t => `<tr><td>${tlBtn("t", t.id)}</td>
          <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div></td>
          <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
          <td class="small">${fmt(t.createdAt)}</td><td class="small">${t.fixedAt ? fmt(t.fixedAt) : "-"}</td></tr>`).join("") : none("No damage reports found.");
        $("hlRows").innerHTML = L.length ? L.map(l => `<tr><td>${tlBtn("l", l.id)}</td>
          <td><div class="fw-semibold">${esc(an(l.assetId))}</div><div class="small text-secondary">${esc(l.purpose)}</div></td>
          <td class="small">${fmtD(l.from)} &rarr; ${fmtD(l.due)}</td><td>${badge(loanStatus(l))}</td>
          <td class="small">${l.returnedAt ? fmt(l.returnedAt) : "-"}</td></tr>`).join("") : none("No borrowing requests found.");
    };
    input.addEventListener("input", render);
    document.querySelector('[data-bs-target="#tabHist"]').addEventListener("shown.bs.tab", () => {
        if (!input.value) input.value = me().idNo || me().name || "";
        render();
    });
    window.addEventListener("storage", render);
    window.addEventListener("authchange", render);
    render();
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", e => {
        const b = e.target.closest("[data-tl]");
        if (b) showTimeline(b.dataset.tl === "t" ? Tickets : Loans, b.dataset.id);
    });
    const p = document.body.dataset.page;
    if (p === "student") { initAuth(); initStudent(); initBorrowClient(); initHistoryClient(); }
    if (p === "admin") { initAdminAuth(); initAdmin(); initAdminExtras(); }
});