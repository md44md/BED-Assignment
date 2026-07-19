/* ============================================================
   Stall Menu — customer-facing menu + reviews browsing.
   Public page: viewable by guests. Only "Add to cart" needs a session
   (enforced by api(..., { auth: true }), which redirects to login on 401).
   Reads ?stallID= from the URL (linked from customer-home.html).

   Talks to the back-end API:
     GET  /stalls/:stallID/menu       (public)
     GET  /stalls/:stallID/feedback   (public)
     POST /cart/items                 (customer only)
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/customer-login.html";

/* ---------- Auth guard ---------- */
// This page is viewable by guests (menu + reviews are public); only
// "Add to cart" actually requires a session, enforced by api(...,
// { auth: true }) below.

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

/* ---------- Likes ---------- */

// menuItemIDs the logged-in customer has liked, so item cards can show the
// right heart state on first paint.
let likedMenuItemIDs = new Set();

async function loadMyLikes() {
    if (!isLoggedIn()) {
        likedMenuItemIDs = new Set();
        return;
    }
    try {
        const data = await api("/menuitems/likes", { auth: true });
        likedMenuItemIDs = new Set(data.likedMenuItemIDs || []);
    } catch {
        likedMenuItemIDs = new Set();
    }
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
    const liked = likedMenuItemIDs.has(item.menuItemID);

    const card = document.createElement("article");
    card.className = `item-card category--${item.category}` + (available ? "" : " item-card--unavailable");
    card.dataset.itemId = item.menuItemID;

    const availTag = available ? "" : '<span class="tag tag--unavailable">Unavailable</span>';
    const lowStockTag = isTruthy(item.isLowStock) ? '<span class="tag tag--low-stock">Low stock</span>' : "";

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
                    <div class="item-card__actions">
                        <input type="number" class="input qty-input" min="1" max="99" value="1" ${available ? "" : "disabled"} />
                        <button type="button" class="btn btn--primary btn--sm" data-action="add" ${available ? "" : "disabled"}>
                            Add to cart
                        </button>
                        <button type="button" class="btn-like${liked ? " btn-like--active" : ""}" data-action="like" aria-pressed="${liked}">
                            <span class="btn-like__icon">${liked ? "♥" : "♡"}</span>
                            <span class="btn-like__count">${item.likeCount ?? 0}</span>
                        </button>
                    </div>
                </div>
                <span class="item-card__price item-card__price--right">${formatCurrency(item.price)}</span>
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

/* ---------- Reviews rendering ---------- */

function renderReviewCard(review) {
    const card = document.createElement("article");
    card.className = "review-card";
    const reviewerName = `${review.firstName} ${review.lastName.charAt(0)}.`;

    card.innerHTML = `
        <div class="review-card__head">
            <span class="review-card__stars">${renderStars(review.rating)}</span>
            <span class="review-card__meta">${escapeHtml(reviewerName)} · ${formatDate(review.createdAt)}</span>
        </div>
        ${review.comments ? `<p class="review-card__comment">${escapeHtml(review.comments)}</p>` : ""}
    `;
    return card;
}

function renderReviews(data) {
    const summary = $("#reviews-summary");
    const results = $("#reviews-results");
    results.innerHTML = "";

    if (!data.reviewCount) {
        summary.textContent = "No reviews yet.";
        results.innerHTML = '<div class="empty">Be the first to leave a review after your order.</div>';
        return;
    }

    summary.textContent = `${renderStars(data.averageRating)} ${data.averageRating} out of 5 (${data.reviewCount} review${data.reviewCount === 1 ? "" : "s"})`;
    for (const review of data.reviews) {
        results.appendChild(renderReviewCard(review));
    }
}

/* ---------- Load reviews ---------- */

async function loadReviews(stallID) {
    const msg = $("#reviews-message");
    clearMessage(msg);
    try {
        const data = await api(`/stalls/${stallID}/feedback`);
        renderReviews(data);
    } catch (err) {
        showMessage(msg, "error", err.message);
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

async function handleAddToCart(btn) {
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

/* ---------- Like / unlike ---------- */

async function handleLikeClick(btn) {
    const card = btn.closest(".item-card");
    const menuItemID = Number(card.dataset.itemId);
    const currentlyLiked = likedMenuItemIDs.has(menuItemID);
    const msg = $("#menu-message");
    clearMessage(msg);

    btn.disabled = true;
    try {
        const method = currentlyLiked ? "DELETE" : "POST";
        const data = await api(`/menuitems/${menuItemID}/like`, { method, auth: true });

        if (data.liked) likedMenuItemIDs.add(menuItemID);
        else likedMenuItemIDs.delete(menuItemID);

        btn.classList.toggle("btn-like--active", data.liked);
        btn.setAttribute("aria-pressed", String(data.liked));
        btn.querySelector(".btn-like__icon").textContent = data.liked ? "♥" : "♡";
        btn.querySelector(".btn-like__count").textContent = data.likeCount;
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    } finally {
        btn.disabled = false;
    }
}

async function handleResultsClick(event) {
    const addBtn = event.target.closest('button[data-action="add"]');
    if (addBtn) {
        await handleAddToCart(addBtn);
        return;
    }

    const likeBtn = event.target.closest('button[data-action="like"]');
    if (likeBtn) {
        await handleLikeClick(likeBtn);
    }
}

/* ---------- Init ---------- */

async function init() {
    // Menu + reviews are public, so reveal the page for guests and members alike
    // (it starts hidden only to avoid a flash before we know the login state).
    document.body.classList.remove("auth-pending");

    if (isLoggedIn()) {
        const email = getEmail();
        if (email) $("#session-email").textContent = email;
        $("#logout-btn").hidden = false;
        $("#logout-btn").addEventListener("click", handleLogout);
    } else {
        $("#login-btn").hidden = false;
    }

    const stallID = getStallIdFromUrl();
    if (!stallID) {
        $("#stall-name").textContent = "No stall selected";
        showMessage($("#menu-message"), "error", "Go back to Stalls and pick a stall to view its menu.");
        return;
    }

    $("#menu-results").addEventListener("click", handleResultsClick);

    // Run sequentially, not concurrently: these share the backend's single
    // global mssql connection pool, and firing them at the same time can
    // cause one request's pool.close() to cut off the other mid-query.
    await loadMyLikes();
    await loadMenu(stallID);
    await loadReviews(stallID);
}

document.addEventListener("DOMContentLoaded", init);
