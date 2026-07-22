/* ============================================================
   Customer login page.
   POST /customers/login -> store JWT -> go to the customer home page.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const HOME_URL = "/customer-home.html";

async function handleLogin(event) {
    event.preventDefault();
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;
    const msg = $("#login-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    if (submitBtn) submitBtn.disabled = true;
    try {
        const data = await api("/customers/login", {
            method: "POST",
            body: { email, password },
        });
        // Pass the role so any page can read getRole(); the server still
        // enforces authorisation from the JWT regardless.
        saveSession(data.token, email, "customer", data.profilePictureURL);
        window.location.href = HOME_URL;
    } catch (err) {
        showMessage(msg, "error", err.message);
        if (submitBtn) submitBtn.disabled = false;
    }
}

function init() {
    // Already logged in? Skip the form and go straight home.
    if (isLoggedIn()) {
        window.location.replace(HOME_URL);
        return;
    }
    $("#login-form").addEventListener("submit", handleLogin);
}

document.addEventListener("DOMContentLoaded", init);
