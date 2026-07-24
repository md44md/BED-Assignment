# Database Setup

## Requirements
- Microsoft SQL Server (Express or Developer Edition)
- SQL Server Management Studio (SSMS)

## Setup Instructions
1. Open SSMS
2. Connect to your local instance (server name is usually
   localhost or `.\SQLEXPRESS`)
3. Open `hawker_centre_schema.sql`
4. Click Execute (or press F5)
5. The script will:
   - Create the `bed_user` login and `HawkerCentreDatabase` database
   - Create all tables with constraints
   - Insert sample data for testing

The credentials created here (`bed_user` / `YourPassword123`) must match
`DB_USER` / `DB_PASSWORD` in your root `.env` file — see the root
[README](../README.md#app-setup).

## Tables

| Table | Description |
|---|---|
| Users | Base authentication for all roles |
| Operator | Hawker centre operator profile |
| HawkerCentre | Hawker centre information |
| StallOwner | Vendor profile |
| Stall | Individual food stalls |
| MenuItem | Food items and priced add-ons per stall |
| MenuItemCuisine | Menu item to cuisine mapping (cuisineName VARCHAR) |
| Promotion | Stall promotions |
| OperatorAccounts | Operator-to-stall assignment tracking |
| RentalAgreement | Stall lease records |
| Customer | Patron profile |
| Cart / CartItem | Customer shopping cart |
| Orders / OrderItem | Customer orders with price snapshots |
| Payment | Payment records |
| Feedback | Customer ratings and comments (profanity-filtered) |
| MenuItemLike | Customer likes on menu items |
| Complaint | Formal complaints linked to stalls |
| Notification | In-app / email notifications (e.g. queue-ready alerts) |
| LoyaltyAccount | Customer loyalty points |
| NEAOfficer | NEA inspection officer profile |
| Inspection | NEA inspection records |
| HygieneGrade | Hygiene grades issued to stalls |

## Sample Data Included
- 15 users total: 3 customers, 6 stall owners, 3 operators, 3 NEA officers.
  All seeded accounts use the password pattern `<Name>123!` (e.g.
  `alice@email.com` / `Alice123!`) for local login testing.
- 3 hawker centres, 6 stalls (2 per centre)
- 30 menu items across 6 stalls: 18 core items (3 per stall — 2 mains + 1
  drink — covering Chinese, Malay, and Indian cuisines) plus 12 priced
  add-ons (2 per stall, category = `'add-on'`, e.g. extra chicken, papadum)
- 3 promotions
- 6 operator-to-stall account assignments
- 7 rental agreements (including 1 expired + renewed, to show history)
- 3 carts with 1 item each
- 4 orders with order items and payments (PayNow/NETS/Cash), including a
  live `preparing` order used to demo the queue-advance / email flow
- 3 feedback entries, 3 menu item likes, 3 complaints (varied statuses)
- 3 notifications, 3 loyalty accounts
- 8 inspections (7 completed, 1 scheduled) and 7 hygiene grades (6 active,
  1 historical/inactive) — every stall currently holds one active grade