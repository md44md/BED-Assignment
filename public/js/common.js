/* ============================================================
   Shared front-end helpers used by every page.
   Loaded BEFORE each page's own script.

   Provides (as globals):
     - session helpers   (JWT/email in localStorage, shared by ALL roles)
     - api()             (fetch wrapper)
     - stall helpers     (loadStalls / fillStallSelect / stallName)
     - grade rendering   (renderGradeCard / renderGradeList)
     - small DOM/format utilities
   ============================================================ */

"use strict";

/* ---------- Session (shared by every role) ----------
   One logged-in user per browser. Any role's login page (officer, customer,
   stall owner, operator) calls saveSession() after a successful
   POST /<role>/login, and every page reads the same token. Pass the role to 
   saveSession() if a page needs to know who is signed in. */

const TOKEN_KEY = "hcms_token";
const EMAIL_KEY = "hcms_email";
const ROLE_KEY = "hcms_role";
const PICTURE_KEY = "hcms_picture";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
function getEmail() {
    return localStorage.getItem(EMAIL_KEY);
}
function getRole() {
    return localStorage.getItem(ROLE_KEY);
}
function getPicture() {
    return localStorage.getItem(PICTURE_KEY);
}
function isLoggedIn() {
    return !!getToken();
}
// Cache the profile picture URL locally so every page can show it without an
// extra API call. Call this again (with just the new URL) right after a
// successful upload so the header updates immediately, no re-login needed.
function setPicture(profilePictureURL) {
    if (profilePictureURL) {
        localStorage.setItem(PICTURE_KEY, profilePictureURL);
    } else {
        localStorage.removeItem(PICTURE_KEY);
    }
    renderHeaderAvatar();
}
function saveSession(token, email, role, profilePictureURL) {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
    if (role) localStorage.setItem(ROLE_KEY, role);
    setPicture(profilePictureURL);
}
function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(PICTURE_KEY);
}

/* ---------- Header avatar (auto-rendered on every authenticated page) ----------
   Every protected page already has #session-email in its header. Rather than
   editing every page's HTML/JS individually, this hooks into that one shared
   element and injects the avatar image next to it — one place to maintain. */

// Generic person-silhouette icon, inlined so no extra image asset is needed.
const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#cbd5e1"/><circle cx="12" cy="9" r="4" fill="#64748b"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6" fill="#64748b"/></svg>'
);

function renderHeaderAvatar() {
    const emailEl = $("#session-email");
    if (!emailEl || !isLoggedIn()) return;

    let img = $("#session-avatar");
    if (!img) {
        img = document.createElement("img");
        img.id = "session-avatar";
        img.className = "session-avatar";
        img.alt = "Profile picture";
        emailEl.parentNode.insertBefore(img, emailEl);
    }
    img.src = getPicture() || DEFAULT_AVATAR;
}

document.addEventListener("DOMContentLoaded", renderHeaderAvatar);

/* ---------- Small DOM helper ---------- */

const $ = (sel) => document.querySelector(sel);

/* ---------- Formatting ---------- */

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
    return `$${Number(value).toFixed(2)}`;
}

function isExpired(expiryDate) {
    const d = new Date(expiryDate);
    return !isNaN(d) && d < new Date(new Date().toDateString());
}

// Render a 1-5 rating as a filled/empty star string, e.g. renderStars(4) -> "★★★★☆"
function renderStars(rating) {
    const filled = Math.round(Number(rating));
    return "★".repeat(filled) + "☆".repeat(5 - filled);
}

// Escape text before interpolating it into innerHTML. Needed anywhere we
// render free text written by someone other than the viewer (e.g. another
// customer's review comment) so it can't be used for a stored-XSS injection.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showMessage(el, type, text) {
    el.className = `message message--${type}`;
    el.textContent = text;
    el.hidden = false;
}

function clearMessage(el) {
    el.hidden = true;
    el.textContent = "";
}

/* ---------- API layer ---------- */

function makeError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

