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
    $("#queue-tab").hidden = target !== "queue";
    $("#rentals-tab").hidden = target !== "rentals";
    $("#complaints-tab").hidden = target !== "complaints";
    $("#analytics-tab").hidden = target !== "analytics";
    if (target === "menu") loadMenuItems();
    if (target === "queue") loadQueue();
    if (target === "rentals") loadRentalAgreements();
    if (target === "complaints") loadComplaintsAndRatings();
    if (target === "analytics") loadSalesAnalytics();
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
    if (item.imageURL) card.dataset.imageUrl = item.imageURL;

    const availTag = available
        ? '<span class="tag tag--available">Available</span>'
        : '<span class="tag tag--unavailable">Unavailable</span>';
    const lowStockTag = lowStock ? '<span class="tag tag--low-stock">Low stock</span>' : "";

    card.innerHTML = `
        <div class="item-card__body">
            <div class="item-card__layout">                
                ${item.imageURL ? `<img class="item-card__image item-card__image--thumb" src="${item.imageURL}" alt="${item.name}" />` 
                : `<img class="item-card__image item-card__image--thumb" src="../images/default-img.png" alt="${item.name}" />`}
                <div class="item-card__content">
                    <div class="item-card__row">
                        <span class="category-tag category--${item.category}">${item.category}</span>
                        ${availTag}
                        ${lowStockTag}
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
                <span class="item-card__price">${formatCurrency(item.price)}</span>
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
 
    const formData = new FormData();
    formData.append("name", $("#add-name").value.trim());
    formData.append("description", $("#add-description").value.trim());
    formData.append("price", Number($("#add-price").value));
    formData.append("category", $("#add-category").value);
 
    const imageFile = $("#add-image").files[0];
    if (imageFile) formData.append("image", imageFile); // field name must match multer's upload.single("image")
 
    const submitBtn = event.submitter;
    submitBtn.disabled = true;
    try {
        const res = await fetch("/menuitems", {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Request failed.");
 
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

        <div class="field field--full">
            <label class="field__label" for="edit-image-${item.menuItemID}">Image</label>
            <img id="edit-image-preview-${item.menuItemID}" class="item-card__image"
                src="${item.imageURL || ""}" alt="Menu item image preview"
                style="margin-bottom:0.5rem; ${item.imageURL ? "" : "display:none;"}" />
            <input type="file" class="input" id="edit-image-${item.menuItemID}" accept="image/*" />
        </div>

        <div class="item-edit-form__actions">
            <button type="submit" class="btn btn--primary btn--sm">Save</button>
            <button type="button" class="btn btn--secondary btn--sm" data-action="cancel-edit">Cancel</button>
        </div>
    `;
    // Handle image preview
    const imageInput = form.querySelector(`#edit-image-${item.menuItemID}`);
    const imagePreview = form.querySelector(`#edit-image-preview-${item.menuItemID}`);

    imageInput.addEventListener("change", () => {
        const file = imageInput.files[0];
        if (!file) return;

        imagePreview.src = URL.createObjectURL(file);
        imagePreview.style.display = "";
    });

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

    const formData = new FormData();
    formData.append("name", $(`#edit-name-${menuItemID}`).value.trim());
    formData.append("description", $(`#edit-desc-${menuItemID}`).value.trim());
    formData.append("price", Number($(`#edit-price-${menuItemID}`).value));
    formData.append("category", $(`#edit-category-${menuItemID}`).value);
    formData.append("isAvailable", $(`#edit-available-${menuItemID}`).checked);

    const imageFile = $(`#edit-image-${menuItemID}`).files[0];
    if (imageFile) formData.append("image", imageFile);

    const submitBtn = event.submitter;
    submitBtn.disabled = true;
    try {
        const res = await fetch(`/menuitems/${menuItemID}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "Request failed.");

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
            imageURL: card.dataset.imageUrl || null,
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

/* ---------- Complaints & Ratings ---------- */

// Map a complaint status to one of the shared tag colour variants.
const COMPLAINT_STATUSES = ["open", "underReview", "resolved", "closed"];

function complaintStatusTagClass(status) {
    switch (status) {
        case "resolved":
        case "closed":
            return "tag--current";       // green
        case "underReview":
            return "tag--low-stock";     // amber
        default:                         // open
            return "tag--historical";    // neutral
    }
}

// Summary stat cards: average rating + total review count.
function renderSatisfactionSummary(container, summary) {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "stat-grid";
    const totalReviews = Number(summary.totalReviews);
    const averageRating = Number(summary.averageRating);
    grid.innerHTML = `
        <div class="stat-card">
            <span class="stat-card__value">${totalReviews > 0 ? averageRating.toFixed(1) : "—"}</span>
            <span class="stat-card__label">Average rating (out of 5)</span>
        </div>
        <div class="stat-card">
            <span class="stat-card__value">${totalReviews}</span>
            <span class="stat-card__label">Total reviews</span>
        </div>
    `;
    container.appendChild(grid);
}

// CSS-only bar chart: number of reviews at each star rating, 5 down to 1,
// bar length scaled to whichever star count is highest.
function renderRatingDistribution(container, feedback) {
    container.innerHTML = "";
    if (!feedback || feedback.length === 0) {
        container.innerHTML = "";
        return;
    }
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    feedback.forEach((item) => {
        counts[item.rating] = (counts[item.rating] || 0) + 1;
    });
    const max = Math.max(...Object.values(counts));

    const list = document.createElement("div");
    list.className = "bar-list";
    [5, 4, 3, 2, 1].forEach((stars) => {
        const count = counts[stars];
        const pct = max > 0 ? Math.round((count / max) * 100) : 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
            <div class="bar-row__label">
                <span class="bar-row__name">${stars}★</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="bar-row__stats">
                <span>${count} review${count === 1 ? "" : "s"}</span>
            </div>
        `;
        list.appendChild(row);
    });
    container.appendChild(list);
}

