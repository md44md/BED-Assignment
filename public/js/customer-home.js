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

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is customer-only.
    if (!isLoggedIn()) {
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

    loadStallGrid();
}

document.addEventListener("DOMContentLoaded", init);
