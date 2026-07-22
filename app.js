const path = require("path");
const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger-output.json");

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
const { validateCreateComplaint, validateUpdateComplaintStatus, validateComplaintFilters } = require("./middlewares/complaintValidation")
const officerComplaintController = require("./controllers/officerComplaintController");
const menuItemController = require("./controllers/menuItemController");
const { validateMenuItem, validateMenuItemId } = require("./middlewares/menuItemValidation")
const { uploadMenuItemImage, uploadProfilePicture } = require("./middlewares/uploadMiddleware");
const rentalAgreementController = require("./controllers/rentalAgreementController");
const userController = require("./controllers/userController");
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
app.get("/stallowners/account", verifyJWT, stallOwnerController.getAccount);

// Routes for customer auth
app.post("/customers/register", validateRegister, customerController.register);
app.post("/customers/login", validateLogin, customerController.login);
app.post("/customers/logout", customerController.logout);
app.delete("/customers/account", verifyJWT, customerController.deleteAccount);
app.get("/customers/account", verifyJWT, customerController.getAccount);

// Routes for officer auth
app.post("/officers/login", validateLogin, officerController.login);
app.post("/officers/logout", officerController.logout);
app.get("/officers/account", verifyJWT, officerController.getAccount);

// Routes for operator auth
app.post("/operators/login", validateLogin, operatorController.login);
app.post("/operators/logout", operatorController.logout);
app.get("/operators/account", verifyJWT, operatorController.getAccount);

// Route for profile picture upload (shared across all roles)
app.put("/account/picture", verifyJWT, uploadProfilePicture, userController.uploadProfilePicture);

// Routes for officer inspections
app.post("/inspections", verifyJWT, validateLogInspection, inspectionController.logInspection);
app.put("/inspections/:id", verifyJWT, validateUpdateInspection, inspectionController.updateInspection);

// Routes for customer cart
app.get("/cart", verifyJWT, cartController.getCart);
app.post("/cart/items", verifyJWT, validateAddItem, cartController.addItemToCart);
app.delete("/cart/items/:cartItemID", verifyJWT, validateCartItemId, cartController.removeItem);

// Routes for orders
app.post("/orders", verifyJWT, validateSubmitOrder, orderController.submitOrder);
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

// Routes for NEA officer complaint oversight
// Officer only: view complaints across every stall, and record follow-up action on one
app.get("/officers/complaints",
    /*
        #swagger.tags = ['Officer Complaints']
        #swagger.summary = 'View complaints submitted about stalls'
        #swagger.description = 'NEA officer view of complaints across every stall, newest first. Each complaint includes the stall, its hawker centre and the customer who raised it. The optional filters can be combined to narrow the list down while investigating.'
        #swagger.parameters['status'] = { in: 'query', description: 'Filter by status: open, underReview, resolved or closed.', type: 'string' }
        #swagger.parameters['stallID'] = { in: 'query', description: 'Filter by the stall the complaint is about.', type: 'integer' }
        #swagger.parameters['category'] = { in: 'query', description: 'Filter by category: Hygiene, Service, Food Quality or Other.', type: 'string' }
        #swagger.responses[200] = { description: 'Matching complaints (empty list when nothing matches).' }
        #swagger.responses[400] = { description: 'Invalid filter value.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer).' }
        #swagger.responses[500] = { description: 'Error retrieving complaints.' }
    */
    verifyJWT, validateComplaintFilters, officerComplaintController.getAllComplaints);
app.put("/officers/complaints/:complaintID/status",
    /*
        #swagger.tags = ['Officer Complaints']
        #swagger.summary = 'Record follow-up action on a complaint'
        #swagger.description = 'Moves a complaint through open -> underReview -> resolved/closed as the officer investigates. Officers have authority over every stall, so no ownership check applies. resolvedAt is stamped when the complaint is resolved or closed, and cleared if it is reopened.'
        #swagger.parameters['complaintID'] = { in: 'path', description: 'ID of the complaint being followed up.', required: true, type: 'integer' }
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { status: 'underReview' } }
        #swagger.responses[200] = { description: 'Status updated; the updated complaint is returned.' }
        #swagger.responses[400] = { description: 'Complaint ID is not a number, or the status is missing/invalid.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer).' }
        #swagger.responses[404] = { description: 'Complaint not found.' }
        #swagger.responses[500] = { description: 'Error updating complaint status.' }
    */
    verifyJWT, validateUpdateComplaintStatus, officerComplaintController.updateComplaintStatus);

// Routes for menu management
app.get("/menuitems", verifyJWT, menuItemController.getMenuItems);
app.post("/menuitems", verifyJWT,uploadMenuItemImage, validateMenuItem, menuItemController.createMenuItem);
app.put("/menuitems/:id", verifyJWT, uploadMenuItemImage, validateMenuItemId, validateMenuItem, menuItemController.updateMenuItem);
app.delete("/menuitems/:id", verifyJWT, validateMenuItemId, menuItemController.deleteMenuItem);

// Routes for customer menu item likes
app.get("/menuitems/likes", verifyJWT, menuItemController.getMyLikedMenuItems);
app.post("/menuitems/:id/like", verifyJWT, validateMenuItemId, menuItemController.likeMenuItem);
app.delete("/menuitems/:id/like", verifyJWT, validateMenuItemId, menuItemController.unlikeMenuItem);

// Route for viewing rental agreements
app.get("/rental-agreements", verifyJWT, rentalAgreementController.getRentalAgreements);

// Public: list all stalls (used by the front-end stall picker, no auth)
app.get("/stalls", stallController.getStalls);
// Public: browse a stall's menu (no auth)
app.get("/stalls/:stallID/menu", stallController.getStallMenu);
// Public: browse a stall's ratings/reviews (no auth)
app.get("/stalls/:stallID/feedback", feedbackController.getStallReviews);
// Stall owner only: toggle own stall's status (open/busy/closed)
app.put("/stalls/status", verifyJWT, stallController.updateStallStatus);

// Routes for stall owner queue management
// Stall owner only: view current queue and advance it (serve current customer)
app.get("/stallowners/queue", verifyJWT, queueController.getQueue);
app.post("/stallowners/queue/advance", verifyJWT, queueController.advanceQueue);

// Routes for hygiene grades
// Public: customers viewing a stall's hygiene grades (no auth)
app.get("/stalls/:stallID/hygiene-grades", hygieneGradeController.getStallGrades);
// Officer only: issue, update and revoke grades
app.post("/hygiene-grades", verifyJWT, validateIssueGrade, hygieneGradeController.issueGrade);
app.put("/hygiene-grades/:gradeID", verifyJWT, validateUpdateGrade, hygieneGradeController.updateGrade);
app.delete("/hygiene-grades/:gradeID", verifyJWT, hygieneGradeController.deleteGrade);

// Routes for viewing sales analytics
app.get("/operators/stalls", verifyJWT, operatorController.getMyStalls)
app.get("/stalls/:stallID/sales-analytics", verifyJWT, salesAnalyticsController.getSalesAnalytics)
app.get("/sales-analytics", verifyJWT, salesAnalyticsController.getMySalesAnalytics)

/* Multer throws its own errors (e.g. file too big, wrong type) that would crash with a raw stack trace. This is to
catch the errors cleanly.*/
app.use((error, req, res, next) => {
    if (error && error.message) {
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

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