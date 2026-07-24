/* ============================================================
   Reset password — public page, no session required.
   Reads ?token= from the URL (linked from the password-reset email).
   POST /reset-password -> on success, sends the user to log back in.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

function getTokenFromUrl() {
    return new URLSearchParams(window.location.search).get("token");
}

async function handleResetPassword(event) {
    event.preventDefault();
    const token = getTokenFromUrl();
    const password = $("#reset-password").value;
    const confirmPassword = $("#reset-password-confirm").value;
    const msg = $("#reset-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    if (password !== confirmPassword) {
        showMessage(msg, "error", "Passwords do not match.");
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
        const data = await api("/reset-password", {
            method: "POST",
            body: { token, password },
        });
        showMessage(msg, "success", `${data.message} Redirecting you to log in…`);
        $("#reset-form").hidden = true;
        setTimeout(() => {
            window.location.href = "/select-role.html";
        }, 2500);
    } catch (err) {
        showMessage(msg, "error", err.message);
        if (submitBtn) submitBtn.disabled = false;
    }
}

function init() {
    if (!getTokenFromUrl()) {
        showMessage(
            $("#reset-message"),
            "error",
            "This reset link is missing its token. Please use the link from your email, or request a new one."
        );
        $("#reset-form").hidden = true;
        return;
    }
    $("#reset-form").addEventListener("submit", handleResetPassword);
}

document.addEventListener("DOMContentLoaded", init);
