/* ============================================================
   My Orders — customer-facing list of past orders.
   Protected page: no valid customer session -> redirect to login.

   Talks to the back-end API (needs a customer JWT):
     GET /orders   — this customer's orders, newest first, each with its items
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

function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Formatting ---------- */

// Orders happen at a point in time, so show the time alongside the date
// (common.js formatDate is date-only and used elsewhere for validity ranges).
function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleString("en-SG", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// Map an order status to one of the shared tag colour variants.
function statusTagClass(status) {
    switch (String(status).toLowerCase()) {
        case "completed":
        case "ready":
            return "tag--current";      // green
        case "cancelled":
            return "tag--expired";       // red
        default:                         // pending, preparing, etc.
            return "tag--historical";    // neutral
    }
}

/* ---------- Rendering ---------- */

function renderOrderItemHtml(item) {
    const lineTotal = item.itemTotal != null ? item.itemTotal : item.unitPrice * item.quantity;
    return `
        <div class="cart-item">
            <div class="cart-item__body">
                <div class="cart-item__title">${item.itemName}</div>
                <div class="cart-item__meta">
                    ${formatCurrency(item.unitPrice)} × ${item.quantity}${item.addons ? ` · "${item.addons}"` : ""}
                </div>
            </div>
            <span class="cart-item__price">${formatCurrency(lineTotal)}</span>
        </div>
    `;
}

function renderOrder(order) {
    const card = document.createElement("article");
    card.className = "order-card";
    card.dataset.orderId = order.orderID;

    const statusTag = `<span class="tag ${statusTagClass(order.status)}">${order.status}</span>`;

    card.innerHTML = `
        <div class="order-card__head">
            <div>
                <div class="order-card__title">${order.stallName}</div>
                <div class="order-card__meta">
                    Order #${order.orderID} · ${formatDateTime(order.createdAt)} · Queue ${order.queueNumber}
                </div>
            </div>
            ${statusTag}
        </div>

        <div class="cart-stall__items">${order.items.map(renderOrderItemHtml).join("")}</div>

        <div class="order-summary">
            <div class="order-summary__row"><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
            ${Number(order.packagingFee) > 0 ? `<div class="order-summary__row"><span>Packaging</span><span>${formatCurrency(order.packagingFee)}</span></div>` : ""}
            <div class="order-summary__row"><span>GST</span><span>${formatCurrency(order.gstAmount)}</span></div>
            <div class="order-summary__row order-summary__row--total"><span>Total</span><span>${formatCurrency(order.totalAmount)}</span></div>
            <div class="order-card__meta">Paid by ${order.paymentMethod} · Payment ${order.paymentStatus}</div>
        </div>

        <div class="order-card__meta" style="margin-top: 12px;">
            <a class="btn btn--secondary btn--sm" href="/customer-receipt.html?orderID=${order.orderID}">View Receipt</a>
        </div>
    `;
    return card;
}

function renderOrders(orders) {
    const results = $("#orders-results");
    results.innerHTML = "";
    if (!orders || orders.length === 0) {
        results.innerHTML = `
            <div class="empty">
                You haven't placed any orders yet. <a href="/customer-home.html">Browse stalls</a> to get started.
            </div>
        `;
        return;
    }
    for (const order of orders) {
        results.appendChild(renderOrder(order));
    }
}

/* ---------- Load orders ---------- */

async function loadOrders() {
    const msg = $("#orders-message");
    clearMessage(msg);
    try {
        const orders = await api("/orders", { auth: true });
        renderOrders(orders);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

function init() {
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

    loadOrders();
}

document.addEventListener("DOMContentLoaded", init);
