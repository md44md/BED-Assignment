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

            // Stall owner queue management
            "GET /stallowners/queue": ["stallOwner"],
            "POST /stallowners/queue/advance": ["stallOwner"],

            // Stall owner account deletion / profile view
            "DELETE /stallowners/account": ["stallOwner"],
            "GET /stallowners/account": ["stallOwner"],

            // NEA officer inspection routes
            "POST /inspections": ["neaOfficer"],
            "PUT /inspections/[0-9]+": ["neaOfficer"],
            "POST /inspections/schedule": ["neaOfficer"],
            "GET /inspections/scheduled": ["neaOfficer"],

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

            // Customer menu item like routes
            "GET /menuitems/likes": ["customer"],
            "POST /menuitems/[0-9]+/like": ["customer"],
            "DELETE /menuitems/[0-9]+/like": ["customer"],

            // Customer complaint routes
            "POST /complaint": ["customer"],
            "GET /complaint": ["customer"],

            // Stall owner complaint routes
            "GET /complaint/stall": ["stallOwner"],
            "PUT /complaint/[0-9]+/status": ["stallOwner"],

            // Stall owner feedback routes
            "GET /feedback/stall": ["stallOwner"],

            // Customer account deletion / profile view
            "DELETE /customers/account": ["customer"],
            "GET /customers/account": ["customer"],

            // NEA officer hygiene grade routes
            "POST /hygiene-grades": ["neaOfficer"],
            "PUT /hygiene-grades/[0-9]+": ["neaOfficer"],
            "DELETE /hygiene-grades/[0-9]+": ["neaOfficer"],

            // NEA officer complaint oversight routes
            "GET /officers/complaints": ["neaOfficer"],
            "PUT /officers/complaints/[0-9]+/status": ["neaOfficer"],

            // Operator sales analytics route
            "GET /stalls/[0-9]+/sales-analytics": ["operator"],

            // Stall owner sales analytics route
            "GET /sales-analytics": ["stallOwner"],

            // Operator stall list (filtered to their centres)
            "GET /operators/stalls": ["operator"],

            // Profile view (officer / operator)
            "GET /officers/account": ["neaOfficer"],
            "GET /operators/account": ["operator"],

            // Profile picture upload (any logged-in role)
            "PUT /account/picture": ["customer", "stallOwner", "operator", "neaOfficer"],
        };

        // req.path is the path WITHOUT the query string. req.url would include it, so a
        // filtered request like /officers/complaints?status=open would fail to match its
        // allow-list entry and be rejected with a 403.
        const requestedEndpoint = `${req.method} ${req.path}`;
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