const path = require("path");
const express = require("express");
const sql = require("mssql");
const dotenv = require("dotenv");

dotenv.config();

// controllers and middlewares
const stallOwnerController = require("./controllers/stallOwnerController");
const { validateRegister, validateLogin } = require("./middlewares/stallOwnerValidation");
const customerController = require("./controllers/customerController");
const { validateRegister: validateCustomerRegister, validateLogin: validateCustomerLogin } = require("./middlewares/customerValidation");
const officerController = require("./controllers/officerController");
const { validateLogin: validateOfficerLogin } = require("./middlewares/officerValidation");
const inspectionController = require("./controllers/inspectionController");
const { validateLogInspection } = require("./middlewares/inspectionValidation");
const orderController = require("./controllers/orderController");
const { validateSubmitOrder } = require("./middlewares/orderValidation");
const hygieneGradeController = require("./controllers/hygieneGradeController");
const { validateIssueGrade, validateUpdateGrade } = require("./middlewares/hygieneGradeValidation");
const feedbackController = require("./controllers/feedbackController");
const { validateSubmitFeedback, validateEditFeedback } = require("./middlewares/feedbackValidation");
const menuItemController = require("./controllers/menuItemController");
const { validateMenuItem, validateMenuItemId } = require("./middlewares/menuItemValidation")
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

// Routes for customer auth
app.post("/customers/register", validateCustomerRegister, customerController.register);
app.post("/customers/login", validateCustomerLogin, customerController.login);
app.post("/customers/logout", customerController.logout);

// Routes for officer auth
app.post("/officers/login", validateOfficerLogin, officerController.login);
app.post("/officers/logout", officerController.logout);

// Routes for officer inspections
app.post("/inspections", verifyJWT, validateLogInspection, inspectionController.logInspection);

// Routes for orders
app.post("/orders", verifyJWT, validateSubmitOrder, orderController.submitOrder);

// Routes for feedback
app.post("/feedback", verifyJWT, validateSubmitFeedback, feedbackController.submitFeedback);
app.post("/feedback/edit", verifyJWT, validateEditFeedback, feedbackController.editFeedback);

// Routes for menu management
app.get("/menuitems", verifyJWT, menuItemController.getMenuItems);
app.post("/menuitems", verifyJWT, validateMenuItem, menuItemController.createMenuItem);
app.put("/menuitems/:id", verifyJWT, validateMenuItemId, validateMenuItem, menuItemController.updateMenuItem);
app.delete("/menuitems/:id", verifyJWT, validateMenuItemId, menuItemController.deleteMenuItem);

// Routes for hygiene grades
// Public: customers viewing a stall's hygiene grades (no auth)
app.get("/stalls/:stallID/hygiene-grades", hygieneGradeController.getStallGrades);
// Officer only: issue, update and revoke grades
app.post("/hygiene-grades", verifyJWT, validateIssueGrade, hygieneGradeController.issueGrade);
app.put("/hygiene-grades/:gradeID", verifyJWT, validateUpdateGrade, hygieneGradeController.updateGrade);
app.delete("/hygiene-grades/:gradeID", verifyJWT, hygieneGradeController.deleteGrade);

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