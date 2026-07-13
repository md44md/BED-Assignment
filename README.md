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

## Getting Started

### Prerequisites
- Node.js v18 or above
- Microsoft SQL Server (Express Edition or Developer Edition)
- SQL Server Management Studio (SSMS)

### Database Setup
1. Open SSMS and connect to your local SQL Server instance
2. Open `database/hawker_centre_schema.sql`
3. Execute the script — this will create the database, 
   all tables, and insert sample data

### Running the App
1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values (DB credentials,
   `JWT_SECRET`, etc.):
   ```
   cp .env.example .env
   ```
3. Set up the database by running `database/hawker_centre_schema.sql` in SSMS
   (see [Database Setup](#database-setup) above).
4. Start the server:
   ```
   npm start
   ```
5. The app runs on `http://localhost:3000` (or the `PORT` set in `.env`).

## Project Structure
```
BED-Assignment/
├── app.js               # Express app entry point and route definitions
├── dbConfig.js          # SQL Server connection config (reads from .env)
├── controllers/         # Request handlers (business logic per feature)
├── models/              # Database access (SQL queries per table)
├── middlewares/         # JWT auth and Joi validation
├── database/            # Schema creation script + sample data
├── public/              # Front-end (HTML, CSS, client-side JS)
└── postman/             # API test evidence (screenshots + test cases)
```
