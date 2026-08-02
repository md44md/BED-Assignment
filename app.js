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
const { validateRegister, validateLogin, validateChangeEmail, validateForgotPassword, validateResetPassword } = require("./middlewares/userValidation");
const inspectionController = require("./controllers/inspectionController");
const { validateLogInspection, validateUpdateInspection, validateScheduleInspection } = require("./middlewares/inspectionValidation");
const cartController = require("./controllers/cartController");
const { validateAddItem, validateCartItemId } = require("./middlewares/cartValidation");
const orderController = require("./controllers/orderController");
const { validateSubmitOrder, validateOrderId, validateOrderIdParam } = require("./middlewares/orderValidation");
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
const promotionController = require("./controllers/promotionController");
const { validatePromotion, validatePromotionId } = require("./middlewares/promotionValidation");
const userController = require("./controllers/userController");
const hawkerCentreController = require("./controllers/hawkerCentreController");
const { validateNearbyQuery, validateDirectionsQuery } = require("./middlewares/hawkerCentreValidation");
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
app.delete("/stallowners/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'Delete my account (stall owner)'
        #swagger.description = 'Soft-deletes the signed-in stall owner\'s account (isActive = 0), removing it from active use while preserving linked records for referential integrity.'
        #swagger.responses[200] = { description: 'Account deleted.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner).' }
        #swagger.responses[500] = { description: 'Error deleting account.' }
    */
    verifyJWT, stallOwnerController.deleteAccount);
app.get("/stallowners/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'View my account profile (stall owner)'
        #swagger.description = 'Returns the signed-in stall owner\'s own profile (never another user\'s, never the password hash). A soft-deleted account is refused even with a still-valid token.'
        #swagger.responses[200] = { description: 'The stall owner\'s profile.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner, or the account is disabled).' }
        #swagger.responses[404] = { description: 'Account not found.' }
        #swagger.responses[500] = { description: 'Error retrieving account.' }
    */
    verifyJWT, stallOwnerController.getAccount);

// Routes for customer auth
app.post("/customers/register", validateRegister, customerController.register);
app.post("/customers/login", validateLogin, customerController.login);

// Password reset (public, role-agnostic — works for any account regardless of role)
app.post("/forgot-password",
    /*
        #swagger.tags = ['Account']
        #swagger.security = []
        #swagger.summary = 'Request a password reset link'
        #swagger.description = 'Public, role-agnostic (works for any Users row). Always returns the same generic message whether or not the email is registered, so this endpoint cannot be used to enumerate accounts. When a matching active account exists, emails a one-time reset link (valid 1 hour, single-use) via the Brevo third-party API.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { email: 'alice@email.com' } }
        #swagger.responses[200] = { description: 'Generic confirmation message (sent regardless of whether the account exists).' }
        #swagger.responses[400] = { description: 'Invalid body (missing/malformed email).' }
        #swagger.responses[500] = { description: 'Error processing password reset request.' }
    */
    validateForgotPassword, userController.forgotPassword);
app.post("/reset-password",
    /*
        #swagger.tags = ['Account']
        #swagger.security = []
        #swagger.summary = 'Complete a password reset'
        #swagger.description = 'Public, role-agnostic. Redeems the token from the emailed reset link: verifies it is unused and unexpired, sets the new password, and marks the token used (single-use, atomically with the password update) so the same link can never be redeemed twice.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { token: 'a1b2c3...', password: 'NewPassword123!' } }
        #swagger.responses[200] = { description: 'Password reset successfully.' }
        #swagger.responses[400] = { description: 'Invalid body, or the reset link is invalid/expired/already used.' }
        #swagger.responses[500] = { description: 'Error resetting password.' }
    */
    validateResetPassword, userController.resetPassword);
app.post("/customers/logout", customerController.logout);
app.delete("/customers/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'Delete my account (customer)'
        #swagger.description = 'Soft-deletes the signed-in customer\'s account (isActive = 0), removing it from active use while preserving linked orders/reviews for referential integrity.'
        #swagger.responses[200] = { description: 'Account deleted.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[500] = { description: 'Error deleting account.' }
    */
    verifyJWT, customerController.deleteAccount);
