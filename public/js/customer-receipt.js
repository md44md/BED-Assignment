/* ============================================================
   Receipt — itemized breakdown of a single past order, so a customer can
   review their spending or split the bill with friends.
   Protected page: no valid customer session -> redirect to login.
   Reads ?orderID= from the URL (linked from customer-orders.js).

   Talks to the back-end API (needs a customer JWT):
     GET /orders/:orderID/receipt
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

function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleString("en-SG", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function getOrderIdFromUrl() {
    const id = parseInt(new URLSearchParams(window.location.search).get("orderID"), 10);
    return isNaN(id) ? null : id;
}

/* ---------- Rendering ---------- */

function renderLineItemHtml(item) {
    return `
        <div class="cart-item">
            <div class="cart-item__body">
                <div class="cart-item__title">${item.itemName}</div>
                <div class="cart-item__meta">
                    ${formatCurrency(item.unitPrice)} × ${item.quantity}${item.addons ? ` · "${item.addons}"` : ""}
                </div>
            </div>
            <span class="cart-item__price">${formatCurrency(item.itemTotal)}</span>
        </div>
    `;
}

function renderReceipt(receipt) {
    const results = $("#receipt-results");

    const addonsSection = receipt.addons.length > 0 ? `
        <div class="panel__head panel__head--sub">
            <h3 class="panel__title panel__title--sm">Add-ons</h3>
        </div>
        <div class="cart-stall__items">${receipt.addons.map(renderLineItemHtml).join("")}</div>
    ` : "";

    results.innerHTML = `
        <article class="order-card">
            <div class="order-card__head">
                <div>
                    <div class="order-card__title">${receipt.stallName}</div>
                    <div class="order-card__meta">
                        Order #${receipt.orderID} · ${formatDateTime(receipt.createdAt)} · Queue ${receipt.queueNumber}
                    </div>
                </div>
                <span class="tag tag--historical">${receipt.status}</span>
            </div>

            <div class="panel__head panel__head--sub">
                <h3 class="panel__title panel__title--sm">Items</h3>
            </div>
            <div class="cart-stall__items">${receipt.items.map(renderLineItemHtml).join("")}</div>

            ${addonsSection}

            <div class="order-summary">
                <div class="order-summary__row"><span>Base items</span><span>${formatCurrency(receipt.baseItemsTotal)}</span></div>
                ${receipt.addons.length > 0 ? `<div class="order-summary__row"><span>Add-ons</span><span>${formatCurrency(receipt.addonsTotal)}</span></div>` : ""}
                ${Number(receipt.packagingFee) > 0 ? `<div class="order-summary__row"><span>Packaging</span><span>${formatCurrency(receipt.packagingFee)}</span></div>` : ""}
                <div class="order-summary__row"><span>GST</span><span>${formatCurrency(receipt.gstAmount)}</span></div>
                <div class="order-summary__row order-summary__row--total"><span>Total</span><span>${formatCurrency(receipt.totalAmount)}</span></div>
                <div class="order-card__meta">Paid by ${receipt.paymentMethod} · Payment ${receipt.paymentStatus}</div>
            </div>
        </article>

        <section class="panel" aria-labelledby="split-heading">
            <div class="panel__head">
                <h3 id="split-heading" class="panel__title panel__title--sm">Split the bill</h3>
                <p class="panel__lead">Enter how many people are sharing this order to see what each person owes.</p>
            </div>
            <div class="form-row">
                <input id="split-count" type="number" class="input" min="1" max="99" value="1" />
                <span id="split-result" class="order-summary__row--total"></span>
            </div>
        </section>
    `;

    const splitInput = $("#split-count");
    const splitResult = $("#split-result");
    const updateSplit = () => {
        const count = Math.max(1, parseInt(splitInput.value, 10) || 1);
        splitResult.textContent = `${formatCurrency(receipt.totalAmount / count)} per person`;
    };
    splitInput.addEventListener("input", updateSplit);
    updateSplit();
}

/* ---------- Load receipt ---------- */

async function loadReceipt(orderID) {
    const msg = $("#receipt-message");
    clearMessage(msg);
    try {
        const receipt = await api(`/orders/${orderID}/receipt`, { auth: true });
        renderReceipt(receipt);
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

    const orderID = getOrderIdFromUrl();
    if (!orderID) {
        showMessage($("#receipt-message"), "error", "No order selected. Go back to My Orders and pick an order to view its receipt.");
        return;
    }

    loadReceipt(orderID);
}

document.addEventListener("DOMContentLoaded", init);
