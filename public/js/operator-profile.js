/* ============================================================
   Operator profile page.
   Protected page: no valid session -> redirect to the login page.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/operator-login.html";

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

// If any authed call reports the session is gone (401/403), bring back to login.
function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Profile ---------- */

function renderProfile(account) {
    const results = $("#profile-results");
    results.innerHTML = "";
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
        <div class="item-card__body">
            <img class="session-avatar" style="width:64px;height:64px;margin-bottom:8px;"
                 src="${account.profilePictureURL || DEFAULT_AVATAR}" alt="Profile picture" />
            <div class="item-card__row">
                <span class="item-card__title">${account.firstName} ${account.lastName}</span>
            </div>
            <div class="item-card__meta">Email: ${account.email}</div>
            <div class="item-card__meta">Phone: ${account.phone || "—"}</div>
        </div>
    `;
    results.appendChild(card);
}

/* ---------- Profile picture upload ---------- */

async function handleUploadPicture() {
    const fileInput = $("#picture-input");
    const file = fileInput.files[0];
    const msg = $("#picture-message");
    clearMessage(msg);

    if (!file) {
        showMessage(msg, "error", "Please choose an image first.");
        return;
    }

    const btn = $("#picture-upload-btn");
    btn.disabled = true;

    const formData = new FormData();
    formData.append("image", file);

    try {
        const res = await fetch("/account/picture", {
            method: "PUT",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Upload failed.");

        setPicture(data.profilePictureURL);
        showMessage(msg, "success", data.message || "Profile picture updated.");
        fileInput.value = "";
        loadProfile();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

async function loadProfile() {
    const msg = $("#profile-message");
    clearMessage(msg);
    try {
        const account = await api("/operators/account", { auth: true });
        renderProfile(account);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

function init() {
    if (!isLoggedIn() || getRole() !== "operator") {
        goToLogin();
        return;
    }

    document.body.classList.remove("auth-pending");

    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
    $("#picture-upload-btn").addEventListener("click", handleUploadPicture);

    loadProfile();
}

document.addEventListener("DOMContentLoaded", init);
