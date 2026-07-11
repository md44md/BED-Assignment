# Database Setup

## Requirements
- Microsoft SQL Server (Express or Developer Edition)
- SQL Server Management Studio (SSMS)

## Setup Instructions
1. Open SSMS
2. Connect to your local instance (server name is usually
   localhost or `.\SQLEXPRESS`)
3. Open hawker_centre_schema.sql
4. Click Execute (or press F5)
5. The script will:
   - Create the HawkerCentreDatabase database
   - Create all tables with constraints
   - Insert sample data for testing


| Table | Description |
|--------------------|-----------|
| Users | Base authentication for all roles |
| Operator | Hawker centre operator profile |
| HawkerCentre | Hawker centre information |
| StallOwner | Vendor profile |
| Stall | Individual food stalls |
| MenuItem | Food items per stall
| MenuItemCuisine | Menu item to cuisine mapping (cuisineName VARCHAR)
| Promotion | Stall promotions
| OperatorAccounts | Operator-to-stall assignment tracking
| RentalAgreement | Stall lease records
| Customer | Patron profile
| Cart / CartItem | Customer shopping cart
| Orders / OrderItem | Customer orders with price snapshots
| Payment | Payment records
| Feedback | Customer ratings and comments
| MenuItemLike | Customer likes on menu items
| Complaint | Formal complaints linked to stalls
| Notification | In-app notifications
| LoyaltyAccount | Customer loyalty points
| NEAOfficer | NEA inspection officer profile
| Inspection | NEA inspection records
| HygieneGrade | Hygiene grades issued to stalls


Sample Data Included

3 customers, 6 stall owners, 3 operators, 3 NEA officers (15 users total)
3 hawker centres, 6 stalls (2 per centre)
18 menu items across 6 stalls (3 per stall, covering Chinese, Malay, and Indian cuisines)
3 orders with order items, payments (PayNow/NETS/Cash), and varied statuses
3 feedback entries, 3 likes, 3 complaints (with different statuses)
7 rental agreements (including 1 expired + renewed for history)
4 inspections (3 completed, 1 scheduled) and 3 hygiene grades (including historical)
3 promotions, 3 notifications, 3 loyalty accounts