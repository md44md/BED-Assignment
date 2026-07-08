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
}

document.addEventListener("DOMContentLoaded", init);
