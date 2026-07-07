/* ============================================================
   Stall owner login page.
   POST /stallowner/login -> store JWT -> go to the dashboard.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const DASHBOARD_URL = "/stallowner-dashboard.html";

async function handleLogin(event) {
    event.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const msg = $("#login-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    if (submitBtn) submitBtn.disabled = true;
    try {
        const data = await api("/stallowners/login", {
            method: "POST",
            body: { email, password },
        });
        // Pass the role so any page can read getRole(); the server still
        // enforces authorisation from the JWT regardless.
        saveSession(data.token, email, "stallOwner");
        // Straight to the console after authentication.
        window.location.href = DASHBOARD_URL;
    } catch (err) {
        showMessage(msg, "error", err.message);
        if (submitBtn) submitBtn.disabled = false;
    }
}

function init() {
    // Already logged in? Skip the form and go to the dashboard.
    if (isLoggedIn()) {
        window.location.replace(DASHBOARD_URL);
        return;
    }
    $("#login-form").addEventListener("submit", handleLogin);
}

document.addEventListener("DOMContentLoaded", init);
