// Unit tests for the Brevo email integration.
// The real Brevo API is never called: global fetch is replaced with a mock, so these
// tests run offline and can reproduce failures (bad key, network down) on demand.

const emailService = require("../services/emailService");

describe("emailService.sendQueueNotification", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Give each test its own env and a fresh fetch mock.
        process.env = { ...originalEnv };
        process.env.BREVO_API_KEY = "test-api-key";
        process.env.BREVO_SENDER_EMAIL = "sender@example.com";
        process.env.BREVO_SENDER_NAME = "Hawker Centre Management System";
        global.fetch = jest.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.resetAllMocks();
    });

    test("sends the email and reports success", async () => {
        global.fetch.mockResolvedValue({ ok: true });

        const result = await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("posts the customer and stall details to the Brevo API", async () => {
        global.fetch.mockResolvedValue({ ok: true });

        await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://api.brevo.com/v3/smtp/email");
        expect(options.method).toBe("POST");
        expect(options.headers["api-key"]).toBe("test-api-key");

        const body = JSON.parse(options.body);
        expect(body.sender).toEqual({ name: "Hawker Centre Management System", email: "sender@example.com" });
        expect(body.to).toEqual([{ email: "alice@email.com", name: "Alice" }]);
        expect(body.subject).toBe("You're next in line at Stall 1");
        expect(body.htmlContent).toContain("43");
    });

    test("reports failure when the API key is missing, without calling the API", async () => {
        delete process.env.BREVO_API_KEY;

        const result = await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/not configured/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("reports failure when the customer has no email on file", async () => {
        const result = await emailService.sendQueueNotification(null, "Alice", "Stall 1", 43);

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/no email address/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("surfaces the error message Brevo returns when it rejects the request", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: "Key not found" }),
        });

        const result = await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        expect(result).toEqual({ ok: false, error: "Key not found" });
    });

    test("falls back to the status code when the error body is not JSON", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error("not json");
            },
        });

        const result = await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        expect(result).toEqual({ ok: false, error: "HTTP 500" });
    });

    test("returns an error instead of throwing when the network fails", async () => {
        global.fetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.brevo.com"));

        const result = await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        expect(result.ok).toBe(false);
        expect(result.error).toBe("getaddrinfo ENOTFOUND api.brevo.com");
    });

    test("uses a default sender name when one is not configured", async () => {
        delete process.env.BREVO_SENDER_NAME;
        global.fetch.mockResolvedValue({ ok: true });

        await emailService.sendQueueNotification("alice@email.com", "Alice", "Stall 1", 43);

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.sender.name).toBe("Hawker Centre Management System");
    });
});

describe("emailService.sendPasswordResetEmail", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.BREVO_API_KEY = "test-api-key";
        process.env.BREVO_SENDER_EMAIL = "sender@example.com";
        process.env.BREVO_SENDER_NAME = "Hawker Centre Management System";
        global.fetch = jest.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.resetAllMocks();
    });

    test("sends the email and reports success", async () => {
        global.fetch.mockResolvedValue({ ok: true });

        const result = await emailService.sendPasswordResetEmail("alice@email.com", "https://example.com/reset-password.html?token=abc123");

        expect(result).toEqual({ ok: true });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test("posts the recipient and reset link to the Brevo API", async () => {
        global.fetch.mockResolvedValue({ ok: true });

        await emailService.sendPasswordResetEmail("alice@email.com", "https://example.com/reset-password.html?token=abc123");

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://api.brevo.com/v3/smtp/email");
        expect(options.method).toBe("POST");
        expect(options.headers["api-key"]).toBe("test-api-key");

        const body = JSON.parse(options.body);
        expect(body.to).toEqual([{ email: "alice@email.com" }]);
        expect(body.subject).toBe("Reset your password");
        expect(body.htmlContent).toContain("https://example.com/reset-password.html?token=abc123");
    });

    test("reports failure when the API key is missing, without calling the API", async () => {
        delete process.env.BREVO_API_KEY;

        const result = await emailService.sendPasswordResetEmail("alice@email.com", "https://example.com/reset-password.html?token=abc123");

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/not configured/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("reports failure when there is no recipient email", async () => {
        const result = await emailService.sendPasswordResetEmail(null, "https://example.com/reset-password.html?token=abc123");

        expect(result.ok).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("surfaces the error message Brevo returns when it rejects the request", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: "Key not found" }),
        });

        const result = await emailService.sendPasswordResetEmail("alice@email.com", "https://example.com/reset-password.html?token=abc123");

        expect(result).toEqual({ ok: false, error: "Key not found" });
    });

    test("returns an error instead of throwing when the network fails", async () => {
        global.fetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.brevo.com"));

        const result = await emailService.sendPasswordResetEmail("alice@email.com", "https://example.com/reset-password.html?token=abc123");

        expect(result.ok).toBe(false);
        expect(result.error).toBe("getaddrinfo ENOTFOUND api.brevo.com");
    });
});
