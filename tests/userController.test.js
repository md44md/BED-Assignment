// Unit tests for the shared user controller (changeEmail, forgotPassword, resetPassword).
// The model, bcryptjs, and emailService are mocked, so no database connection, real
// password hashing, or real email send happens -- these tests only check that the
// controller wires lookups/hashing/updates together with the right responses.

jest.mock("../models/userModel");
jest.mock("bcryptjs");
jest.mock("../services/emailService");

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const emailService = require("../services/emailService");
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

const GENERIC_FORGOT_MESSAGE = "If an account exists for that email, a password reset link has been sent.";

describe("forgotPassword", () => {
    function reqBody(email = "alice@email.com") {
        return { body: { email } };
    }

    test("creates a token, emails the reset link, and returns the generic message", async () => {
        userModel.getUserByEmailGlobal.mockResolvedValue({ userID: 1, isActive: true });
        userModel.createPasswordResetToken.mockResolvedValue();
        emailService.sendPasswordResetEmail.mockResolvedValue({ ok: true });
        const res = mockRes();

        await userController.forgotPassword(reqBody(), res);

        expect(userModel.createPasswordResetToken).toHaveBeenCalledWith(1, expect.any(String), expect.any(Date));
        const [toEmail, resetLink] = emailService.sendPasswordResetEmail.mock.calls[0];
        expect(toEmail).toBe("alice@email.com");
        expect(resetLink).toContain("/reset-password.html?token=");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: GENERIC_FORGOT_MESSAGE });
    });

    test("returns the generic message without sending an email when no account matches", async () => {
        userModel.getUserByEmailGlobal.mockResolvedValue(null);
        const res = mockRes();

        await userController.forgotPassword(reqBody("nobody@email.com"), res);

        expect(userModel.createPasswordResetToken).not.toHaveBeenCalled();
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: GENERIC_FORGOT_MESSAGE });
    });

    test("returns the generic message without sending an email when the account is disabled", async () => {
        userModel.getUserByEmailGlobal.mockResolvedValue({ userID: 1, isActive: false });
        const res = mockRes();

        await userController.forgotPassword(reqBody(), res);

        expect(userModel.createPasswordResetToken).not.toHaveBeenCalled();
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: GENERIC_FORGOT_MESSAGE });
    });

    test("still returns 200 with the generic message even when the email fails to send", async () => {
        userModel.getUserByEmailGlobal.mockResolvedValue({ userID: 1, isActive: true });
        userModel.createPasswordResetToken.mockResolvedValue();
        emailService.sendPasswordResetEmail.mockResolvedValue({ ok: false, error: "Key not found" });
        const res = mockRes();

        await userController.forgotPassword(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: GENERIC_FORGOT_MESSAGE });
    });

    test("500s when a database call fails", async () => {
        userModel.getUserByEmailGlobal.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await userController.forgotPassword(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("resetPassword", () => {
    function reqBody(token = "raw-token-value", password = "NewPassword123!") {
        return { body: { token, password } };
    }

    test("hashes the new password and redeems the token", async () => {
        userModel.getValidPasswordResetToken.mockResolvedValue({ tokenID: 5, userID: 1 });
        bcrypt.genSalt.mockResolvedValue("salt");
        bcrypt.hash.mockResolvedValue("hashedNewPassword");
        userModel.redeemPasswordResetToken.mockResolvedValue();
        const res = mockRes();

        await userController.resetPassword(reqBody(), res);

        expect(bcrypt.hash).toHaveBeenCalledWith("NewPassword123!", "salt");
        expect(userModel.redeemPasswordResetToken).toHaveBeenCalledWith(5, 1, "hashedNewPassword");
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("400s when the token is invalid or expired, without touching the password", async () => {
        userModel.getValidPasswordResetToken.mockResolvedValue(null);
        const res = mockRes();

        await userController.resetPassword(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(userModel.redeemPasswordResetToken).not.toHaveBeenCalled();
    });

    test("500s when a database call fails", async () => {
        userModel.getValidPasswordResetToken.mockRejectedValue(new Error("connection lost"));
        const res = mockRes();

        await userController.resetPassword(reqBody(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