app.get("/customers/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'View my account profile (customer)'
        #swagger.description = 'Returns the signed-in customer\'s own profile (never another user\'s, never the password hash). A soft-deleted account is refused even with a still-valid token.'
        #swagger.responses[200] = { description: 'The customer\'s profile.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer, or the account is disabled).' }
        #swagger.responses[404] = { description: 'Account not found.' }
        #swagger.responses[500] = { description: 'Error retrieving account.' }
    */
    verifyJWT, customerController.getAccount);

// Routes for officer auth
app.post("/officers/login", validateLogin, officerController.login);
app.post("/officers/logout", officerController.logout);
app.get("/officers/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'View my account profile (NEA officer)'
        #swagger.description = 'Returns the signed-in officer\'s own profile (never another user\'s, never the password hash). A soft-deleted account is refused even with a still-valid token.'
        #swagger.responses[200] = { description: 'The officer\'s profile.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer, or the account is disabled).' }
        #swagger.responses[404] = { description: 'Account not found.' }
        #swagger.responses[500] = { description: 'Error retrieving account.' }
    */
    verifyJWT, officerController.getAccount);

// Routes for operator auth
app.post("/operators/login", validateLogin, operatorController.login);
app.post("/operators/logout", operatorController.logout);
app.get("/operators/account",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'View my account profile (operator)'
        #swagger.description = 'Returns the signed-in operator\'s own profile (never another user\'s, never the password hash). A soft-deleted account is refused even with a still-valid token.'
        #swagger.responses[200] = { description: 'The operator\'s profile.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an operator, or the account is disabled).' }
        #swagger.responses[404] = { description: 'Account not found.' }
        #swagger.responses[500] = { description: 'Error retrieving account.' }
    */
    verifyJWT, operatorController.getAccount);

// Route for profile picture upload (shared across all roles)
app.put("/account/picture", verifyJWT, uploadProfilePicture, userController.uploadProfilePicture);

// Route for changing the account email (shared across all roles)
app.put("/account/email",
    /*
        #swagger.tags = ['Account']
        #swagger.summary = 'Change the logged-in user\'s email address'
        #swagger.description = 'Any logged-in role. Confirms the current password, rejects an unchanged or already-taken email (email is unique across all accounts), then updates Users.email.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { newEmail: 'new@example.com', currentPassword: 'Password123!' } }
        #swagger.responses[200] = { description: 'Email updated; the new email is returned.' }
        #swagger.responses[400] = { description: 'Invalid body, or the new email is unchanged.' }
        #swagger.responses[401] = { description: 'Unauthorized (no token) or the current password is incorrect.' }
        #swagger.responses[403] = { description: 'Forbidden (invalid token).' }
        #swagger.responses[404] = { description: 'Account not found.' }
        #swagger.responses[409] = { description: 'Email is already in use.' }
        #swagger.responses[500] = { description: 'Error updating email.' }
    */
    verifyJWT, validateChangeEmail, userController.changeEmail);

// Routes for officer inspections
app.post("/inspections", verifyJWT, validateLogInspection, inspectionController.logInspection);
app.put("/inspections/:id",
    /*
        #swagger.tags = ['Inspections']
        #swagger.summary = 'Correct or update a logged inspection'
        #swagger.description = 'NEA officer updates an existing inspection record with a corrected score, remarks and/or inspection date, to keep official inspection data accurate.'
        #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID of the inspection to update.' }
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { score: 85, remarks: 'Re-checked; minor issues resolved.', inspectionDate: '2026-07-20' } }
        #swagger.responses[200] = { description: 'Inspection updated; the updated record is returned.' }
        #swagger.responses[400] = { description: 'Inspection ID is not a number, or the body failed validation.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer).' }
        #swagger.responses[404] = { description: 'Inspection not found.' }
        #swagger.responses[500] = { description: 'Error updating inspection.' }
    */
    verifyJWT, validateUpdateInspection, inspectionController.updateInspection);
app.post("/inspections/schedule",
    /*
        #swagger.tags = ['Inspections']
        #swagger.summary = 'Schedule an inspection'
        #swagger.description = 'NEA officer schedules an upcoming inspection for a specific stall on a chosen date, so they can plan their workload. The date cannot be in the past (scheduling for later today is allowed).'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { stallID: 1, scheduledDate: '2026-08-15' } }
        #swagger.responses[201] = { description: 'Inspection scheduled; the new record is returned.' }
        #swagger.responses[400] = { description: 'Validation failed, or the scheduled date is in the past.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer).' }
        #swagger.responses[404] = { description: 'Stall not found.' }
        #swagger.responses[500] = { description: 'Error scheduling inspection.' }
    */
    verifyJWT, validateScheduleInspection, inspectionController.scheduleInspection);
