// Unit tests for the customer controller's account features: deleting the
// account (soft delete) and viewing the own profile. customerModel is mocked,
// so no database connection happens.

jest.mock("../models/customerModel");

const customerModel = require("../models/customerModel");
const customerController = require("../controllers/customerController");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("deleteAccount", () => {
    test("deactivates the account and returns 200", async () => {
        customerModel.deactivateAccount.mockResolvedValue();
        const res = mockRes();

        await customerController.deleteAccount({ user: { userID: 1 } }, res);

        expect(customerModel.deactivateAccount).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: "Account deleted successfully." });
    });

    test("500s when deactivation fails", async () => {
        customerModel.deactivateAccount.mockRejectedValue(new Error("UPDATE failed"));
        const res = mockRes();

        await customerController.deleteAccount({ user: { userID: 1 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error deleting account." });
    });
});

describe("getAccount", () => {
    const req = { user: { userID: 1 } };
    const activeAccount = {
        email: "alice@email.com",
        firstName: "Alice",
        lastName: "Tan",
        phone: "91112222",
        isVerified: 1,
        isActive: 1,
        passwordHash: "should-never-be-returned",
        profilePictureURL: null,
    };

    test("returns the customer's own profile without the password hash", async () => {
        customerModel.getAccountByUserID.mockResolvedValue(activeAccount);
        const res = mockRes();

        await customerController.getAccount(req, res);

        expect(customerModel.getAccountByUserID).toHaveBeenCalledWith(1);
        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload).toMatchObject({ email: "alice@email.com", firstName: "Alice", isVerified: 1 });
        expect(payload).not.toHaveProperty("passwordHash");
    });

    test("404s when the account does not exist", async () => {
        customerModel.getAccountByUserID.mockResolvedValue(null);
        const res = mockRes();

        await customerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("403s when the account is soft-deleted (isActive = 0)", async () => {
        customerModel.getAccountByUserID.mockResolvedValue({ ...activeAccount, isActive: 0 });
        const res = mockRes();

        await customerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("500s when the database call fails", async () => {
        customerModel.getAccountByUserID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await customerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
