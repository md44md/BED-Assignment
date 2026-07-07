# Postman Testing Evidence

Screenshots demonstrating that each completed feature works, tested via Postman.
(The Postman requests are also demonstrated live in the individual video deliverable.)

## Feature 1 — Officer Login / Logout

**User Story:** *As a NEA Officer, I would like to log in and out with my officer credentials, so that I could access inspection scheduling and logging features.*

**Endpoints:** `POST /officers/login`, `POST /officers/logout`

### Test cases captured

| # | Request | Expected result |
|---|---------|-----------------|
| 1 | Login with valid officer credentials | `200` + JWT token returned |
| 2 | Login with wrong password | `401` Invalid credentials |
| 3 | Login with a non-officer (customer) account | `404` Account not found — login is role-isolated |
| 4 | Login with an unknown email | `404` Account not found |
| 5 | Login with password field missing | `400` validation error |
| 6 | Login with an invalid email format | `400` validation error |
| 7 | Logout | `200` logout confirmation |

Seeded officer credentials used for testing: `mary@email.com` / `Mary123!`

## Screenshots

Each feature has its own subfolder under [`screenshots/`](./screenshots/) to keep things tidy:

```
screenshots/
  feature1-officer-auth/     Login / logout (this feature)
  feature2-.../
  feature3-.../
```

Name each screenshot by its test case, e.g. `01-login-success.png`, `02-wrong-password.png`, …
