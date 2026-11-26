const $ = id => document.getElementById(id);
const fmtT = ms => new Date(ms).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const labelOf = o => o.title || o.name || o.area || o.itemName || "";

const isSupplyPage = () => (document.body.dataset.page || document.body.dataset.role || "").toLowerCase() === "famo";
const currentOfficeScope = () => {
    const p = (document.body.dataset.page || document.body.dataset.role || "").toLowerCase();
    return (p === "famo" || p === "admin_office") ? p : "";
};

const coll = (key, prefix, pad, kind, opts = {}) => {
    const scoped = !!opts.scoped;
    const rawAll = () => {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    };
    const saveRaw = l => localStorage.setItem(key, JSON.stringify(l));

    return {
        rawAll,
        all() {
            const list = rawAll();
            const scope = scoped ? currentOfficeScope() : "";
            if (!scope) return list;
            return list.filter(x => (x.scope || x.office || "") === scope);
        },
        save(l) {
            const scope = scoped ? currentOfficeScope() : "";
            if (!scope) { saveRaw(l); return; }
            const others = rawAll().filter(x => (x.scope || x.office || "") !== scope);
            saveRaw([...l, ...others]);
        },
        note(o, text) {
            const by = sessionStorage.getItem("fixit_admin_name");
            if (by) text += " (by " + by + ")";
            o.events = (o.events || []).concat({ ts: Date.now(), text });
            if (kind) {
                Log.add({
                    kind,
                    ref: o.id,
                    text: `${o.id} (${labelOf(o)}) - ${text}`
                }, o.scope || currentOfficeScope());
            }
        },
        add(o, text) {
            const scope = scoped ? currentOfficeScope() : "";
            if (scope && !o.scope) o.scope = scope;
            const l = this.all();
            const n = Math.max(0, ...l.map(x => parseInt((x.id || "").split("-")[1], 10) || 0)) + 1;
            o.id = prefix + "-" + String(n).padStart(pad, "0");
            o.createdAt = o.updatedAt = Date.now();
            o.events = [];
            if (text) this.note(o, text);
            l.unshift(o);
            this.save(l);
            return o;
        },
        patch(id, p, text) {
            const l = this.all(), o = l.find(x => x.id === id);
            if (o) {
                Object.assign(o, p, { updatedAt: Date.now() });
                if (text) this.note(o, text);
                this.save(l);
            }
            return o;
        },
        remove(id, text) {
            const o = this.all().find(x => x.id === id);
            if (o && text) this.note(o, text);
            this.save(this.all().filter(x => x.id !== id));
        }
    };
};

const Tickets = coll("fixit_tickets", "FX", 4, "ticket"),
    Assets = coll("fixit_assets", "AS", 3, "asset", { scoped: true }),
    Supplies = coll("fixit_supplies", "SP", 3, "supply", { scoped: true }),
    Cleanings = coll("fixit_cleanings", "CL", 4, "cleaning"),
    Loans = coll("fixit_loans", "LN", 4, "loan"),
    Log = {
        ...coll("fixit_log", "LG", 5, null, { scoped: true }),
        add(entry, scopeOverride) {
            const list = this.all();
            const n = Math.max(0, ...list.map(x => parseInt((x.id || "").split("-")[1], 10) || 0)) + 1;
            const rec = {
                ...entry,
                id: "LG-" + String(n).padStart(5, "0"),
                createdAt: Date.now(),
                scope: scopeOverride || currentOfficeScope() || ""
            };
            list.unshift(rec);
            this.save(list);
            return rec;
        }
    };

const invStore = () => (isSupplyPage() ? Supplies : Assets);
const invItemOf = id => invStore().all().find(a => a.id === id);

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
    if (o.returnedAt) bits.push(`Returned ${fmtT(o.returnedAt)}`);
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
const badge = s => {
    const raw = String(s ?? "");
    const cls = esc(raw.trim().replace(/\s+/g, "-"));
    return `<span class="badge-status st-${cls}">${esc(raw)}</span>`;
};

function toast(msg) {
    const wrap = document.getElementById("toasts");
    if (!wrap) return;
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
function revokePhotoUrl(id) {
    if (id in photoCache && photoCache[id]) {
        URL.revokeObjectURL(photoCache[id]);
    }
    delete photoCache[id];
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
        if (!$("photoPreview")) return;
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
        if (open) { open.addEventListener("hidden.bs.modal", go, { once: true }); bootstrap.Modal.getOrCreateInstance(open).hide(); } else go();
    });
    if ($("phPrev")) $("phPrev").addEventListener("click", () => { lb.i = (lb.i - 1 + lb.ids.length) % lb.ids.length; show(); });
    if ($("phNext")) $("phNext").addEventListener("click", () => { lb.i = (lb.i + 1) % lb.ids.length; show(); });
    hydratePhotos(document);
}

const getAdminsList = () => { try { return JSON.parse(localStorage.getItem("fixit_admins")) || []; } catch { return []; } };
const saveAdminsList = l => localStorage.setItem("fixit_admins", JSON.stringify(l));
const currentAdminObj = () => {
    const u = sessionStorage.getItem("fixit_admin_session");
    return getAdminsList().find(a => a.username === u) || null;
};

const Personnel = {
    all() {
        const adm = currentAdminObj();
        if (!adm) return [];
        if (!Array.isArray(adm.personnel)) {
            adm.personnel = [];
            const list = getAdminsList();
            const idx = list.findIndex(a => a.username === adm.username);
            if (idx !== -1) { list[idx] = adm; saveAdminsList(list); }
        }
        return adm.personnel;
    },
    save(items) {
        const adm = currentAdminObj();
        if (!adm) return;
        const list = getAdminsList();
        const idx = list.findIndex(a => a.username === adm.username);
        if (idx !== -1) {
            list[idx].personnel = items;
            saveAdminsList(list);
        }
    },
    add(entry) {
        const items = this.all();
        const n = Math.max(0, ...items.map(x => parseInt((x.id || "").split("-")[1], 10) || 0)) + 1;
        const rec = {
            id: "PS-" + String(n).padStart(3, "0"),
            name: (entry.name || "").trim(),
            role: (entry.role || "").trim() || "Maintenance Staff",
            status: entry.status || "Present"
        };
        items.push(rec);
        this.save(items);
        return rec;
    },
    update(id, patch) {
        const items = this.all().map(x => x.id === id ? { ...x, ...patch } : x);
        this.save(items);
    },
    remove(id) {
        this.save(this.all().filter(x => x.id !== id));
    },
    labelOf(p) {
        return p.role && p.name !== p.role ? `${p.name} (${p.role})` : p.name;
    }
};

/* Keep Staff compatibility with existing callers */
const Staff = {
    all() { return Personnel.all().filter(p => p.status !== "On Leave").map(p => Personnel.labelOf(p)); },
    add(n) {
        const v = (n || "").trim();
        if (!v) return;
        if (!Personnel.all().some(p => p.name.toLowerCase() === v.toLowerCase() || Personnel.labelOf(p).toLowerCase() === v.toLowerCase())) {
            Personnel.add({ name: v, role: "Maintenance Staff", status: "Present" });
        }
    },
    remove(n) {
        const target = Personnel.all().find(p => p.name === n || Personnel.labelOf(p) === n);
        if (target) Personnel.remove(target.id);
    }
};

function populateAssigneeSelect() {
    const sel = $("rAssignee");
    if (!sel) return;
    const labels = Personnel.all().filter(p => p.status === "Present").map(p => Personnel.labelOf(p));
    sel.innerHTML = `<option value="">Unassigned</option>` + labels.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}

