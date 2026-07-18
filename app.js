const path = require("path");
const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

dotenv.config();

// controllers and middlewares
const stallOwnerController = require("./controllers/stallOwnerController");
const customerController = require("./controllers/customerController");
const officerController = require("./controllers/officerController");
const operatorController = require("./controllers/operatorController");
const { validateRegister, validateLogin } = require("./middlewares/userValidation");
const inspectionController = require("./controllers/inspectionController");
const { validateLogInspection, validateUpdateInspection } = require("./middlewares/inspectionValidation");
const cartController = require("./controllers/cartController");
const { validateAddItem, validateCartItemId } = require("./middlewares/cartValidation");
const orderController = require("./controllers/orderController");
const { validateSubmitOrder } = require("./middlewares/orderValidation");
const hygieneGradeController = require("./controllers/hygieneGradeController");
const { validateIssueGrade, validateUpdateGrade } = require("./middlewares/hygieneGradeValidation");
const stallController = require("./controllers/stallController");
const feedbackController = require("./controllers/feedbackController");
const { validateSubmitFeedback, validateEditFeedback } = require("./middlewares/feedbackValidation");
const complaintController = require("./controllers/complaintController")
const { validateCreateComplaint, validateUpdateComplaintStatus } = require("./middlewares/complaintValidation")
const menuItemController = require("./controllers/menuItemController");
const { validateMenuItem, validateMenuItemId } = require("./middlewares/menuItemValidation")
const rentalAgreementController = require("./controllers/rentalAgreementController");
const queueController = require("./controllers/queueController");
const salesAnalyticsController = require("./controllers/salesAnalyticsController")
const { verifyJWT } = require("./middlewares/auth");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

// Interactive API documentation (Swagger UI) served at /api-docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes for stall owner auth
app.post("/stallowners/register", validateRegister, stallOwnerController.register);
app.post("/stallowners/login", validateLogin, stallOwnerController.login);
app.post("/stallowners/logout", stallOwnerController.logout);
app.delete("/stallowners/account", verifyJWT, stallOwnerController.deleteAccount);

// Routes for customer auth
app.post("/customers/register", validateRegister, customerController.register);
app.post("/customers/login", validateLogin, customerController.login);
app.post("/customers/logout", customerController.logout);
app.delete("/customers/account", verifyJWT, customerController.deleteAccount);

// Routes for officer auth
/**
 * @openapi
 * /officers/login:
 *   post:
 *     tags: [Officer Auth]
 *     summary: Log in as an NEA officer
 *     description: Authenticates officer credentials and returns a JWT for use as a Bearer token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: mary@email.com }
 *               password: { type: string, format: password, example: Mary123! }
 *     responses:
 *       200:
 *         description: Login successful; JWT returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 token:   { type: string, description: JWT bearer token }
 *       400: { description: Validation error (missing/malformed fields) }
 *       401: { description: Invalid credentials }
 *       404: { description: Account not found (or not an officer account) }
 */
app.post("/officers/login", validateOfficerLogin, officerController.login);
/**
 * @openapi
 * /officers/logout:
 *   post:
 *     tags: [Officer Auth]
 *     summary: Log out (stateless)
 *     description: JWT is stateless, so logout is confirmed and the client discards the token.
 *     responses:
 *       200: { description: Logout confirmed. }
 */
app.post("/officers/login", validateLogin, officerController.login);
app.post("/officers/logout", officerController.logout);

// Routes for operator auth
app.post("/operators/login", validateLogin, operatorController.login);
app.post("/operators/logout", operatorController.logout);