app.get("/inspections/scheduled",
    /*
        #swagger.tags = ['Inspections']
        #swagger.summary = 'View my upcoming scheduled inspections'
        #swagger.description = 'Returns the signed-in officer\'s scheduled (not yet completed) inspections, earliest date first, for planning.'
        #swagger.responses[200] = { description: 'The officer\'s scheduled inspections (empty list when none).' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not an officer).' }
        #swagger.responses[500] = { description: 'Error retrieving scheduled inspections.' }
    */
    verifyJWT, inspectionController.getScheduledInspections);

// Routes for customer cart
app.get("/cart", verifyJWT, cartController.getCart);
app.post("/cart/items", verifyJWT, validateAddItem, cartController.addItemToCart);
app.delete("/cart/items/:cartItemID", verifyJWT, validateCartItemId, cartController.removeItem);

// Routes for orders
app.post("/orders",
    /*
        #swagger.tags = ['Orders']
        #swagger.summary = 'Submit a cart as an order'
        #swagger.description = 'Customer only. Turns one of the signed-in customer\'s carts into an order: creates the order, its line items and a payment record in a single transaction, generates a daily per-stall queue number, and clears that cart. paymentMethod is Cash, NETS or PayNow.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { cartID: 3, paymentMethod: 'NETS' } }
        #swagger.responses[201] = { description: 'Order placed; returns orderID, queueNumber and totalAmount.' }
        #swagger.responses[400] = { description: 'Validation error (missing cartID or invalid paymentMethod).' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[404] = { description: 'Cart not found or empty.' }
        #swagger.responses[500] = { description: 'Error submitting order.' }
    */
    verifyJWT, validateSubmitOrder, orderController.submitOrder);
app.get("/orders",
    /*
        #swagger.tags = ['Orders']
        #swagger.summary = 'View my past orders'
        #swagger.description = 'Customer only. Returns the signed-in customer\'s own orders (scoped by customerID from the JWT), newest first, each with its line items, totals, status, queue number and payment details.'
        #swagger.responses[200] = { description: 'The customer\'s orders (empty array if none).' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[500] = { description: 'Error retrieving orders.' }
    */
    verifyJWT, orderController.getMyOrders);
app.post("/orders/:orderID/reorder", verifyJWT, validateOrderId, orderController.reorder);
app.get("/orders/:orderID/receipt",
    /*
        #swagger.tags = ['Orders']
        #swagger.summary = 'Get an itemized receipt for a past order'
        #swagger.description = 'Customer only, and only for their own order. Returns the order\'s line items split into base dishes/drinks vs priced add-ons, plus the packagingFee/gstAmount/totalAmount breakdown, so a customer can review spending or split the bill with friends.'
        #swagger.parameters['orderID'] = { in: 'path', required: true, type: 'integer', description: 'ID of the order to fetch the receipt for.' }
        #swagger.responses[200] = { description: 'Itemized receipt, with items/addons arrays and the fee breakdown.' }
        #swagger.responses[400] = { description: 'Invalid order ID.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (this order does not belong to you).' }
        #swagger.responses[404] = { description: 'Order not found.' }
        #swagger.responses[500] = { description: 'Error retrieving receipt.' }
    */
    verifyJWT, validateOrderIdParam, orderController.getOrderReceipt);
app.get("/orders/:orderID/receipt/pdf",
    /*
        #swagger.tags = ['Orders']
        #swagger.summary = 'Download an itemized receipt as a PDF'
        #swagger.description = 'Customer only, and only for their own order. Renders the same itemized breakdown as GET /orders/{orderID}/receipt to HTML, converts it to a PDF via the PDFShift third-party API, and streams it back as an attachment.'
        #swagger.parameters['orderID'] = { in: 'path', required: true, type: 'integer', description: 'ID of the order to generate a receipt PDF for.' }
        #swagger.responses[200] = { description: 'The receipt as a PDF file (Content-Type: application/pdf).' }
        #swagger.responses[400] = { description: 'Invalid order ID.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (this order does not belong to you).' }
        #swagger.responses[404] = { description: 'Order not found.' }
        #swagger.responses[500] = { description: 'Error generating receipt PDF.' }
        #swagger.responses[502] = { description: 'The PDFShift conversion failed (e.g. misconfigured or rejected API key).' }
    */
    verifyJWT, validateOrderIdParam, orderController.getOrderReceiptPdf);

