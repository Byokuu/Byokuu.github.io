const $ = id => document.getElementById(id);
const fmtT = ms => new Date(ms).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const labelOf = o => o.title || o.name || o.area || "";
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
const Tickets = coll("fixit_tickets", "FX", 4, "ticket"), Assets = coll("fixit_assets", "AS", 3, "asset"), Cleanings = coll("fixit_cleanings", "CL", 4, "cleaning"), Log = coll("fixit_log", "LG", 5);
Tickets.setStatus = (id, s) => {
    const msg = { Fixed: "Marked as fixed", "In progress": "Work started", Pending: "Reopened (back to pending)" }[s];
    Tickets.patch(id, { status: s, fixedAt: s === "Fixed" ? Date.now() : null }, msg);
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
    if (o.cleanedAt) bits.push(`Cleaned ${fmtT(o.cleanedAt)}`);
    $("tlSummary").innerHTML = bits.map(esc).join("<br>") + (o.photos && o.photos.length ? '<div class="mt-2">' + photoStrip(o) + "</div>" : "");
    $("tlBody").innerHTML = tlItems(o);
    bootstrap.Modal.getOrCreateInstance("#timelineModal").show();
}
const Store = Tickets;

/* asset helpers */
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtD = d => d ? new Date(d + "T00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "-";
const assetOf = id => Assets.all().find(a => a.id === id);

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

/* ---------- Photos (kept in the browser's IndexedDB) ---------- */
const PhotoDB = {
    db: null,
    open() {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((res, rej) => {
            const r = indexedDB.open("campuscare", 1);
            r.onupgradeneeded = () => r.result.createObjectStore("photos");
            r.onsuccess = () => { this.db = r.result; res(r.result); };
            r.onerror = () => rej(r.error);
        });
    },
    async run(mode, fn) {
        const db = await this.open();
        return new Promise((res, rej) => {
            const tx = db.transaction("photos", mode); const req = fn(tx.objectStore("photos"));
            tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error);
        });
    },
    put(id, blob) { return this.run("readwrite", s => s.put(blob, id)); },
    get(id) { return this.run("readonly", s => s.get(id)); },
    remove(id) { return this.run("readwrite", s => s.delete(id)); }
};
const photoCache = {};
async function photoUrl(id) {
    if (!(id in photoCache)) { try { const b = await PhotoDB.get(id); photoCache[id] = b ? URL.createObjectURL(b) : ""; } catch { photoCache[id] = ""; } }
    return photoCache[id];
}
function resizeImage(file, max = 1280) {
    return new Promise((res, rej) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
            c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
            c.toBlob(b => b ? res(b) : rej(new Error("resize failed")), "image/jpeg", 0.78);
        };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("not an image")); };
        img.src = url;
    });
}
const photoStrip = t => (t.photos && t.photos.length)
    ? `<div class="photo-strip">${t.photos.map(id => `<button type="button" class="photo-thumb" data-photo="${id}" aria-label="View photo"><img alt=""></button>`).join("")}</div>` : "";
async function hydratePhotos(root) {
    for (const b of root.querySelectorAll(".photo-thumb:not([data-ready])")) {
        b.dataset.ready = "1";
        const url = await photoUrl(b.dataset.photo);
        if (url) b.querySelector("img").src = url; else b.classList.add("d-none");
    }
}
const Photos = {
    pending: [],
    render() {
        $("photoPreview").innerHTML = this.pending.map((p, i) => `<div class="photo-prev"><img src="${p.url}" alt="Photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}">&times;</button></div>`).join("");
    },
    async add(files) {
        for (const f of files) {
            if (this.pending.length >= 3) { toast("You can add up to 3 photos."); break; }
            if (!f.type.startsWith("image/")) { toast(`${f.name} is not an image.`); continue; }
            try { const blob = await resizeImage(f); this.pending.push({ blob, url: URL.createObjectURL(blob) }); }
            catch { toast(`Could not read ${f.name}.`); }
        }
        this.render();
    },
    async saveAll() {
        const ids = [];
        try {
            for (const p of this.pending) {
                const id = "ph-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                await PhotoDB.put(id, p.blob); ids.push(id);
            }
        } catch { toast("Photos could not be saved in this browser. The report was sent without them."); }
        return ids;
    },
    clear() { this.pending.forEach(p => URL.revokeObjectURL(p.url)); this.pending = []; if ($("photoPreview")) this.render(); },
    init() {
        const drop = $("photoDrop"); if (!drop) return;
        const pick = () => $("photoInput").click();
        drop.addEventListener("click", e => { if (!e.target.closest("button")) pick(); });
        drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
        ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
        drop.addEventListener("drop", e => this.add([...e.dataTransfer.files]));
        $("photoInput").addEventListener("change", e => { this.add([...e.target.files]); e.target.value = ""; });
        $("photoCamera").addEventListener("change", e => { this.add([...e.target.files]); e.target.value = ""; });
        $("photoCamBtn").addEventListener("click", () => $("photoCamera").click());
        $("photoGalBtn").addEventListener("click", pick);
        $("photoPreview").addEventListener("click", e => {
            const b = e.target.closest("[data-rm]"); if (!b) return;
            const [p] = this.pending.splice(+b.dataset.rm, 1); URL.revokeObjectURL(p.url); this.render();
        });
    }
};
function initPhotoViewer() {
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; hydratePhotos(document); }); } }).observe(document.body, { childList: true, subtree: true });
    let lb = { ids: [], i: 0 };
    const show = async () => {
        $("phImg").src = await photoUrl(lb.ids[lb.i]);
        $("phCount").textContent = `Photo ${lb.i + 1} of ${lb.ids.length}`;
        $("phPrev").classList.toggle("d-none", lb.ids.length < 2); $("phNext").classList.toggle("d-none", lb.ids.length < 2);
    };
    document.addEventListener("click", e => {
        const t = e.target.closest(".photo-thumb"); if (!t) return;
        lb.ids = [...t.parentElement.querySelectorAll(".photo-thumb")].map(x => x.dataset.photo); lb.i = lb.ids.indexOf(t.dataset.photo);
        const go = () => { show(); bootstrap.Modal.getOrCreateInstance("#photoModal").show(); };
        const open = document.querySelector(".modal.show");
        if (open) { open.addEventListener("hidden.bs.modal", go, { once: true }); bootstrap.Modal.getInstance(open).hide(); } else go();
    });
    $("phPrev").addEventListener("click", () => { lb.i = (lb.i - 1 + lb.ids.length) % lb.ids.length; show(); });
    $("phNext").addEventListener("click", () => { lb.i = (lb.i + 1) % lb.ids.length; show(); });
    hydratePhotos(document);
}

