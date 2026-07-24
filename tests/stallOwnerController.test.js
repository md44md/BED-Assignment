// Unit tests for the stall owner controller (vendor registration, login/logout).
// The model, bcryptjs, and jsonwebtoken are all mocked, so no database connection,
// real password hashing, or real token signing happens -- these tests only check
// that the controller wires everything together correctly.

jest.mock("../models/stallOwnerModel");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const stallOwnerModel = require("../models/stallOwnerModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const stallOwnerController = require("../controllers/stallOwnerController");

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

describe("register", () => {
    const reqBody = {
        body: {
            email: "newowner@email.com",
            password: "Password123!",
            firstName: "New",
            lastName: "Owner",
            phone: "90000000",
        },
    };

    test("creates the user and stall owner, returning 201 with the new stallOwnerID", async () => {
        stallOwnerModel.getUserByEmail.mockResolvedValue(null);
        bcrypt.genSalt.mockResolvedValue("salt");
        bcrypt.hash.mockResolvedValue("hashedPassword");
        stallOwnerModel.createUser.mockResolvedValue(20);
        stallOwnerModel.createStallOwner.mockResolvedValue(7);
        const res = mockRes();

        await stallOwnerController.register(reqBody, res);

        expect(stallOwnerModel.createUser).toHaveBeenCalledWith("newowner@email.com", "hashedPassword");
        expect(stallOwnerModel.createStallOwner).toHaveBeenCalledWith(20, "New", "Owner", "90000000");
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Account registered successfully.",
            stallOwnerID: 7,
        });
    });

    test("409s when the email is already registered", async () => {
        stallOwnerModel.getUserByEmail.mockResolvedValue({ userID: 1, email: "newowner@email.com" });
        const res = mockRes();

        await stallOwnerController.register(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: "Email is already registered." });
        expect(stallOwnerModel.createUser).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        stallOwnerModel.getUserByEmail.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await stallOwnerController.register(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error registering account." });
    });
});

describe("login", () => {
    const reqBody = { body: { email: "diana@email.com", password: "Diana123!" } };
    const activeUser = {
        userID: 4,
        email: "diana@email.com",
        passwordHash: "hashedPassword",
        role: "stallOwner",
        isActive: 1,
    };

    test("logs in and returns a signed JWT on success", async () => {
        stallOwnerModel.getUserByEmail.mockResolvedValue(activeUser);
        bcrypt.compare.mockResolvedValue(true);
        stallOwnerModel.getStallOwnerByUserID.mockResolvedValue({ stallOwnerID: 1 });
        jwt.sign.mockReturnValue("signed.jwt.token");
        const res = mockRes();

        await stallOwnerController.login(reqBody, res);

        expect(jwt.sign).toHaveBeenCalledWith(
            { userID: 4, stallOwnerID: 1, role: "stallOwner" },
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
        stallOwnerModel.getUserByEmail.mockResolvedValue(null);
        const res = mockRes();

        await stallOwnerController.login(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Account not found." });
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("403s when the account is disabled", async () => {
        stallOwnerModel.getUserByEmail.mockResolvedValue({ ...activeUser, isActive: 0 });
        const res = mockRes();

        await stallOwnerController.login(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: "Account is disabled." });
    });

    test("401s when the password does not match", async () => {
        stallOwnerModel.getUserByEmail.mockResolvedValue(activeUser);
        bcrypt.compare.mockResolvedValue(false);
        const res = mockRes();

        await stallOwnerController.login(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials." });
        expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("500s when the database call fails", async () => {
        stallOwnerModel.getUserByEmail.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await stallOwnerController.login(reqBody, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error logging in." });
    });
});

describe("logout", () => {
    test("returns 200 without touching the model (JWT logout is client-side)", async () => {
        const res = mockRes();

        await stallOwnerController.logout({}, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String) })
        );
    });
});

describe("deleteAccount", () => {
    test("deactivates the account and returns 200", async () => {
        stallOwnerModel.deactivateAccount.mockResolvedValue();
        const res = mockRes();

        await stallOwnerController.deleteAccount({ user: { userID: 4 } }, res);

        expect(stallOwnerModel.deactivateAccount).toHaveBeenCalledWith(4);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Account deleted successfully." });
    });

    test("500s when deactivation fails", async () => {
        stallOwnerModel.deactivateAccount.mockRejectedValue(new Error("UPDATE failed"));
        const res = mockRes();

        await stallOwnerController.deleteAccount({ user: { userID: 4 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error deleting account." });
    });
});

describe("getAccount", () => {
    const req = { user: { userID: 4 } };
    const activeAccount = {
        email: "diana@email.com",
        firstName: "Diana",
        lastName: "Koh",
        phone: "94567890",
        isActive: 1,
        passwordHash: "should-never-be-returned",
        profilePictureURL: null,
    };

    test("returns the stall owner's own profile without the password hash", async () => {
        stallOwnerModel.getAccountByUserID.mockResolvedValue(activeAccount);
        const res = mockRes();

        await stallOwnerController.getAccount(req, res);

        expect(stallOwnerModel.getAccountByUserID).toHaveBeenCalledWith(4);
        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload).toMatchObject({ email: "diana@email.com", firstName: "Diana", phone: "94567890" });
        expect(payload).not.toHaveProperty("passwordHash");
    });

    test("404s when the account does not exist", async () => {
        stallOwnerModel.getAccountByUserID.mockResolvedValue(null);
        const res = mockRes();

        await stallOwnerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("403s when the account is soft-deleted (isActive = 0)", async () => {
        stallOwnerModel.getAccountByUserID.mockResolvedValue({ ...activeAccount, isActive: 0 });
        const res = mockRes();

        await stallOwnerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("500s when the database call fails", async () => {
        stallOwnerModel.getAccountByUserID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await stallOwnerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
