/* ============================================================
   NEA Hygiene Grades — front-end logic
   Talks to the back-end RESTful API:
     GET    /stalls/:stallID/hygiene-grades   (public)
     POST   /officers/login                   (get JWT)
     POST   /hygiene-grades                    (officer)
     PUT    /hygiene-grades/:gradeID           (officer)
     DELETE /hygiene-grades/:gradeID           (officer)
   ============================================================ */

"use strict";

// Stalls are loaded from the back-end (GET /stalls) at start-up, so the picker
// always reflects the real database rather than a hardcoded list.
let stalls = [];

const TOKEN_KEY = "nea_officer_token";
const EMAIL_KEY = "nea_officer_email";

// Small DOM helper
const $ = (sel) => document.querySelector(sel);

/* ---------- Utilities ---------- */

function stallName(stallID) {
    const match = stalls.find((s) => s.stallID === Number(stallID));
    return match ? match.stallName : `Stall ${stallID}`;
}

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpired(expiryDate) {
    const d = new Date(expiryDate);
    return !isNaN(d) && d < new Date(new Date().toDateString());
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

// Populate a <select> with the stalls loaded from the back-end
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

// Fetch the stall list once at start-up and fill every stall picker.
async function loadStalls() {
    const selectors = ["#public-stall", "#issue-stall", "#manage-stall"];
    try {
        const data = await api("/stalls");
        stalls = data.stalls || [];
        selectors.forEach((sel) => fillStallSelect($(sel)));
        if (stalls.length === 0) {
            showMessage($("#public-message"), "info", "No stalls are available yet.");
        }
    } catch (err) {
        // Keep the page usable and tell the user why the pickers are empty.
        showMessage($("#public-message"), "error", `Could not load stalls: ${err.message}`);
    }
}

/* ---------- API layer ---------- */

// Wrap fetch: parse JSON, and throw an Error carrying the server's message + status.
async function api(path, { method = "GET", body, auth = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
        const token = localStorage.getItem(TOKEN_KEY);
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

function makeError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
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

// Render a list of grades into a container, splitting current vs history for the public view.
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

/* ---------- Public panel: view a stall's grades ---------- */

async function handlePublicView(event) {
    event.preventDefault();
    const stallID = $("#public-stall").value;
    const msg = $("#public-message");
    const results = $("#public-results");
    clearMessage(msg);
    results.innerHTML = "";

    try {
        const data = await api(`/stalls/${stallID}/hygiene-grades`);
        renderGradeList(results, data.grades, { manage: false });
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

/* ---------- Officer session ---------- */

function applySession() {
    const email = localStorage.getItem(EMAIL_KEY);
    const loggedIn = !!localStorage.getItem(TOKEN_KEY);

    $("#login-view").hidden = loggedIn;
    $("#console-view").hidden = !loggedIn;
    $("#logout-btn").hidden = !loggedIn;
    if (loggedIn && email) $("#session-email").textContent = email;
}

async function handleLogin(event) {
    event.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const msg = $("#login-message");
    clearMessage(msg);

    try {
        const data = await api("/officers/login", {
            method: "POST",
            body: { email, password },
        });
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(EMAIL_KEY, email);
        $("#login-form").reset();
        applySession();
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    applySession();
}

// If any authed call reports the session is gone (401/403), drop the token and show login.
function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        handleLogout();
        showMessage($("#login-message"), "error", "Session expired or access denied. Please log in again.");
        return true;
    }
    return false;
}

/* ---------- Officer: issue a grade ---------- */

async function handleIssue(event) {
    event.preventDefault();
    const msg = $("#issue-message");
    const result = $("#issue-result");
    const submitBtn = event.submitter;
    clearMessage(msg);
    result.innerHTML = "";

    const gradeInput = document.querySelector('input[name="grade"]:checked');
    if (!gradeInput) {
        showMessage(msg, "error", "Please select a grade (A, B, C or D).");
        return;
    }

    const payload = {
        stallID: Number($("#issue-stall").value),
        inspectionID: Number($("#issue-inspection").value),
        grade: gradeInput.value,
    };

    submitBtn.disabled = true;
    try {
        const data = await api("/hygiene-grades", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", data.message || "Hygiene grade issued successfully.");
        renderGradeList(result, [data.grade], { manage: false });
        $("#issue-form").reset();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

/* ---------- Officer: manage (load / correct / revoke) ---------- */

async function handleManageLoad(event) {
    event.preventDefault();
    const stallID = $("#manage-stall").value;
    const msg = $("#manage-message");
    const results = $("#manage-results");
    clearMessage(msg);
    results.innerHTML = "";

    try {
        const data = await api(`/stalls/${stallID}/hygiene-grades`);
        renderGradeList(results, data.grades, { manage: true });
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

// Delegated clicks for the Save / Revoke buttons on manage cards.
async function handleManageAction(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".grade-card");
    const gradeID = card.dataset.gradeId;
    const msg = $("#manage-message");
    clearMessage(msg);

    if (btn.dataset.action === "save") {
        const newGrade = card.querySelector(`#edit-${gradeID}`).value;
        btn.disabled = true;
        try {
            const data = await api(`/hygiene-grades/${gradeID}`, {
                method: "PUT",
                body: { grade: newGrade },
                auth: true,
            });
            showMessage(msg, "success", data.message || "Hygiene grade updated.");
            await refreshManage();
        } catch (err) {
            if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
        } finally {
            btn.disabled = false;
        }
    }

    if (btn.dataset.action === "revoke") {
        const ok = window.confirm(`Revoke grade ID ${gradeID}? This permanently deletes it.`);
        if (!ok) return;
        btn.disabled = true;
        try {
            const data = await api(`/hygiene-grades/${gradeID}`, { method: "DELETE", auth: true });
            showMessage(msg, "success", data.message || "Hygiene grade revoked.");
            await refreshManage();
        } catch (err) {
            if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
        } finally {
            btn.disabled = false;
        }
    }
}

// Re-load the manage list for the currently selected stall (after edit/revoke).
async function refreshManage() {
    const results = $("#manage-results");
    const stallID = $("#manage-stall").value;
    try {
        const data = await api(`/stalls/${stallID}/hygiene-grades`);
        renderGradeList(results, data.grades, { manage: true });
    } catch {
        /* keep the success message; a stale list is harmless */
    }
}

/* ---------- Tabs ---------- */

function handleTabClick(event) {
    const tab = event.target.closest(".tab");
    if (!tab) return;
    const target = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
    });
    $("#issue-tab").hidden = target !== "issue";
    $("#manage-tab").hidden = target !== "manage";
}

/* ---------- Init ---------- */

function init() {
    // Load stall list from the back-end and populate all dropdowns
    loadStalls();

    // Public
    $("#public-form").addEventListener("submit", handlePublicView);

    // Officer auth
    $("#login-form").addEventListener("submit", handleLogin);
    $("#logout-btn").addEventListener("click", handleLogout);

    // Officer actions
    $("#issue-form").addEventListener("submit", handleIssue);
    $("#manage-form").addEventListener("submit", handleManageLoad);
    $("#manage-results").addEventListener("click", handleManageAction);

    // Tabs
    document.querySelector(".tabs").addEventListener("click", handleTabClick);

    // Restore any existing session
    applySession();
}

document.addEventListener("DOMContentLoaded", init);