// Routes for feedback
app.post("/feedback",
    /*
        #swagger.tags = ['Feedback']
        #swagger.summary = 'Submit a rating and review for a stall'
        #swagger.description = 'Customer only. Leaves a star rating (1-5) and optional comment for a stall the customer has a completed, paid order with. One review per customer per stall. The comment is run through a profanity filter before it is stored.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { orderID: 5, rating: 5, comments: 'Great chicken rice!' } }
        #swagger.responses[201] = { description: 'Feedback submitted; returns the new feedbackID.' }
        #swagger.responses[400] = { description: 'Validation error, or order not completed/paid.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer, or order does not belong to you).' }
        #swagger.responses[404] = { description: 'Order not found.' }
        #swagger.responses[409] = { description: 'You have already reviewed this stall.' }
        #swagger.responses[500] = { description: 'Error submitting feedback.' }
    */
    verifyJWT, validateSubmitFeedback, feedbackController.submitFeedback);
app.post("/feedback/edit",
    /*
        #swagger.tags = ['Feedback']
        #swagger.summary = 'Edit my existing review'
        #swagger.description = 'Customer only. Updates the rating and/or comment on a review the signed-in customer owns. The updated comment is run through the profanity filter before it is stored.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { feedbackID: 4, rating: 4, comments: 'Changed my mind, still good.' } }
        #swagger.responses[200] = { description: 'Feedback updated successfully.' }
        #swagger.responses[400] = { description: 'Validation error.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer, or review does not belong to you).' }
        #swagger.responses[404] = { description: 'Feedback not found.' }
        #swagger.responses[500] = { description: 'Error updating feedback.' }
    */
    verifyJWT, validateEditFeedback, feedbackController.editFeedback);
app.get("/feedback",
    /*
        #swagger.tags = ['Feedback']
        #swagger.summary = 'View my own reviews'
        #swagger.description = 'Customer only. Returns the signed-in customer\'s own reviews, each with the stall name, newest first. Used by the feedback page to let a customer pick a review to edit.'
        #swagger.responses[200] = { description: 'The customer\'s reviews (empty array if none).' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[500] = { description: 'Error retrieving feedback.' }
    */
    verifyJWT, feedbackController.getMyFeedback);

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
app.get("/menuitems/likes",
    /*
        #swagger.tags = ['Menu Item Likes']
        #swagger.summary = 'View which menu items I have liked'
        #swagger.description = 'Customer only. Returns the IDs of the menu items the signed-in customer has liked, so the front-end can mark them as liked on the public stall menu.'
        #swagger.responses[200] = { description: 'Object with a likedMenuItemIDs array.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[500] = { description: 'Error retrieving your liked menu items.' }
    */
    verifyJWT, menuItemController.getMyLikedMenuItems);
app.post("/menuitems/:id/like",
    /*
        #swagger.tags = ['Menu Item Likes']
        #swagger.summary = 'Like a menu item'
        #swagger.description = 'Customer only. Records a like for a menu item (one like per customer per item; liking again is a no-op). Returns the item\'s new like count.'
        #swagger.responses[200] = { description: 'Liked; returns { liked: true, likeCount }.' }
        #swagger.responses[400] = { description: 'Invalid menu item ID.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[404] = { description: 'Menu item not found.' }
        #swagger.responses[500] = { description: 'Error liking menu item.' }
    */
    verifyJWT, validateMenuItemId, menuItemController.likeMenuItem);
app.delete("/menuitems/:id/like",
    /*
        #swagger.tags = ['Menu Item Likes']
        #swagger.summary = 'Unlike a menu item'
        #swagger.description = 'Customer only. Removes the signed-in customer\'s like from a menu item. Returns the item\'s new like count.'
        #swagger.responses[200] = { description: 'Unliked; returns { liked: false, likeCount }.' }
        #swagger.responses[400] = { description: 'Invalid menu item ID.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[404] = { description: 'Menu item not found.' }
        #swagger.responses[500] = { description: 'Error unliking menu item.' }
    */
    verifyJWT, validateMenuItemId, menuItemController.unlikeMenuItem);

