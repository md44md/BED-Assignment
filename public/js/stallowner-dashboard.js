/* ============================================================
   Stall Owner dashboard (hub page).
   Protected page: no valid session -> redirect to the login page.

   For now this page just links out to the other stall owner
   feature pages (e.g. stallowner-items.html for menu management).
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/stallowner-login.html";

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is stall-owner-only.
    if (!isLoggedIn() || getRole() !== "stallOwner") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which stall owner is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
}

document.addEventListener("DOMContentLoaded", init);