/* ---------- Shared: report form + modals ---------- */
function initReportForm(afterSave) {
    const form = document.getElementById("ticketForm");
    const rm = document.getElementById("reportModal");
    if (!form || !rm) return;
    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const d = Object.fromEntries(new FormData(form));
        const photoIds = await Photos.saveAll();
        const assignee = (d.assignee || "").trim();
        const status = assignee && (!d.status || d.status === "Pending") ? "In progress" : (d.status || "Pending");
        const baseNote = d.role
            ? `Reported by ${(d.reporter || "").trim()} (${d.role})`
            : `Logged by ${(d.reporter || "").trim()}${d.via ? " - found by " + d.via.toLowerCase() : ""}${d.onBehalf && d.onBehalf.trim() ? ", reported by " + d.onBehalf.trim() : ""}`;
        const note = assignee ? `${baseNote} · Assigned to ${assignee}` : baseNote;
        const t = Store.add({
            title: d.title.trim(), building: d.building, location: d.location.trim(),
            category: d.category, urgency: d.urgency, description: d.description.trim(),
            role: d.role || "Office", reporter: (d.reporter || "").trim() || "Maintenance office",
            idNo: (d.idNo || "").trim(), via: d.via || "", status, assignee, fixedAt: null, photos: photoIds, onBehalf: (d.onBehalf || "").trim(),
            reporterUser: sessionStorage.getItem("fixit_admin_session") || ""
        }, note);
        if (d.role) localStorage.setItem("fixit_me", JSON.stringify({ name: (d.reporter || "").trim(), idNo: (d.idNo || "").trim() }));
        if ($("lastId")) $("lastId").textContent = t.id;
        if ($("lastName")) $("lastName").textContent = t.reporter.split(" ")[0];
        if ($("lastTitle")) $("lastTitle").textContent = t.title;
        if ($("lastPlace")) $("lastPlace").textContent = t.building + " - " + t.location;
        if ($("lastStatus")) $("lastStatus").innerHTML = badge(t.status);
        if ($("copyId")) $("copyId").textContent = "Copy";
        afterSave();
        rm.addEventListener("hidden.bs.modal", () => bootstrap.Modal.getOrCreateInstance("#doneModal").show(), { once: true });
        bootstrap.Modal.getOrCreateInstance(rm).hide();
    });
    const syncId = bindRole("role", "idWrap", "idNo");
    rm.addEventListener("show.bs.modal", () => {
        populateAssigneeSelect();
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
    if ($("copyId")) {
        $("copyId").addEventListener("click", async e => {
            const id = $("lastId") ? $("lastId").textContent : "";
            try { await navigator.clipboard.writeText(id); e.target.textContent = "Copied"; }
            catch { e.target.textContent = "Press Ctrl+C"; }
        });
    }
    rm.addEventListener("shown.bs.modal", () => { if ($("title")) $("title").focus(); });
}

/* ---------- Student page ---------- */
function initStudent() {
    const body = document.getElementById("clDmgRows") || document.getElementById("rows");
    const histBody = document.getElementById("clientDamageHistRows");
    const search = document.getElementById("clDmgSearch") || document.getElementById("search");
    const statusFilter = document.getElementById("clDmgStatus") || document.getElementById("fStatus");
    const urgFilter = document.getElementById("clFUrg");
    const histSearch = document.getElementById("clientHistSearch");
    if (!body || !search) return;

    function render() {
        const u = currentUser();
        const q = search.value.trim().toLowerCase();
        const st = statusFilter ? statusFilter.value : "";
        const urg = urgFilter ? urgFilter.value : "";
        const allActive = Store.all().filter(t => !t.archived && u && (
            (t.idNo && t.idNo === u.idNo) ||
            (!t.idNo && t.reporter === u.name)
        ));

        const openList = allActive.filter(t => t.status !== "Fixed");
        const fixedAll = allActive.filter(t => t.status === "Fixed");

        if ($("clTotal")) $("clTotal").textContent = allActive.length;
        if ($("clOpen")) $("clOpen").textContent = openList.length;
        if ($("clFixed")) $("clFixed").textContent = fixedAll.length;

        // Keep unfixed damages in Reported damages; Fixed items go to the history tab
        const effectiveStatus = st === "Fixed" ? "" : st;
        const list = openList.filter(t =>
            (!effectiveStatus || t.status === effectiveStatus) &&
            (!urg || t.urgency === urg) &&
            (!q || (t.id + t.title + t.building + t.location).toLowerCase().includes(q))
        );

        body.innerHTML = list.length ? list.map(t => `
      <tr>
        <td>${tlBtn("t", t.id)}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div>${photoStrip(t)}</td>
        <td class="urg-${t.urgency}">${t.urgency}</td>
        <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
        <td class="small text-secondary">${fmt(t.createdAt)}</td>
      </tr>`).join("")
            : `<tr><td colspan="5" class="empty">${u ? "No active damage reports match your filters." : "Log in to view your submitted damage reports."}</td></tr>`;

        if (histBody) {
            const hq = (histSearch ? histSearch.value : "").trim().toLowerCase();
            const fixedList = fixedAll.filter(t =>
                !hq || (t.id + t.title + t.building + t.location).toLowerCase().includes(hq));
            histBody.innerHTML = fixedList.length ? fixedList.map(t => `
      <tr>
        <td>${tlBtn("t", t.id)}</td>
        <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div>${photoStrip(t)}</td>
        <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
        <td class="small text-secondary">${fmt(t.createdAt)}</td>
        <td class="small text-secondary">${t.fixedAt ? fmt(t.fixedAt) : "-"}</td>
      </tr>`).join("")
                : `<tr><td colspan="5" class="empty">${u ? "No fixed damage reports in history yet." : "Log in to view your fixed damage report history."}</td></tr>`;
        }
    }

    initReportForm(render);
    search.addEventListener("input", render);
    if (statusFilter) statusFilter.addEventListener("change", render);
    if (urgFilter) urgFilter.addEventListener("change", render);
    if (histSearch) histSearch.addEventListener("input", render);
    window.addEventListener("storage", render);
    window.addEventListener("authchange", render);
    render();
}

/* ---------- Client: borrow & return assets ---------- */
function initBorrowClient() {
    const borrowBody = $("borrowRows"), myLoanBody = $("myLoanRows"), bSearch = $("bSearch");
    const bModalEl = $("borrowModal"), bForm = $("borrowForm"), bSelect = $("bAssetSelect"), bQty = $("bQtyInput"), bHint = $("bAvailHint");
    if (!borrowBody || !myLoanBody) return;

    const loansForUser = u => Loans.all().filter(l => u && (l.borrowerId === u.idNo || (!l.borrowerId && l.borrowerName === u.name)));
    const availableAssets = () => Assets.all().filter(a => !a.archived && (Number(a.qty) || 0) > 0);

    const renderBorrowable = () => {
        const q = (bSearch ? bSearch.value : "").trim().toLowerCase();
        const list = availableAssets().filter(a =>
            !q || (a.id + " " + a.name + " " + a.tag + " " + a.location + " " + a.category).toLowerCase().includes(q));
        borrowBody.innerHTML = list.length ? list.map(a => `
          <tr>
            <td><span class="tid">${esc(a.id)}</span><div class="small text-secondary">${esc(a.tag || "")}</div></td>
            <td><div class="fw-semibold">${esc(a.name)}</div><div class="small text-secondary">${esc(a.category || "")}</div></td>
            <td class="fw-semibold">${Number(a.qty) || 0} <span class="small text-secondary fw-normal">${esc(a.unit || "pcs")}</span></td>
            <td class="small">${esc(a.location || "-")}</td>
          </tr>`).join("")
            : `<tr><td colspan="4" class="empty">No available assets match right now.</td></tr>`;
    };

    const renderMyLoans = () => {
        const u = currentUser();
        const list = loansForUser(u);
        myLoanBody.innerHTML = list.length ? list.map(l => `
          <tr>
            <td>${tlBtn("l", l.id)}</td>
            <td><div class="fw-semibold">${esc(l.itemName)}</div><div class="small text-secondary">${Number(l.qty) || 1} ${esc(l.unit || "pcs")} &bull; ${esc(l.assetId)}</div></td>
            <td>${badge(l.status)}</td>
            <td class="small">${fmt(l.createdAt)}</td>
            <td class="small">${l.returnedAt ? fmt(l.returnedAt) : "-"}</td>
            <td class="text-end text-nowrap">${l.status === "Borrowed" ? `<button type="button" class="btn btn-sm btn-success" data-return="${l.id}">Return</button>` : ""}</td>
          </tr>`).join("")
            : `<tr><td colspan="6" class="empty">You haven't borrowed any assets yet.</td></tr>`;
    };

    const syncBorrowModalStock = () => {
        if (!bSelect || !bQty) return;
        const chosen = assetOf(bSelect.value);
        const maxQty = chosen ? Math.max(1, Number(chosen.qty) || 1) : 1;
        bQty.max = String(maxQty);
        if ((parseInt(bQty.value, 10) || 1) > maxQty) bQty.value = String(maxQty);
        if ((parseInt(bQty.value, 10) || 0) < 1) bQty.value = "1";
        if (bHint) {
            bHint.textContent = chosen
                ? `${Number(chosen.qty) || 0} ${chosen.unit || "pcs"} available (${chosen.location || "Asset Office"})`
                : "No assets available to borrow.";
        }
    };

    const populateBorrowModal = () => {
        if (!bSelect || !bQty) return;
        const items = availableAssets();
        bSelect.innerHTML = items.length
            ? items.map(a => `<option value="${esc(a.id)}">${esc(a.id)} - ${esc(a.name)} (${Number(a.qty) || 0} ${esc(a.unit || "pcs")})</option>`).join("")
            : `<option value="">No available assets</option>`;
        bSelect.disabled = items.length === 0;
        bQty.disabled = items.length === 0;
        bQty.value = "1";
        if (bForm) bForm.classList.remove("was-validated");
        syncBorrowModalStock();
    };

    const renderAll = () => { renderBorrowable(); renderMyLoans(); };

    if (bModalEl) {
        bModalEl.addEventListener("show.bs.modal", populateBorrowModal);
    }
    if (bSelect) {
        bSelect.addEventListener("change", syncBorrowModalStock);
    }
    if (bForm) {
        bForm.addEventListener("submit", e => {
            e.preventDefault();
            const u = currentUser();
            if (!u) { toast("Please log in first."); return; }
            const assetId = bSelect ? bSelect.value : "";
            const asset = assetOf(assetId);
            const avail = asset && !asset.archived ? (Number(asset.qty) || 0) : 0;
            const qty = parseInt(bQty ? bQty.value : "0", 10) || 0;

            if (bQty) bQty.setCustomValidity(qty < 1 || qty > avail ? "range" : "");
            if (!bForm.checkValidity() || !asset || avail < 1) {
                bForm.classList.add("was-validated");
                return;
            }

            Assets.patch(assetId, { qty: avail - qty }, `Borrowed ${qty} ${asset.unit || "pcs"} by ${u.name} (${u.idNo})`);
            Loans.add({
                assetId: asset.id,
                itemName: asset.name,
                unit: asset.unit || "pcs",
                qty,
                borrowerName: u.name,
                borrowerId: u.idNo,
                borrowerRole: u.role,
                status: "Borrowed",
                returnedAt: null
            }, `Borrowed ${qty} ${asset.unit || "pcs"} by ${u.name} (${u.idNo})`);

            bootstrap.Modal.getOrCreateInstance(bModalEl).hide();
            toast(`Borrowed ${qty} ${asset.unit || "pcs"} of ${asset.name}`);
            renderAll();
            window.dispatchEvent(new Event("loanschange"));
        });
    }

    myLoanBody.addEventListener("click", e => {
        const btn = e.target.closest("button[data-return]");
        if (!btn) return;
        const loanId = btn.dataset.return;
        const loan = Loans.all().find(x => x.id === loanId);
        if (!loan || loan.status !== "Borrowed") return;
        const u = currentUser();
        const whoTxt = u ? `${u.name} (${u.idNo})` : (loan.borrowerName || "Borrower");
        const qty = Number(loan.qty) || 1;
        const asset = assetOf(loan.assetId);
        if (asset) {
            Assets.patch(asset.id, { qty: (Number(asset.qty) || 0) + qty }, `Returned ${qty} ${loan.unit || "pcs"} by ${whoTxt}`);
        }
        Loans.patch(loanId, { status: "Returned", returnedAt: Date.now() }, `Returned ${qty} ${loan.unit || "pcs"} by ${whoTxt}`);
        toast(`Returned ${loan.itemName}`);
        renderAll();
        window.dispatchEvent(new Event("loanschange"));
    });

    if (bSearch) bSearch.addEventListener("input", renderBorrowable);
    document.addEventListener("shown.bs.tab", e => {
        if (e.target.getAttribute("data-bs-target") === "#tabBorrow") renderAll();
    });
    window.addEventListener("storage", renderAll);
    window.addEventListener("authchange", renderAll);
    renderAll();
}

const ADMIN_TABS = {
    famo: ["#tabClean", "#tabSupplies", "#tabPersonnel", "#tabTickets", "#tabReports", "#tabHistory"],
    admin_office: ["#tabAssets", "#tabTickets", "#tabReports", "#tabHistory"]
};

function applyAdminTabVisibility() {
    const page = document.body.dataset.page;
    const allowed = ADMIN_TABS[page];
    if (!allowed) return;

    const allTargets = ["#tabClean", "#tabAssets", "#tabReports", "#tabHistory", "#tabPersonnel", "#tabTickets"];
    allTargets.forEach(target => {
        const show = allowed.includes(target);
        document.querySelectorAll(`#adminTabs [data-bs-target="${target}"]`).forEach(el => {
            el.closest(".nav-item")?.classList.toggle("d-none", !show);
        });
        document.querySelectorAll(`#adminBottomNav [data-bs-target="${target}"]`).forEach(el => {
            el.classList.toggle("d-none", !show);
        });
    });

    const activeDesktop = document.querySelector("#adminTabs .nav-link.active");
    const activeTarget = activeDesktop?.getAttribute("data-bs-target");
    if (!activeTarget || !allowed.includes(activeTarget)) {
        const firstBtn = document.querySelector(`#adminTabs [data-bs-target="${allowed[0]}"]`);
        if (firstBtn) bootstrap.Tab.getOrCreateInstance(firstBtn).show();

        document.querySelectorAll("#adminBottomNav [data-main-nav]").forEach(btn => {
            const isFirst = btn.getAttribute("data-bs-target") === allowed[0];
            btn.classList.toggle("active", isFirst);
            btn.setAttribute("aria-selected", isFirst);
        });
        updateMobileHead(allowed[0]);
    }
}

/* ---------- Admin page ---------- */
function initAdmin() {
    const isOffice = document.body.dataset.page === "admin_office";
    const body = isOffice
        ? (document.getElementById("aoDmgRows") || document.getElementById("rows"))
        : document.getElementById("rows");
    const fixedBody = isOffice
        ? document.getElementById("officeFixedRows")
        : (document.getElementById("fixedHistRows") || document.getElementById("famoFixedRows"));
    const fixedSearch = isOffice
        ? document.getElementById("aoFixedHistSearch")
        : document.getElementById("fixedHistSearch");
    const fStatus = isOffice
        ? (document.getElementById("aoDmgStatus") || document.getElementById("fStatus"))
        : document.getElementById("fStatus");
    const fUrg = isOffice
        ? (document.getElementById("aoDmgUrg") || document.getElementById("fUrg"))
        : document.getElementById("fUrg");
    const search = isOffice
        ? (document.getElementById("aoDmgSearch") || document.getElementById("search"))
        : document.getElementById("search");

    if (!body || !fStatus || !fUrg || !search) {
        window.renderTickets = () => { };
        return;
    }

    function mineForOffice(list) {
        const sessUser = (sessionStorage.getItem("fixit_admin_session") || "").toLowerCase();
        const sessName = (sessionStorage.getItem("fixit_admin_name") || "").toLowerCase();
        return list.filter(t =>
            (sessUser && (t.reporterUser || "").toLowerCase() === sessUser) ||
            (sessName && (t.reporter || "").toLowerCase() === sessName)
        );
    }

    function renderFixedTable(targetBody, items, queryStr, emptyText, isOfficeView) {
        if (!targetBody) return;
        const fq = (queryStr || "").trim().toLowerCase();
        const filtered = items.filter(t =>
            !fq || (t.id + t.title + t.building + t.location + t.category + (t.reporter || "")).toLowerCase().includes(fq)
        );
        targetBody.innerHTML = filtered.length ? filtered.map(t => `
          <tr>
            <td>${tlBtn("t", t.id)}</td>
            <td><div class="fw-semibold">${esc(t.title)}</div>
                <div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)} &bull; ${esc(t.category)}</div>
                ${t.description ? `<div class="small mt-1">${esc(t.description)}</div>` : ""}${photoStrip(t)}</td>
            <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">${isOfficeView ? "Fixed by" : "Assigned to"} ${esc(t.assignee)}</div>` : ""}</td>
            <td class="small text-secondary">${fmt(t.createdAt)}</td>
            <td class="small text-secondary">${t.fixedAt ? fmt(t.fixedAt) : fmt(t.updatedAt)}</td>
          </tr>`).join("")
            : `<tr><td colspan="5" class="empty">${emptyText}</td></tr>`;
    }

    function render() {
        const baseAll = Store.all().filter(t => !t.archived);
        const q = search.value.trim().toLowerCase();

        if (isOffice) {
            const mine = mineForOffice(baseAll);
            const openList = mine.filter(t => t.status !== "Fixed");
            const fixedList = mine.filter(t => t.status === "Fixed");

            if ($("cTotal")) $("cTotal").textContent = mine.length;
            if ($("cOpen")) $("cOpen").textContent = openList.length;
            if ($("cFixed")) $("cFixed").textContent = fixedList.length;

            // Only unfixed ("Pending" / "In progress") reports stay in the reported damages tab
            const effectiveStatus = fStatus.value === "Fixed" ? "" : fStatus.value;
            const filteredOpen = openList.filter(t =>
                (!effectiveStatus || t.status === effectiveStatus) &&
                (!fUrg.value || t.urgency === fUrg.value) &&
                (!q || (t.id + t.title + t.building + t.location + t.category).toLowerCase().includes(q))
            );

            body.innerHTML = filteredOpen.length ? filteredOpen.map(t => `
              <tr>
                <td>${tlBtn("t", t.id)}</td>
                <td><div class="fw-semibold">${esc(t.title)}</div>
                    <div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)} &bull; ${esc(t.category)}</div>
                    ${t.description ? `<div class="small mt-1">${esc(t.description)}</div>` : ""}${photoStrip(t)}</td>
                <td class="urg-${t.urgency}">${t.urgency}</td>
                <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
                <td class="small text-secondary">${fmt(t.createdAt)}</td>
                <td class="text-end text-nowrap">
                  <button type="button" class="btn btn-sm btn-outline-danger" data-act="cancel-report" data-id="${t.id}">Cancel report</button>
                </td>
              </tr>`).join("")
                : `<tr><td colspan="6" class="empty">No active damage reports match your filters.</td></tr>`;

            renderFixedTable(
                fixedBody,
                fixedList,
                fixedSearch ? fixedSearch.value : q,
                "No fixed damage reports in your history yet.",
                true
            );
            return;
        }

        const openTickets = baseAll.filter(t => t.status !== "Fixed");
        const fixedTickets = baseAll.filter(t => t.status === "Fixed");

        if ($("cTotal")) $("cTotal").textContent = baseAll.length;
        if ($("cPending")) $("cPending").textContent = openTickets.filter(t => t.status === "Pending").length;
        if ($("cProg")) $("cProg").textContent = openTickets.filter(t => t.status === "In progress").length;
        if ($("cFixed")) $("cFixed").textContent = fixedTickets.length;

        // Keep unfixed damages in the reported/active tab; move Fixed tickets to history
        const effectiveStatus = fStatus.value === "Fixed" ? "" : fStatus.value;
        const list = openTickets.filter(t =>
            (!effectiveStatus || t.status === effectiveStatus) &&
            (!fUrg.value || t.urgency === fUrg.value) &&
            (!q || (t.id + t.title + t.building + t.location + t.reporter).toLowerCase().includes(q))
        );

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
              <button class="btn btn-sm btn-outline-secondary" data-act="assign" data-id="${t.id}">${t.assignee ? "Reassign" : "Assign"}</button>
              ${t.status === "Pending" ? `<button class="btn btn-sm btn-outline-primary" data-act="In progress" data-id="${t.id}">Start work</button>` : ""}
              <button class="btn btn-sm btn-success" data-act="Fixed" data-id="${t.id}">Mark as fixed</button>
              <button class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${t.id}" aria-label="Archive ${t.id}">Archive</button>
            </td>
          </tr>`).join("")
            : `<tr><td colspan="7" class="empty">No active damage reports match these filters.</td></tr>`;

        renderFixedTable(
            fixedBody,
            fixedTickets,
            fixedSearch ? fixedSearch.value : q,
            "No fixed damage reports in history yet.",
            false
        );
    }

    body.addEventListener("click", e => {
        const b = e.target.closest("button[data-act]"); if (!b) return;
        const { act, id } = b.dataset;
        if (isOffice) {
            if (act === "cancel-report") {
                const t = Store.all().find(x => x.id === id);
                if (!t || t.status === "Fixed") return;
                openConfirmDelete({
                    title: `Cancel report ${id}?`,
                    item: `${id} - ${t.title}`,
                    desc: "This removes an open report logged in error and records the cancellation in the activity log.",
                    btnText: "Cancel report",
                    onConfirm: () => {
                        (t.photos || []).forEach(p => {
                            revokePhotoUrl(p);
                            PhotoDB.remove(p).catch(() => { });
                        });
                        Store.remove(id, "Cancelled accidental report");
                        toast(`${id} cancelled`);
                        render();
                        window.dispatchEvent(new Event("storage"));
                    }
                });
            }
            return;
        }
        if (act === "assign") { openAssign(id); return; }
        if (act === "delete") {
            openConfirmDelete({
                title: `Archive report ${id}?`,
                item: `${id}`,
                desc: "You can restore it anytime from the History tab.",
                btnText: "Archive report",
                onConfirm: () => {
                    Store.patch(id, { archived: true, archivedAt: Date.now() }, "Archived");
                    toast(`${id} archived`);
                    render();
                }
            });
            return;
        }
        Store.setStatus(id, act);
        toast(act === "Fixed" ? `${id} marked as fixed and moved to History` : `${id} marked as ${act.toLowerCase()}`);
        render();
    });
    [fStatus, fUrg].forEach(el => el.addEventListener("change", render));
    search.addEventListener("input", render);
    if (fixedSearch) fixedSearch.addEventListener("input", render);
    window.addEventListener("storage", render);
    window.renderTickets = render;

    initReportForm(render);
    render();
}

