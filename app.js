const path = require("path");
const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");

dotenv.config();

// controllers and middlewares
const stallOwnerController = require("./controllers/stallOwnerController");
const customerController = require("./controllers/customerController");
const officerController = require("./controllers/officerController");
const operatorController = require("./controllers/operatorController");
const { validateRegister, validateLogin } = require("./middlewares/userValidation");
const inspectionController = require("./controllers/inspectionController");
const { validateLogInspection } = require("./middlewares/inspectionValidation");
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
const { validateCreateComplaint } = require("./middlewares/complaintValidation")
const menuItemController = require("./controllers/menuItemController");
const { validateMenuItem, validateMenuItemId } = require("./middlewares/menuItemValidation")
const rentalAgreementController = require("./controllers/rentalAgreementController");
const salesAnalyticsController = require("./controllers/salesAnalyticsController")
const { verifyJWT } = require("./middlewares/auth");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

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
app.post("/officers/login", validateLogin, officerController.login);
app.post("/officers/logout", officerController.logout);

// Routes for operator auth
app.post("/operators/login", validateLogin, operatorController.login);
app.post("/operators/logout", operatorController.logout);

// Routes for officer inspections
app.post("/inspections", verifyJWT, validateLogInspection, inspectionController.logInspection);

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