// Individual reviews, newest first, reusing the order-card look.
function renderFeedbackCard(item) {
    const card = document.createElement("article");
    card.className = "order-card";
    card.innerHTML = `
        <div class="order-card__head">
            <div>
                <div class="order-card__title">${item.firstName} ${item.lastName}</div>
                <div class="order-card__meta">${item.rating}★ · ${formatDate(item.createdAt)}</div>
            </div>
        </div>
        ${item.comments ? `<p class="order-card__meta">${item.comments}</p>` : ""}
    `;
    return card;
}

function renderFeedbackList(feedback) {
    const results = $("#feedback-results");
    results.innerHTML = "";
    if (!feedback || feedback.length === 0) {
        results.innerHTML = `<div class="empty">No reviews left for your stall yet.</div>`;
        return;
    }
    for (const item of feedback) {
        results.appendChild(renderFeedbackCard(item));
    }
}

// Complaints, each with a status select + update button so the stall owner
// can work through them without leaving the page.
function renderComplaintCard(complaint) {
    const card = document.createElement("article");
    card.className = "order-card";
    card.dataset.complaintId = complaint.complaintID;

    const statusTag = `<span class="tag ${complaintStatusTagClass(complaint.status)}">${complaint.status}</span>`;

    card.innerHTML = `
        <div class="order-card__head">
            <div>
                <div class="order-card__title">${complaint.firstName} ${complaint.lastName}</div>
                <div class="order-card__meta">${complaint.category} · Filed ${formatDate(complaint.createdAt)}</div>
            </div>
            ${statusTag}
        </div>
        <p class="order-card__meta">${complaint.description}</p>
        ${complaint.resolvedAt ? `<div class="order-card__meta">Resolved ${formatDate(complaint.resolvedAt)}</div>` : ""}
        <div class="grade-card__actions">
            <select class="input" data-role="status-select">
                ${COMPLAINT_STATUSES.map((s) => `<option value="${s}" ${s === complaint.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <button type="button" class="btn btn--secondary btn--sm" data-action="update-status">Update status</button>
        </div>
    `;
    return card;
}

function renderComplaintsList(complaints) {
    const results = $("#complaints-results");
    results.innerHTML = "";
    if (!complaints || complaints.length === 0) {
        results.innerHTML = `<div class="empty">No complaints filed against your stall yet.</div>`;
        return;
    }
    for (const complaint of complaints) {
        results.appendChild(renderComplaintCard(complaint));
    }
}

async function loadComplaintsAndRatings() {
    const msg = $("#complaints-message");
    clearMessage(msg);
    try {
        // Run sequentially, not concurrently: both share the back-end's
        // single global mssql connection pool (same note as complaints.js
        // and feedback.js on the customer side).
        const feedbackData = await api("/feedback/stall", { auth: true });
        renderSatisfactionSummary($("#satisfaction-summary-results"), feedbackData.summary);
        renderRatingDistribution($("#rating-distribution-results"), feedbackData.feedback);
        renderFeedbackList(feedbackData.feedback);

        const complaintsData = await api("/complaint/stall", { auth: true });
        renderComplaintsList(complaintsData.complaints);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleUpdateComplaintStatus(card, complaintID) {
    const msg = $("#complaints-message");
    clearMessage(msg);
    const status = card.querySelector('[data-role="status-select"]').value;

    try {
        const data = await api(`/complaint/${complaintID}/status`, {
            method: "PUT",
            body: { status },
            auth: true,
        });
        showMessage(msg, "success", data.message || "Complaint status updated.");
        loadComplaintsAndRatings();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleComplaintsResultsClick(event) {
    const btn = event.target.closest('button[data-action="update-status"]');
    if (!btn) return;
    const card = btn.closest(".order-card");
    const complaintID = Number(card.dataset.complaintId);

    btn.disabled = true;
    await handleUpdateComplaintStatus(card, complaintID);
    btn.disabled = false;
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

/* ---------- Queue management ---------- */

// Render the queue: the current customer first (highlighted), then those waiting.
function renderQueue(queue) {
    const results = $("#queue-results");
    results.innerHTML = "";

    if (!queue || queue.length === 0) {
        results.innerHTML = '<div class="empty">No customers in the queue right now.</div>';
        return;
    }

    queue.forEach((order, index) => {
        const isCurrent = index === 0;
        const card = document.createElement("article");
        card.className = "item-card" + (isCurrent ? " item-card--current" : "");
        const tag = isCurrent
            ? '<span class="tag tag--current">Now serving</span>'
            : '<span class="tag tag--historical">Waiting</span>';
        card.innerHTML = `
            <div class="item-card__body">
                <div class="item-card__row">
                    <span class="item-card__title">Queue #${order.queueNumber}</span>
                    ${tag}
                    <span class="tag tag--available">${order.status}</span>
                </div>
                <div class="item-card__meta">Order ID ${order.orderID} · Customer ID ${order.customerID}</div>
            </div>
        `;
        results.appendChild(card);
    });
}

async function loadQueue() {
    const msg = $("#queue-message");
    clearMessage(msg);
    try {
        const data = await api("/stallowners/queue", { auth: true });
        renderQueue(data.queue);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

async function handleServeNext() {
    const msg = $("#queue-message");
    clearMessage(msg);

    const btn = $("#serve-next-btn");
    btn.disabled = true;
    try {
        const data = await api("/stallowners/queue/advance", { method: "POST", auth: true });

        // Build a clear summary of what happened for the owner.
        let summary = `Served queue #${data.servedOrder.queueNumber}.`;
        if (data.nextOrder) {
            summary += ` Now serving #${data.nextOrder.queueNumber}.`;
            summary += data.notified
                ? " The next customer has been emailed."
                : " (Could not email the next customer.)";
        } else {
            summary += " The queue is now empty.";
        }
        showMessage(msg, data.nextOrder && !data.notified ? "error" : "success", summary);

        loadQueue();
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

/* ---------- Stall status toggle ---------- */

// Maps each status to an existing tag colour so it reuses the same visual
// language as availability/hygiene tags elsewhere in the app.
const STATUS_TAG_CLASS = {
    open: "tag--available",
    busy: "tag--low-stock",
    closed: "tag--unavailable",
};

function updateStallStatusTag(status) {
    const tag = $("#stall-status-tag");
    tag.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    tag.className = `tag ${STATUS_TAG_CLASS[status] || "tag--historical"}`;
}

async function handleStallStatusClick(event) {
    const btn = event.target.closest("button[data-status]");
    if (!btn) return;
    const status = btn.dataset.status;
    const msg = $("#stall-status-message");
    clearMessage(msg);

    const buttons = document.querySelectorAll("#stall-status-row button[data-status]");
    buttons.forEach((b) => (b.disabled = true));
    try {
        const data = await api("/stalls/status", { method: "PUT", body: { status }, auth: true });
        updateStallStatusTag(data.stall.status);
        showMessage(msg, "success", data.message || "Stall status updated.");
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        buttons.forEach((b) => (b.disabled = false));
    }
}

/* ---------- Delete account ---------- */

async function handleDeleteAccount() {
    const confirmed = window.confirm("Are you sure you want to delete your account? This cannot be undone.");
    if (!confirmed) return;

    const msg = $("#delete-account-message");
    clearMessage(msg);
    const btn = $("#delete-account-btn");
    btn.disabled = true;
    try {
        const data = await api("/stallowners/account", { method: "DELETE", auth: true });
        showMessage(msg, "success", data.message || "Account deleted successfully.");
        setTimeout(() => {
            clearSession();
            window.location.href = LOGIN_URL;
        }, 1500);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
        btn.disabled = false;
    }
}

/* ---------- Sales Analytics ---------- */

function renderSummary(container, summary) {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "stat-grid";
    grid.innerHTML = `
        <div class="stat-card">
            <span class="stat-card__value">${Number(summary.totalOrders)}</span>
            <span class="stat-card__label">Completed orders</span>
        </div>
        <div class="stat-card">
            <span class="stat-card__value">${formatCurrency(summary.totalRevenue)}</span>
            <span class="stat-card__label">Total revenue</span>
        </div>
        <div class="stat-card">
            <span class="stat-card__value">${formatCurrency(summary.averageOrderValue)}</span>
            <span class="stat-card__label">Average order value</span>
        </div>
    `;
    container.appendChild(grid);
}
// Popular items: bar length scaled to quantity sold, relative to the top item.
function renderPopularItems(container, items) {
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty">No completed orders yet for your stall.</div>`;
        return;
    }
    const max = Math.max(...items.map((i) => Number(i.totalQuantitySold)));
    const list = document.createElement("div");
    list.className = "bar-list";
    items.forEach((item) => {
        const pct = max > 0 ? Math.round((Number(item.totalQuantitySold) / max) * 100) : 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
            <div class="bar-row__label">
                <span class="bar-row__name">${item.name}</span>
                <span class="category-tag category--${item.category}">${item.category}</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="bar-row__stats">
                <span>${Number(item.totalQuantitySold)} sold</span>
                <span>${formatCurrency(item.totalRevenue)}</span>
                <span>${Number(item.orderCount)} orders</span>
            </div>
        `;
        list.appendChild(row);
    });
    container.appendChild(list);
}

// Peak hours: one bar per active hour, scaled to the busiest hour. The API
// already orders these by orderCount descending, so the busiest hour is first.
function renderPeakHours(container, hours) {
    container.innerHTML = "";
    if (!hours || hours.length === 0) {
        container.innerHTML = `<div class="empty">No completed orders yet for your stall.</div>`;
        return;
    }
    const max = Math.max(...hours.map((h) => Number(h.orderCount)));
    const list = document.createElement("div");
    list.className = "bar-list";
    hours.forEach((hour) => {
        const pct = max > 0 ? Math.round((Number(hour.orderCount) / max) * 100) : 0;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
            <div class="bar-row__label">
                <span class="bar-row__name">${formatHourRange(hour.hourOfDay)}</span>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="bar-row__stats">
                <span>${Number(hour.orderCount)} orders</span>
                <span>${formatCurrency(hour.totalRevenue)}</span>
            </div>
        `;
        list.appendChild(row);
    });
    container.appendChild(list);
}

// e.g. 13 -> "1pm–2pm"
function formatHourRange(hour) {
    const h = Number(hour);
    const label = (n) => {
        const period = n < 12 || n === 24 ? "am" : "pm";
        let display = n % 12;
        if (display === 0) display = 12;
        return `${display}${period}`;
    };
    return `${label(h)}–${label((h + 1) % 24)}`;
}

async function loadSalesAnalytics() {
    const msg = $("#analytics-message");
    clearMessage(msg);
    try {
        // Server derives the stall from the signed-in owner's JWT, so there's
        // no stallID to pass — unlike the operator's version of this route.
        const data = await api("/sales-analytics", { auth: true });
        renderSummary($("#analytics-summary-results"), data.summary);
        renderPopularItems($("#analytics-popular-items-results"), data.popularItems);
        renderPeakHours($("#analytics-peak-hours-results"), data.peakHours);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

function init() {
    // Auth guard: this page is stallowner-only. A logged-in customer or
    // officer must not land here, so check the role, not just for any session.
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
    $("#complaints-refresh-btn").addEventListener("click", loadComplaintsAndRatings);
    $("#complaints-results").addEventListener("click", handleComplaintsResultsClick);
    $("#queue-refresh-btn").addEventListener("click", loadQueue);
    $("#serve-next-btn").addEventListener("click", handleServeNext);
    $("#analytics-refresh-btn").addEventListener("click", loadSalesAnalytics);
    $("#stall-status-row").addEventListener("click", handleStallStatusClick);
    $("#delete-account-btn").addEventListener("click", handleDeleteAccount);

    $("#logout-btn").addEventListener("click", handleLogout);

    // Handle image preview
    const addImageInput = $("#add-image");
    const addImagePreview = $("#add-image-preview");

    addImageInput.addEventListener("change", () => {
        const file = addImageInput.files[0];
        if (!file) {
            addImagePreview.style.display = "none";
            return;
        }

        addImagePreview.src = URL.createObjectURL(file);
        addImagePreview.style.display = "";
    });

    // Load menu items for the default tab
    loadMenuItems();
}

document.addEventListener("DOMContentLoaded", init);
