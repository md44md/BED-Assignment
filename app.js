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