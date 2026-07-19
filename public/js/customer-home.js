/* ============================================================
   Customer home page.
   Protected page: no valid session -> redirect to the login page.
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

/* ---------- Stall browsing ---------- */

function renderStallGrid(stallList) {
    const grid = $("#stall-grid");
    grid.innerHTML = "";
    if (!stallList || stallList.length === 0) {
        grid.innerHTML = '<div class="empty">No stalls are available right now.</div>';
        return;
    }
    for (const stall of stallList) {
        const card = document.createElement("a");
        card.className = "home-card";
        card.href = `/customer-menu.html?stallID=${stall.stallID}`;
        card.innerHTML = `
            <span class="home-card__badge home-card__badge--placeholder" aria-hidden="true"></span>
            <span class="home-card__title">${stall.stallName}</span>
            <span class="home-card__desc">${stall.centreName || ""} · Unit ${stall.unitNumber}</span>
            <span class="home-card__cta">View menu →</span>
        `;
        grid.appendChild(card);
    }
}

async function loadStallGrid() {
    const msg = $("#home-message");
    clearMessage(msg);
    const stallList = await loadStalls([], (err) => showMessage(msg, "error", err.message));
    renderStallGrid(stallList);
}

/* ---------- My profile ---------- */

function renderProfile(account) {
    const results = $("#profile-results");
    results.innerHTML = "";
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
        <div class="item-card__body">
            <div class="item-card__row">
                <span class="item-card__title">${account.firstName} ${account.lastName}</span>
                ${account.isVerified ? '<span class="tag tag--available">Verified</span>' : '<span class="tag tag--unavailable">Not verified</span>'}
            </div>
            <div class="item-card__meta">Email: ${account.email}</div>
            <div class="item-card__meta">Phone: ${account.phone || "—"}</div>
        </div>
    `;
    results.appendChild(card);
}

async function loadProfile() {
    const msg = $("#profile-message");
    clearMessage(msg);
    try {
        const account = await api("/customers/account", { auth: true });
        renderProfile(account);
    } catch (err) {
        if (!goToLoginIfAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

// If the token is stale (e.g. account was deleted elsewhere), bounce to login.
function goToLoginIfAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Delete account ---------- */

async function handleDeleteAccount() {
    const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
    if (!confirmed) return;

    const msg = $("#delete-account-message");
    clearMessage(msg);
    const btn = $("#delete-account-btn");
    btn.disabled = true;
    try {
        const data = await api("/customers/account", { method: "DELETE", auth: true });
        showMessage(msg, "success", data.message || "Account deleted successfully.");
        setTimeout(() => {
            clearSession();
            window.location.href = LOGIN_URL;
        }, 1500);
    } catch (err) {
        showMessage(msg, "error", err.message);
        btn.disabled = false;
    }
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is customer-only. A logged-in officer or stall
    // owner must not land here, so check the role, not just for any session.
    if (!isLoggedIn() || getRole() !== "customer") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which customer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    // Wire up actions.
    $("#logout-btn").addEventListener("click", handleLogout);
    $("#delete-account-btn").addEventListener("click", handleDeleteAccount);

    loadStallGrid();
    loadProfile();
}

document.addEventListener("DOMContentLoaded", init);
