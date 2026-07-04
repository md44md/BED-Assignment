const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const stallOwnerModel = require("../models/stallOwnerModel");

// POST /stallowners/register
async function register(req, res) {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        // Check if email is already registered
        const existingUser = await stallOwnerModel.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        // Hash the password before storing
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert into Users table, get back the new userID
        const userID = await stallOwnerModel.createUser(email, passwordHash);

        // Insert into StallOwner table using that userID
        const stallOwnerID = await stallOwnerModel.createStallOwner(
            userID,
            firstName,
            lastName,
            phone
        );

        res.status(201).json({
            message: "Account registered successfully.",
            stallOwnerID: stallOwnerID,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ message: "Error registering account." });
    }
}

// POST /stallowners/login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check if account exists
        const user = await stallOwnerModel.getUserByEmail(email);
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

        // Get stallOwnerID to embed in token
        const stallOwner = await stallOwnerModel.getStallOwnerByUserID(user.userID);

        // Sign JWT with userID, stallOwnerID and role
        const token = jwt.sign(
            {
                userID: user.userID,
                stallOwnerID: stallOwner.stallOwnerID,
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

// POST /stallowners/logout
async function logout(req, res) {
    // JWT is stateless — logout is handled client-side by discarding the token
    res.status(200).json({ message: "Logout successful. Please discard your token." });
}

module.exports = {
    register,
    login,
    logout,
};