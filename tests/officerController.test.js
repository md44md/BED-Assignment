// Unit tests for the NEA officer controller's view-account feature.
// officerModel is mocked, so no database connection happens.

jest.mock("../models/officerModel");

const officerModel = require("../models/officerModel");
const officerController = require("../controllers/officerController");

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

describe("getAccount", () => {
    const req = { user: { userID: 13 } };
    const activeAccount = {
        email: "mary@email.com",
        firstName: "Mary",
        lastName: "Lim",
        badgeNumber: "NEA-001",
        department: "Hygiene",
        isActive: 1,
        passwordHash: "should-never-be-returned",
        profilePictureURL: null,
    };

    test("returns the officer's own profile without the password hash", async () => {
        officerModel.getAccountByUserID.mockResolvedValue(activeAccount);
        const res = mockRes();

        await officerController.getAccount(req, res);

        expect(officerModel.getAccountByUserID).toHaveBeenCalledWith(13);
        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload).toMatchObject({ email: "mary@email.com", badgeNumber: "NEA-001", department: "Hygiene" });
        expect(payload).not.toHaveProperty("passwordHash");
    });

    test("404s when the account does not exist", async () => {
        officerModel.getAccountByUserID.mockResolvedValue(null);
        const res = mockRes();

        await officerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("403s when the account is soft-deleted (isActive = 0)", async () => {
        officerModel.getAccountByUserID.mockResolvedValue({ ...activeAccount, isActive: 0 });
        const res = mockRes();

        await officerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("500s when the database call fails", async () => {
        officerModel.getAccountByUserID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await officerController.getAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