/* ---------- Admin: personnel, assign, cleaning, assets, reports ---------- */
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
    if (!$("aChips")) return;
    $("aChips").innerHTML = Staff.all().map(n => `<span class="badge text-bg-light border fw-normal"><button type="button" class="btn btn-link p-0 text-decoration-none text-dark" data-pick="${esc(n)}">${esc(n)}</button> <button type="button" class="btn btn-link p-0 text-danger text-decoration-none" data-del="${esc(n)}" aria-label="Remove ${esc(n)}">&times;</button></span>`).join("")
        || '<span class="text-secondary small">None yet. Personnel saved on your account appear here.</span>';
}
function openAssign(id) {
    const t = Tickets.all().find(x => x.id === id);
    if (!t || !$("aId") || !$("aName")) return;
    $("aId").value = id; $("aTitle").textContent = t.id + " - " + t.title; $("aName").value = t.assignee || "";
    if ($("aList")) $("aList").innerHTML = [...new Set([...Staff.all(), ...Tickets.all().map(x => x.assignee).filter(Boolean)])].map(n => `<option value="${esc(n)}">`).join("");
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

let pendingConfirmAction = null;
function openConfirmDelete({ title, item, desc, btnText, onConfirm }) {
    if (!$("confirmDelModal")) { if (typeof onConfirm === "function") onConfirm(); return; }
    $("cfmDelT").textContent = title;
    $("cfmDelItem").textContent = item;
    $("cfmDelDesc").textContent = desc || "";
    $("cfmDelBtn").textContent = btnText || "Delete";
    pendingConfirmAction = onConfirm;
    bootstrap.Modal.getOrCreateInstance("#confirmDelModal").show();
}

function initAdminExtras() {
    const modal = id => bootstrap.Modal.getOrCreateInstance(id);
    const refreshTickets = () => {
        if (typeof window.renderTickets === "function") window.renderTickets();
    };

    if ($("cfmDelBtn")) {
        $("cfmDelBtn").addEventListener("click", () => {
            const fn = pendingConfirmAction;
            pendingConfirmAction = null;
            bootstrap.Modal.getOrCreateInstance("#confirmDelModal").hide();
            if (typeof fn === "function") fn();
        });
    }

    let personnelEdit = null;
    function renderPersonnel() {
        const rowsEl = $("personnelRows");
        if (!rowsEl) return;
        const q = ($("pSearch") ? $("pSearch").value : "").trim().toLowerCase();
        const list = Personnel.all().filter(p => !q || (p.id + " " + p.name + " " + (p.role || "") + " " + (p.status || "")).toLowerCase().includes(q));
        rowsEl.innerHTML = list.length ? list.map(p => `<tr>
          <td><div class="fw-semibold">${esc(p.name)}</div><div class="small text-secondary">${esc(p.id)}</div></td>
          <td class="small">${esc(p.role || "Maintenance Staff")}</td>
          <td><span class="badge ${p.status === "Present" ? "text-bg-success" : "text-bg-secondary"}">${esc(p.status || "Present")}</span></td>
          <td class="text-end text-nowrap">
            <button class="btn btn-sm btn-outline-secondary" data-pact="edit" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-pact="del" data-id="${p.id}">Remove</button>
          </td>
        </tr>`).join("")
            : `<tr><td colspan="4" class="empty">No personnel found. Use "+ Add personnel" to add one.</td></tr>`;
        renderChips();
        populateAssigneeSelect();
    }
    if ($("pSearch")) $("pSearch").addEventListener("input", renderPersonnel);
    if ($("personnelRows")) {
        $("personnelRows").addEventListener("click", e => {
            const b = e.target.closest("button[data-pact]"); if (!b) return;
            const { pact, id } = b.dataset;
            const p = Personnel.all().find(x => x.id === id); if (!p) return;
            if (pact === "edit") { personnelEdit = p; modal("#personnelModal").show(); return; }
            if (pact === "del") {
                openConfirmDelete({
                    title: "Remove personnel?",
                    item: p.name,
                    desc: "This removes them from your saved personnel list.",
                    btnText: "Remove",
                    onConfirm: () => {
                        Personnel.remove(id);
                        toast(`${p.name} removed`);
                        renderAll();
                    }
                });
                return;
            }
        });
    }
    if ($("personnelModal")) {
        $("personnelModal").addEventListener("show.bs.modal", () => {
            const f = $("personnelForm"), p = personnelEdit; personnelEdit = null;
            if (!f) return;
            f.reset(); f.classList.remove("was-validated");
            if ($("pId")) $("pId").value = p ? p.id : "";
            if ($("personnelModalT")) $("personnelModalT").textContent = p ? "Edit personnel" : "Add personnel";
            if ($("personnelSave")) $("personnelSave").textContent = p ? "Save changes" : "Save personnel";
            if (p) {
                if ($("pName")) $("pName").value = p.name || "";
                if ($("pRole")) $("pRole").value = p.role || "";
                if ($("pStatus")) $("pStatus").value = p.status || "Present";
            }
        });
    }
    if ($("personnelForm")) {
        $("personnelForm").addEventListener("submit", e => {
            e.preventDefault(); const f = e.target;
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f));
            const id = $("pId") ? $("pId").value : "";
            const payload = {
                name: (d.name || "").trim(),
                role: (d.role || "").trim() || "Maintenance Staff",
                status: d.status || "Present"
            };
            if (id) {
                Personnel.update(id, payload);
                toast(`${payload.name} updated`);
            } else {
                Personnel.add(payload);
                toast(`${payload.name} added to personnel`);
            }
            modal("#personnelModal").hide();
            renderAll();
        });
    }

    if ($("aChips")) {
        $("aChips").addEventListener("click", e => {
            const p = e.target.closest("[data-pick]"), x = e.target.closest("[data-del]");
            if (p && $("aName")) $("aName").value = p.dataset.pick;
            if (x) { Staff.remove(x.dataset.del); renderAll(); }
        });
    }

    const csvBtn = (paneId, fn) => {
        const panel = document.querySelector(`#${paneId} section.panel`);
        if (!panel) return;
        panel.insertAdjacentHTML("afterbegin", '<div class="text-end mb-2 no-print"><button type="button" class="btn btn-outline-secondary btn-sm">Export CSV</button></div>');
        panel.firstElementChild.firstElementChild.addEventListener("click", fn);
    };
    csvBtn("tabTickets", () => downloadCSV("tickets", ["Ticket", "Damage", "Building", "Room / spot", "Type", "Urgency", "Status", "Reported by", "Role", "ID no.", "Assigned to", "Related asset", "Reported", "Fixed", "Archived", "Details"],
        Tickets.all().map(t => [t.id, t.title, t.building, t.location, t.category, t.urgency, t.status, t.onBehalf || t.reporter, t.role, t.idNo || t.studentNo || "", t.assignee || "", t.assetId || "", fmtT(t.createdAt), t.fixedAt ? fmtT(t.fixedAt) : "", t.archived ? "Yes" : "", t.description || ""])));
    csvBtn("tabClean", () => downloadCSV("facility-cleaning", ["Facility ID", "Building", "Area", "Area type", "Status today", "Cleaned today at", "Total cleaned", "Last cleaned", "Notes"],
        Cleanings.all().map(c => { const log = logOf(c), d = doneToday(c), last = log.slice(-1)[0]; return [c.id, c.building, c.area, c.areaType, d ? "Cleaned" : "For Cleaning", d ? clock(d.ts) : "", log.length, last ? last.date : "", c.notes || ""]; })));
    const invPaneId = isSupplyPage() ? "tabSupplies" : "tabAssets";
    csvBtn(invPaneId, () => {
        const store = invStore();
        downloadCSV(isSupplyPage() ? "supplies" : "assets", ["ID", isSupplyPage() ? "Supply" : "Asset", "ID no.", "Category", "Quantity", "Unit", "Location", "Archived"],
            store.all().map(a => [a.id, a.name, a.tag, a.category, a.qty ?? "", a.unit || "", a.location, a.archived ? "Yes" : ""]));
    });

    if ($("assignForm")) {
        $("assignForm").addEventListener("submit", e => {
            e.preventDefault();
            const id = $("aId").value, name = $("aName").value.trim(), t = Tickets.all().find(x => x.id === id);
            if (!t) return;
            Staff.add(name);
            Tickets.patch(id, { assignee: name, status: t.status === "Pending" ? "In progress" : t.status }, "Assigned to " + name + (t.status === "Pending" ? " (work started)" : ""));
            modal("#assignModal").hide(); toast(`${id} assigned to ${name}`); refreshTickets(); renderPersonnel();
        });
    }

    /* facility cleaning: safely guarded if #cleanRows is absent */
    let cleanEdit = null, shownDay = today();
    const dayOf = ts => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
    const logOf = c => c.cleanLog || (c.cleanedAt ? [{ date: dayOf(c.cleanedAt), ts: c.cleanedAt }] : []);
    const doneToday = c => logOf(c).find(x => x.date === today());
    const clock = ts => new Date(ts).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
    const fmtClock = hhmm => hhmm ? clock("2000-01-01T" + hhmm) : "";
    function renderCleanings() {
        const cleanRows = $("cleanRows");
        if (!cleanRows) return;
        shownDay = today();
        const all = Cleanings.all();
        const q = ($("cSearch") ? $("cSearch").value : "").trim().toLowerCase();
        const st = $("cStatus") ? $("cStatus").value : "";
        const ty = $("cType") ? $("cType").value : "";
        const stat = c => doneToday(c) ? "Cleaned" : "For Cleaning", dueN = all.filter(c => !doneToday(c)).length;
        if ($("cCDue")) $("cCDue").textContent = dueN;
        if ($("cCDone")) $("cCDone").textContent = all.length - dueN;
        if ($("cToday")) $("cToday").textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const list = all.filter(c => (!st || stat(c) === st) && (!ty || c.areaType === ty) && (!q || (c.id + c.building + c.area).toLowerCase().includes(q)))
            .sort((x, y) => stat(x) !== stat(y) ? (stat(x) === "For Cleaning" ? -1 : 1)
                : stat(x) === "For Cleaning" ? (x.time || "99").localeCompare(y.time || "99") : doneToday(y).ts - doneToday(x).ts);
        cleanRows.innerHTML = list.length ? list.map(c => {
            const d = doneToday(c), n = logOf(c).length, last = logOf(c).slice(-1)[0];
            return `<tr>
          <td>${tlBtn("c", c.id)}</td>
          <td><div class="fw-semibold">${esc(c.building)} &ndash; ${esc(c.area)}</div><div class="small text-secondary">${esc(c.areaType)}${c.time ? " &bull; usually " + fmtClock(c.time) : ""}${c.notes ? " &bull; " + esc(c.notes) : ""}</div></td>
          <td>${badge(stat(c))}${d ? `<div class="small text-secondary mt-1">at ${clock(d.ts)}</div>` : ""}</td>
          <td><span class="fw-semibold">${n}</span> <span class="small text-secondary">${n === 1 ? "time" : "times"}</span>${last ? `<div class="small text-secondary">Last: ${fmtD(last.date)}</div>` : ""}</td>
          <td class="text-end text-nowrap">${d
                    ? `<button class="btn btn-sm btn-outline-secondary" data-act="undo" data-id="${c.id}">Undo</button>`
                    : `<button class="btn btn-sm btn-success" data-act="done" data-id="${c.id}">Mark as cleaned</button>`}
            <button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${c.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${c.id}">Delete</button></td></tr>`;
        }).join("") : `<tr><td colspan="5" class="empty">${all.length ? "No facilities match." : 'No facilities yet. Use "+ Add facility" to list one.'}</td></tr>`;
    }
    if ($("cleanRows")) {
        $("cleanRows").addEventListener("click", e => {
            const b = e.target.closest("button[data-act]"); if (!b) return;
            const { act, id } = b.dataset, c = Cleanings.all().find(x => x.id === id); if (!c) return;
            if (act === "done") {
                const log = logOf(c).concat({ date: today(), ts: Date.now() });
                Cleanings.patch(id, { cleanLog: log, cleanedAt: Date.now() }, `Marked as cleaned (total ${log.length})`); toast(`${c.area} marked as cleaned`);
            } else if (act === "undo") {
                const log = logOf(c).filter(x => x.date !== today()), last = log.slice(-1)[0];
                Cleanings.patch(id, { cleanLog: log, cleanedAt: last ? last.ts : null }, "Today's cleaning undone"); toast(`${c.area} is back to For Cleaning`);
            } else if (act === "edit") { cleanEdit = c; modal("#cleanModal").show(); return; }
            else {
                openConfirmDelete({
                    title: "Delete facility?",
                    item: `${c.building} - ${c.area}`,
                    desc: "Its cleaning totals will be lost.",
                    btnText: "Delete facility",
                    onConfirm: () => {
                        Cleanings.remove(id, "Deleted");
                        toast(`${c.area} removed from the list`);
                        renderAll();
                    }
                });
            }
            renderAll();
        });
    }
    if ($("cleanModal")) {
        $("cleanModal").addEventListener("show.bs.modal", () => {
            const f = $("cleanForm"), c = cleanEdit; cleanEdit = null;
            if (!f) return;
            f.reset(); f.classList.remove("was-validated");
            if ($("cleanId")) $("cleanId").value = c ? c.id : "";
            if ($("cleanModalT")) $("cleanModalT").textContent = c ? "Edit facility" : "Add facility";
            if ($("cleanSave")) $("cleanSave").textContent = c ? "Save changes" : "Save facility";
            if (c) {
                if ($("cBuilding")) $("cBuilding").value = c.building;
                if ($("cArea")) $("cArea").value = c.area;
                if ($("cAreaType")) $("cAreaType").value = c.areaType;
                if ($("cWhen")) $("cWhen").value = c.time || "";
                if ($("cNotes")) $("cNotes").value = c.notes || "";
            }
        });
    }
    if ($("cleanForm")) {
        $("cleanForm").addEventListener("submit", e => {
            e.preventDefault(); const f = e.target;
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f)), id = $("cleanId") ? $("cleanId").value : "";
            const data = { building: d.building.trim(), area: d.area.trim(), areaType: d.areaType, time: d.time || "", notes: d.notes.trim() };
            if (id) { Cleanings.patch(id, data, "Facility details updated"); toast(`${data.area} updated`); }
            else { Cleanings.add({ ...data, cleanLog: [], cleanedAt: null }, "Added to the cleaning list"); toast(`${data.area} added to the list`); }
            modal("#cleanModal").hide(); renderAll();
        });
    }
    setInterval(() => { if ($("cleanRows") && today() !== shownDay) renderAll(); }, 60000);

    /* assets & supplies: add, edit, archive, delete + category filter */
    let assetView = "active", delId = null, pendingEdit = null;
    function renderAssets() {
        const assetRows = $("assetRows");
        if (!assetRows) return;
        const store = invStore();
        const itemLabel = isSupplyPage() ? "Supply" : "Asset";
        const assetHead = {
            active: `<tr><th>ID no.</th><th>${itemLabel}</th><th>Quantity</th><th>Location</th><th>Updated</th><th></th></tr>`,
            archived: `<tr><th>ID no.</th><th>${itemLabel}</th><th>Quantity</th><th>Location</th><th>Archived on</th><th></th></tr>`
        };
        const all = store.all();
        const q = ($("sSearch") ? $("sSearch").value : "").trim().toLowerCase();
        const cat = ($("assetCatFilter") ? $("assetCatFilter").value : "").trim().toLowerCase();
        const supCat = ($("supplyCatFilter") ? $("supplyCatFilter").value : "").trim().toLowerCase();
        const arch = assetView === "archived";
        if ($("cntActive")) $("cntActive").textContent = all.filter(a => !a.archived).length;
        if ($("cntArch")) $("cntArch").textContent = all.filter(a => a.archived).length;
        if ($("assetHead")) $("assetHead").innerHTML = assetHead[assetView];
        const list = all.filter(a =>
            !!a.archived === arch &&
            (!cat || String(a.category || "").toLowerCase() === cat) &&
            (!supCat || String(a.category || "").toLowerCase() === supCat) &&
            (!q || ((a.tag || "") + a.name + (a.location || "") + (a.category || "")).toLowerCase().includes(q))
        );
        const btns = a => arch
            ? `<button class="btn btn-sm btn-success" data-act="restore" data-id="${a.id}">Restore</button> <button class="btn btn-sm btn-outline-danger" data-act="purge" data-id="${a.id}">Delete permanently</button>`
            : `<button class="btn btn-sm btn-outline-secondary" data-act="edit" data-id="${a.id}">Edit</button> <button class="btn btn-sm btn-outline-danger" data-act="del" data-id="${a.id}">Delete</button>`;
        assetRows.innerHTML = list.length ? list.map(a => `<tr>
          <td><span class="tid">${esc(a.tag || a.id)}</span></td>
          <td><div class="fw-semibold">${esc(a.name)}</div><div class="small text-secondary">${esc(a.category || "")}</div></td>
          <td class="fw-semibold">${a.qty ?? "-"} <span class="small text-secondary fw-normal">${esc(a.unit || "")}</span></td>
          <td class="small">${esc(a.location || "")}</td>
          <td class="small text-secondary">${fmt(arch ? (a.archivedAt || a.updatedAt) : a.updatedAt)}</td>
          <td class="text-end text-nowrap">${btns(a)}</td></tr>`).join("")
            : `<tr><td colspan="6" class="empty">${arch ? "Nothing in the archive." : 'No items yet. Use "+ Add" to record one.'}</td></tr>`;
    }
    if ($("assetView")) {
        $("assetView").addEventListener("click", e => {
            const b = e.target.closest("[data-av]"); if (!b) return;
            assetView = b.dataset.av;
            $("assetView").querySelectorAll("[data-av]").forEach(x => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
            renderAssets();
        });
    }
    const nextAssetTag = (prefix = "AS") => {
        const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
        let maxNum = 0;
        const pad = 3;
        invStore().all().forEach(a => {
            const m = String(a.tag || "").trim().match(re);
            if (!m) return;
            const n = parseInt(m[1], 10);
            if (!Number.isNaN(n) && n > maxNum) maxNum = n;
        });
        return `${prefix}-${String(maxNum + 1).padStart(pad, "0")}`;
    };
    const setAssetForm = a => {
        const f = $("assetForm"); if (!f) return;
        const label = isSupplyPage() ? "supply" : "asset";
        f.reset(); f.classList.remove("was-validated");
        if ($("assetId2")) $("assetId2").value = a ? a.id : "";
        if ($("assetModalT")) $("assetModalT").textContent = a ? `Edit ${label}` : `Add ${label}`;
        if ($("assetSave")) $("assetSave").textContent = a ? "Save changes" : `Save ${label}`;
        if (a) {
            if ($("nName")) $("nName").value = a.name;
            if ($("nCat")) $("nCat").value = a.category;
            if ($("nQty")) $("nQty").value = a.qty ?? "";
            if ($("nUnit")) $("nUnit").value = a.unit || "";
            if ($("nLoc")) $("nLoc").value = a.location || "";
        }
    };
    if ($("assetModal")) {
        $("assetModal").addEventListener("show.bs.modal", () => { setAssetForm(pendingEdit); pendingEdit = null; });
    }
    if ($("assetForm")) {
        $("assetForm").addEventListener("submit", e => {
            e.preventDefault();
            const store = invStore();
            const f = e.target, tag = $("nTag"), eid = $("assetId2") ? $("assetId2").value : "";
            const defaultPrefix = isSupplyPage() ? "AS" : "AST";
            if (tag) {
                tag.setCustomValidity(store.all().some(a => a.id !== eid && String(a.tag || "").toLowerCase() === tag.value.trim().toLowerCase()) ? "dup" : "");
            }
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f));
            const existing = eid ? invItemOf(eid) : null;
            const resolvedTag = tag
                ? ((tag.value || "").trim() || (existing && existing.tag) || nextAssetTag(defaultPrefix))
                : ((existing && existing.tag) || nextAssetTag(defaultPrefix));
            const data = {
                name: (d.name || "").trim(),
                tag: resolvedTag,
                category: d.category,
                qty: Number(d.qty),
                unit: (d.unit || "").trim(),
                location: $("nLoc") ? (d.location || "").trim() : (existing ? existing.location : (isSupplyPage() ? "FAMO Storage" : "Admin Office"))
            };
            if (eid) {
                store.patch(eid, data, "Details updated" + (existing && existing.qty !== data.qty ? ` (quantity ${existing.qty ?? 0} to ${data.qty})` : ""));
                toast(`${data.name} updated`);
            } else {
                store.add({ ...data, condition: "Good" }, `Added to inventory (${data.qty} ${data.unit})`);
                toast(`${data.name} added to the inventory`);
            }
            modal("#assetModal").hide(); renderAll();
        });
    }
    const showStep = confirmStep => {
        if ($("delChoices")) $("delChoices").classList.toggle("d-none", confirmStep);
        if ($("delConfirm")) $("delConfirm").classList.toggle("d-none", !confirmStep);
        if ($("delGo")) $("delGo").classList.toggle("d-none", !confirmStep);
        if ($("delT")) $("delT").textContent = confirmStep ? "Delete permanently?" : "Remove this item?";
    };
    function openDelete(a, permanentOnly) {
        delId = a.id;
        if ($("delItem")) $("delItem").innerHTML = `<b>${esc(a.name)}</b> <span class="text-secondary">(${esc(a.tag || a.id)})</span>`;
        if ($("delBack")) $("delBack").classList.toggle("d-none", permanentOnly);
        showStep(permanentOnly);
        modal("#delAssetModal").show();
    }
    if ($("assetRows")) {
        $("assetRows").addEventListener("click", e => {
            const b = e.target.closest("button[data-act]"); if (!b) return;
            const store = invStore();
            const { act, id } = b.dataset, a = invItemOf(id); if (!a) return;
            if (act === "edit") { pendingEdit = a; modal("#assetModal").show(); }
            else if (act === "restore") { store.patch(id, { archived: false, archivedAt: null }, "Restored from archive"); toast(`${a.name} restored`); renderAll(); }
            else openDelete(a, act === "purge");
        });
    }
    if ($("chArchive")) {
        $("chArchive").addEventListener("click", () => {
            const a = invItemOf(delId); if (!a) return;
            invStore().patch(delId, { archived: true, archivedAt: Date.now() }, "Moved to archive");
            modal("#delAssetModal").hide(); toast(`${a.name} moved to the archive`); renderAll();
        });
    }
    if ($("chPurge")) $("chPurge").addEventListener("click", () => showStep(true));
    if ($("delBack")) $("delBack").addEventListener("click", () => showStep(false));
    if ($("delGo")) {
        $("delGo").addEventListener("click", () => {
            const a = invItemOf(delId); if (!a) return;
            invStore().remove(delId, "Deleted permanently");
            modal("#delAssetModal").hide(); toast(`${a.name} deleted permanently`); renderAll(); refreshTickets();
        });
    }

    /* reports */
    function renderReports() {
        if (!$("reportBody")) return;
        const page = document.body.dataset.page || document.body.dataset.role || "famo";
        const isOffice = page === "admin_office";

        const T = Tickets.all().filter(t => !t.archived);
        const A = invStore().all().filter(a => !a.archived);
        const C = Cleanings.all();
        const L = Loans.all();
        const fixed = T.filter(t => t.status === "Fixed");

        const times = fixed.filter(t => t.fixedAt).map(t => t.fixedAt - t.createdAt);
        const avg = times.length ? times.reduce((x, y) => x + y, 0) / times.length / 36e5 : null;
        const avgTxt = avg === null ? "-" : avg < 48 ? avg.toFixed(1) + " h" : (avg / 24).toFixed(1) + " days";
        const fixedRate = T.length ? Math.round(fixed.length / T.length * 100) + "%" : "-";

        const panel = (title, data) =>
            `<div class="col-md-6"><div class="panel"><h3 class="h6 mb-3">${esc(title)}</h3>${bars(data)}</div></div>`;

        const renderCards = (items, colClass = "col-6 col-md-4 col-lg") =>
            `<div class="row g-3 mb-3 align-items-stretch">${items.map(([n, l]) =>
                `<div class="${colClass}"><div class="panel stat h-100"><div class="n">${n}</div><div class="text-secondary small">${l}</div></div></div>`
            ).join("")}</div>`;

        if (isOffice) {
            const totalUnits = A.reduce((sum, a) => sum + (Number(a.qty) || 0), 0);
            const activeLoans = L.filter(x => x.status === "Borrowed").length;
            const returnedLoans = L.filter(x => x.status === "Returned").length;
            const stats = [
                [A.length, "Active Assets"],
                [totalUnits, "Total Units on Hand"],
                [activeLoans, "Active Borrowed"],
                [returnedLoans, "Returned Loans"]
            ];

            $("reportBody").innerHTML = `<p class="text-secondary small">Office report &bull; Generated ${fmt(Date.now())}</p>` +
                renderCards(stats, "col-6 col-md-3") +
                `<div class="row g-3">` +
                panel("Inventory by category", tally(A, a => a.category || "Uncategorized")) +
                panel("Assets by location", tally(A, a => a.location || "Unspecified")) +
                panel("Borrowing records by status", tally(L, x => x.status || "Unknown")) +
                `</div>`;
            return;
        }

        const cleanedTodayCount = C.filter(doneToday).length;
        const totalsByType = C.reduce((o, c) => {
            o[c.areaType] = (o[c.areaType] || 0) + logOf(c).length;
            return o;
        }, {});
        const stats = [
            [C.length, "Facilities listed"],
            [cleanedTodayCount, "Cleaned today"],
            [T.length, "Damage reports"],
            [fixedRate, "Issues fixed"],
            [avgTxt, "Avg. repair time"]
        ];

        $("reportBody").innerHTML = `<p class="text-secondary small">FAMO report &bull; Generated ${fmt(Date.now())}</p>` +
            renderCards(stats, "col-6 col-md-4 col-lg") +
            `<div class="row g-3">` +
            panel("Facility cleaning today", tally(C, c => doneToday(c) ? "Cleaned" : "For Cleaning")) +
            panel("Total times cleaned, by area type", totalsByType) +
            panel("Repair progress (by status)", tally(T, t => t.status)) +
            panel("Damage issues by type", tally(T, t => t.category)) +
            `</div>`;
    }

    /* history: activity log + archive */
    function renderHistory() {
        if (!$("logRows") || !$("archRows")) return;
        const store = invStore();
        const invKind = isSupplyPage() ? "supply" : "asset";
        const invLabel = isSupplyPage() ? "Supply" : "Asset";
        const kindLabels = {
            ticket: "Report",
            asset: "Asset",
            supply: "Supply",
            cleaning: "Cleaning",
            loan: "Borrowing",
            office: "Admin Office"
        };
        const q = ($("gSearch") ? $("gSearch").value : "").trim().toLowerCase(), k = $("gKind") ? $("gKind").value : "";
        const logs = Log.all().filter(g => (!k || g.kind === k) && (!q || g.text.toLowerCase().includes(q))).slice(0, 200);
        $("logRows").innerHTML = logs.length ? logs.map(g => `<tr><td class="small text-nowrap">${fmtT(g.createdAt)}</td><td><span class="badge text-bg-light border">${esc(kindLabels[g.kind] || g.kind)}</span></td><td>${esc(g.text)}</td></tr>`).join("")
            : `<tr><td colspan="3" class="empty">No activity yet.</td></tr>`;
        const arch = [
            ...Tickets.all().filter(t => t.archived).map(t => ({ k: "ticket", label: "Report", o: t, name: t.title })),
            ...store.all().filter(a => a.archived).map(a => ({ k: invKind, label: invLabel, o: a, name: `${a.name} (${a.tag || a.id})` }))
        ].sort((x, y) => (Number(y.o?.archivedAt) || 0) - (Number(x.o?.archivedAt) || 0));
        $("archRows").innerHTML = arch.length ? arch.map(x => `<tr><td><span class="badge text-bg-light border">${x.label}</span></td>
          <td><span class="tid">${x.o.id}</span><div class="fw-semibold">${esc(x.name)}</div></td><td class="small">${fmtT(x.o.archivedAt)}</td>
          <td class="text-end text-nowrap"><button class="btn btn-sm btn-success" data-act="restore" data-k="${x.k}" data-id="${x.o.id}">Restore</button>
          <button class="btn btn-sm btn-outline-danger" data-act="purge" data-k="${x.k}" data-id="${x.o.id}">Delete forever</button></td></tr>`).join("")
            : `<tr><td colspan="4" class="empty">Nothing archived.</td></tr>`;
    }
    if ($("archRows")) {
        $("archRows").addEventListener("click", e => {
            const b = e.target.closest("button[data-act]"); if (!b) return;
            const { act, k, id } = b.dataset, c = k === "ticket" ? Tickets : invStore();
            if (act === "restore") {
                c.patch(id, { archived: false, archivedAt: null }, "Restored from archive");
                toast(`${id} restored`);
                renderAll();
                refreshTickets();
            } else {
                openConfirmDelete({
                    title: `Delete ${id} forever?`,
                    item: id,
                    desc: "This can't be undone. The activity log keeps a record of it.",
                    btnText: "Delete forever",
                    onConfirm: () => {
                        (c === Tickets ? (Tickets.all().find(t => t.id === id) || {}).photos || [] : []).forEach(p => {
                            revokePhotoUrl(p);
                            PhotoDB.remove(p).catch(() => { });
                        });
                        c.remove(id, "Deleted forever");
                        toast(`${id} deleted forever`);
                        renderAll();
                        refreshTickets();
                    }
                });
            }
        });
    }

    ["gSearch", "gKind"].forEach(id => { if ($(id)) $(id).addEventListener("input", renderHistory); });
    const renderAll = () => { renderPersonnel(); renderCleanings(); renderAssets(); renderReports(); renderHistory(); };
    ["cSearch", "cStatus", "cType"].forEach(id => { if ($(id)) $(id).addEventListener("input", renderCleanings); });
    if ($("sSearch")) $("sSearch").addEventListener("input", renderAssets);
    if ($("assetCatFilter")) $("assetCatFilter").addEventListener("change", renderAssets);
    if ($("supplyCatFilter")) $("supplyCatFilter").addEventListener("change", renderAssets);
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
    stop() { clearTimeout(Idle.t); if (this.on) { this.on = false; IDLE_EVENTS.forEach(ev => document.removeEventListener(ev, this.bump)); } }
};
function closeEverything() {
    document.querySelectorAll(".modal.show").forEach(m => { const i = bootstrap.Modal.getInstance(m); if (i) i.hide(); });
    document.querySelectorAll(".offcanvas.show").forEach(o => { const i = bootstrap.Offcanvas.getInstance(o); if (i) i.hide(); });
}
function initProfile(cfg) {
    const form = $("profileForm"), modalEl = $("profileModal"), err = $("profErr");
    if (!form || !modalEl || !err) return;
    const pwIds = ["pfCur", "pfNew", "pfNew2"];
    addEyes(modalEl);
    let mode = "name";
    const fail = m => { err.textContent = m; err.classList.remove("d-none"); };
    const done = msg => { bootstrap.Modal.getOrCreateInstance(modalEl).hide(); window.refreshAuth(); toast(msg); };
    const setMode = m => {
        mode = m; err.classList.add("d-none"); form.classList.remove("was-validated");
        modalEl.querySelectorAll("[data-pf]").forEach(b => { const on = b.dataset.pf === m; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on); });
        if ($("pfPaneName")) $("pfPaneName").classList.toggle("d-none", m !== "name");
        if ($("pfPanePw")) $("pfPanePw").classList.toggle("d-none", m !== "pw");
        if ($("pfName")) $("pfName").required = m === "name";
        pwIds.forEach(id => { if ($(id)) { $(id).required = m === "pw"; $(id).value = ""; $(id).readOnly = true; } });
        modalEl.querySelectorAll(".pw-eye").forEach(b => b.reset());
    };
    pwIds.forEach(id => { if ($(id)) $(id).addEventListener("focus", e => { e.target.readOnly = false; }); });
    modalEl.querySelectorAll("[data-pf]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.pf)));
    window.openProfile = () => {
        const u = cfg.get(); if (!u) return;
        if ($("pfName")) $("pfName").value = u.name;
        if ($("pfId")) $("pfId").value = cfg.idText(u);
        setMode("name");
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };
    modalEl.addEventListener("hidden.bs.modal", () => setMode("name"));
    form.addEventListener("submit", async e => {
        e.preventDefault(); err.classList.add("d-none");
        if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
        const u = cfg.get();
        if (mode === "name") {
            const name = $("pfName") ? $("pfName").value.trim() : "";
            if (!name) return fail("Enter your name.");
            if (name === u.name) return fail("That is already your name.");
            cfg.save(u, { name }); done("Name updated");
        } else {
            const cur = $("pfCur") ? $("pfCur").value : "", n1 = $("pfNew") ? $("pfNew").value : "", n2 = $("pfNew2") ? $("pfNew2").value : "";
            if (u.pw !== await hashPw(cur, cfg.salt(u))) return fail("Your current password is wrong.");
            if (n1.length < 6) return fail("Use a new password with at least 6 characters.");
            if (n1 === cur) return fail("The new password must be different from the current one.");
            if (n1 !== n2) return fail("The two new passwords do not match.");
            cfg.save(u, { pw: await hashPw(n1, cfg.salt(u)) }); done("Password updated");
        }
    });
}