// Routes for officer inspections
/**
 * @openapi
 * /inspections:
 *   post:
 *     tags: [Inspections]
 *     summary: Log an inspection result for a stall
 *     description: NEA officer records a hygiene score and remarks against an existing stall.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stallID, score, remarks]
 *             properties:
 *               stallID:        { type: integer, example: 1 }
 *               score:          { type: integer, minimum: 0, maximum: 100, example: 88 }
 *               remarks:        { type: string, example: Generally clean, minor grease buildup. }
 *               inspectionDate: { type: string, format: date, description: Optional; defaults to today. Cannot be in the future. }
 *     responses:
 *       201: { description: Inspection record created. }
 *       400: { description: Validation error (missing score, score out of range, empty remarks, future date). }
 *       401: { description: Unauthorized (no/invalid token). }
 *       403: { description: Forbidden (not an officer). }
 *       404: { description: Stall not found. }
 */
app.post("/inspections", verifyJWT, validateLogInspection, inspectionController.logInspection);
app.put("/inspections/:id", verifyJWT, validateUpdateInspection, inspectionController.updateInspection);

// Routes for customer cart
app.get("/cart", verifyJWT, cartController.getCart);
app.post("/cart/items", verifyJWT, validateAddItem, cartController.addItemToCart);
app.delete("/cart/items/:cartItemID", verifyJWT, validateCartItemId, cartController.removeItem);

// Routes for orders
app.post("/orders", verifyJWT, validateSubmitOrder, orderController.submitOrder);
/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: View my past orders
 *     description: >
 *       Returns the logged-in customer's own orders only (scoped by customerID from the JWT),
 *       newest first, each with its snapshotted line items and totals.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The customer's orders (empty array if none).
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   orderID:     { type: integer }
 *                   stallID:     { type: integer }
 *                   stallName:   { type: string }
 *                   queueNumber: { type: integer }
 *                   status:      { type: string }
 *                   totalAmount: { type: number, format: float }
 *                   createdAt:   { type: string, format: date-time }
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         itemName:  { type: string }
 *                         unitPrice: { type: number, format: float }
 *                         quantity:  { type: integer }
 *                         addons:    { type: string, nullable: true }
 *                         itemTotal: { type: number, format: float }
 *       401: { description: Unauthorized (no/invalid token). }
 *       403: { description: Forbidden (not a customer). }
 */
app.get("/orders", verifyJWT, orderController.getMyOrders);

// Routes for feedback
app.post("/feedback", verifyJWT, validateSubmitFeedback, feedbackController.submitFeedback);
app.post("/feedback/edit", verifyJWT, validateEditFeedback, feedbackController.editFeedback);
app.get("/feedback", verifyJWT, feedbackController.getMyFeedback);

// Routes for complaints
app.post("/complaint", verifyJWT, validateCreateComplaint, complaintController.createComplaint);
app.get("/complaint", verifyJWT, complaintController.getComplaintsByCustomer);

// Routes for stall satisfaction and complaint viewing
app.get("/complaint/stall", verifyJWT, complaintController.getComplaintsByStall);
app.put("/complaint/:complaintID/status", verifyJWT, validateUpdateComplaintStatus, complaintController.updateComplaintStatus);
app.get("/feedback/stall", verifyJWT, feedbackController.getStallFeedback);

// Routes for menu management
app.get("/menuitems", verifyJWT, menuItemController.getMenuItems);
app.post("/menuitems", verifyJWT, validateMenuItem, menuItemController.createMenuItem);
app.put("/menuitems/:id", verifyJWT, validateMenuItemId, validateMenuItem, menuItemController.updateMenuItem);
app.delete("/menuitems/:id", verifyJWT, validateMenuItemId, menuItemController.deleteMenuItem);

// Route for viewing rental agreements
app.get("/rental-agreements", verifyJWT, rentalAgreementController.getRentalAgreements);

// Public: list all stalls (used by the front-end stall picker, no auth)
app.get("/stalls", stallController.getStalls);
// Public: browse a stall's menu (no auth)
app.get("/stalls/:stallID/menu", stallController.getStallMenu);
// Stall owner only: toggle own stall's status (open/busy/closed)
app.put("/stalls/status", verifyJWT, stallController.updateStallStatus);

