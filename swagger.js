// Swagger / OpenAPI configuration.
// Specs are written as @openapi JSDoc annotation blocks above the routes in app.js;
// swagger-jsdoc collects them and swagger-ui-express serves them at /api-docs.

const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Hawker Centre Management System API",
            version: "1.0.0",
            description:
                "RESTful API for the Hawker Centre Management System (BED assignment). " +
                "Protected endpoints require a Bearer JWT obtained from the relevant /login route.",
        },
        servers: [
            { url: "http://localhost:3000", description: "Local development server" },
        ],
        components: {
            securitySchemes: {
                // Reusable JWT bearer scheme; routes opt in with `security: [{ bearerAuth: [] }]`.
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                // One order as it appears when viewing a stall's queue.
                QueueOrder: {
                    type: "object",
                    properties: {
                        orderID: { type: "integer", example: 8 },
                        customerID: { type: "integer", example: 1 },
                        queueNumber: { type: "integer", example: 43 },
                        status: { type: "string", example: "pending" },
                        createdAt: { type: "string", format: "date-time" },
                    },
                },
                // The same order as reported by the advance endpoint, which reads the
                // queue rows it acts on and so does not carry createdAt.
                QueueOrderSummary: {
                    type: "object",
                    properties: {
                        orderID: { type: "integer", example: 8 },
                        customerID: { type: "integer", example: 1 },
                        queueNumber: { type: "integer", example: 43 },
                        status: { type: "string", example: "completed" },
                    },
                },
            },
        },
    },
    // Files containing @openapi annotations.
    apis: ["./app.js"],
};

module.exports = swaggerJsdoc(options);
