// Unit tests for the PDFShift HTML-to-PDF integration.
// The real PDFShift API is never called: global fetch is replaced with a mock, so these
// tests run offline and can reproduce failures (bad key, network down) on demand.

const pdfService = require("../services/pdfService");

describe("pdfService.convertHtmlToPdf", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.PDFSHIFT_API_KEY = "test-api-key";
        global.fetch = jest.fn();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.resetAllMocks();
    });

    test("converts HTML to a PDF buffer and reports success", async () => {
        const pdfBytes = new Uint8Array([1, 2, 3]);
        global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => pdfBytes.buffer });

        const result = await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        expect(result.ok).toBe(true);
        expect(Buffer.isBuffer(result.buffer)).toBe(true);
        expect(result.buffer.equals(Buffer.from(pdfBytes))).toBe(true);
    });

    test("posts the HTML source and API key to PDFShift", async () => {
        global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });

        await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe("https://api.pdfshift.io/v3/convert/pdf");
        expect(options.method).toBe("POST");
        expect(options.headers["X-API-Key"]).toBe("test-api-key");

        const body = JSON.parse(options.body);
        expect(body.source).toBe("<p>Receipt</p>");
        expect(body.sandbox).toBe(true);
    });

    test("disables sandbox mode when PDFSHIFT_SANDBOX is 'false'", async () => {
        process.env.PDFSHIFT_SANDBOX = "false";
        global.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });

        await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        const body = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(body.sandbox).toBe(false);
    });

    test("reports failure when the API key is missing, without calling the API", async () => {
        delete process.env.PDFSHIFT_API_KEY;

        const result = await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/not configured/i);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("surfaces the error message PDFShift returns when it rejects the request", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: "Invalid API Key" }),
        });

        const result = await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        expect(result).toEqual({ ok: false, error: "Invalid API Key" });
    });

    test("falls back to the status code when the error body is not JSON", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error("not json");
            },
        });

        const result = await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        expect(result).toEqual({ ok: false, error: "HTTP 500" });
    });

    test("returns an error instead of throwing when the network fails", async () => {
        global.fetch.mockRejectedValue(new Error("getaddrinfo ENOTFOUND api.pdfshift.io"));

        const result = await pdfService.convertHtmlToPdf("<p>Receipt</p>");

        expect(result.ok).toBe(false);
        expect(result.error).toBe("getaddrinfo ENOTFOUND api.pdfshift.io");
    });
});
