// Third-party email integration (Brevo transactional email API).
// Invoked from the back-end so the app can email a customer when they become the
// current customer in a stall's queue. Node 18+ provides a global fetch, so no
// extra HTTP dependency is needed.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// Send the "you're next in line" email to a customer.
// Returns { ok, error } and never throws — the caller decides how to record the
// outcome, so a failed email can never break the stall owner's serve action.
async function sendQueueNotification(toEmail, toName, stallName, queueNumber) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "Hawker Centre Management System";

    // Guard: without config we can't call the API. Report it rather than crash.
    if (!apiKey || !senderEmail) {
        return { ok: false, error: "Email service is not configured (missing BREVO_API_KEY or BREVO_SENDER_EMAIL)." };
    }
    if (!toEmail) {
        return { ok: false, error: "Customer has no email address on file." };
    }

    const subject = `You're next in line at ${stallName}`;
    const htmlContent = `
        <p>Hi ${toName || "there"},</p>
        <p>Good news!</p>
        <p>You are now the <strong>current customer</strong> in the queue at
        <strong>${stallName}</strong> (queue number <strong>${queueNumber}</strong>).</p>
        <p>Please head over and get ready to collect your order.</p>
        <p>— Hawker Centre Management System</p>
    `;

    try {
        const res = await fetch(BREVO_URL, {
            method: "POST",
            headers: {
                "api-key": apiKey,
                "content-type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: [{ email: toEmail, name: toName || undefined }],
                subject,
                htmlContent,
            }),
        });

        if (!res.ok) {
            // Brevo returns a JSON error body describing what went wrong
            let detail = `HTTP ${res.status}`;
            try {
                const body = await res.json();
                if (body && body.message) detail = body.message;
            } catch {
                /* non-JSON error body */
            }
            return { ok: false, error: detail };
        }

        return { ok: true };
    } catch (error) {
        // Network failure / DNS / timeout
        return { ok: false, error: error.message };
    }
}

module.exports = {
    sendQueueNotification,
};
