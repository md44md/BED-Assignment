const jwt = require("jsonwebtoken");

function verifyJWT(req, res, next) {
    // Extract token from Authorization header (format: "Bearer <token>")
    const token =
        req.headers.authorization && req.headers.authorization.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Define which roles are allowed for each endpoint
        // This will grow as you add more protected routes
        const authorizedRoles = {
            // Stall owner menu management routes (to be added next feature)
            "POST /menuitems": ["stallOwner"],
            "PUT /menuitems/[0-9]+": ["stallOwner"],
            "DELETE /menuitems/[0-9]+": ["stallOwner"],
            "GET /menuitems": ["stallOwner"],

            // Stall owner rental agreements
            "GET /rental-agreements": ["stallOwner"],

            // Stall owner status toggle route
            "PUT /stalls/status": ["stallOwner"],

            // Stall owner account deletion
            "DELETE /stallowners/account": ["stallOwner"],

            // NEA officer inspection routes
            "POST /inspections": ["neaOfficer"],

            // Customer cart routes
            "GET /cart": ["customer"],
            "POST /cart/items": ["customer"],
            "DELETE /cart/items/[0-9]+": ["customer"],

            // Customer order routes
            "POST /orders": ["customer"],
            "GET /orders": ["customer"],

            // Customer feedback routes
            "POST /feedback": ["customer"],
            "POST /feedback/edit": ["customer"],
            "GET /feedback": ["customer"],

            // Customer complaint routes
            "POST /complaint": ["customer"],
            "GET /complaint": ["customer"],

            // Customer account deletion
            "DELETE /customers/account": ["customer"],

            // NEA officer hygiene grade routes
            "POST /hygiene-grades": ["neaOfficer"],
            "PUT /hygiene-grades/[0-9]+": ["neaOfficer"],
            "DELETE /hygiene-grades/[0-9]+": ["neaOfficer"],
        };

        const requestedEndpoint = `${req.method} ${req.url}`;
        const userRole = decoded.role;

        const authorizedRole = Object.entries(authorizedRoles).find(
            ([endpoint, roles]) => {
                // Convert the endpoint string into a regex so we can
                // match dynamic segments like /menuitems/1, /menuitems/2, etc.
                const regex = new RegExp(`^${endpoint}$`);
                return regex.test(requestedEndpoint) && roles.includes(userRole);
            }
        );

        if (!authorizedRole) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Attach the decoded token data to req.user so controllers can use it
        req.user = decoded;
        next();
    });
}

module.exports = { verifyJWT };