const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const operatorModel = require("../models/operatorModel");

// POST /operators/login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check if account exists
        const user = await operatorModel.getUserByEmail(email);
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

        // Get operatorID to embed in token
        const operator = await operatorModel.getOperatorByUserID(user.userID);

        // Sign JWT with userID, operatorID and role
        const token = jwt.sign(
            {
                userID: user.userID,
                operatorID: operator.operatorID,
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
        res.status(500).json({ error: "Error logging in." });
    }
}

// POST /operators/logout
async function logout(req, res) {
    // JWT is stateless — logout is handled client-side by discarding the token
    res.status(200).json({ message: "Logout successful. Please discard your token." });
}

module.exports = {
    login,
    logout,
};