function fillChip(id, name, meta) {
    const c = $(id); if (!c) return;
    c.querySelector(".user-avatar").textContent = (name.trim().charAt(0) || "?").toUpperCase();
    c.querySelector(".who-name").textContent = name; c.querySelector(".who-meta").textContent = meta;
}

function addEyes(gate) {
    if (!gate) return;
    const svg = p => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const eyeOpen = svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
    const eyeShut = svg('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>');
    gate.querySelectorAll('input[type="password"]').forEach(inp => {
        if (inp.parentElement && inp.parentElement.classList.contains("pw-wrap")) return;
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
    if (!gate || !app || !nav) return;
    const picBtn = $("topProfilePicBtn");
    const picAvatar = picBtn ? picBtn.querySelector(".user-avatar") : null;
    addEyes(gate);

    const logoutNow = () => {
        localStorage.removeItem("fixit_session");
        apply();
        toast("You have been logged out");
    };
    window.doLogout = logoutNow;

    const apply = () => {
        const u = currentUser();
        gate.classList.toggle("d-none", !!u);
        app.classList.toggle("d-none", !u);
        nav.querySelectorAll("button[data-bs-toggle]").forEach(b => b.classList.toggle("d-none", !u));
        if (picBtn) {
            picBtn.classList.toggle("d-none", !u);
            if (picAvatar) {
                picAvatar.textContent = u && u.name ? u.name.trim().charAt(0).toUpperCase() : "";
            }
        }
        if (u) {
            Idle.start(() => {
                closeEverything();
                localStorage.removeItem("fixit_session");
                apply();
                toast("You were logged out after 15 minutes of inactivity.");
            });
        } else {
            Idle.stop();
        }
        gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
        window.dispatchEvent(new Event("authchange"));
    };

    const fail = (id, m) => { if ($(id)) { $(id).textContent = m; $(id).classList.remove("d-none"); } };

    if (picBtn) {
        picBtn.addEventListener("click", () => {
            const sheetEl = $("accountSheet");
            if (window.innerWidth < 768 && sheetEl && window.bootstrap?.Offcanvas) {
                bootstrap.Offcanvas.getOrCreateInstance(sheetEl).show();
            } else if (typeof window.openProfile === "function") {
                window.openProfile();
            }
        });
    }

    if ($("loginForm")) {
        $("loginForm").addEventListener("submit", async e => {
            e.preventDefault();
            const f = e.target;
            if ($("loginErr")) $("loginErr").classList.add("d-none");
            if ($("loginOk")) $("loginOk").classList.add("d-none");
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f)), id = (d.idNo || "").trim().toLowerCase();
            const u = Users.all().find(x => x.idNo.toLowerCase() === id);
            if (!u || u.pw !== await hashPw(d.password, id)) return fail("loginErr", "Wrong ID number or password.");
            localStorage.setItem("fixit_session", u.idNo);
            f.reset();
            f.classList.remove("was-validated");
            apply();
            toast("Welcome back, " + u.name);
        });
    }

    if ($("regForm")) {
        $("regForm").addEventListener("submit", async e => {
            e.preventDefault();
            const f = e.target;
            if ($("regErr")) $("regErr").classList.add("d-none");
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f)), idNo = d.idNo.trim(), users = Users.all();
            if (users.some(u => u.idNo.toLowerCase() === idNo.toLowerCase())) return fail("regErr", "This ID number already has an account. Try logging in.");
            if (d.password.length < 6) return fail("regErr", "Use a password with at least 6 characters.");
            if (d.password !== d.confirm) return fail("regErr", "The two passwords do not match.");
            users.push({ idNo, name: d.name.trim(), role: d.role, pw: await hashPw(d.password, idNo.toLowerCase()), createdAt: Date.now() });
            Users.save(users);
            f.reset();
            f.classList.remove("was-validated");
            gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
            bootstrap.Tab.getOrCreateInstance('[data-bs-target="#paneLogin"]').show();
            if ($("lgId")) $("lgId").value = idNo;
            if ($("loginOk")) { $("loginOk").textContent = "Account created for " + d.name.trim() + ". Please log in."; $("loginOk").classList.remove("d-none"); }
            if ($("lgPw")) $("lgPw").focus();
        });
    }

    if ($("sideLogoutBtn")) {
        $("sideLogoutBtn").addEventListener("click", logoutNow);
    }

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
    if (!gate || !app || !nav) return;
    const picBtn = $("topProfilePicBtn");
    const picAvatar = picBtn ? picBtn.querySelector(".user-avatar") : null;
    addEyes(gate);
    const admins = () => { try { return JSON.parse(localStorage.getItem("fixit_admins")) || []; } catch { return []; } };
    const current = () => { const u = sessionStorage.getItem("fixit_admin_session"); return admins().find(a => a.username === u) || null; };
    const fail = (id, m) => { if ($(id)) { $(id).textContent = m; $(id).classList.remove("d-none"); } };
    const apply = () => {
        const u = current(), setup = admins().length === 0;
        gate.classList.toggle("d-none", !!u);
        app.classList.toggle("d-none", !u);
        if (picBtn) {
            picBtn.classList.toggle("d-none", !u);
            if (picAvatar) {
                picAvatar.textContent = u && u.name ? u.name.trim().charAt(0).toUpperCase() : "A";
            }
        }
        if (u) {
            Idle.start(() => {
                closeEverything();
                sessionStorage.removeItem("fixit_admin_session");
                apply();
                toast("You were logged out after 15 minutes of inactivity.");
            });
        } else {
            Idle.stop();
        }
        if ($("loginForm")) $("loginForm").classList.toggle("d-none", setup);
        if ($("setupForm")) $("setupForm").classList.toggle("d-none", !setup);
        if ($("gateTitle")) $("gateTitle").textContent = setup ? "Set up the admin account" : "Admin sign in";
        if ($("gateHint")) $("gateHint").textContent = setup ? "No admin account exists yet. Create the first one." : "Log in to manage assets, reports, history, personnel, and damage reports.";
        if (u) sessionStorage.setItem("fixit_admin_name", u.name); else sessionStorage.removeItem("fixit_admin_name");
        gate.querySelectorAll(".pw-eye").forEach(b => b.reset());
        window.dispatchEvent(new Event("authchange"));
    };
    if ($("loginForm")) {
        $("loginForm").addEventListener("submit", async e => {
            e.preventDefault();
            const f = e.target;
            if ($("loginErr")) $("loginErr").classList.add("d-none");
            if ($("loginOk")) $("loginOk").classList.add("d-none");
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f)), id = (d.username || "").trim().toLowerCase();
            const a = admins().find(x => x.username.toLowerCase() === id);
            if (!a || a.pw !== await hashPw(d.password, "admin:" + id)) return fail("loginErr", "Wrong username or password.");
            sessionStorage.setItem("fixit_admin_session", a.username);
            f.reset();
            f.classList.remove("was-validated");
            apply();
            toast("Welcome, " + a.name);
        });
    }
    if ($("setupForm")) {
        $("setupForm").addEventListener("submit", async e => {
            e.preventDefault();
            const f = e.target;
            if ($("setupErr")) $("setupErr").classList.add("d-none");
            if (!f.checkValidity()) { f.classList.add("was-validated"); return; }
            const d = Object.fromEntries(new FormData(f)), username = d.username.trim();
            if (d.password.length < 6) return fail("setupErr", "Use a password with at least 6 characters.");
            if (d.password !== d.confirm) return fail("setupErr", "The two passwords do not match.");
            localStorage.setItem("fixit_admins", JSON.stringify([{
                username,
                name: d.name.trim(),
                pw: await hashPw(d.password, "admin:" + username.toLowerCase()),
                createdAt: Date.now(),
                personnel: []
            }]));
            f.reset();
            f.classList.remove("was-validated");
            apply();
            if ($("lgId")) $("lgId").value = username;
            if ($("loginOk")) { $("loginOk").textContent = "Admin account created. Please log in."; $("loginOk").classList.remove("d-none"); }
            if ($("lgPw")) $("lgPw").focus();
        });
    }
    initProfile({
        get: current, salt: u => "admin:" + u.username.toLowerCase(), idText: u => u.username,
        save: (u, patch) => { const l = admins(); Object.assign(l.find(x => x.username === u.username), patch); localStorage.setItem("fixit_admins", JSON.stringify(l)); }
    });
    window.refreshAuth = apply;
    apply();
}

