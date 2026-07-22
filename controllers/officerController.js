const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const officerModel = require("../models/officerModel");

// POST /officers/login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check if account exists
        const user = await officerModel.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: "Account not found." });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({ error: "Account is disabled." });
        }

        // Compare submitted password against stored hash
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Get officerID to embed in token
        const officer = await officerModel.getOfficerByUserID(user.userID);

        // Sign JWT with userID, officerID and role
        const token = jwt.sign(
            {
                userID: user.userID,
                officerID: officer.officerID,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
        );

        res.status(200).json({
            message: "Login successful.",
            token: token,
            profilePictureURL: user.profilePictureURL,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error logging in." });
    }
}

// POST /officers/logout
async function logout(req, res) {
    // JWT is stateless — logout is handled client-side by discarding the token
    res.status(200).json({ message: "Logout successful. Please discard your token." });
}

// GET /officers/account
async function getAccount(req, res) {
    try {
        const account = await officerModel.getAccountByUserID(req.user.userID);
        if (!account) {
            return res.status(404).json({ error: "Account not found." });
        }

        if (!account.isActive) {
            return res.status(403).json({ error: "Account is disabled." });
        }

        res.status(200).json({
            email: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
            badgeNumber: account.badgeNumber,
            department: account.department,
            profilePictureURL: account.profilePictureURL,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving account." });
    }
}

module.exports = {
    login,
    logout,
    getAccount,
};