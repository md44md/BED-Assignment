/* public/js/complaints.js
   ============================================================
   Complaints page: file a new complaint and view your own
   complaint history.
   Protected page: no valid customer session -> redirect to login.

   Talks to the back-end API (needs a customer JWT):
     POST /complaint — submit a new complaint
     GET  /complaint — this customer's own complaints, newest first
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Formatting ---------- */

// Map a complaint status to one of the shared tag colour variants.
function statusTagClass(status) {
    switch (String(status).toLowerCase()) {
        case "resolved":
        case "closed":
            return "tag--current";      // green
        default:                         // open, underReview
            return "tag--historical";    // neutral
    }
}

/* ---------- Submit complaint ---------- */

async function submitComplaint(event) {
    event.preventDefault();
    const msg = $("#submit-message");
    clearMessage(msg);

    const stallID = Number($("#submit-stall").value);
    if (!stallID) {
        showMessage(msg, "error", "Please select a stall.");
        return;
    }

    const payload = {
        stallID,
        category: $("#submit-category").value,
        description: $("#submit-description").value.trim(),
    };

    if (!payload.description) {
        showMessage(msg, "error", "Please describe the issue.");
        return;
    }

    const btn = event.submitter;
    btn.disabled = true;
    try {
        const data = await api("/complaint", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", `${data.message} (Complaint ID: ${data.complaintID})`);
        $("#submit-description").value = "";
        loadMyComplaints();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- Render / load complaint history ---------- */

function renderComplaint(complaint) {
    const card = document.createElement("article");
    card.className = "order-card";
    card.dataset.complaintId = complaint.complaintID;

    const statusTag = `<span class="tag ${statusTagClass(complaint.status)}">${complaint.status}</span>`;

    card.innerHTML = `
        <div class="order-card__head">
            <div>
                <div class="order-card__title">${complaint.stallName}</div>
                <div class="order-card__meta">${complaint.category} · Filed ${formatDate(complaint.createdAt)}</div>
            </div>
            ${statusTag}
        </div>
        <p class="order-card__meta">${complaint.description}</p>
        ${complaint.resolvedAt ? `<div class="order-card__meta">Resolved ${formatDate(complaint.resolvedAt)}</div>` : ""}
    `;
    return card;
}

function renderComplaints(complaints) {
    const results = $("#complaint-results");
    results.innerHTML = "";
    if (!complaints || complaints.length === 0) {
        results.innerHTML = `<div class="empty">You haven't filed any complaints yet.</div>`;
        return;
    }
    for (const complaint of complaints) {
        results.appendChild(renderComplaint(complaint));
    }
}

async function loadMyComplaints() {
    const msg = $("#list-message");
    clearMessage(msg);
    try {
        const complaints = await api("/complaint", { auth: true });
        renderComplaints(complaints);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is customer-only. Check the role, not just for
    // any session, so a logged-in officer or stall owner can't land here.
    if (!isLoggedIn() || getRole() !== "customer") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which customer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
    $("#submit-form").addEventListener("submit", submitComplaint);

    // Run sequentially, not concurrently: both share the back-end's single
    // global mssql connection pool (same note as feedback.js).
    (async () => {
        await loadStalls(["#submit-stall"], (err) => showMessage($("#submit-message"), "error", err.message));
        await loadMyComplaints();
    })();
}

document.addEventListener("DOMContentLoaded", init);