// Route for viewing rental agreements
app.get("/rental-agreements", verifyJWT, rentalAgreementController.getRentalAgreements);

// Routes for stall owner promotion management (set up / edit / see / delete)
app.get("/promotions",
    /*
        #swagger.tags = ['Promotions']
        #swagger.summary = 'View my stall\'s promotions'
        #swagger.description = 'Lists every promotion belonging to the signed-in stall owner\'s stall, newest first.'
        #swagger.responses[200] = { description: 'The stall\'s promotions (empty list when none exist).' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner).' }
        #swagger.responses[404] = { description: 'No stall found for this account.' }
        #swagger.responses[500] = { description: 'Error retrieving promotions.' }
    */
    verifyJWT, promotionController.getPromotions);
app.post("/promotions",
    /*
        #swagger.tags = ['Promotions']
        #swagger.summary = 'Create a promotion'
        #swagger.description = 'Creates a promotion for the signed-in owner\'s stall, then emails every customer who has ordered from that stall before. startDate/endDate are optional; discountType is percentage, fixed or points.'
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { title: 'Weekday Special', description: '10% off all mains', discountType: 'percentage', discountValue: 10, startDate: '2026-08-01', endDate: '2026-08-31' } }
        #swagger.responses[201] = { description: 'Promotion created; the new promotion plus a notifiedCustomers count is returned.' }
        #swagger.responses[400] = { description: 'Validation failed, or the end date is before the start date.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner).' }
        #swagger.responses[404] = { description: 'No stall found for this account.' }
        #swagger.responses[500] = { description: 'Error creating promotion.' }
    */
    verifyJWT, validatePromotion, promotionController.createPromotion);
app.put("/promotions/:id",
    /*
        #swagger.tags = ['Promotions']
        #swagger.summary = 'Edit a promotion (also activate/deactivate)'
        #swagger.description = 'Updates a promotion the signed-in owner owns. Passing isActive toggles it on or off, so activation goes through this same route.'
        #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID of the promotion to edit.' }
        #swagger.parameters['body'] = { in: 'body', required: true, schema: { title: 'Weekday Special', description: '15% off all mains', discountType: 'percentage', discountValue: 15, isActive: true } }
        #swagger.responses[200] = { description: 'Promotion updated; the updated promotion is returned.' }
        #swagger.responses[400] = { description: 'Invalid ID/body, or the end date is before the start date.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner, or not this owner\'s promotion).' }
        #swagger.responses[404] = { description: 'Promotion not found.' }
        #swagger.responses[500] = { description: 'Error updating promotion.' }
    */
    verifyJWT, validatePromotionId, validatePromotion, promotionController.updatePromotion);
app.delete("/promotions/:id",
    /*
        #swagger.tags = ['Promotions']
        #swagger.summary = 'Delete a promotion'
        #swagger.description = 'Deletes a promotion the signed-in owner owns.'
        #swagger.parameters['id'] = { in: 'path', required: true, type: 'integer', description: 'ID of the promotion to delete.' }
        #swagger.responses[200] = { description: 'Promotion deleted.' }
        #swagger.responses[400] = { description: 'Invalid promotion ID.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner, or not this owner\'s promotion).' }
        #swagger.responses[404] = { description: 'Promotion not found.' }
        #swagger.responses[500] = { description: 'Error deleting promotion.' }
    */
    verifyJWT, validatePromotionId, promotionController.deletePromotion);

// Route for customers to find hawker centres near them (geocoded via OneMap)
app.get("/hawker-centres/nearby",
    /*
        #swagger.tags = ['Hawker Centres']
        #swagger.summary = 'Find hawker centres near me'
        #swagger.description = 'Returns every hawker centre ranked by distance from the customer\'s current location (nearest first). Each centre is geocoded via the OneMap search API; a centre OneMap cannot locate is still returned but with null coordinates/distance.'
        #swagger.parameters['lat'] = { in: 'query', required: true, type: 'number', description: 'Customer\'s current latitude (from the browser).' }
        #swagger.parameters['lng'] = { in: 'query', required: true, type: 'number', description: 'Customer\'s current longitude (from the browser).' }
        #swagger.responses[200] = { description: 'Hawker centres with coordinates and distanceKm, nearest first.' }
        #swagger.responses[400] = { description: 'Missing or out-of-range lat/lng.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[500] = { description: 'Error retrieving nearby hawker centres.' }
    */
    verifyJWT, validateNearbyQuery, hawkerCentreController.getNearbyHawkerCentres);
