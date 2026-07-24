// Swagger / OpenAPI generator (swagger-autogen).
// Scans app.js for routes and writes the spec to swagger-output.json.
// Run with: node swagger.js  (or: npm run swagger)
// Then restart the server -- app.js serves the generated file at /api-docs.

const swaggerAutogen = require("swagger-autogen")();

const doc = {
    info: {
        title: "Hawker Centre Management System API",
        description:
            "RESTful API for the Hawker Centre Management System (BED assignment). " +
            "Protected endpoints require a Bearer JWT obtained from the relevant /login route.",
        version: "1.0.0",
    },
    host: "localhost:3000",
    schemes: ["http"],
    securityDefinitions: {
        bearerAuth: {
            type: "apiKey",
            name: "Authorization",
            in: "header",
            description:
                "Paste: Bearer <token>. Get a token from /customers/login, /stallowners/login, /operators/login, or /officers/login.",
        },
    },
    // Applied to every route by default; routes that don't need auth
    // are opted out individually with '#swagger.security = []' in app.js.
    security: [{ bearerAuth: [] }],
};

const outputFile = "./swagger-output.json";
const routes = [
    "./app.js",
    "./controllers/stallOwnerController.js",
    "./controllers/customerController.js",
    "./controllers/officerController.js",
    "./controllers/operatorController.js",
    "./controllers/inspectionController.js",
    "./controllers/cartController.js",
    "./controllers/orderController.js",
    "./controllers/hygieneGradeController.js",
    "./controllers/stallController.js",
    "./controllers/feedbackController.js",
    "./controllers/complaintController.js",
    "./controllers/officerComplaintController.js",
    "./controllers/menuItemController.js",
    "./controllers/rentalAgreementController.js",
    "./controllers/promotionController.js",
    "./controllers/hawkerCentreController.js",
    "./controllers/queueController.js",
    "./controllers/salesAnalyticsController.js",
];

swaggerAutogen(outputFile, routes, doc);
