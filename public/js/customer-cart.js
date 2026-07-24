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

// Both images are generic/sample QR graphics, not tied to any real account
// or gateway (see credit.html for sources) - no real payment is processed.
const QR_INFO = {
    NETS: { image: "/images/nets-qr.png", alt: "NETS QR code", text: "Tap or scan at the stall's NETS terminal to pay." },
    PayNow: { image: "/images/paynow-qr.png", alt: "Sample PayNow QR code", text: "Scan with your banking app to pay." },
};

function renderCartStall(cart) {
    const section = document.createElement("article");
    section.className = "cart-stall";
    section.dataset.cartId = cart.cartID;
    section.innerHTML = `
        <div class="cart-stall__title">${cart.stallName}</div>
        <div class="cart-stall__items">${cart.items.map(renderCartItemHtml).join("")}</div>
        <div class="cart-stall__footer">
            <span class="cart-stall__subtotal">Subtotal: ${formatCurrency(cart.subtotal)}</span>
            <div class="form-row">
                <select class="input payment-method">
                    ${PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("")}
                </select>
                <button type="button" class="btn btn--primary btn--sm" data-action="checkout">Checkout</button>
            </div>
            <!-- Shown when NETS or PayNow is selected. Cosmetic only - no real payment
                 gateway is integrated (see ticket assumptions: "records the method and
                 status only"), so this doesn't actually charge anyone. -->
            <div class="qr-placeholder" hidden>
                <img class="qr-placeholder__img" src="" alt="" />
                <p class="qr-placeholder__text hint"></p>
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

/* ---------- Payment method (QR placeholder) ---------- */

// NETS/PayNow show a QR placeholder to scan/tap at the stall - Cash is
// settled at the stall directly, so no extra UI.
function handlePaymentMethodChange(event) {
    const select = event.target.closest(".payment-method");
    if (!select) return;
    const stallSection = select.closest(".cart-stall");
    const placeholder = stallSection.querySelector(".qr-placeholder");
    const info = QR_INFO[select.value];

    placeholder.hidden = !info;
    if (!info) {
        placeholder.querySelector(".qr-placeholder__img").removeAttribute("src");
        return;
    }

    placeholder.querySelector(".qr-placeholder__img").src = info.image;
    placeholder.querySelector(".qr-placeholder__img").alt = info.alt;
    placeholder.querySelector(".qr-placeholder__text").textContent = info.text;
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

async function handleCheckout(cartID, paymentMethod) {
    const msg = $("#cart-message");
    clearMessage(msg);
    try {
        const data = await api("/orders", { method: "POST", body: { cartID, paymentMethod }, auth: true });
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

        btn.disabled = true;
        await handleCheckout(Number(stallSection.dataset.cartId), paymentMethod);
        btn.disabled = false;
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
    $("#cart-results").addEventListener("click", handleResultsClick);
    $("#cart-results").addEventListener("change", handlePaymentMethodChange);

    loadCart();
}

document.addEventListener("DOMContentLoaded", init);