function performAdminLogout() {
    sessionStorage.removeItem("fixit_admin_session");
    sessionStorage.removeItem("fixit_admin_name");
    if (typeof window.refreshAuth === "function") {
        window.refreshAuth();
    }
    toast("You have been logged out");
}

function initAdminSidebarAndAvatars() {
    const page = (document.body.dataset.page || document.body.dataset.role || "").toLowerCase();
    const isAdminPage = page === "admin" || page === "famo" || page === "admin_office";
    if (!isAdminPage) return;

    // 1. Remove/hide the profile button at the top of FAMO
    if (page === "famo") {
        document.querySelectorAll(".topbar .user-menu").forEach(el => el.remove());
    }

    // 2. Connect unconnected logout & account buttons inside aside / sidebar / quick actions
    document.addEventListener("click", e => {
        const logoutEl = e.target.closest("aside button, aside a, .sidebar button, .sidebar a, [data-logout], #logoutBtn, #asideLogout");
        if (logoutEl) {
            const txt = (logoutEl.textContent || "").trim().toLowerCase();
            if (logoutEl.matches("[data-logout], #logoutBtn, #asideLogout") || txt === "log out" || txt === "logout") {
                e.preventDefault();
                performAdminLogout();
                return;
            }
        }

        const acctEl = e.target.closest("aside button, aside a, .sidebar button, .sidebar a, [data-account-settings], #accountSettingsBtn");
        if (acctEl) {
            const txt = (acctEl.textContent || "").trim().toLowerCase();
            if (acctEl.matches("[data-account-settings], #accountSettingsBtn") || txt === "account settings" || txt === "edit profile") {
                e.preventDefault();
                if (typeof window.openProfile === "function") window.openProfile();
            }
        }
    });

    // 3. Sync picture circle for Admin Office
    const syncOfficeCircle = () => {
        const circle = $("adminOfficeAvatar") || document.querySelector(".office-avatar-circle");
        if (!circle) return;
        const name = sessionStorage.getItem("fixit_admin_name") || "Admin Office";
        const ini = (name.trim().charAt(0) || "A").toUpperCase();
        const savedPic = localStorage.getItem("fixit_office_avatar") || "";
        if (savedPic) {
            circle.innerHTML = `<img src="${esc(savedPic)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            circle.textContent = ini;
        }
    };

    syncOfficeCircle();
    window.addEventListener("authchange", syncOfficeCircle);
    window.addEventListener("storage", syncOfficeCircle);
}

/* ---------- Mobile bottom sheets (client) ---------- */
function initSheets() {
    if (!$("accountSheet")) return;
    $("accountSheet").addEventListener("show.bs.offcanvas", () => {
        const u = currentUser(); if (!u) return;
        if ($("shAvatar")) $("shAvatar").textContent = u.name.trim().charAt(0).toUpperCase();
        if ($("shName")) $("shName").textContent = u.name;
        if ($("shMeta")) $("shMeta").textContent = u.role + " - " + u.idNo;
    });
    if ($("sheetProfile")) {
        $("sheetProfile").addEventListener("click", () => {
            const el = $("accountSheet");
            el.addEventListener("hidden.bs.offcanvas", () => window.openProfile(), { once: true });
            bootstrap.Offcanvas.getOrCreateInstance(el).hide();
        });
    }
    if ($("sheetLogout")) {
        $("sheetLogout").addEventListener("click", () => { bootstrap.Offcanvas.getOrCreateInstance("#accountSheet").hide(); window.doLogout(); });
    }
}

/* ---------- My history (client) ---------- */
function initHistoryClient() {
    const hlInput = $("hlSearch"), htInput = $("htSearch");
    const hlBody = $("hlRows"), htBody = $("htRows");
    if (!hlBody || !htBody) return;

    const none = (t, cols = 5) => `<tr><td colspan="${cols}" class="empty">${t}</td></tr>`;

    const render = () => {
        const u = currentUser();
        const lq = (hlInput ? hlInput.value : "").trim().toLowerCase();
        const tq = (htInput ? htInput.value : "").trim().toLowerCase();

        if (!u) {
            if ($("hSummary")) $("hSummary").textContent = "Log in to view your borrowing records and submitted damage reports.";
            hlBody.innerHTML = none("Log in to see your borrowing and return history.");
            htBody.innerHTML = none("Log in to see your submitted damage reports.");
            return;
        }

        const userLoans = Loans.all().filter(l =>
            l.borrowerId ? l.borrowerId === u.idNo : l.borrowerName === u.name
        );
        const userTickets = Tickets.all().filter(t => !t.archived && (
            t.idNo ? t.idNo === u.idNo : t.reporter === u.name
        ));

        if ($("hSummary")) {
            $("hSummary").textContent =
                `Records for ${u.name} (${u.idNo}). ` +
                `${userLoans.length} borrowing record${userLoans.length === 1 ? "" : "s"} (${userLoans.filter(l => l.status === "Borrowed").length} active) · ` +
                `${userTickets.length} damage report${userTickets.length === 1 ? "" : "s"} (${userTickets.filter(t => t.status === "Fixed").length} fixed).`;
        }

        const filteredLoans = userLoans.filter(l => !lq ||
            [l.id, l.itemName, l.assetId, l.status, l.unit]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(lq)
        );

        hlBody.innerHTML = filteredLoans.length ? filteredLoans.map(l => `<tr>
          <td>${tlBtn("l", l.id)}</td>
          <td><div class="fw-semibold">${esc(l.itemName)}</div><div class="small text-secondary">${Number(l.qty) || 1} ${esc(l.unit || "pcs")} &bull; ${esc(l.assetId)}</div></td>
          <td>${badge(l.status)}</td>
          <td class="small">${fmt(l.createdAt)}</td>
          <td class="small">${l.returnedAt ? fmt(l.returnedAt) : "-"}</td>
        </tr>`).join("") : none(lq ? "No matching borrowing or return records." : "No borrowing or return records yet.");

        const filteredTickets = userTickets.filter(t => !tq ||
            [t.id, t.title, t.building, t.location, t.status, t.assignee]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(tq)
        );

        htBody.innerHTML = filteredTickets.length ? filteredTickets.map(t => `<tr>
          <td>${tlBtn("t", t.id)}</td>
          <td><div class="fw-semibold">${esc(t.title)}</div><div class="small text-secondary">${esc(t.building)} &ndash; ${esc(t.location)}</div>${photoStrip(t)}</td>
          <td>${badge(t.status)}${t.assignee ? `<div class="small text-secondary mt-1">Assigned to ${esc(t.assignee)}</div>` : ""}</td>
          <td class="small">${fmt(t.createdAt)}</td>
          <td class="small">${t.fixedAt ? fmt(t.fixedAt) : "-"}</td>
        </tr>`).join("") : none(tq ? "No matching damage reports." : "No damage reports found.");
    };

    if (hlInput) hlInput.addEventListener("input", render);
    if (htInput) htInput.addEventListener("input", render);
    document.addEventListener("shown.bs.tab", e => {
        if (e.target.getAttribute("data-bs-target") === "#tabHist") render();
    });
    window.addEventListener("storage", render);
    window.addEventListener("authchange", render);
    window.addEventListener("loanschange", render);
    render();
}

/* ---------- Mobile page title + client summary ---------- */
const ADMIN_TITLES = {
    "#tabClean": ["Facilities", "Facility list, daily cleaning, and schedules"],
    "#tabSupplies": ["Cleaning supplies", "Cleaning supplies, sanitation stock, and storage levels"],
    "#tabAssets": ["Assets inventory", "Office assets, equipment stock, and storage locations"],
    "#tabReports": ["Reports and analytics", "Summaries of assets, reports, and activity"],
    "#tabHistory": ["History and archive", "Activity log and archived items"],
    "#tabPersonnel": ["Personnel", "Saved office staff and coordinators"],
    "#tabTickets": ["Damage reports", "Secondary damage reports and tracking"]
};

const M_TITLES = {
    student: {
        "#tabCatalog": ["Dashboard", "What CampusCare is for, what's inside, and what it offers"],
        "#tabBorrow": ["Borrow & return", "Check out available assets or return borrowed items"],
        "#tabHist": ["My history", "Your borrowing records and submitted reports"],
        "#tabReports": ["Damage reports", "Secondary damage reporting on campus"]
    },
    admin: ADMIN_TITLES,
    famo: ADMIN_TITLES,
    admin_office: ADMIN_TITLES
};

function updateMobileHead(t) {
    const m = (M_TITLES[document.body.dataset.page] || {})[t];
    if (m && $("mTitle")) { $("mTitle").textContent = m[0]; if ($("mSub")) $("mSub").textContent = m[1]; }
}

function initHero() {
    if (!$("heroName")) return;
    const render = () => {
        const u = currentUser(); if (!u) return;
        const T = Tickets.all().filter(t => !t.archived && (t.idNo ? t.idNo === u.idNo : t.reporter === u.name));
        if ($("heroName")) $("heroName").textContent = u.name.trim().split(" ")[0];
        if ($("heroTotal")) $("heroTotal").textContent = T.length;
        if ($("heroOpen")) $("heroOpen").textContent = T.filter(t => t.status !== "Fixed").length;
        if ($("heroFixed")) $("heroFixed").textContent = T.filter(t => t.status === "Fixed").length;
    };
    window.addEventListener("authchange", render); window.addEventListener("storage", render);
    document.addEventListener("shown.bs.tab", render);
    if ($("rows")) new MutationObserver(render).observe($("rows"), { childList: true });
    render();
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", e => {
        const b = e.target.closest("[data-tl]");
        if (b) showTimeline({ t: Tickets, c: Cleanings, l: Loans }[b.dataset.tl], b.dataset.id);
    });
    document.addEventListener("shown.bs.tab", e => {
        if (e.target.closest(".damage-subtabs, .history-subtabs")) return;
        const t = e.target.getAttribute("data-bs-target");
        updateMobileHead(t);
        document.querySelectorAll("[data-main-nav]").forEach(b => {
            const on = b.getAttribute("data-bs-target") === t;
            b.classList.toggle("active", on); b.setAttribute("aria-selected", on);
        });
    });
    ["hide.bs.modal", "hide.bs.offcanvas"].forEach(ev => document.addEventListener(ev, () => { if (document.activeElement) document.activeElement.blur(); }));
    initPhotoViewer();
    const p = document.body.dataset.page;
    const isAdminPage = p === "admin" || p === "famo" || p === "admin_office";
    const defaultTab = p === "student" ? "#tabCatalog" : (p === "admin_office" ? "#tabAssets" : "#tabClean");
    updateMobileHead(defaultTab);
    if (p === "student") { initAuth(); initStudent(); initBorrowClient(); initHistoryClient(); initSheets(); initHero(); }
    if (isAdminPage) {
        initAdminAuth();
        initAdmin();
        initAdminExtras();
        applyAdminTabVisibility();
        initAdminSidebarAndAvatars();
    }
});