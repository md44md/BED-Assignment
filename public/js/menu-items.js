/* ============================================================
   Menu Management — front-end logic
   Talks to the back-end RESTful API:
     GET    /menuitems              (stall owner, auth) — returns a raw array
     POST   /menuitems              (stall owner, auth) — returns the raw new item
     PUT    /menuitems/:id          (stall owner, auth) — returns the raw updated item
     DELETE /menuitems/:id          (stall owner, auth)

   Expects a valid JWT to already be in localStorage under TOKEN_KEY.
   If none is found the user is redirected to the login page.
   ============================================================ */

"use strict";

const TOKEN_KEY = "stall_owner_token";
const EMAIL_KEY = "stall_owner_email";
const LOGIN_PAGE = "/stall-owner-login.html"; // TODO: update this path once login page is built

const CATEGORIES = ["main", "drink", "dessert", "snack", "add-on"];

// Small DOM helper
const $ = (sel) => document.querySelector(sel);

/* ---------- API layer ---------- */

async function api(path, { method = "GET", body, auth = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw makeError("Your session has expired. Please log in again.", 401);
        headers["Authorization"] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw makeError("Could not reach the server. Is it running?", 0);
    }

    let data = {};
    try {
        data = await res.json();
    } catch {
        /* some responses may have no JSON body */
    }

    if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `Request failed (${res.status}).`;
        throw makeError(msg, res.status);
    }
    return data;
}

function makeError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

/* ---------- Auth helpers ---------- */

// Returns true if the error was an auth failure and the user has been redirected.
// Call this in every catch block so normal errors still show their message.
function handleAuthFailure(err) {
    if (err.status === 401 || err.status === 403) {
        logout();
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    window.location.href = LOGIN_PAGE;
}

/* ---------- Utilities ---------- */

function showMessage(el, type, text) {
    el.className = `message message--${type}`;
    el.textContent = text;
    el.hidden = false;
}

function clearMessage(el) {
    el.hidden = true;
    el.textContent = "";
}

function formatPrice(price) {
    return `$${Number(price).toFixed(2)}`;
}

function isTruthy(flag) {
    return flag === true || flag === 1;
}

/* ---------- Session ---------- */

// Redirect to login if there is no token; otherwise populate the session indicator.
function applySession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        // TODO: uncomment the redirect once the login page exists
        // window.location.href = LOGIN_PAGE;
        loadMenuItems(); // still attempt the load so the 401 surfaces naturally
        return;
    }

    const email = localStorage.getItem(EMAIL_KEY);
    const logoutBtn = $("#logout-btn");
    if (email) $("#session-email").textContent = email;
    logoutBtn.hidden = false;

    loadMenuItems();
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
                <span class="item-card__price">${formatPrice(item.price)}</span>
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

/* ---------- Edit / delete / toggle-availability (delegated) ---------- */

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

/* ---------- Init ---------- */

function init() {
    $("#add-form").addEventListener("submit", handleAdd);
    $("#refresh-btn").addEventListener("click", loadMenuItems);
    $("#menu-results").addEventListener("click", handleResultsClick);
    $("#logout-btn").addEventListener("click", logout);

    applySession();
}

document.addEventListener("DOMContentLoaded", init);
