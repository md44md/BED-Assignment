/* ============================================================
   Stall feedback page: submit and edit a rating + comment.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";
const LAST_FEEDBACK_ID_KEY = "hcms_last_feedback_id";

/* ---------- Auth guard / logout ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleLogout() {
    clearSession();
    window.location.href = LOGIN_URL;
}

// Cache of the customer's own feedback (loaded from GET /feedback), keyed by
// feedbackID, so selecting a review in the edit dropdown can pre-fill its
// current rating/comments without another round-trip.
let myFeedbackById = new Map();

function formatPrice(amount) {
    return `$${Number(amount).toFixed(2)}`;
}

/* ---------- Load eligible orders (completed + paid) into the select ---------- */

async function loadEligibleOrders() {
    const select = $("#submit-order");
    const msg = $("#submit-message");
    clearMessage(msg);
    select.innerHTML = "";

    try {
        const orders = await api("/orders", { auth: true });
        const eligible = orders.filter(
            (order) => order.status === "completed" && order.paymentStatus === "paid"
        );

        if (eligible.length === 0) {
            select.innerHTML = '<option value="">No completed orders yet</option>';
            select.disabled = true;
            return;
        }

        select.disabled = false;
        for (const order of eligible) {
            const opt = document.createElement("option");
            opt.value = order.orderID;
            opt.textContent = `#${order.orderID} · ${order.stallName} · ${formatPrice(order.totalAmount)} · ${formatDate(order.createdAt)}`;
            select.appendChild(opt);
        }
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

/* ---------- Load the customer's own reviews into the edit select ---------- */

async function loadMyFeedback(preselectId) {
    const select = $("#edit-feedback-id");
    const msg = $("#edit-message");
    clearMessage(msg);
    select.innerHTML = "";
    myFeedbackById = new Map();

    try {
        const feedback = await api("/feedback", { auth: true });

        if (feedback.length === 0) {
            select.innerHTML = '<option value="">No reviews yet</option>';
            select.disabled = true;
            $("#edit-rating").value = "5";
            $("#edit-comments").value = "";
            return;
        }

        select.disabled = false;
        for (const item of feedback) {
            myFeedbackById.set(String(item.feedbackID), item);
            const opt = document.createElement("option");
            opt.value = item.feedbackID;
            opt.textContent = `${item.stallName} · ${item.rating}★ · ${formatDate(item.createdAt)}`;
            select.appendChild(opt);
        }

        const lastFeedbackId = localStorage.getItem(LAST_FEEDBACK_ID_KEY);
        if (preselectId && myFeedbackById.has(String(preselectId))) {
            select.value = String(preselectId);
        } else if (lastFeedbackId && myFeedbackById.has(lastFeedbackId)) {
            select.value = lastFeedbackId;
        }

        fillEditFieldsFromSelection();
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

// Pre-fill the rating/comments fields with the currently selected review's values.
function fillEditFieldsFromSelection() {
    const selected = myFeedbackById.get($("#edit-feedback-id").value);
    if (!selected) return;
    $("#edit-rating").value = selected.rating;
    $("#edit-comments").value = selected.comments || "";
}

/* ---------- Submit feedback ---------- */

async function submitFeedback(event) {
    event.preventDefault();
    const msg = $("#submit-message");
    clearMessage(msg);

    const orderID = Number($("#submit-order").value);
    if (!orderID) {
        showMessage(msg, "error", "Please select a completed order.");
        return;
    }

    const payload = {
        orderID,
        rating: Number($("#submit-rating").value),
        comments: $("#submit-comments").value.trim() || undefined,
    };

    const btn = event.submitter;
    btn.disabled = true;
    try {
        const data = await api("/feedback", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", `${data.message} (Feedback ID: ${data.feedbackID})`);
        localStorage.setItem(LAST_FEEDBACK_ID_KEY, data.feedbackID);
        $("#submit-comments").value = "";
        loadMyFeedback(data.feedbackID);
    } catch (err) {
        showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- Edit feedback ---------- */

async function editFeedback(event) {
    event.preventDefault();
    const msg = $("#edit-message");
    clearMessage(msg);

    const feedbackID = Number($("#edit-feedback-id").value);
    if (!feedbackID) {
        showMessage(msg, "error", "Please select a review to edit.");
        return;
    }

    const payload = {
        feedbackID,
        rating: Number($("#edit-rating").value),
        comments: $("#edit-comments").value.trim() || undefined,
    };

    const btn = event.submitter;
    btn.disabled = true;
    try {
        const data = await api("/feedback/edit", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", data.message || "Review updated successfully.");
        localStorage.setItem(LAST_FEEDBACK_ID_KEY, feedbackID);
        loadMyFeedback(feedbackID);
    } catch (err) {
        showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- Init ---------- */

async function init() {
    // Auth guard: this page is customer-only.
    if (!isLoggedIn() || getRole() !== "customer") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which customer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
    $("#submit-form").addEventListener("submit", submitFeedback);
    $("#edit-form").addEventListener("submit", editFeedback);
    $("#edit-feedback-id").addEventListener("change", fillEditFieldsFromSelection);

    // Run sequentially, not concurrently: both ultimately share the backend's
    // single global mssql connection pool, and firing them at the same time
    // can cause one request's pool.close() to cut off the other mid-query.
    await loadEligibleOrders();
    await loadMyFeedback();
}

document.addEventListener("DOMContentLoaded", init);
