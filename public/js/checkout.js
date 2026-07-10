/* ============================================================
   Checkout page: submit cart as order, payment method, queue number.
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

function formatPrice(amount) {
    return `$${Number(amount).toFixed(2)}`;
}

/* ---------- Cart list ---------- */

function renderCarts(carts) {
    const list = $("#cart-list");
    list.innerHTML = "";

    if (!carts || carts.length === 0) {
        list.innerHTML = '<div class="empty">Your cart is empty. Add items to a stall\'s menu first.</div>';
        return;
    }

    for (const cart of carts) {
        const card = document.createElement("article");
        card.className = "item-card";

        const itemLines = cart.items
            .map((item) => `<div>${item.quantity} × ${item.name} — ${formatPrice(item.price * item.quantity)}</div>`)
            .join("");

        card.innerHTML = `
            <div class="item-card__body">
                <label class="item-card__row" style="cursor:pointer;">
                    <input type="radio" name="selected-cart" value="${cart.cartID}" />
                    <span class="item-card__title">${cart.stallName}</span>
                    <span class="tag tag--available">Cart #${cart.cartID}</span>
                </label>
                <div class="item-card__meta">${itemLines}</div>
                <div class="item-card__price">Subtotal: ${formatPrice(cart.subtotal)}</div>
            </div>
        `;
        list.appendChild(card);
    }
}

async function loadCart() {
    const msg = $("#cart-message");
    clearMessage(msg);
    try {
        const data = await api("/cart", { auth: true });
        renderCarts(data.carts);
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

/* ---------- Payment method / QR placeholder ---------- */

// Both images are generic/sample QR graphics, not tied to any real account
// or gateway (see credit.html for sources) - no real payment is processed.
const QR_INFO = {
    NETS: { image: "/images/nets-qr.png", alt: "NETS QR code", text: "Tap or scan at the stall's NETS terminal to pay." },
    PayNow: { image: "/images/paynow-qr.png", alt: "Sample PayNow QR code", text: "Scan with your banking app to pay." },
};

function handlePaymentMethodChange() {
    const selected = document.querySelector('input[name="payment-method"]:checked');
    const placeholder = $("#qr-placeholder");
    const img = $("#qr-placeholder-img");
    const box = $("#qr-placeholder-box");
    const method = selected ? selected.value : null;
    const info = QR_INFO[method];

    placeholder.hidden = !info;
    if (!info) return;

    img.hidden = !info.image;
    box.hidden = !!info.image;
    box.style.display = box.hidden ? "" : "flex";
    if (info.image) {
        img.src = info.image;
        img.alt = info.alt;
    }
    $("#qr-placeholder-text").textContent = info.text;
}

function getSelectedCartId() {
    const selected = document.querySelector('input[name="selected-cart"]:checked');
    return selected ? Number(selected.value) : null;
}

function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="payment-method"]:checked');
    return selected ? selected.value : null;
}

/* ---------- Submit order ---------- */

function renderConfirmation(order) {
    const results = $("#checkout-confirmation");
    results.innerHTML = `
        <div class="grade-card grade-card--current">
            <div class="grade-badge grade-badge--score">#${order.queueNumber}</div>
            <div class="grade-card__body">
                <div class="grade-card__row">
                    <span class="grade-card__title">Order #${order.orderID} placed</span>
                    <span class="tag tag--current">Queue number ${order.queueNumber}</span>
                </div>
                <div class="grade-card__meta">Total paid: ${formatPrice(order.totalAmount)}</div>
            </div>
        </div>
    `;
}

async function submitOrder(event) {
    event.preventDefault();
    const msg = $("#checkout-message");
    clearMessage(msg);
    $("#checkout-confirmation").innerHTML = "";

    const cartID = getSelectedCartId();
    if (!cartID) {
        showMessage(msg, "error", "Please select a cart to check out.");
        return;
    }

    const paymentMethod = getSelectedPaymentMethod();
    if (!paymentMethod) {
        showMessage(msg, "error", "Please choose a payment method.");
        return;
    }

    const payload = { cartID, paymentMethod };

    const btn = event.submitter;
    btn.disabled = true;
    try {
        const data = await api("/orders", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", data.message || "Order placed successfully.");
        renderConfirmation(data);
        $("#checkout-form").reset();
        handlePaymentMethodChange();
        loadCart();
    } catch (err) {
        showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
    $("#checkout-form").addEventListener("submit", submitOrder);
    document.querySelectorAll('input[name="payment-method"]').forEach((radio) => {
        radio.addEventListener("change", handlePaymentMethodChange);
    });
    loadCart();
});
