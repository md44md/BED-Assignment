const jwt = require("jsonwebtoken");

// Verify JWT token from Authorization header
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Expects: Bearer <token>

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Invalid or expired token." });
        }
        req.user = decoded; // { userID, stallOwnerID, role }
        next();
    });
}

// Check that the logged-in user is a stallOwner
function requireStallOwner(req, res, next) {
    if (req.user.role !== "stallOwner") {
        return res.status(403).json({ error: "Access denied. StallOwner role required." });
    }
    next();
}

// Check that the logged-in user is a customer
function requireCustomer(req, res, next) {
    if (req.user.role !== "customer") {
        return res.status(403).json({ error: "Access denied. Customer role required." });
    }
    next();
}

module.exports = {
    verifyToken,
    requireStallOwner,
    requireCustomer,
};