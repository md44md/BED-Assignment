/* ============================================================
   NEA Hygiene Grades — PUBLIC page logic.
   Anyone can look up a stall's grades; no login is involved here.
     GET /stalls                              (stall picker)
     GET /stalls/:stallID/hygiene-grades      (public)
   Relies on helpers from common.js (loaded first).
   ============================================================ */

"use strict";

async function handlePublicView(event) {
    event.preventDefault();
    const stallID = $("#public-stall").value;
    const msg = $("#public-message");
    const results = $("#public-results");
    clearMessage(msg);
    results.innerHTML = "";

    try {
        const data = await api(`/stalls/${stallID}/hygiene-grades`);
        renderGradeList(results, data.grades, { manage: false });
    } catch (err) {
        showMessage(msg, "error", err.message);
    }
}

function init() {
    // Load the stall list and fill the picker.
    loadStalls(["#public-stall"], (err) =>
        showMessage($("#public-message"), "error", `Could not load stalls: ${err.message}`)
    ).then(() => {
        if (stalls.length === 0) {
            showMessage($("#public-message"), "info", "No stalls are available yet.");
        }
    });

    $("#public-form").addEventListener("submit", handlePublicView);
}

document.addEventListener("DOMContentLoaded", init);
