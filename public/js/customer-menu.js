/* ============================================================
   Stall Menu — customer-facing menu browsing.
   Protected page: no valid token -> redirect to the login page.
   Reads ?stallID= from the URL (linked from customer-home.html).

   Talks to the back-end API:
     GET  /stalls/:stallID/menu   (public)
     POST /cart/items             (customer only)
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";

/* ---------- Auth guard ---------- */

function goToLogin() {
    clearSession();
    window.location.replace(LOGIN_URL);
}

function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        goToLogin();
        return true;
    }
    return false;
}

/* ---------- Helpers ---------- */

function getStallIdFromUrl() {
    const id = parseInt(new URLSearchParams(window.location.search).get("stallID"), 10);
    return isNaN(id) ? null : id;
}

function isTruthy(flag) {
    return flag === true || flag === 1;
}

/* ---------- Menu rendering ---------- */

function renderItemCard(item) {
    const available = isTruthy(item.isAvailable);

    const card = document.createElement("article");
    card.className = `item-card category--${item.category}` + (available ? "" : " item-card--unavailable");
    card.dataset.itemId = item.menuItemID;

    const availTag = available ? "" : '<span class="tag tag--unavailable">Unavailable</span>';
    const lowStockTag = isTruthy(item.isLowStock) ? '<span class="tag tag--low-stock">Low stock</span>' : "";

    card.innerHTML = `
        <div class="item-card__body">
            <div class="item-card__row">
                <span class="category-tag category--${item.category}">${item.category}</span>
                ${availTag}
                ${lowStockTag}
                <span class="item-card__price">${formatCurrency(item.price)}</span>
            </div>
            <div class="item-card__title">${item.name}</div>
            ${item.description ? `<div class="item-card__desc">${item.description}</div>` : ""}
            <div class="item-card__actions">
                <input type="number" class="input qty-input" min="1" max="99" value="1" ${available ? "" : "disabled"} />
                <button type="button" class="btn btn--primary btn--sm" data-action="add" ${available ? "" : "disabled"}>
                    Add to cart
                </button>
            </div>
        </div>
    `;
    return card;
}

function renderMenu(items) {
    const results = $("#menu-results");
    results.innerHTML = "";
    if (!items || items.length === 0) {
        results.innerHTML = '<div class="empty">This stall has no menu items yet.</div>';
        return;
    }
    for (const item of items) {
        results.appendChild(renderItemCard(item));
    }
}

/* ---------- Load stall + menu ---------- */

async function loadMenu(stallID) {
    const msg = $("#menu-message");
    clearMessage(msg);
    try {
        const data = await api(`/stalls/${stallID}/menu`);
        $("#stall-name").textContent = data.stall.stallName;
        $("#stall-desc").textContent = data.stall.description || "";
        document.title = `HCMS - ${data.stall.stallName} Menu`;
        renderMenu(data.menuItems);
    } catch (err) {
        $("#stall-name").textContent = "Stall not found";
        showMessage(msg, "error", err.message);
    }
}

/* ---------- Add to cart ---------- */

async function handleResultsClick(event) {
    const btn = event.target.closest('button[data-action="add"]');
    if (!btn) return;

    const card = btn.closest(".item-card");
    const menuItemID = Number(card.dataset.itemId);
    const qtyInput = card.querySelector(".qty-input");
    const quantity = Number(qtyInput.value);
    const msg = $("#menu-message");
    clearMessage(msg);

    if (!Number.isInteger(quantity) || quantity < 1) {
        showMessage(msg, "error", "Enter a quantity of at least 1.");
        return;
    }

    btn.disabled = true;
    try {
        await api("/cart/items", { method: "POST", body: { menuItemID, quantity }, auth: true });
        showMessage(msg, "success", "Added to cart.");
        qtyInput.value = 1;
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
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

    const stallID = getStallIdFromUrl();
    if (!stallID) {
        $("#stall-name").textContent = "No stall selected";
        showMessage($("#menu-message"), "error", "Go back to Stalls and pick a stall to view its menu.");
        return;
    }

    $("#menu-results").addEventListener("click", handleResultsClick);
    loadMenu(stallID);
}

document.addEventListener("DOMContentLoaded", init);