/* ---------- Shared: report form + modals ---------- */
function initReportForm(afterSave) {
    const form = document.getElementById("ticketForm");
    const rm = document.getElementById("reportModal");
    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(form));
        const photoIds = await Photos.saveAll();
        const t = Store.add({
            title: d.title.trim(), building: d.building, location: d.location.trim(),
            category: d.category, urgency: d.urgency, description: d.description.trim(),
            role: d.role || "Office", reporter: (d.reporter || "").trim() || "Maintenance office",
            idNo: (d.idNo || "").trim(), via: d.via || "", status: d.status || "Pending", assignee: "", fixedAt: null, photos: photoIds, onBehalf: (d.onBehalf || "").trim()
        }, d.role ? `Reported by ${(d.reporter || "").trim()} (${d.role})` : `Logged by ${(d.reporter || "").trim()}${d.via ? " - found by " + d.via.toLowerCase() : ""}${d.onBehalf && d.onBehalf.trim() ? ", reported by " + d.onBehalf.trim() : ""}`);
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
    rm.addEventListener("show.bs.modal", () => {
        const lock = el => { el.setAttribute("aria-readonly", "true"); el.tabIndex = -1; el.classList.add("locked"); if (el.tagName !== "SELECT") el.readOnly = true; };
        if ($("role")) {
            const u = currentUser(); if (!u) return;
            $("role").value = u.role; $("role").dispatchEvent(new Event("change"));
            $("reporter").value = u.name; $("idNo").value = u.idNo;
            [$("role"), $("reporter"), $("idNo")].forEach(lock);
            fillChip("whoChip", u.name, `${u.role} \u00b7 ${u.idNo}`);
        } else if ($("reporter")) {
            const n = sessionStorage.getItem("fixit_admin_name");
            if (n) { $("reporter").value = n; lock($("reporter")); fillChip("whoChip", n, "Facility Management Office"); }
        }
    });
    Photos.init();
    rm.addEventListener("hidden.bs.modal", () => { form.reset(); form.classList.remove("was-validated"); syncId(); Photos.clear(); });
    document.getElementById("copyId").addEventListener("click", async e => {
        const id = document.getElementById("lastId").textContent;
        try { await navigator.clipboard.writeText(id); e.target.textContent = "Copied"; }
        catch { e.target.textContent = "Press Ctrl+C"; }
    });
    rm.addEventListener("shown.bs.modal", () => $("title").focus());
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
        <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div>${photoStrip(t)}</td>
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
            <div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)} &bull; ${esc(t.category)}</div>
            ${t.description ? `<div class="small mt-1">${esc(t.description)}</div>` : ""}${photoStrip(t)}</td>
        <td class="small">${esc(t.onBehalf || t.reporter)}<br><span class="text-secondary">${t.onBehalf ? "Logged by " + esc(t.reporter) : esc(who(t))}</span></td>
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

