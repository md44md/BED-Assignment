// Third-party HTML-to-PDF integration (PDFShift).
// Invoked from the back-end so a customer can download their itemized receipt as a
// real PDF document. Node 18+ provides a global fetch, so no extra HTTP dependency
// is needed (same approach as emailService.js's Brevo integration).

const PDFSHIFT_URL = "https://api.pdfshift.io/v3/convert/pdf";

// Convert an HTML string into a PDF (returned as a Buffer).
// Returns { ok, buffer, error } and never throws - the caller decides how to respond
// to the client, so a failed conversion can be reported as a clean error rather than
// crashing the request.
async function convertHtmlToPdf(html) {
    const apiKey = process.env.PDFSHIFT_API_KEY;

    // Guard: without config we can't call the API. Report it rather than crash.
    if (!apiKey) {
        return { ok: false, error: "PDF service is not configured (missing PDFSHIFT_API_KEY)." };
    }

    try {
        const res = await fetch(PDFSHIFT_URL, {
            method: "POST",
            headers: {
                "X-API-Key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                source: html,
                // Free sandbox mode: watermarked output, doesn't consume paid credits.
                // Set PDFSHIFT_SANDBOX=false once on a paid/production key.
                sandbox: process.env.PDFSHIFT_SANDBOX !== "false",
            }),
        });

        if (!res.ok) {
            // PDFShift returns a JSON error body describing what went wrong
            let detail = `HTTP ${res.status}`;
            try {
                const body = await res.json();
                if (body && body.message) detail = body.message;
            } catch {
                /* non-JSON error body */
            }
            return { ok: false, error: detail };
        }

        const arrayBuffer = await res.arrayBuffer();
        return { ok: true, buffer: Buffer.from(arrayBuffer) };
    } catch (error) {
        // Network failure / DNS / timeout
        return { ok: false, error: error.message };
    }
}

module.exports = {
    convertHtmlToPdf,
};
