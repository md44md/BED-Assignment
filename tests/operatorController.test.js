// Unit tests for the operator controller (operator login/logout, and the stall
// list operators pick a stall from before viewing its sales analytics).
// operatorModel and jsonwebtoken are mocked, so no database connection or real
// token signing happens.

jest.mock("../models/operatorModel");
jest.mock("../models/salesAnalyticsModel");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const operatorModel = require("../models/operatorModel");
const salesAnalyticsModel = require("../models/salesAnalyticsModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const operatorController = require("../controllers/operatorController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("login", () => {
    const req = { body: { email: "james@email.com", password: "James123!" } };
    const activeUser = {
        userID: 10,
        email: "james@email.com",
        passwordHash: "hashedPassword",
        role: "operator",
        isActive: 1,
    };

    test("logs in and returns a signed JWT on success", async () => {
        operatorModel.getUserByEmail.mockResolvedValue(activeUser);
        bcrypt.compare.mockResolvedValue(true);
        operatorModel.getOperatorByUserID.mockResolvedValue({ operatorID: 1 });
        jwt.sign.mockReturnValue("signed.jwt.token");
        const res = mockRes();

        await operatorController.login(req, res);

        expect(jwt.sign).toHaveBeenCalledWith(
            { userID: 10, operatorID: 1, role: "operator" },
            "test-secret",
            expect.objectContaining({ expiresIn: expect.anything() })
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Login successful.",
            token: "signed.jwt.token",
        });
    });

    test("404s when the account does not exist", async () => {
        operatorModel.getUserByEmail.mockResolvedValue(null);
        const res = mockRes();

        await operatorController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("403s when the account is disabled", async () => {
        operatorModel.getUserByEmail.mockResolvedValue({ ...activeUser, isActive: 0 });
        const res = mockRes();

        await operatorController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("401s when the password does not match", async () => {
        operatorModel.getUserByEmail.mockResolvedValue(activeUser);
        bcrypt.compare.mockResolvedValue(false);
        const res = mockRes();

        await operatorController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        operatorModel.getUserByEmail.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await operatorController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("logout", () => {
    test("returns 200 without touching the model (JWT logout is client-side)", async () => {
        const res = mockRes();

        await operatorController.logout({}, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String) })
        );
    });
});

describe("getMyStalls", () => {
    const req = { user: { operatorID: 2 } };

    test("returns the stalls inside centres managed by this operator", async () => {
        const stalls = [
            { stallID: 3, stallName: "Lao Wang Char Kway Teow", centreName: "Chinatown Complex" },
            { stallID: 4, stallName: "Raj's Curry Corner", centreName: "Chinatown Complex" },
        ];
        salesAnalyticsModel.getStallsByOperatorID.mockResolvedValue(stalls);
        const res = mockRes();

        await operatorController.getMyStalls(req, res);

        expect(salesAnalyticsModel.getStallsByOperatorID).toHaveBeenCalledWith(2);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ stalls });
    });

    test("500s when the database call fails", async () => {
        salesAnalyticsModel.getStallsByOperatorID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await operatorController.getMyStalls(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("getAccount", () => {
    const req = { user: { userID: 10 } };
    const activeAccount = {
        email: "james@email.com",
        firstName: "James",
        lastName: "Tan",
        phone: "91234567",
        isActive: 1,
        passwordHash: "should-never-be-returned",
        profilePictureURL: null,
    };

    test("returns the operator's own profile without the password hash", async () => {
        operatorModel.getAccountByUserID.mockResolvedValue(activeAccount);
        const res = mockRes();

        await operatorController.getAccount(req, res);

        expect(operatorModel.getAccountByUserID).toHaveBeenCalledWith(10);
        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload).toMatchObject({ email: "james@email.com", firstName: "James", phone: "91234567" });
        expect(payload).not.toHaveProperty("passwordHash");
    });

    test("404s when the account does not exist", async () => {
        operatorModel.getAccountByUserID.mockResolvedValue(null);
        const res = mockRes();

        await operatorController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("403s when the account is soft-deleted (isActive = 0)", async () => {
        operatorModel.getAccountByUserID.mockResolvedValue({ ...activeAccount, isActive: 0 });
        const res = mockRes();

        await operatorController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("500s when the database call fails", async () => {
        operatorModel.getAccountByUserID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await operatorController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
