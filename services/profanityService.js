// Third-party profanity filtering (PurgoMalum API).
// Used to clean customer review comments before they are stored, so offensive
// language never ends up publicly displayed on a stall's page. Node 18+ provides
// a global fetch, so no extra HTTP dependency is needed.

const PURGOMALUM_URL = "https://www.purgomalum.com/service/json";

// Run a piece of text through PurgoMalum and return the cleaned version.
// Contract: never throws. On any failure (timeout, non-200, network, bad body)
// the original text is returned unchanged with filtered=false, so a PurgoMalum
// outage can never stop a review from saving.
//   returns { cleaned: <string>, filtered: <boolean> }
async function filterProfanity(text) {
    // Nothing to filter (empty/undefined comment) - short-circuit.
    if (!text) {
        return { cleaned: text, filtered: false };
    }

    try {
        const url = `${PURGOMALUM_URL}?text=${encodeURIComponent(text)}`;
        const res = await fetch(url);

        if (!res.ok) {
            console.error("Profanity service error:", `HTTP ${res.status}`);
            return { cleaned: text, filtered: false };
        }

        // PurgoMalum's JSON endpoint returns { "result": "<cleaned text>" }
        const body = await res.json();
        const cleaned = body && typeof body.result === "string" ? body.result : text;

        return { cleaned: cleaned, filtered: cleaned !== text };
    } catch (error) {
        // Network failure / DNS / timeout
        console.error("Profanity service error:", error.message);
        return { cleaned: text, filtered: false };
    }
}

module.exports = {
    filterProfanity,
};
