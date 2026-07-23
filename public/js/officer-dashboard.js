/* ============================================================
   NEA Officer console (dashboard).
   Protected page: no valid token -> redirect to the login page.

   Talks to the back-end RESTful API (all officer routes need a JWT):
     GET    /stalls/:stallID/hygiene-grades
     POST   /hygiene-grades
     PUT    /hygiene-grades/:gradeID
     DELETE /hygiene-grades/:gradeID
     PUT    /inspections/:id
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/officer-login.html";

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

// If any authed call reports the session is gone (401/403), bring back to login.
function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Log an inspection result ---------- */

// Show the freshly-logged inspection so the officer can confirm it and note the ID.
function renderInspectionResult(container, insp) {
    container.innerHTML = "";
    const card = document.createElement("article");
    card.className = "grade-card";
    card.innerHTML = `
        <div class="grade-badge grade-badge--score">${Number(insp.score)}</div>
        <div class="grade-card__body">
            <div class="grade-card__row">
                <span class="grade-card__title">Inspection #${Number(insp.inspectionID)}</span>
                <span class="tag tag--current">${insp.status ? String(insp.status) : "completed"}</span>
            </div>
            <div class="grade-card__meta">
                ${stallName(insp.stallID)} · ${formatDate(insp.inspectionDate)} · Score ${Number(insp.score)}/100
            </div>
            <div class="grade-card__meta grade-card__remarks"></div>
            <div class="grade-card__meta">Use Inspection #${Number(insp.inspectionID)} when issuing a grade.</div>
        </div>
    `;
    // Remarks are free text (set via textContent to avoid any HTML injection)
    card.querySelector(".grade-card__remarks").textContent = insp.remarks || "";
    container.appendChild(card);
}

// After logging, suggest the new inspection in the Issue-a-grade picker and
// pre-fill that form so the officer can grade it straight away.
function rememberInspection(insp) {
    const list = $("#completed-inspections");
    if (list) {
        const opt = document.createElement("option");
        opt.value = insp.inspectionID;
        opt.textContent = `${stallName(insp.stallID)} — score ${insp.score}`;
        list.appendChild(opt);
    }
    const issueStall = $("#issue-stall");
    if (issueStall) issueStall.value = insp.stallID;
    const issueInsp = $("#issue-inspection");
    if (issueInsp) issueInsp.value = insp.inspectionID;
}

