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
            return res.status(404).json({ message: "Account not found." });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(403).json({ message: "Account is disabled." });
        }

        // Compare submitted password against stored hash
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
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
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ message: "Error logging in." });
    }
}

// POST /officers/logout
async function logout(req, res) {
    // JWT is stateless — logout is handled client-side by discarding the token
    res.status(200).json({ message: "Logout successful. Please discard your token." });
}

module.exports = {
    login,
    logout,
};