/* ---------- Admin: assign, borrowing, assets, reports ---------- */
/* saved personnel, own requests, CSV export */
const Staff = {
    all() { try { return JSON.parse(localStorage.getItem("fixit_staff")) || []; } catch { return []; } },
    add(n) { const l = this.all(); if (n && !l.some(x => x.toLowerCase() === n.toLowerCase())) { l.push(n); localStorage.setItem("fixit_staff", JSON.stringify(l.sort())); } },
    remove(n) { localStorage.setItem("fixit_staff", JSON.stringify(this.all().filter(x => x !== n))); }
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
        Tickets.all().map(t => [t.id, t.title, t.building, t.location, t.category, t.urgency, t.status, t.onBehalf || t.reporter, t.role, t.idNo || t.studentNo || "", t.assignee || "", t.assetId || "", fmtT(t.createdAt), t.fixedAt ? fmtT(t.fixedAt) : "", t.archived ? "Yes" : "", t.description || ""])));
    csvBtn("tabClean", () => downloadCSV("facility-cleaning", ["Record", "Building", "Area", "Area type", "Scheduled", "Staff assigned", "Status", "Cleaned on", "Notes"],
        Cleanings.all().map(c => [c.id, c.building, c.area, c.areaType, c.when ? fmtT(new Date(c.when).getTime()) : "", c.staff, c.status, c.cleanedAt ? fmtT(c.cleanedAt) : "", c.notes || ""])));
    csvBtn("tabAssets", () => downloadCSV("assets", ["ID", "Item", "ID no.", "Category", "Quantity", "Unit", "Location", "Department", "Archived"],
        Assets.all().map(a => [a.id, a.name, a.tag, a.category, a.qty ?? "", a.unit || "", a.location, a.dept, a.archived ? "Yes" : ""])));

    /* assign personnel */
    $("assignForm").addEventListener("submit", e => {
        e.preventDefault();
        const id = $("aId").value, name = $("aName").value.trim(), t = Tickets.all().find(x => x.id === id);
        Staff.add(name);
        Tickets.patch(id, { assignee: name, status: t.status === "Pending" ? "In progress" : t.status }, "Assigned to " + name + (t.status === "Pending" ? " (work started)" : ""));
        modal("#assignModal").hide(); toast(`${id} assigned to ${name}`); window.renderTickets();
    });

    /* facility cleaning */
    let cleanEdit = null;
    const fmtWhen = s => s ? new Date(s).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";
    const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    function renderCleanings() {
        const all = Cleanings.all(), q = $("cSearch").value.trim().toLowerCase(), st = $("cStatus").value, ty = $("cType").value;
        $("cCTotal").textContent = all.length;
        $("cCDue").textContent = all.filter(c => c.status === "For Cleaning").length;
        $("cCDone").textContent = all.filter(c => c.status === "Cleaned").length;
        const list = all.filter(c => (!st || c.status === st) && (!ty || c.areaType === ty) && (!q || (c.id + c.building + c.area + c.staff).toLowerCase().includes(q)))
            .sort((x, y) => x.status === y.status ? (x.status === "For Cleaning" ? x.when.localeCompare(y.when) : y.when.localeCompare(x.when)) : (x.status === "For Cleaning" ? -1 : 1));
        $("cleanRows").innerHTML = list.length ? list.map(c => `<tr>
          <td>${tlBtn("c", c.id)}</td>
          <td><div class="fw-semibold">${esc(c.building)} &ndash; ${esc(c.area)}</div><div class="small text-secondary">${esc(c.areaType)}${c.notes ? " &bull; " + esc(c.notes) : ""}</div></td>
          <td class="small">${fmtWhen(c.when)}${c.cleanedAt ? `<div class="text-secondary">Cleaned ${fmt(c.cleanedAt)}</div>` : ""}</td>
          <td class="small">${esc(c.staff)}</td>
          <td>${badge(c.status)}</td>
          <td class="text-end text-nowrap">${c.status === "For Cleaning"
                ? `<button class="btn btn-sm btn-success" data-act="done" data-id="${c.id}">Mark as cleaned</button>`
                : `<button class="btn btn-sm btn-outline-secondary" data-act="reopen" data-id="${c.id}">Reopen</button>`}
            <button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${c.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${c.id}">Delete</button></td></tr>`).join("")
            : `<tr><td colspan="6" class="empty">No cleaning records match.</td></tr>`;
    }
    $("cleanRows").addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset, c = Cleanings.all().find(x => x.id === id); if (!c) return;
        if (act === "done") { Cleanings.patch(id, { status: "Cleaned", cleanedAt: Date.now() }, "Marked as cleaned"); toast(`${id} marked as cleaned`); }
        else if (act === "reopen") { Cleanings.patch(id, { status: "For Cleaning", cleanedAt: null }, "Reopened (back to For Cleaning)"); toast(`${id} is back to For Cleaning`); }
        else if (act === "edit") { cleanEdit = c; modal("#cleanModal").show(); return; }
        else { if (!confirm(`Delete cleaning record ${id}? This can't be undone.`)) return; Cleanings.remove(id, "Deleted"); toast(`${id} deleted`); }
        renderAll();
    });
    $("cleanModal").addEventListener("show.bs.modal", () => {
        const f = $("cleanForm"), c = cleanEdit; cleanEdit = null;
        f.reset(); f.classList.remove("was-validated");
        $("cleanId").value = c ? c.id : "";
        $("cleanModalT").textContent = c ? "Edit cleaning record" : "Add cleaning record";
        $("cleanSave").textContent = c ? "Save changes" : "Save record";
        $("staffList").innerHTML = Staff.all().map(n => `<option value="${esc(n)}">`).join("");
        $("cWhen").value = c ? c.when : nowLocal();
        if (c) { $("cBuilding").value = c.building; $("cArea").value = c.area; $("cAreaType").value = c.areaType; $("cStaff").value = c.staff; $("cState").value = c.status; $("cNotes").value = c.notes || ""; }
    });
    $("cleanForm").addEventListener("submit", e => {
        e.preventDefault(); const f = e.target;
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f)), id = $("cleanId").value;
        const data = { building: d.building.trim(), area: d.area.trim(), areaType: d.areaType, when: d.when, staff: d.staff.trim(), status: d.state, notes: d.notes.trim() };
        Staff.add(data.staff);
        if (id) {
            const old = Cleanings.all().find(x => x.id === id);
            data.cleanedAt = data.status === "Cleaned" ? (old.cleanedAt || Date.now()) : null;
            Cleanings.patch(id, data, "Record updated" + (old.status !== data.status ? ` (${data.status})` : ""));
            toast(`${id} updated`);
        } else {
            data.cleanedAt = data.status === "Cleaned" ? Date.now() : null;
            const c = Cleanings.add(data, `Scheduled for ${fmtWhen(data.when)}, assigned to ${data.staff}`);
            toast(`${c.id} added`);
        }
        modal("#cleanModal").hide(); renderAll();
    });

    /* assets (cleaning supplies): add, edit, archive, delete */
    let assetView = "active", delId = null, pendingEdit = null;
    const assetHead = {
        active: "<tr><th>ID no.</th><th>Item</th><th>Quantity</th><th>Location</th><th>Department</th><th>Updated</th><th></th></tr>",
        archived: "<tr><th>ID no.</th><th>Item</th><th>Quantity</th><th>Location</th><th>Archived on</th><th></th></tr>"
    };
    function renderAssets() {
        const all = Assets.all(), q = $("sSearch").value.trim().toLowerCase(), arch = assetView === "archived";
        $("cntActive").textContent = all.filter(a => !a.archived).length; $("cntArch").textContent = all.filter(a => a.archived).length;
        $("assetHead").innerHTML = assetHead[assetView];
        const list = all.filter(a => !!a.archived === arch && (!q || (a.id + a.name + a.tag + a.location + a.dept + a.category).toLowerCase().includes(q)));
        const btns = a => arch
            ? `<button class="btn btn-sm btn-success" data-act="restore" data-id="${a.id}">Restore</button> <button class="btn btn-sm btn-outline-danger" data-act="purge" data-id="${a.id}">Delete permanently</button>`
            : `<button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${a.id}">Edit</button> <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${a.id}">Delete</button>`;
        $("assetRows").innerHTML = list.length ? list.map(a => `<tr>
          <td><span class="tid">${a.id}</span><div class="small text-secondary">${esc(a.tag)}</div></td>
          <td><div class="fw-semibold">${esc(a.name)}</div><div class="small text-secondary">${esc(a.category)}</div></td>
          <td class="fw-semibold">${a.qty ?? "-"} <span class="small text-secondary fw-normal">${esc(a.unit || "")}</span></td>
          <td class="small">${esc(a.location)}</td>
          ${arch ? "" : `<td class="small">${esc(a.dept)}</td>`}
          <td class="small text-secondary">${fmt(arch ? (a.archivedAt || a.updatedAt) : a.updatedAt)}</td>
          <td class="text-end text-nowrap">${btns(a)}</td></tr>`).join("")
            : `<tr><td colspan="${arch ? 6 : 7}" class="empty">${arch ? "Nothing in the archive." : 'No items yet. Use "+ Add item" to record one.'}</td></tr>`;
    }
    $("assetView").addEventListener("click", e => {
        const b = e.target.closest("[data-av]"); if (!b) return;
        assetView = b.dataset.av;
        $("assetView").querySelectorAll("[data-av]").forEach(x => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
        renderAssets();
    });
    const setAssetForm = a => {
        const f = $("assetForm"); f.reset(); f.classList.remove("was-validated");
        $("assetId2").value = a ? a.id : "";
        $("assetModalT").textContent = a ? "Edit item" : "Add item";
        $("assetSave").textContent = a ? "Save changes" : "Save item";
        if (a) { $("nName").value = a.name; $("nTag").value = a.tag; $("nCat").value = a.category; $("nQty").value = a.qty ?? ""; $("nUnit").value = a.unit || ""; $("nLoc").value = a.location; $("nDept").value = a.dept; }
    };
    $("assetModal").addEventListener("show.bs.modal", () => { setAssetForm(pendingEdit); pendingEdit = null; });
    $("assetForm").addEventListener("submit", e => {
        e.preventDefault();
        const f = e.target, tag = $("nTag"), eid = $("assetId2").value;
        tag.setCustomValidity(Assets.all().some(a => a.id !== eid && a.tag.toLowerCase() === tag.value.trim().toLowerCase()) ? "dup" : "");
        if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(f));
        const data = { name: d.name.trim(), tag: d.tag.trim(), category: d.category, qty: Number(d.qty), unit: d.unit.trim(), location: d.location.trim(), dept: d.dept.trim() };
        if (eid) {
            const old = assetOf(eid);
            Assets.patch(eid, data, "Item details updated" + (old && old.qty !== data.qty ? ` (quantity ${old.qty ?? 0} to ${data.qty})` : ""));
            toast(`${data.name} updated`);
        } else {
            Assets.add({ ...data, condition: "Good" }, `Added to inventory (${data.qty} ${data.unit})`);
            toast(`${data.name} added to the inventory`);
        }
        modal("#assetModal").hide(); renderAll();
    });
    /* delete: choose archive or permanent delete */
    const showStep = confirmStep => {
        $("delChoices").classList.toggle("d-none", confirmStep); $("delConfirm").classList.toggle("d-none", !confirmStep); $("delGo").classList.toggle("d-none", !confirmStep);
        $("delT").textContent = confirmStep ? "Delete permanently?" : "Remove this item?";
    };
    function openDelete(a, permanentOnly) {
        delId = a.id; $("delItem").innerHTML = `<b>${esc(a.name)}</b> <span class="text-secondary">(${esc(a.tag)})</span>`;
        $("delBack").classList.toggle("d-none", permanentOnly); showStep(permanentOnly); modal("#delAssetModal").show();
    }
    $("assetRows").addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset, a = assetOf(id); if (!a) return;
        if (act === "edit") { pendingEdit = a; modal("#assetModal").show(); }
        else if (act === "restore") { Assets.patch(id, { archived: false, archivedAt: null }, "Restored from archive"); toast(`${a.name} restored`); renderAll(); }
        else openDelete(a, act === "purge");
    });
    $("chArchive").addEventListener("click", () => {
        const a = assetOf(delId); if (!a) return;
        Assets.patch(delId, { archived: true, archivedAt: Date.now() }, "Moved to archive");
        modal("#delAssetModal").hide(); toast(`${a.name} moved to the archive`); renderAll();
    });
    $("chPurge").addEventListener("click", () => showStep(true));
    $("delBack").addEventListener("click", () => showStep(false));
    $("delGo").addEventListener("click", () => {
        const a = assetOf(delId); if (!a) return;
        Assets.remove(delId, "Deleted permanently");
        modal("#delAssetModal").hide(); toast(`${a.name} deleted permanently`); renderAll(); window.renderTickets();
    });

    /* reports */
    function renderReports() {
        const T = Tickets.all().filter(t => !t.archived), A = Assets.all().filter(a => !a.archived), C = Cleanings.all(), fixed = T.filter(t => t.status === "Fixed");
        const times = fixed.filter(t => t.fixedAt).map(t => t.fixedAt - t.createdAt);
        const avg = times.length ? times.reduce((x, y) => x + y, 0) / times.length / 36e5 : null;
        const stats = [[T.length, "Issues reported"], [T.length ? Math.round(fixed.length / T.length * 100) + "%" : "-", "Issues fixed"],
        [avg === null ? "-" : avg < 48 ? avg.toFixed(1) + " h" : (avg / 24).toFixed(1) + " days", "Avg. repair time"],
        [A.length, "Items in inventory"], [C.length, "Cleaning records"], [C.filter(c => c.status === "Cleaned").length, "Areas cleaned"]];
        const panel = (title, data) => `<div class="col-md-6"><div class="panel h-100"><h3 class="h6 mb-3">${title}</h3>${bars(data)}</div></div>`;
        $("reportBody").innerHTML = `<p class="text-secondary small">Generated ${fmt(Date.now())}</p>
          <div class="row g-3 mb-3">${stats.map(([n, l]) => `<div class="col-6 col-md-4 col-lg-2"><div class="panel stat"><div class="n fs-4">${n}</div><div class="text-secondary small">${l}</div></div></div>`).join("")}</div>
          <div class="row g-3">${panel("Repair progress (by status)", tally(T, t => t.status))}${panel("Issues by type", tally(T, t => t.category))}${panel("Facility cleaning (by status)", tally(C, c => c.status))}${panel("Cleaning records by area type", tally(C, c => c.areaType))}${panel("Inventory by category", tally(A, a => a.category))}</div>`;
    }

    /* history: activity log + archive */
    function renderHistory() {
        const q = $("gSearch").value.trim().toLowerCase(), k = $("gKind").value;
        const logs = Log.all().filter(g => (!k || g.kind === k) && (!q || g.text.toLowerCase().includes(q))).slice(0, 200);
        $("logRows").innerHTML = logs.length ? logs.map(g => `<tr><td class="small text-nowrap">${fmtT(g.createdAt)}</td><td><span class="badge text-bg-light border">${{ ticket: "Ticket", asset: "Asset", cleaning: "Cleaning", loan: "Borrowing" }[g.kind]}</span></td><td>${esc(g.text)}</td></tr>`).join("")
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
            (c === Tickets ? (Tickets.all().find(t => t.id === id) || {}).photos || [] : []).forEach(p => PhotoDB.remove(p).catch(() => { }));
            c.remove(id, "Deleted forever"); toast(`${id} deleted forever`);
        }
        renderAll(); window.renderTickets();
    });
    ["gSearch", "gKind"].forEach(id => $(id).addEventListener("input", renderHistory));
    const renderAll = () => { renderCleanings(); renderAssets(); renderReports(); renderHistory(); };
    ["cSearch", "cStatus", "cType"].forEach(id => $(id).addEventListener("input", renderCleanings));
    $("sSearch").addEventListener("input", renderAssets);
    document.addEventListener("shown.bs.tab", e => { if (e.target.closest("#adminTabs, #adminBottomNav")) renderAll(); });
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
/* ---------- Auto log-out when idle, and edit profile ---------- */
const IDLE_MS = 15 * 60 * 1000;
const IDLE_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"];
const Idle = {
    t: null, on: false, cb: null,
    bump: () => { clearTimeout(Idle.t); Idle.t = setTimeout(() => Idle.cb && Idle.cb(), IDLE_MS); },
    start(cb) {
        this.cb = cb;
        if (!this.on) { this.on = true; IDLE_EVENTS.forEach(ev => document.addEventListener(ev, this.bump, { passive: true })); }
        this.bump();
    },
    stop() { clearTimeout(this.t); if (this.on) { this.on = false; IDLE_EVENTS.forEach(ev => document.removeEventListener(ev, this.bump)); } }
};
function closeEverything() {
    document.querySelectorAll(".modal.show").forEach(m => { const i = bootstrap.Modal.getInstance(m); if (i) i.hide(); });
    document.querySelectorAll(".offcanvas.show").forEach(o => { const i = bootstrap.Offcanvas.getInstance(o); if (i) i.hide(); });
}
function initProfile(cfg) {
    const form = $("profileForm"), modalEl = $("profileModal"), err = $("profErr");
    const pwIds = ["pfCur", "pfNew", "pfNew2"];
    addEyes(modalEl);
    let mode = "name";
    const fail = m => { err.textContent = m; err.classList.remove("d-none"); };
    const done = msg => { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); window.refreshAuth(); toast(msg); };
    const setMode = m => {
        mode = m; err.classList.add("d-none"); form.classList.remove("was-validated");
        modalEl.querySelectorAll("[data-pf]").forEach(b => { const on = b.dataset.pf === m; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
        $("pfPaneName").classList.toggle("d-none", m !== "name"); $("pfPanePw").classList.toggle("d-none", m !== "pw");
        $("pfName").required = m === "name";
        pwIds.forEach(id => { $(id).required = m === "pw"; $(id).value = ""; $(id).readOnly = true; });
        modalEl.querySelectorAll(".pw-eye").forEach(b => b.reset());
    };
    pwIds.forEach(id => $(id).addEventListener("focus", e => { e.target.readOnly = false; }));
    modalEl.querySelectorAll("[data-pf]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.pf)));
    window.openProfile = () => {
        const u = cfg.get(); if (!u) return;
        $("pfName").value = u.name; $("pfId").value = cfg.idText(u); setMode("name");
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };
    modalEl.addEventListener("hidden.bs.modal", () => setMode("name"));
    form.addEventListener("submit", async e => {
        e.preventDefault(); err.classList.add("d-none");
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const u = cfg.get();
        if (mode === "name") {
            const name = $("pfName").value.trim();
            if (!name) return fail("Enter your name.");
            if (name === u.name) return fail("That is already your name.");
            cfg.save(u, { name }); done("Name updated");
        } else {
            const cur = $("pfCur").value, n1 = $("pfNew").value, n2 = $("pfNew2").value;
            if (u.pw !== await hashPw(cur, cfg.salt(u))) return fail("Your current password is wrong.");
            if (n1.length < 6) return fail("Use a new password with at least 6 characters.");
            if (n1 === cur) return fail("The new password must be different from the current one.");
            if (n1 !== n2) return fail("The two new passwords do not match.");
            cfg.save(u, { pw: await hashPw(n1, cfg.salt(u)) }); done("Password updated");
        }
    });
}

function buildUserMenu(nav) {
    const wrap = document.createElement("div"); wrap.className = "dropdown user-menu";
    const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    wrap.innerHTML = `<button type="button" class="user-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Account menu">
        <span class="user-avatar"></span><span class="user-name"></span>${svg('<path d="M6 9l6 6 6-6"/>')}</button>
      <div class="dropdown-menu dropdown-menu-end user-dd">
        <div class="user-card"><span class="user-avatar lg"></span><div><div class="user-card-name"></div><div class="user-card-meta"></div></div></div>
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item">${svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}Edit profile</button>
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item text-danger">${svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>')}Log out</button>
      </div>`;
    nav.append(wrap);
    const tag = wrap.querySelector(".user-toggle"), [prof, out] = wrap.querySelectorAll(".dropdown-item");
    return { tag, prof, out, hdr: null };
}
function fillChip(id, name, meta) {
    const c = $(id); if (!c) return;
    c.querySelector(".user-avatar").textContent = (name.trim().charAt(0) || "?").toUpperCase();
    c.querySelector(".who-name").textContent = name; c.querySelector(".who-meta").textContent = meta;
}
function fillUserMenu(tag, name, meta) {
    const w = tag.closest(".user-menu"), ini = (name.trim().charAt(0) || "?").toUpperCase();
    w.querySelectorAll(".user-avatar").forEach(a => a.textContent = ini);
    w.querySelector(".user-name").textContent = name;
    w.querySelector(".user-card-name").textContent = name;
    w.querySelector(".user-card-meta").textContent = meta;
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
    const { tag, prof, out, hdr } = buildUserMenu(nav);
    addEyes(gate);
    window.doLogout = () => out.click();
    const apply = () => {
        const u = currentUser();
        gate.classList.toggle("d-none", !!u); app.classList.toggle("d-none", !u);
        nav.querySelectorAll("button[data-bs-toggle]").forEach(b => b.classList.toggle("d-none", !u));
        tag.classList.toggle("d-none", !u); out.classList.toggle("d-none", !u); prof.classList.toggle("d-none", !u);
        fillUserMenu(tag, u ? u.name : "", u ? `${u.role} - ${u.idNo}` : "");
        if (u) Idle.start(() => { closeEverything(); localStorage.removeItem("fixit_session"); apply(); toast("You were logged out after 15 minutes of inactivity."); }); else Idle.stop();
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
    prof.addEventListener("click", () => window.openProfile());
    initProfile({
        get: currentUser, salt: u => u.idNo.toLowerCase(), idText: u => u.idNo,
        save: (u, patch) => { const l = Users.all(); Object.assign(l.find(x => x.idNo === u.idNo), patch); Users.save(l); }
    });
    window.refreshAuth = apply;
    apply();
}

/* ---------- Admin login (account is kept in this browser) ---------- */
function initAdminAuth() {
    const gate = $("authGate"), app = document.querySelector("main"), nav = document.querySelector(".topbar nav");
    const { tag, prof, out, hdr } = buildUserMenu(nav);
    addEyes(gate);
    const admins = () => { try { return JSON.parse(localStorage.getItem("fixit_admins")) || []; } catch { return []; } };
    const current = () => { const u = sessionStorage.getItem("fixit_admin_session"); return admins().find(a => a.username === u) || null; };
    const fail = (id, m) => { $(id).textContent = m; $(id).classList.remove("d-none"); };
    const apply = () => {
        const u = current(), setup = admins().length === 0;
        gate.classList.toggle("d-none", !!u); app.classList.toggle("d-none", !u);
        nav.querySelectorAll("button[data-bs-toggle]").forEach(b => b.classList.toggle("d-none", !u));
        tag.classList.toggle("d-none", !u); out.classList.toggle("d-none", !u); prof.classList.toggle("d-none", !u);
        fillUserMenu(tag, u ? u.name : "", u ? "Admin - " + u.username : "");
        if (u) Idle.start(() => { closeEverything(); sessionStorage.removeItem("fixit_admin_session"); apply(); toast("You were logged out after 15 minutes of inactivity."); }); else Idle.stop();
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
    prof.addEventListener("click", () => window.openProfile());
    initProfile({
        get: current, salt: u => "admin:" + u.username.toLowerCase(), idText: u => u.username,
        save: (u, patch) => { const l = admins(); Object.assign(l.find(x => x.username === u.username), patch); localStorage.setItem("fixit_admins", JSON.stringify(l)); }
    });
    window.refreshAuth = apply;
    apply();
}

/* ---------- Mobile bottom sheets (client) ---------- */
function initSheets() {
    $("accountSheet").addEventListener("show.bs.offcanvas", () => {
        const u = currentUser(); if (!u) return;
        $("shAvatar").textContent = u.name.trim().charAt(0).toUpperCase();
        $("shName").textContent = u.name; $("shMeta").textContent = u.role + " - " + u.idNo;
    });
    $("sheetProfile").addEventListener("click", () => {
        const el = $("accountSheet");
        el.addEventListener("hidden.bs.offcanvas", () => window.openProfile(), { once: true });
        bootstrap.Offcanvas.getOrCreateInstance(el).hide();
    });
    $("sheetLogout").addEventListener("click", () => { bootstrap.Offcanvas.getOrCreateInstance("#accountSheet").hide(); window.doLogout(); });
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
            $("hSummary").textContent = "Type your name or ID number (at least 3 characters) to see your damage reports.";
            $("htRows").innerHTML = none("Nothing to show yet."); return;
        }
        const T = Tickets.all().filter(t => !t.archived && (u ? (t.idNo ? t.idNo === u.idNo : t.reporter === u.name) : ((t.reporter || "") + " " + (t.idNo || t.studentNo || "")).toLowerCase().includes(q)));
        $("hSummary").textContent = (u ? `Records for ${u.name} (${u.idNo}). ` : "") + `${T.length} damage report${T.length === 1 ? "" : "s"}, ${T.filter(t => t.status === "Fixed").length} fixed.`;
        $("htRows").innerHTML = T.length ? T.map(t => `<tr><td>${tlBtn("t", t.id)}</td>
          <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div>${photoStrip(t)}</td>
          <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
          <td class="small">${fmt(t.createdAt)}</td><td class="small">${t.fixedAt ? fmt(t.fixedAt) : "-"}</td></tr>`).join("") : none("No damage reports found.");
    };
    input.addEventListener("input", render);
    document.addEventListener("shown.bs.tab", e => {
        if (e.target.getAttribute("data-bs-target") !== "#tabHist") return;
        if (!input.value) input.value = me().idNo || me().name || "";
        render();
    });
    window.addEventListener("storage", render);
    window.addEventListener("authchange", render);
    render();
}

/* ---------- Mobile page title + client summary ---------- */
const M_TITLES = {
    student: {
        "#tabReports": ["Damage reports", "Track what has been reported on campus"],
        "#tabHist": ["My history", "Your damage reports"]
    },
    admin: {
        "#tabTickets": ["Maintenance tracking", "Assign, update, and close tickets"],
        "#tabClean": ["Facility cleaning", "Record and track cleaning of campus areas"],
        "#tabAssets": ["Assets", "Cleaning supplies and other items"],
        "#tabReports": ["Reports and analytics", "Summaries of tickets, assets, and borrowing"],
        "#tabHistory": ["History and archive", "Activity log and archived items"]
    }
};
function updateMobileHead(t) {
    const m = (M_TITLES[document.body.dataset.page] || {})[t];
    if (m && $("mTitle")) { $("mTitle").textContent = m[0]; $("mSub").textContent = m[1]; }
}
function initHero() {
    if (!$("heroName")) return;
    const render = () => {
        const u = currentUser(); if (!u) return;
        const T = Tickets.all().filter(t => !t.archived && (t.idNo ? t.idNo === u.idNo : t.reporter === u.name));
        $("heroName").textContent = u.name.trim().split(" ")[0];
        $("heroTotal").textContent = T.length;
        $("heroOpen").textContent = T.filter(t => t.status !== "Fixed").length;
        $("heroFixed").textContent = T.filter(t => t.status === "Fixed").length;
    };
    window.addEventListener("authchange", render); window.addEventListener("storage", render);
    document.addEventListener("shown.bs.tab", render);
    new MutationObserver(render).observe($("rows"), { childList: true });
    render();
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", e => {
        const b = e.target.closest("[data-tl]");
        if (b) showTimeline({ t: Tickets, c: Cleanings }[b.dataset.tl], b.dataset.id);
    });
    document.addEventListener("shown.bs.tab", e => {
        const t = e.target.getAttribute("data-bs-target");
        updateMobileHead(t);
        document.querySelectorAll("[data-main-nav]").forEach(b => {
            const on = b.getAttribute("data-bs-target") === t;
            b.classList.toggle("active", on); b.setAttribute("aria-selected", on);
        });
    });
    /* move focus out of a window before it is hidden (stops the aria-hidden warning) */
    ["hide.bs.modal", "hide.bs.offcanvas"].forEach(ev => document.addEventListener(ev, () => { if (document.activeElement) document.activeElement.blur(); }));
    initPhotoViewer();
    const p = document.body.dataset.page;
    updateMobileHead(p === "student" ? "#tabReports" : "#tabTickets");
    if (p === "student") { initAuth(); initStudent(); initHistoryClient(); initSheets(); initHero(); }
    if (p === "admin") { initAdminAuth(); initAdmin(); initAdminExtras(); }
});