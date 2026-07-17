/* ============================================================
   My Cart — customer-facing cart review + checkout.
   Protected page: no valid token -> redirect to the login page.

   Talks to the back-end API (all routes need a JWT):
     GET    /cart                  — one entry per stall the customer has a cart for
     DELETE /cart/items/:id        — remove a single item
     POST   /orders                — checkout a stall's cart
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";
const PAYMENT_METHODS = ["Cash", "NETS", "PayNow"];

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

/* ---------- Cart rendering ---------- */

function renderCartItemHtml(item) {
    return `
        <div class="cart-item" data-cart-item-id="${item.cartItemID}">
            <div class="cart-item__body">
                <div class="cart-item__title">${item.name}</div>
                <div class="cart-item__meta">
                    ${formatCurrency(item.price)} × ${item.quantity}${item.notes ? ` · "${item.notes}"` : ""}
                </div>
            </div>
            <span class="cart-item__price">${formatCurrency(item.price * item.quantity)}</span>
            <button type="button" class="btn btn--danger btn--sm" data-action="remove">Remove</button>
        </div>
    `;
}

// GST is charged at 9% of the subtotal (matches the backend calculation in
// controllers/orderController.js) so the customer sees the real total before checkout.
const GST_RATE = 0.09;

function renderCartStall(cart) {
    const gstAmount = Math.round(cart.subtotal * GST_RATE * 100) / 100;
    const totalAmount = Math.round((cart.subtotal + gstAmount) * 100) / 100;

    const section = document.createElement("article");
    section.className = "cart-stall";
    section.dataset.cartId = cart.cartID;
    section.innerHTML = `
        <div class="cart-stall__title">${cart.stallName}</div>
        <div class="cart-stall__items">${cart.items.map(renderCartItemHtml).join("")}</div>
        <div class="order-summary">
            <div class="order-summary__row"><span>Subtotal</span><span>${formatCurrency(cart.subtotal)}</span></div>
            <div class="order-summary__row"><span>GST (9%)</span><span>${formatCurrency(gstAmount)}</span></div>
            <div class="order-summary__row order-summary__row--total"><span>Total</span><span>${formatCurrency(totalAmount)}</span></div>
        </div>
        <div class="cart-stall__footer">
            <div class="form-row">
                <select class="input payment-method">
                    ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
                </select>
                <button type="button" class="btn btn--primary btn--sm" data-action="checkout">Checkout</button>
            </div>
            <div class="form-grid nets-billing" hidden>
                <div class="field">
                    <label class="field__label">Card number</label>
                    <input type="text" class="input nets-card-number" placeholder="1234 5678 9012 3456" maxlength="19" inputmode="numeric" autocomplete="cc-number" />
                </div>
                <div class="field">
                    <label class="field__label">Expiry (MM/YY)</label>
                    <input type="text" class="input nets-card-expiry" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp" />
                </div>
                <div class="field">
                    <label class="field__label">CVV</label>
                    <input type="text" class="input nets-card-cvv" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="cc-csc" />
                </div>
                <div class="field field--full">
                    <label class="field__label">Cardholder name</label>
                    <input type="text" class="input nets-card-name" placeholder="Name on card" autocomplete="cc-name" />
                </div>
            </div>
        </div>
    `;
    return section;
}

function renderCarts(carts) {
    const results = $("#cart-results");
    results.innerHTML = "";
    if (!carts || carts.length === 0) {
        results.innerHTML = `
            <div class="empty">
                Your cart is empty. <a href="/customer-home.html">Browse stalls</a> to add something.
            </div>
        `;
        return;
    }
    for (const cart of carts) {
        results.appendChild(renderCartStall(cart));
    }
}

/* ---------- Load cart ---------- */

// Fetch + render only — never touches #cart-message, so callers can show
// their own success message without it being wiped by a refresh right after.
async function loadCart() {
    try {
        const data = await api("/cart", { auth: true });
        renderCarts(data.carts);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage($("#cart-message"), "error", err.message);
    }
}

/* ---------- Payment method (NETS card details) ---------- */

// NETS is an online card payment, so it needs card details up front — the
// other methods (Cash, PayNow) are settled at the stall, so no extra fields.
function handlePaymentMethodChange(event) {
    const select = event.target.closest(".payment-method");
    if (!select) return;
    const stallSection = select.closest(".cart-stall");
    stallSection.querySelector(".nets-billing").hidden = select.value !== "NETS";
}

// Reads + validates the NETS card fields for one stall's checkout.
// Returns the billing info object, or null (after showing an error) if invalid.
function readNetsBillingInfo(stallSection) {
    const msg = $("#cart-message");
    const cardNumber = stallSection.querySelector(".nets-card-number").value.replace(/\s+/g, "");
    const expiryDate = stallSection.querySelector(".nets-card-expiry").value.trim();
    const cvv = stallSection.querySelector(".nets-card-cvv").value.trim();
    const cardHolderName = stallSection.querySelector(".nets-card-name").value.trim();

    if (!/^\d{16}$/.test(cardNumber)) {
        showMessage(msg, "error", "NETS card number must be 16 digits.");
        return null;
    }

    const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiryDate);
    if (!expiryMatch) {
        showMessage(msg, "error", "NETS card expiry must be in MM/YY format.");
        return null;
    }
    const expiry = new Date(2000 + Number(expiryMatch[2]), Number(expiryMatch[1]), 1);
    if (expiry <= new Date()) {
        showMessage(msg, "error", "NETS card has expired.");
        return null;
    }

    if (!/^\d{3,4}$/.test(cvv)) {
        showMessage(msg, "error", "NETS CVV must be 3 or 4 digits.");
        return null;
    }

    if (cardHolderName.length < 2) {
        showMessage(msg, "error", "Cardholder name is required.");
        return null;
    }

    return { cardNumber, expiryDate, cvv, cardHolderName };
}

/* ---------- Remove item / checkout (delegated) ---------- */

async function handleRemove(cartItemID) {
    const msg = $("#cart-message");
    clearMessage(msg);
    try {
        await api(`/cart/items/${cartItemID}`, { method: "DELETE", auth: true });
        await loadCart();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleCheckout(cartID, paymentMethod, billingInfo) {
    const msg = $("#cart-message");
    clearMessage(msg);
    try {
        const body = { cartID, paymentMethod };
        if (billingInfo) body.billingInfo = billingInfo;
        const data = await api("/orders", { method: "POST", body, auth: true });
        await loadCart();
        showMessage(
            msg,
            "success",
            `Order placed! Queue number ${data.queueNumber} · Total ${formatCurrency(data.totalAmount)}.`
        );
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleResultsClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    if (btn.dataset.action === "remove") {
        const item = btn.closest(".cart-item");
        btn.disabled = true;
        await handleRemove(Number(item.dataset.cartItemId));
    }

    if (btn.dataset.action === "checkout") {
        const stallSection = btn.closest(".cart-stall");
        const paymentMethod = stallSection.querySelector(".payment-method").value;

        let billingInfo;
        if (paymentMethod === "NETS") {
            billingInfo = readNetsBillingInfo(stallSection);
            if (!billingInfo) return;
        }

        btn.disabled = true;
        await handleCheckout(Number(stallSection.dataset.cartId), paymentMethod, billingInfo);
        btn.disabled = false;
    }
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is customer-only.
    if (!isLoggedIn()) {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which customer is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    $("#logout-btn").addEventListener("click", handleLogout);
    $("#cart-results").addEventListener("click", handleResultsClick);
    $("#cart-results").addEventListener("change", handlePaymentMethodChange);

    loadCart();
}

document.addEventListener("DOMContentLoaded", init);
