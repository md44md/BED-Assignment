const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const customerModel = require("../models/customerModel");

// POST /customers/register
async function register(req, res) {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        // Check if email is already registered
        const existingUser = await customerModel.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: "Email is already registered." });
        }

        // Hash the password before storing
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert into Users table, get back the new userID
        const userID = await customerModel.createUser(email, passwordHash);

        // Insert into Customer table using that userID
        const customerID = await customerModel.createCustomer(
            userID,
            firstName,
            lastName,
            phone
        );

        res.status(201).json({
            message: "Account registered successfully.",
            customerID: customerID,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error registering account." });
    }
}

// POST /customers/login
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Check if account exists
        const user = await customerModel.getUserByEmail(email);
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

        // Get customerID to embed in token
        const customer = await customerModel.getCustomerByUserID(user.userID);

        // Sign JWT with userID, customerID and role
        const token = jwt.sign(
            {
                userID: user.userID,
                customerID: customer.customerID,
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

// POST /customers/logout
async function logout(req, res) {
    // JWT is stateless — logout is handled client-side by discarding the token
    res.status(200).json({ message: "Logout successful. Please discard your token." });
}

// DELETE /customers/account
async function deleteAccount(req, res) {
    try {
        await customerModel.deactivateAccount(req.user.userID);
        res.status(200).json({ message: "Account deleted successfully." });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error deleting account." });
    }
}

// GET /customers/account
async function getAccount(req, res) {
    try {
        const account = await customerModel.getAccountByUserID(req.user.userID);
        if (!account) {
            return res.status(404).json({ error: "Account not found." });
        }

        // A soft-deleted account shouldn't be viewable even with a still-valid token.
        if (!account.isActive) {
            return res.status(403).json({ error: "Account is disabled." });
        }

        res.status(200).json({
            email: account.email,
            firstName: account.firstName,
            lastName: account.lastName,
            phone: account.phone,
            isVerified: account.isVerified,
            profilePictureURL: account.profilePictureURL,
        });
    } catch (error) {
        console.error("Controller error:", error);
        res.status(500).json({ error: "Error retrieving account." });
    }
}

module.exports = {
    register,
    login,
    logout,
    deleteAccount,
    getAccount,
};