// Routes for stall owner queue management
// Stall owner only: view current queue and advance it (serve current customer)
/**
 * @openapi
 * /stallowners/queue:
 *   get:
 *     tags: [Queue]
 *     summary: View my stall's current queue
 *     description: >
 *       Returns today's active orders (pending / preparing / ready) for the logged-in owner's
 *       stall, ordered by queue number. The head of the list is the current customer.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The current queue (current is null and queue is empty when no one is waiting).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 current:
 *                   allOf:
 *                     - $ref: '#/components/schemas/QueueOrder'
 *                   nullable: true
 *                   description: The customer being served now, or null when the queue is empty.
 *                 queue:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QueueOrder'
 *       401: { description: Unauthorized (no/invalid token). }
 *       403: { description: Forbidden (not a stall owner). }
 *       404: { description: No stall found for this account. }
 */
app.get("/stallowners/queue", verifyJWT, queueController.getQueue);
/**
 * @openapi
 * /stallowners/queue/advance:
 *   post:
 *     tags: [Queue]
 *     summary: Serve the current customer and advance the queue
 *     description: >
 *       Marks the current (head) order as completed and promotes the next order to current.
 *       When a next customer exists, the back-end emails them via the Brevo third-party API and
 *       records the result in the Notification table. A failed email does not fail the request
 *       (the response reports notified=false and the notification is logged as failed).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current customer served; queue advanced.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:     { type: string }
 *                 servedOrder:
 *                   allOf:
 *                     - $ref: '#/components/schemas/QueueOrderSummary'
 *                   description: The order just served, with status already 'completed'.
 *                 nextOrder:
 *                   allOf:
 *                     - $ref: '#/components/schemas/QueueOrderSummary'
 *                   nullable: true
 *                   description: The new current customer, or null if the queue is now empty.
 *                 notified:
 *                   type: boolean
 *                   description: True only when the next customer was emailed successfully.
 *       401: { description: Unauthorized (no/invalid token). }
 *       403: { description: Forbidden (not a stall owner). }
 *       404: { description: No stall found, or no customer in the queue to serve. }
 */
app.post("/stallowners/queue/advance", verifyJWT, queueController.advanceQueue);

// Routes for hygiene grades
// Public: customers viewing a stall's hygiene grades (no auth)
app.get("/stalls/:stallID/hygiene-grades", hygieneGradeController.getStallGrades);
// Officer only: issue, update and revoke grades
/**
 * @openapi
 * /hygiene-grades:
 *   post:
 *     tags: [Hygiene Grades]
 *     summary: Issue a hygiene grade to a stall
 *     description: >
 *       NEA officer issues an A/B/C/D grade off an existing completed inspection that belongs to
 *       the same stall. Issuing a new grade retires the stall's previous active grade (transaction).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inspectionID, grade]
 *             properties:
 *               inspectionID: { type: integer, example: 1 }
 *               grade:        { type: string, enum: [A, B, C, D], example: A, description: Normalised to uppercase. }
 *     responses:
 *       201: { description: Grade issued. }
 *       400: { description: Validation error (missing/invalid grade or inspectionID). }
 *       401: { description: Unauthorized (no/invalid token). }
 *       403: { description: Forbidden (not an officer). }
 *       404: { description: No completed inspection for that stall (not completed, or belongs to another stall). }
 */
app.post("/hygiene-grades", verifyJWT, validateIssueGrade, hygieneGradeController.issueGrade);
app.put("/hygiene-grades/:gradeID", verifyJWT, validateUpdateGrade, hygieneGradeController.updateGrade);
app.delete("/hygiene-grades/:gradeID", verifyJWT, hygieneGradeController.deleteGrade);

// Routes for viewing sales analytics
app.get("/operators/stalls", verifyJWT, operatorController.getMyStalls)
app.get("/stalls/:stallID/sales-analytics", verifyJWT, salesAnalyticsController.getSalesAnalytics)
app.get("/sales-analytics", verifyJWT, salesAnalyticsController.getMySalesAnalytics)

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Server is gracefully shutting down...");
    await sql.close();
    console.log("Database connection closed.");
    process.exit(0);
});