// Route for customers to get directions from their location to a centre (OneMap routing)
app.get("/hawker-centres/directions",
    /*
        #swagger.tags = ['Hawker Centres']
        #swagger.summary = 'Get directions to a hawker centre'
        #swagger.description = 'Proxies OneMap\'s routing service (which requires an authenticated token, kept server-side) to return the distance, travel time and route line from the customer\'s location to a chosen centre.'
        #swagger.parameters['startLat'] = { in: 'query', required: true, type: 'number', description: 'Customer\'s latitude.' }
        #swagger.parameters['startLng'] = { in: 'query', required: true, type: 'number', description: 'Customer\'s longitude.' }
        #swagger.parameters['endLat'] = { in: 'query', required: true, type: 'number', description: 'Destination centre\'s latitude.' }
        #swagger.parameters['endLng'] = { in: 'query', required: true, type: 'number', description: 'Destination centre\'s longitude.' }
        #swagger.parameters['routeType'] = { in: 'query', required: false, type: 'string', description: 'Travel mode: walk (default), drive or cycle.' }
        #swagger.responses[200] = { description: 'Route summary: distanceMeters, timeSeconds and an encoded route geometry.' }
        #swagger.responses[400] = { description: 'Missing/invalid coordinates or routeType.' }
        #swagger.responses[401] = { description: 'Unauthorized (no/invalid token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a customer).' }
        #swagger.responses[502] = { description: 'OneMap routing unavailable (or ONEMAP credentials not configured).' }
        #swagger.responses[500] = { description: 'Error retrieving directions.' }
    */
    verifyJWT, validateDirectionsQuery, hawkerCentreController.getDirections);

// Public: list all stalls (used by the front-end stall picker, no auth)
app.get("/stalls", stallController.getStalls);
// Public: browse a stall's menu (no auth)
app.get("/stalls/:stallID/menu", stallController.getStallMenu);
// Public: browse a stall's ratings/reviews (no auth)
app.get("/stalls/:stallID/feedback",
    /*
        #swagger.tags = ['Feedback']
        #swagger.summary = 'View a stall\'s ratings and reviews (public)'
        #swagger.description = 'Public, no login required. Returns a stall\'s average rating, review count and individual reviews (rating, comment, reviewer name and timestamp), newest first, so anyone browsing can read reviews before deciding where to eat.'
        #swagger.security = []
        #swagger.responses[200] = { description: 'Object with averageRating, reviewCount and a reviews array.' }
        #swagger.responses[400] = { description: 'Stall ID must be a number.' }
        #swagger.responses[404] = { description: 'Stall not found.' }
        #swagger.responses[500] = { description: 'Error retrieving stall feedback.' }
    */
    feedbackController.getStallReviews);
// Stall owner only: toggle own stall's status (open/busy/closed)
app.put("/stalls/status", verifyJWT, stallController.updateStallStatus);

// Routes for stall owner queue management
// Stall owner only: view current queue and advance it (serve current customer)
app.get("/stallowners/queue", verifyJWT, queueController.getQueue);
app.post("/stallowners/queue/advance", verifyJWT, queueController.advanceQueue);
app.post("/stallowners/queue/abandon",
    /*
        #swagger.tags = ['Queue']
        #swagger.summary = 'Mark uncollected orders as abandoned'
        #swagger.description = 'Stall owner only. Marks the stall\'s still-active orders (pending/preparing/ready) that were placed over 45 minutes ago as "abandoned", clearing them from the active order board for food-waste tracking. This sweep also runs automatically whenever the queue board is loaded.'
        #swagger.responses[200] = { description: 'Sweep done; returns the count and the abandoned orders (count may be 0).' }
        #swagger.responses[401] = { description: 'Unauthorized (no token).' }
        #swagger.responses[403] = { description: 'Forbidden (not a stall owner).' }
        #swagger.responses[404] = { description: 'No stall found for this account.' }
        #swagger.responses[500] = { description: 'Error abandoning stale orders.' }
    */
    verifyJWT, queueController.abandonStale);

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