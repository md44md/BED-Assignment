/* ============================================================
   Stall owner sign up page.
   POST /stallowners/register -> show success -> send to login page.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/stallowner-login.html";

async function handleSignup(event) {
    event.preventDefault();
    const email = $("#signup-email").value.trim();
    const firstName = $("#signup-firstname").value.trim();
    const lastName = $("#signup-lastname").value.trim();
    const phone = $("#signup-phone").value.trim();
    const password = $("#signup-password").value;
    const confirmPassword = $("#signup-confirm-password").value;
    const msg = $("#signup-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    // Checked client-side only; the server does not receive confirmPassword.
    if (password !== confirmPassword) {
        showMessage(msg, "error", "Passwords do not match.");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
        const data = await api("/stallowners/register", {
            method: "POST",
            body: { email, password, firstName, lastName, phone: phone || undefined },
        });
        showMessage(msg, "success", data.message || "Account registered successfully. Redirecting to login...");
        $("#signup-form").reset();
        setTimeout(() => {
            window.location.href = LOGIN_URL;
        }, 1500);
    } catch (err) {
        showMessage(msg, "error", err.message);
        if (submitBtn) submitBtn.disabled = false;
    }
}

function init() {
    // Already logged in? No need to sign up again.
    if (isLoggedIn()) {
        window.location.replace("/stallowner-dashboard.html");
        return;
    }
    $("#signup-form").addEventListener("submit", handleSignup);
}

document.addEventListener("DOMContentLoaded", init);