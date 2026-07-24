// Unit tests for the shared user controller (changeEmail).
// The model and bcryptjs are mocked, so no database connection or real password
// comparison happens -- these tests only check that the controller wires the
// password check, uniqueness check, and update together with the right responses.

jest.mock("../models/userModel");
jest.mock("bcryptjs");

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const userController = require("../controllers/userController");

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

describe("changeEmail", () => {
    const existingUser = {
        userID: 4,
        email: "old@email.com",
        passwordHash: "hashedPassword",
    };

    function reqBody() {
        return {
            user: { userID: 4 },
            body: { newEmail: "new@email.com", currentPassword: "Password123!" },
        };
    }

    test("updates the email and returns 200 with the new email", async () => {
        userModel.getUserByUserID.mockResolvedValue(existingUser);
        bcrypt.compare.mockResolvedValue(true);
        userModel.getUserByEmailGlobal.mockResolvedValue(null);
        userModel.updateEmail.mockResolvedValue({ email: "new@email.com" });
        const res = mockRes();

        await userController.changeEmail(reqBody(), res);

        expect(bcrypt.compare).toHaveBeenCalledWith("Password123!", "hashedPassword");
        expect(userModel.updateEmail).toHaveBeenCalledWith(4, "new@email.com");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Email updated successfully.",
            email: "new@email.com",
        });
    });

    test("401s when the current password is incorrect", async () => {
        userModel.getUserByUserID.mockResolvedValue(existingUser);
        bcrypt.compare.mockResolvedValue(false);
        const res = mockRes();

        await userController.changeEmail(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Current password is incorrect." });
        expect(userModel.updateEmail).not.toHaveBeenCalled();
    });

    test("409s when the new email is already in use", async () => {
        userModel.getUserByUserID.mockResolvedValue(existingUser);
        bcrypt.compare.mockResolvedValue(true);
        userModel.getUserByEmailGlobal.mockResolvedValue({ userID: 9 });
        const res = mockRes();

        await userController.changeEmail(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: "Email is already in use." });
        expect(userModel.updateEmail).not.toHaveBeenCalled();
    });

    test("404s when the account cannot be found", async () => {
        userModel.getUserByUserID.mockResolvedValue(null);
        const res = mockRes();

        await userController.changeEmail(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: "Account not found." });
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("400s when the new email matches the current email", async () => {
        userModel.getUserByUserID.mockResolvedValue(existingUser);
        bcrypt.compare.mockResolvedValue(true);
        const req = reqBody();
        req.body.newEmail = "old@email.com";
        const res = mockRes();

        await userController.changeEmail(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "New email is the same as your current email." });
        expect(userModel.getUserByEmailGlobal).not.toHaveBeenCalled();
        expect(userModel.updateEmail).not.toHaveBeenCalled();
    });

    test("500s when a database call fails", async () => {
        userModel.getUserByUserID.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await userController.changeEmail(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Error updating email." });
    });
});
