/* ============================================================
   Stall Owner console (dashboard).
   Protected page: no valid session -> redirect to the login page.

   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/stallowner-login.html";
const CATEGORIES = ["main", "drink", "dessert", "snack", "add-on"];

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

/* ---------- Tab switching ---------- */

function handleTabClick(event) {
    const tab = event.target.closest(".tab");
    if (!tab) return;
    const target = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
    });
    $("#menu-tab").hidden = target !== "menu";
    $("#rentals-tab").hidden = target !== "rentals";
    $("#complaints-tab").hidden = target !== "complaints";
    $("#analytics-tab").hidden = target !== "analytics";
    if (target === "menu") loadMenuItems();
    if (target === "rentals") loadRentalAgreements();
}

/* ---------- Small helpers specific to menu items ---------- */

function isTruthy(flag) {
    return flag === true || flag === 1;
}

// Days between today and a date string (positive = still in the future).
function daysUntil(dateStr) {
    const target = new Date(dateStr);
    const today = new Date(new Date().toDateString());
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/* ---------- Menu item rendering ---------- */

function renderItemCard(item) {
    const available = isTruthy(item.isAvailable);
    const lowStock = isTruthy(item.isLowStock);

    const card = document.createElement("article");
    card.className = `item-card category--${item.category}` + (available ? "" : " item-card--unavailable");
    card.dataset.itemId = item.menuItemID;

    const availTag = available
        ? '<span class="tag tag--available">Available</span>'
        : '<span class="tag tag--unavailable">Unavailable</span>';
    const lowStockTag = lowStock ? '<span class="tag tag--low-stock">Low stock</span>' : "";

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
            <div class="item-card__meta">Menu item ID ${item.menuItemID}</div>
            <div class="item-card__actions" data-view="display">
                <button type="button" class="btn btn--secondary btn--sm" data-action="edit">Edit</button>
                <button type="button" class="btn btn--secondary btn--sm" data-action="toggle-availability">
                    Mark ${available ? "unavailable" : "available"}
                </button>
                <button type="button" class="btn btn--danger btn--sm" data-action="delete">Delete</button>
            </div>
        </div>
    `;
    return card;
}

function renderItemList(items) {
    const results = $("#menu-results");
    results.innerHTML = "";
    if (!items || items.length === 0) {
        results.innerHTML = '<div class="empty">No menu items yet. Add your first one above.</div>';
        return;
    }
    for (const item of items) {
        results.appendChild(renderItemCard(item));
    }
}

/* ---------- Load menu items ---------- */

async function loadMenuItems() {
    const msg = $("#menu-message");
    clearMessage(msg);
    try {
        const items = await api("/menuitems", { auth: true });
        renderItemList(items);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Add item ---------- */

async function handleAdd(event) {
    event.preventDefault();
    const msg = $("#add-message");
    clearMessage(msg);

    const payload = {
        name: $("#add-name").value.trim(),
        description: $("#add-description").value.trim(),
        price: Number($("#add-price").value),
        category: $("#add-category").value,
    };

    const submitBtn = event.submitter;
    submitBtn.disabled = true;
    try {
        await api("/menuitems", { method: "POST", body: payload, auth: true });
        showMessage(msg, "success", "Menu item added.");
        $("#add-form").reset();
        $("#add-category").value = "main";
        loadMenuItems();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

/* ---------- Edit / delete / toggle-availability ---------- */

function showEditForm(card, item) {
    const body = card.querySelector(".item-card__body");
    const existingForm = body.querySelector(".item-edit-form");
    if (existingForm) return; // already editing

    const form = document.createElement("form");
    form.className = "item-edit-form";
    form.innerHTML = `
        <div class="field">
            <label class="field__label" for="edit-name-${item.menuItemID}">Name</label>
            <input id="edit-name-${item.menuItemID}" class="input" type="text" maxlength="255"
                   value="${item.name.replace(/"/g, "&quot;")}" required />
        </div>
        <div class="field">
            <label class="field__label" for="edit-price-${item.menuItemID}">Price ($)</label>
            <input id="edit-price-${item.menuItemID}" class="input" type="number" min="0.01" step="0.01"
                   value="${item.price}" required />
        </div>
        <div class="field">
            <label class="field__label" for="edit-category-${item.menuItemID}">Category</label>
            <select id="edit-category-${item.menuItemID}" class="input" required>
                ${CATEGORIES.map((c) => `<option value="${c}" ${c === item.category ? "selected" : ""}>${c}</option>`).join("")}
            </select>
        </div>
        <div class="field checkbox-field">
            <input id="edit-available-${item.menuItemID}" type="checkbox" ${isTruthy(item.isAvailable) ? "checked" : ""} />
            <label for="edit-available-${item.menuItemID}">Available to order</label>
        </div>
        <div class="field field--full">
            <label class="field__label" for="edit-desc-${item.menuItemID}">Description</label>
            <input id="edit-desc-${item.menuItemID}" class="input" type="text" maxlength="1000"
                   value="${(item.description || "").replace(/"/g, "&quot;")}" />
        </div>
        <div class="item-edit-form__actions">
            <button type="submit" class="btn btn--primary btn--sm">Save</button>
            <button type="button" class="btn btn--secondary btn--sm" data-action="cancel-edit">Cancel</button>
        </div>
    `;

    card.querySelector('[data-view="display"]').hidden = true;
    body.appendChild(form);
    form.addEventListener("submit", (event) => handleSaveEdit(event, item.menuItemID));
}

function closeEditForm(card) {
    const form = card.querySelector(".item-edit-form");
    if (form) form.remove();
    const display = card.querySelector('[data-view="display"]');
    if (display) display.hidden = false;
}

async function handleSaveEdit(event, menuItemID) {
    event.preventDefault();
    const msg = $("#menu-message");
    clearMessage(msg);

    const payload = {
        name: $(`#edit-name-${menuItemID}`).value.trim(),
        description: $(`#edit-desc-${menuItemID}`).value.trim(),
        price: Number($(`#edit-price-${menuItemID}`).value),
        category: $(`#edit-category-${menuItemID}`).value,
        isAvailable: $(`#edit-available-${menuItemID}`).checked,
    };

    const submitBtn = event.submitter;
    submitBtn.disabled = true;
    try {
        await api(`/menuitems/${menuItemID}`, { method: "PUT", body: payload, auth: true });
        showMessage(msg, "success", "Menu item updated.");
        loadMenuItems();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleToggleAvailability(card, menuItemID) {
    const msg = $("#menu-message");
    clearMessage(msg);

    const currentlyAvailable = !card.classList.contains("item-card--unavailable");
    const name = card.querySelector(".item-card__title").textContent;
    const priceText = card.querySelector(".item-card__price").textContent.replace("$", "");
    const category = [...card.classList].find((c) => c.startsWith("category--") && c !== "category-tag").replace("category--", "");
    const descEl = card.querySelector(".item-card__desc");

    const payload = {
        name,
        description: descEl ? descEl.textContent : "",
        price: Number(priceText),
        category,
        isAvailable: !currentlyAvailable,
    };

    try {
        await api(`/menuitems/${menuItemID}`, { method: "PUT", body: payload, auth: true });
        loadMenuItems();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleDelete(menuItemID) {
    const ok = window.confirm(`Delete menu item ID ${menuItemID}? This cannot be undone.`);
    if (!ok) return;
    const msg = $("#menu-message");
    clearMessage(msg);

    try {
        const data = await api(`/menuitems/${menuItemID}`, { method: "DELETE", auth: true });
        showMessage(msg, "success", data.message || "Menu item deleted.");
        loadMenuItems();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleResultsClick(event) {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".item-card");
    const menuItemID = Number(card.dataset.itemId);

    if (btn.dataset.action === "edit") {
        const item = {
            menuItemID,
            name: card.querySelector(".item-card__title").textContent,
            description: card.querySelector(".item-card__desc")?.textContent || "",
            price: card.querySelector(".item-card__price").textContent.replace("$", ""),
            category: [...card.classList].find((c) => c.startsWith("category--") && c !== "category-tag").replace("category--", ""),
            isAvailable: !card.classList.contains("item-card--unavailable"),
        };
        showEditForm(card, item);
    }

    if (btn.dataset.action === "cancel-edit") {
        closeEditForm(card);
    }

    if (btn.dataset.action === "toggle-availability") {
        btn.disabled = true;
        await handleToggleAvailability(card, menuItemID);
        btn.disabled = false;
    }

    if (btn.dataset.action === "delete") {
        btn.disabled = true;
        await handleDelete(menuItemID);
        btn.disabled = false;
    }
}

/* ---------- Rental Agreements ---------- */
const EXPIRY_WARNING_DAYS = 30; // flag leases ending within this many days

// Build one rental agreement card reusing item card styles
function renderRentalCard(agreement) {
    const daysLeft = daysUntil(agreement.endDate);
    const expiringSoon = daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS;

    let tag;
    if (daysLeft < 0) tag = '<span class="tag tag--expired">Overdue for renewal</span>';
    else if (expiringSoon) tag = `<span class="tag tag--expired">Expiring in ${daysLeft}d</span>`;
    else tag = '<span class="tag tag--current">Active</span>';

    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
        <div class="item-card__body">
            <div class="item-card__row">
                <span class="item-card__title">${agreement.stallName} (${agreement.unitNumber})</span>
                ${tag}
            </div>
            <div class="item-card__meta">${agreement.centreName} · ${agreement.centreAddress}</div>
            <div class="item-card__meta">
                Lease: ${formatDate(agreement.startDate)} – ${formatDate(agreement.endDate)} · ${formatCurrency(agreement.monthlyRent)}/month
            </div>
            <div class="item-card__meta">Agreement ID ${agreement.agreementID}</div>
        </div>
    `;
    return card;
}

function renderRentalList(container, agreements) {
    container.innerHTML = "";
    if (!agreements || agreements.length === 0) {
        container.innerHTML = `<div class="empty">No active rental agreement on file yet. Contact your hawker centre operator if this looks wrong.</div>`;
        return;
    }
    for (const agreement of agreements) {
        container.appendChild(renderRentalCard(agreement));
    }
}

async function loadRentalAgreements() {
    const msg = $("#rentals-message");
    const results = $("#rentals-results");
    clearMessage(msg);
    try {
        const data = await api("/rental-agreements", { auth: true });
        renderRentalList(results, data.rentalAgreements);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is stall-owner-only.
    if (!isLoggedIn() || getRole() !== "stallOwner") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which stall owner is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    // Set up tab switching
    document.querySelector(".tabs").addEventListener("click", handleTabClick);

    // Set up menu items functionality
    $("#add-form").addEventListener("submit", handleAdd);
    $("#refresh-btn").addEventListener("click", loadMenuItems);
    $("#menu-results").addEventListener("click", handleResultsClick);
    $("#rentals-refresh-btn").addEventListener("click", loadRentalAgreements);
    
    $("#logout-btn").addEventListener("click", handleLogout);

    // Load menu items for the default tab
    loadMenuItems();
}

document.addEventListener("DOMContentLoaded", init);
