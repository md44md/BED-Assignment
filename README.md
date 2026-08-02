# Singapore Hawker Centre Management System

AY2026 Semester 1 | Diploma in Information Technology  
Modules: Back-End Development (BED) | Software Project Management (SPM)

## Team Members
| Name | Student ID | Role |
|--------------------|-----------|------------------------------|
| Lee Kang Zheng     | S10268867 | Project Lead                 |
| Hayder Zikry       | S10272315 | Product Owner & Scrum Master |
| Muhammad Bin Riadi | S10273446 | Developer                    |
| Seah Hao Bin       | S10273358 | Developer                    |
| Dana Tun           | S10274081 | Developer                    |

## Project Overview
A web-based management system for Singapore hawker centres built 
with Node.js, Express, and Microsoft SQL Server. The system serves 
customers, stall owners, operators, and NEA officers.

## Tech Stack
- **Backend:** Node.js, Express
- **Database:** Microsoft SQL Server
- **Authentication:** JWT (JSON Web Tokens)
- **Version Control:** GitHub

## App Setup

### Prerequisites
- Node.js v18 or above
- Microsoft SQL Server (Express Edition or Developer Edition)
- SQL Server Management Studio (SSMS)
- Free accounts for the third-party services used by some features:
  [Cloudinary](https://cloudinary.com) (menu/profile images),
  [Brevo](https://www.brevo.com) (queue-ready emails),
  [PDFShift](https://pdfshift.io) (PDF receipts), and
  [OneMap](https://www.onemap.gov.sg) (nearby centres & directions)

### Database Setup
1. Open SSMS and connect to your local SQL Server instance
2. Open `database/hawker_centre_schema.sql`
3. Execute the script — this creates the login, the database, all
   tables, and inserts sample data (see [database/README.md](database/README.md))

### Running the App
1. Install dependencies: npm install
2. Copy `.env.example` to `.env` and fill in your values: cp .env.example .env
This includes DB credentials (must match the login created in the
   database setup step above), `JWT_SECRET`, and API keys for
   Cloudinary, Brevo, PDFShift, and OneMap. Comments in `.env.example`
   explain where to get each one.
3. Start the server: npm start
4. The app runs on `http://localhost:3000` (or the `PORT` set in `.env`).
5. Interactive API documentation (Swagger UI) is available at
   `http://localhost:3000/api-docs`. If you've added or changed routes,
   regenerate the spec first with `npm run swagger`, then restart the server.

### Running Tests
Unit tests are written with [Jest](https://jestjs.io/): npm test

## Project Structure
```
BED-Assignment/
├── app.js                # Express app entry point and all route definitions
├── swagger.js             # swagger-autogen script; regenerates swagger-output.json
├── swagger-output.json    # Generated OpenAPI spec, served at /api-docs
├── dbConfig.js             # SQL Server connection config (reads from .env)
├── cloudinaryConfig.js     # Cloudinary config for image uploads
├── .env.example            # Template for required environment variables
├── controllers/            # Request handlers (business logic per feature)
├── models/                 # Database access (raw SQL queries per table)
├── middlewares/            # JWT auth (RBAC), Joi validation, Multer uploads
├── services/                # Third-party integrations
│   ├── emailService.js       # Brevo — queue-ready notification emails
│   ├── oneMapService.js       # OneMap — nearby centres & directions
│   ├── pdfService.js           # PDFShift — HTML-to-PDF receipts
│   └── profanityService.js      # PurgoMalum — feedback comment filtering
├── database/                # Schema creation script + sample data
├── tests/                    # Jest unit tests (one file per controller)
├── public/                    # Front-end (vanilla HTML/CSS/JS)
│   ├── css/common.css          # Shared styles
│   ├── js/common.js             # Shared fetch/auth helpers (api(), isLoggedIn(), getRole()...)
│   ├── js/*.js                   # Page-specific scripts
│   └── *.html                     # One page per role/feature (login, dashboard, profile...)
└── postman/                  # API test evidence (screenshots + test case docs)
```