async function handleLogInspection(event) {
    event.preventDefault();
    const msg = $("#inspect-message");
    const result = $("#inspect-result");
    const submitBtn = event.submitter;
    clearMessage(msg);
    result.innerHTML = "";

    const payload = {
        stallID: Number($("#inspect-stall").value),
        score: Number($("#inspect-score").value),
        remarks: $("#inspect-remarks").value.trim(),
    };
    // Only send a date if the officer picked one; otherwise the server defaults to today.
    const date = $("#inspect-date").value;
    if (date) payload.inspectionDate = date;

    submitBtn.disabled = true;
    try {
        const data = await api("/inspections", { method: "POST", body: payload, auth: true });
        const insp = data.inspection || {};
        showMessage(
            msg,
            "success",
            `${data.message || "Inspection logged successfully."} You can now grade it in the "Issue a grade" tab.`
        );
        renderInspectionResult(result, insp);
        rememberInspection(insp);
        $("#inspect-form").reset();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

/* ---------- Correct an inspection ---------- */

async function handleCorrectInspection(event) {
    event.preventDefault();
    const msg = $("#correct-message");
    const result = $("#correct-result");
    const submitBtn = event.submitter;
    clearMessage(msg);
    result.innerHTML = "";

    const inspectionID = $("#correct-inspection-id").value;
    const payload = {
        score: Number($("#correct-score").value),
        remarks: $("#correct-remarks").value.trim(),
    };
    // Only send a date if the officer picked one; otherwise the server keeps the original.
    const date = $("#correct-date").value;
    if (date) payload.inspectionDate = date;

    submitBtn.disabled = true;
    try {
        const data = await api(`/inspections/${inspectionID}`, { method: "PUT", body: payload, auth: true });
        showMessage(msg, "success", data.message || "Inspection updated successfully.");
        renderInspectionResult(result, data.inspection || {});
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

/* ---------- Schedule an inspection ---------- */

function renderScheduledCard(insp) {
    const card = document.createElement("article");
    card.className = "grade-card";
    card.innerHTML = `
        <div class="grade-card__body">
            <div class="grade-card__row">
                <span class="grade-card__title">Inspection #${Number(insp.inspectionID)}</span>
                <span class="tag tag--historical">${insp.status}</span>
            </div>
            <div class="grade-card__meta">
                ${stallName(insp.stallID)} · Scheduled for ${formatDate(insp.scheduledDate)}
            </div>
        </div>
    `;
    return card;
}

function renderScheduledList(container, inspections) {
    container.innerHTML = "";
    if (!inspections || inspections.length === 0) {
        container.innerHTML = `<div class="empty">No upcoming inspections scheduled yet.</div>`;
        return;
    }
    for (const insp of inspections) {
        container.appendChild(renderScheduledCard(insp));
    }
}

// Re-fetch and re-render this officer's own upcoming scheduled inspections.
async function loadScheduledInspections() {
    const msg = $("#schedule-message");
    const result = $("#schedule-result");
    try {
        const data = await api("/inspections/scheduled", { auth: true });
        renderScheduledList(result, data.inspections);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleScheduleInspection(event) {
    event.preventDefault();
    const msg = $("#schedule-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    const payload = {
        stallID: Number($("#schedule-stall").value),
        scheduledDate: $("#schedule-date").value,
    };

    submitBtn.disabled = true;
    try {
        const data = await api("/inspections/schedule", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", data.message || "Inspection scheduled successfully.");
        $("#schedule-form").reset();
        await loadScheduledInspections();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

/* ---------- Issue a grade ---------- */

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

/* ---------- Manage (load / correct / revoke) ---------- */

async function handleManageLoad(event) {
    event.preventDefault();
    const msg = $("#manage-message");
    const results = $("#manage-results");
    clearMessage(msg);
    results.innerHTML = "";

    try {
        const data = await api(`/stalls/${$("#manage-stall").value}/hygiene-grades`);
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
    try {
        const data = await api(`/stalls/${$("#manage-stall").value}/hygiene-grades`);
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
    $("#inspect-tab").hidden = target !== "inspect";
    $("#correct-tab").hidden = target !== "correct";
    $("#issue-tab").hidden = target !== "issue";
    $("#manage-tab").hidden = target !== "manage";
    $("#schedule-tab").hidden = target !== "schedule";
    if (target === "schedule") loadScheduledInspections();
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is officer-only. A logged-in customer or stall
    // owner must not land here, so check the role, not just for any session.
    if (!isLoggedIn() || getRole() !== "neaOfficer") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which officer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    // Populate the stall pickers.
    loadStalls(["#inspect-stall", "#issue-stall", "#manage-stall", "#schedule-stall"], (err) =>
        showMessage($("#inspect-message"), "error", `Could not load stalls: ${err.message}`)
    );

    // The inspection date can't be in the future (server enforces this too).
    $("#inspect-date").max = new Date().toISOString().slice(0, 10);
    $("#correct-date").max = new Date().toISOString().slice(0, 10);
    // The scheduled date can't be in the past (server enforces this too).
    $("#schedule-date").min = new Date().toISOString().slice(0, 10);

    // Wire up actions.
    $("#logout-btn").addEventListener("click", handleLogout);
    $("#inspect-form").addEventListener("submit", handleLogInspection);
    $("#correct-form").addEventListener("submit", handleCorrectInspection);
    $("#issue-form").addEventListener("submit", handleIssue);
    $("#manage-form").addEventListener("submit", handleManageLoad);
    $("#manage-results").addEventListener("click", handleManageAction);
    $("#schedule-form").addEventListener("submit", handleScheduleInspection);
    document.querySelector(".tabs").addEventListener("click", handleTabClick);
}

document.addEventListener("DOMContentLoaded", init);