// Wrap fetch: parse JSON, and throw an Error carrying the server's message + status.
async function api(path, { method = "GET", body, auth = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
        const token = getToken();
        if (!token) throw makeError("Your session has expired. Please log in again.", 401);
        headers["Authorization"] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        // Network / server-down failure
        throw makeError("Could not reach the server. Is it running?", 0);
    }

    let data = {};
    try {
        data = await res.json();
    } catch {
        /* some responses may have no JSON body */
    }

    if (!res.ok) {
        const msg = data.error || data.message || `Request failed (${res.status}).`;
        throw makeError(msg, res.status);
    }
    return data;
}

/* ---------- Stalls ---------- */

// Stalls are loaded from the back-end (GET /stalls) so pickers always reflect
// the real database rather than a hardcoded list.
let stalls = [];

function stallName(stallID) {
    const match = stalls.find((s) => s.stallID === Number(stallID));
    return match ? match.stallName : `Stall ${stallID}`;
}

// Populate a <select> with the stalls loaded from the back-end.
function fillStallSelect(select) {
    select.innerHTML = "";
    for (const stall of stalls) {
        const opt = document.createElement("option");
        opt.value = stall.stallID;
        const centre = stall.centreName ? ` — ${stall.centreName}` : "";
        opt.textContent = `${stall.stallName}${centre} (ID ${stall.stallID})`;
        select.appendChild(opt);
    }
}

// Fetch the stall list once and fill every stall picker named in `selectors`.
// `onError` lets each page decide where to surface a load failure.
async function loadStalls(selectors, onError) {
    try {
        const data = await api("/stalls");
        stalls = data.stalls || [];
        selectors.forEach((sel) => {
            const el = $(sel);
            if (el) fillStallSelect(el);
        });
        return stalls;
    } catch (err) {
        if (onError) onError(err);
        return [];
    }
}

/* ---------- Grade rendering ---------- */

// Build one grade card. `manage` adds officer edit/revoke controls.
function renderGradeCard(grade, { manage = false } = {}) {
    const active = grade.isActive === true || grade.isActive === 1;
    const expired = isExpired(grade.expiryDate);
    const card = document.createElement("article");
    card.className = `grade-card grade--${grade.grade}` + (active && !expired ? " grade-card--current" : "");
    card.dataset.gradeId = grade.gradeID;

    // Status tag
    let tag;
    if (expired) tag = '<span class="tag tag--expired">Expired</span>';
    else if (active) tag = '<span class="tag tag--current">Current</span>';
    else tag = '<span class="tag tag--historical">Historical</span>';

    card.innerHTML = `
        <div class="grade-badge">${grade.grade}</div>
        <div class="grade-card__body">
            <div class="grade-card__row">
                <span class="grade-card__title">Grade ${grade.grade}</span>
                ${tag}
            </div>
            <div class="grade-card__meta">
                ${stallName(grade.stallID)} · Issued ${formatDate(grade.issuedDate)} ·
                Valid until ${formatDate(grade.expiryDate)}
            </div>
            <div class="grade-card__meta">From inspection #${grade.inspectionID} · Grade ID ${grade.gradeID}</div>
        </div>
    `;

    if (manage) {
        const actions = document.createElement("div");
        actions.className = "grade-card__actions";
        actions.innerHTML = `
            <label class="field__label" for="edit-${grade.gradeID}">Correct to</label>
            <select id="edit-${grade.gradeID}" class="input">
                ${["A", "B", "C", "D"].map((g) => `<option value="${g}" ${g === grade.grade ? "selected" : ""}>${g}</option>`).join("")}
            </select>
            <button type="button" class="btn btn--secondary btn--sm" data-action="save">Save</button>
            <button type="button" class="btn btn--danger btn--sm" data-action="revoke">Revoke</button>
        `;
        card.querySelector(".grade-card__body").appendChild(actions);
    }
    return card;
}

// Render a list of grades into a container.
function renderGradeList(container, grades, { manage = false } = {}) {
    container.innerHTML = "";
    if (!grades || grades.length === 0) {
        container.innerHTML = `<div class="empty">No hygiene grades have been issued for this stall yet.</div>`;
        return;
    }
    for (const grade of grades) {
        container.appendChild(renderGradeCard(grade, { manage }));
    }
}
