/* ============================================================
   Forgot password — public page, no session required.
   POST /forgot-password -> always shows the same generic message, so this
   page can't be used to check whether an email is registered.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = $("#forgot-email").value.trim();
    const msg = $("#forgot-message");
    const submitBtn = event.submitter;
    clearMessage(msg);

    if (submitBtn) submitBtn.disabled = true;
    try {
        const data = await api("/forgot-password", {
            method: "POST",
            body: { email },
        });
        showMessage(msg, "success", data.message);
    } catch (err) {
        showMessage(msg, "error", err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function init() {
    $("#forgot-form").addEventListener("submit", handleForgotPassword);
}

document.addEventListener("DOMContentLoaded", init);
