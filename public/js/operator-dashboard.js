/* ============================================================
   Operator console (dashboard).
   Protected page: no valid token -> redirect to the login page.

   Talks to the back-end RESTful API (route needs a JWT):
     GET /stalls/:stallID/sales-analytics
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

const LOGIN_URL = "/operator-login.html";

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

/* ---------- Rendering: summary ---------- */

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

/* ---------- Rendering: CSS-only bar rows ---------- */

// Popular items: bar length scaled to quantity sold, relative to the top item.
function renderPopularItems(container, items) {
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = `<div class="empty">No completed orders yet for this stall.</div>`;
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
        container.innerHTML = `<div class="empty">No completed orders yet for this stall.</div>`;
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

/* ---------- Load analytics ---------- */

async function handleLoadAnalytics(event) {
    event.preventDefault();
    const msg = $("#analytics-message");
    const stallID = $("#analytics-stall").value;
    clearMessage(msg);
    $("#summary-results").innerHTML = "";
    $("#popular-items-results").innerHTML = "";
    $("#peak-hours-results").innerHTML = "";

    if (!stallID) {
        showMessage(msg, "error", "Please select a stall.");
        return;
    }

    try {
        // Note: 404 here means this stall isn't managed by the signed-in
        // operator (the picker lists all stalls; the server enforces this).
        const data = await api(`/stalls/${stallID}/sales-analytics`, { auth: true });
        renderSummary($("#summary-results"), data.summary);
        renderPopularItems($("#popular-items-results"), data.popularItems);
        renderPeakHours($("#peak-hours-results"), data.peakHours);
    } catch (err) {
        if (!handleAuthFailure(err)) showMessage(msg, "error", err.message);
    }
}

/* ---------- Init ---------- */

async function init() {
    // Auth guard: this page is operator-only. A logged-in customer, stall
    // owner, or officer must not land here, so check the role, not just for
    // any session.
    if (!isLoggedIn() || getRole() !== "operator") {
        goToLogin();
        return;
    }

    // Guard passed. Reveal the page (it starts hidden to avoid a flash).
    document.body.classList.remove("auth-pending");

    // Show which operator is signed in.
    const email = getEmail();
    if (email) $("#session-email").textContent = email;

    // Populate the stall picker with only this operator's stalls.
    try {
        const data = await api("/operators/stalls", { auth: true });
        const stalls = data.stalls || [];
        const select = $("#analytics-stall");
        select.innerHTML = "";
        if (stalls.length === 0) {
            select.innerHTML = '<option value="">No stalls found</option>';
        } else {
            for (const stall of stalls) {
                const opt = document.createElement("option");
                opt.value = stall.stallID;
                const centre = stall.centreName ? ` — ${stall.centreName}` : "";
                opt.textContent = `${stall.stallName}${centre} (ID ${stall.stallID})`;
                select.appendChild(opt);
            }
        }
    } catch (err) {
        if (!handleAuthFailure(err)) {
            showMessage($("#analytics-message"), "error", `Could not load stalls: ${err.message}`);
        }
    }

    // Wire up actions.
    $("#logout-btn").addEventListener("click", handleLogout);
    $("#analytics-form").addEventListener("submit", handleLoadAnalytics);
}

document.addEventListener("DOMContentLoaded", init);