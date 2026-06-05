CREATE LOGIN bed_user WITH PASSWORD = 'YourPassword123';
GO

CREATE DATABASE HawkerCentreDatabase;
GO

USE HawkerCentreDatabase;
GO

CREATE USER hawker_admin FOR LOGIN bed_user;
ALTER ROLE db_owner ADD MEMBER bed_user;
GO

-- ============================================================
-- SECTION: SHARED
-- Tables used across all roles
-- ============================================================

CREATE TABLE Users (
    userID       INT IDENTITY(1,1) PRIMARY KEY,
    email        VARCHAR(255) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    role         VARCHAR(20)  NOT NULL,      -- 'customer', 'stallOwner', 'operator', 'neaOfficer'
    createdAt    DATETIME DEFAULT GETDATE(),
    isActive     BIT DEFAULT 1
);

INSERT INTO Users (email, passwordHash, role) VALUES
    ('alice@email.com',    'hash_alice',    'customer'),
    ('bob@email.com',      'hash_bob',      'customer'),
    ('charlie@email.com',  'hash_charlie',  'customer'),
    ('diana@email.com',    'hash_diana',    'stallOwner'),
    ('evan@email.com',     'hash_evan',     'stallOwner'),
    ('fiona@email.com',    'hash_fiona',    'stallOwner'),
    ('grace@email.com',    'hash_grace',    'stallOwner'),
    ('henry@email.com',    'hash_henry',    'stallOwner'),
    ('iris@email.com',     'hash_iris',     'stallOwner'),
    ('james@email.com',    'hash_james',    'operator'),
    ('karen@email.com',    'hash_karen',    'operator'),
    ('leon@email.com',     'hash_leon',     'operator'),
    ('mary@email.com',     'hash_mary',     'neaOfficer'),
    ('nathan@email.com',   'hash_nathan',   'neaOfficer'),
    ('olivia@email.com',   'hash_olivia',   'neaOfficer');


-- ============================================================
-- SECTION: OPERATOR
-- Operator, HawkerCentre, OperatorAccounts, RentalAgreement
-- ============================================================

CREATE TABLE Operator (
    operatorID INT IDENTITY(1,1) PRIMARY KEY,
    userID     INT NOT NULL UNIQUE REFERENCES Users(userID),
    firstName  VARCHAR(100) NOT NULL,
    lastName   VARCHAR(100) NOT NULL,
    phone      VARCHAR(20)
);

INSERT INTO Operator (userID, firstName, lastName, phone) VALUES
    (10, 'James', 'Tan', '91234567'),
    (11, 'Karen', 'Lim', '92345678'),
    (12, 'Leon',  'Ng',  '93456789');
------------------------------------------------
CREATE TABLE HawkerCentre (
    centreID   INT IDENTITY(1,1) PRIMARY KEY,
    operatorID INT NOT NULL REFERENCES Operator(operatorID),
    name       VARCHAR(255) NOT NULL,
    address    VARCHAR(500) NOT NULL,
    postalCode CHAR(6),
    region     VARCHAR(50),
    openTime   TIME,
    closeTime  TIME
);

INSERT INTO HawkerCentre (operatorID, name, address, postalCode, region, openTime, closeTime) VALUES
    (1, 'Maxwell Food Centre',  '1 Kadayanallur St', '069184', 'Central', '06:00', '21:00'),
    (2, 'Chinatown Complex',    '335 Smith St',      '050335', 'Central', '07:00', '22:00'),
    (3, 'Geylang Serai Market', '1 Geylang Serai',   '402001', 'East',    '06:30', '22:30');


-- ============================================================
-- SECTION: STALL OWNER
-- StallOwner, Stall, MenuItem, MenuItemCuisine, Promotion
-- ============================================================

CREATE TABLE StallOwner (
    stallOwnerID INT IDENTITY(1,1) PRIMARY KEY,
    userID       INT NOT NULL UNIQUE REFERENCES Users(userID),
    firstName    VARCHAR(100) NOT NULL,
    lastName     VARCHAR(100) NOT NULL,
    phone        VARCHAR(20)
);

INSERT INTO StallOwner (userID, firstName, lastName, phone) VALUES
    (4, 'Diana', 'Koh',   '94567890'),
    (5, 'Evan',  'Chua',  '95678901'),
    (6, 'Fiona', 'Wong',  '96789012'),
    (7, 'Grace', 'Tan',   '97890123'),
    (8, 'Henry', 'Lee',   '98901234'),
    (9, 'Iris',  'Goh',   '99012345');
------------------------------------------------
CREATE TABLE Stall (
    stallID      INT IDENTITY(1,1) PRIMARY KEY,
    centreID     INT NOT NULL REFERENCES HawkerCentre(centreID),
    stallOwnerID INT NOT NULL REFERENCES StallOwner(stallOwnerID),
    unitNumber   VARCHAR(10) NOT NULL,
    stallName    VARCHAR(255) NOT NULL,
    description  VARCHAR(1000),
    status       VARCHAR(20) DEFAULT 'open',
    createdAt    DATETIME DEFAULT GETDATE()
);
-- status can be: 'open', 'busy', 'closed'

-- 2 stalls per hawker centre to reflect "a hawker centre contains many stalls"
INSERT INTO Stall (centreID, stallOwnerID, unitNumber, stallName, description, status) VALUES
    (1, 1, '#01-03', 'Tian Tian Chicken Rice',  'Famous Hainanese chicken rice',        'open'),
    (1, 2, '#01-07', 'Hamid''s Briyani',         'Fragrant mutton and chicken briyani',  'open'),
    (2, 3, '#02-15', 'Lao Wang Char Kway Teow', 'Wok-fried flat noodles with cockles',  'open'),
    (2, 4, '#02-22', 'Raj''s Curry Corner',      'Authentic South Indian curry rice',    'busy'),
    (3, 5, '#01-08', 'Mak''s Noodles',           'Handmade noodles with rich broth',     'busy'),
    (3, 6, '#01-12', 'Nasi Lemak Wangi',         'Fragrant coconut rice with sides',     'open');
------------------------------------------------
CREATE TABLE MenuItem (
    menuItemID  INT IDENTITY(1,1) PRIMARY KEY,
    stallID     INT NOT NULL REFERENCES Stall(stallID),
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    price       DECIMAL(10,2) NOT NULL,
    category    VARCHAR(50),
    isAvailable BIT DEFAULT 1,
    isLowStock  BIT DEFAULT 0,
    imageURL    VARCHAR(500),
    createdAt   DATETIME DEFAULT GETDATE()
);
-- category can be: 'main', 'drink', 'dessert', 'snack', 'add-on'

INSERT INTO MenuItem (stallID, name, description, price, category, isAvailable) VALUES
    -- Stall 1: Tian Tian Chicken Rice (Chinese)
    (1, 'Steamed Chicken Rice',  'Steamed chicken with fragrant rice',        4.50, 'main',    1),
    (1, 'Roasted Chicken Rice',  'Roasted chicken with fragrant rice',        5.00, 'main',    1),
    (1, 'Chicken Soup',          'Clear chicken broth',                       1.50, 'drink',   1),
    -- Stall 2: Hamid's Briyani (Malay / Indian fusion)
    (2, 'Mutton Briyani',        'Slow-cooked mutton with basmati rice',      8.00, 'main',    1),
    (2, 'Chicken Briyani',       'Spiced chicken with basmati rice',          7.00, 'main',    1),
    (2, 'Teh Tarik',             'Pulled milk tea',                           1.80, 'drink',   1),
    -- Stall 3: Lao Wang Char Kway Teow (Chinese)
    (3, 'Char Kway Teow',        'Fried flat noodles, cockles, bean sprouts', 5.50, 'main',    1),
    (3, 'Fried Carrot Cake',     'White or black version available',          4.00, 'main',    1),
    (3, 'Canned Drink',          'Assorted canned drinks',                    1.50, 'drink',   1),
    -- Stall 4: Raj's Curry Corner (Indian)
    (4, 'Fish Curry Rice',       'Fried fish with curry gravy and rice',      5.50, 'main',    1),
    (4, 'Vegetable Curry Rice',  'Mixed vegetables in curry gravy with rice', 4.50, 'main',    1),
    (4, 'Lassi',                 'Sweet yoghurt drink',                       2.00, 'drink',   1),
    -- Stall 5: Mak's Noodles (Chinese)
    (5, 'Wonton Noodles',        'Handmade noodles with pork wontons',        5.00, 'main',    1),
    (5, 'Dry Noodles',           'Tossed noodles with chilli sauce',          4.50, 'main',    1),
    (5, 'Barley Water',          'Chilled barley water',                      1.50, 'drink',   1),
    -- Stall 6: Nasi Lemak Wangi (Malay)
    (6, 'Nasi Lemak',            'Coconut rice with egg, ikan bilis, sambal', 4.00, 'main',    1),
    (6, 'Mee Rebus',             'Yellow noodles in thick spicy gravy',       4.50, 'main',    1),
    (6, 'Bandung',               'Rose syrup with milk',                      1.80, 'drink',   1);

-- One menu item can belong to many cuisines
CREATE TABLE MenuItemCuisine (
    menuItemID  INT NOT NULL REFERENCES MenuItem(menuItemID),
    cuisineName VARCHAR(100) NOT NULL,
    PRIMARY KEY (menuItemID, cuisineName)
);

INSERT INTO MenuItemCuisine (menuItemID, cuisineName) VALUES
    -- Stall 1: Chinese
    (1, 'Chinese'), (2, 'Chinese'), (3, 'Chinese'),
    -- Stall 2: Briyani spans both Malay and Indian cuisines
    (4, 'Malay'), (4, 'Indian'),
    (5, 'Malay'), (5, 'Indian'),
    (6, 'Malay'), (6, 'Indian'),
    -- Stall 3: Chinese
    (7, 'Chinese'), (8, 'Chinese'), (9, 'Chinese'),
    -- Stall 4: Indian
    (10, 'Indian'), (11, 'Indian'), (12, 'Indian'),
    -- Stall 5: Chinese
    (13, 'Chinese'), (14, 'Chinese'), (15, 'Chinese'),
    -- Stall 6: Malay
    (16, 'Malay'), (17, 'Malay'), (18, 'Malay');

CREATE TABLE Promotion (
    promotionID   INT IDENTITY(1,1) PRIMARY KEY,
    stallID       INT NOT NULL REFERENCES Stall(stallID),
    title         VARCHAR(255) NOT NULL,
    description   VARCHAR(1000),
    discountType  VARCHAR(20),
    discountValue DECIMAL(10,2),
    startDate     DATE NOT NULL,
    endDate       DATE NOT NULL,
    createdAt     DATETIME DEFAULT GETDATE()
);
-- discountType can be: 'percentage', 'fixed'

INSERT INTO Promotion (stallID, title, description, discountType, discountValue, startDate, endDate) VALUES
    (1, 'Weekday Special',  '10% off all mains on weekdays',         'percentage', 10.00, '2025-01-01', '2025-12-31'),
    (3, 'Happy Hour',       '$1 off orders above $8 after 2pm',      'fixed',       1.00, '2025-06-01', '2025-08-31'),
    (5, 'Grand Opening',    '15% off everything this month',         'percentage', 15.00, '2025-05-01', '2025-05-31');


-- ============================================================
-- SECTION: OPERATOR (continued)
-- OperatorAccounts and RentalAgreement depend on Stall existing
-- ============================================================

CREATE TABLE OperatorAccounts (
    operatorAccountID INT IDENTITY(1,1) PRIMARY KEY,
    operatorID        INT          NOT NULL REFERENCES Operator(operatorID),
    stallID           INT          NOT NULL REFERENCES Stall(stallID),
    name              VARCHAR(100) NOT NULL,
    email             VARCHAR(150) NOT NULL UNIQUE,
    phone             VARCHAR(30),
    createdAt         DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    updatedAt         DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);

-- One entry per stall managed by each operator
INSERT INTO OperatorAccounts (operatorID, stallID, name, email, phone) VALUES
    (1, 1, 'James Tan', 'james.stall1@hawker.sg', '91234567'),
    (1, 2, 'James Tan', 'james.stall2@hawker.sg', '91234567'),
    (2, 3, 'Karen Lim', 'karen.stall3@hawker.sg', '92345678'),
    (2, 4, 'Karen Lim', 'karen.stall4@hawker.sg', '92345678'),
    (3, 5, 'Leon Ng',   'leon.stall5@hawker.sg',  '93456789'),
    (3, 6, 'Leon Ng',   'leon.stall6@hawker.sg',  '93456789');

CREATE TABLE RentalAgreement (
    agreementID INT IDENTITY(1,1) PRIMARY KEY,
    stallID     INT NOT NULL REFERENCES Stall(stallID),
    operatorID  INT NOT NULL REFERENCES Operator(operatorID),
    monthlyRent DECIMAL(10,2) NOT NULL,
    startDate   DATE NOT NULL,
    endDate     DATE NOT NULL,
    status      VARCHAR(20) DEFAULT 'active',
    notes       VARCHAR(1000),
    createdAt   DATETIME DEFAULT GETDATE()
);
-- status can be: 'active', 'expired', 'terminated'

-- Stall 1 has an expired + renewed active agreement to demonstrate multiple agreements over time
INSERT INTO RentalAgreement (stallID, operatorID, monthlyRent, startDate, endDate, status) VALUES
    (1, 1, 1200.00, '2024-01-01', '2024-12-31', 'expired'),
    (1, 1, 1300.00, '2025-01-01', '2025-12-31', 'active'),
    (2, 1, 1100.00, '2025-03-01', '2026-02-28', 'active'),
    (3, 2,  950.00, '2025-01-01', '2025-12-31', 'active'),
    (4, 2, 1050.00, '2025-04-01', '2026-03-31', 'active'),
    (5, 3, 1000.00, '2025-05-01', '2026-04-30', 'active'),
    (6, 3,  900.00, '2025-02-01', '2026-01-31', 'active');


-- ============================================================
-- SECTION: CUSTOMER
-- Customer, Cart, CartItem, Feedback, MenuItemLike,
-- Complaint, Notification, LoyaltyAccount
-- ============================================================

CREATE TABLE Customer (
    customerID  INT IDENTITY(1,1) PRIMARY KEY,
    userID      INT NOT NULL UNIQUE REFERENCES Users(userID),
    firstName   VARCHAR(100) NOT NULL,
    lastName    VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    isVerified  BIT DEFAULT 0,  -- email verification
    isActive    BIT DEFAULT 1   -- soft delete
);

INSERT INTO Customer (userID, firstName, lastName, phone, isVerified) VALUES
    (1, 'Alice',   'Tan', '81234567', 1),
    (2, 'Bob',     'Lim', '82345678', 1),
    (3, 'Charlie', 'Ng',  '83456789', 0);

CREATE TABLE Cart (
    cartID     INT IDENTITY(1,1) PRIMARY KEY,
    customerID INT REFERENCES Customer(customerID),   -- NULL if guest
    sessionID  VARCHAR(255),
    stallID    INT NOT NULL REFERENCES Stall(stallID),
    createdAt  DATETIME DEFAULT GETDATE()
);

INSERT INTO Cart (customerID, sessionID, stallID) VALUES
    (1, 'sess_abc123', 1),
    (2, 'sess_def456', 3),
    (3, 'sess_ghi789', 5);

CREATE TABLE CartItem (
    cartItemID INT IDENTITY(1,1) PRIMARY KEY,
    cartID     INT NOT NULL REFERENCES Cart(cartID),
    menuItemID INT NOT NULL REFERENCES MenuItem(menuItemID),
    quantity   INT NOT NULL,
    notes      VARCHAR(500)
);

INSERT INTO CartItem (cartID, menuItemID, quantity, notes) VALUES
    (1, 1,  2, 'No chilli'),
    (2, 7,  1, 'Extra cockles'),
    (3, 13, 1, NULL);


-- ============================================================
-- SECTION: SHARED — Customer & Stall Owner
-- Orders, OrderItem, Payment
-- ============================================================

CREATE TABLE Orders (
    orderID        INT IDENTITY(1,1) PRIMARY KEY,
    customerID     INT REFERENCES Customer(customerID),   -- NULL if guest order
    stallID        INT NOT NULL REFERENCES Stall(stallID),
    queueNumber    INT NOT NULL,
    status         VARCHAR(20) DEFAULT 'pending',
    -- status can be: 'pending', 'preparing', 'ready', 'completed', 'abandoned'
    paymentMethod  VARCHAR(20) NOT NULL,                  -- Cash / NETS / PayNow
    paymentStatus  VARCHAR(20) DEFAULT 'pending',
    -- paymentStatus can be: 'pending', 'paid', 'failed'
    subtotal       DECIMAL(10,2) NOT NULL,
    packagingFee   DECIMAL(10,2) DEFAULT 0,
    gstAmount      DECIMAL(10,2) DEFAULT 0,
    totalAmount    DECIMAL(10,2) NOT NULL,
    notes          VARCHAR(500),
    createdAt      DATETIME DEFAULT GETDATE(),
    updatedAt      DATETIME DEFAULT GETDATE()
);

INSERT INTO Orders (customerID, stallID, queueNumber, status, paymentMethod, paymentStatus, subtotal, packagingFee, gstAmount, totalAmount) VALUES
    (1, 1, 42, 'completed', 'PayNow', 'paid',    9.00, 0.00, 0.63,  9.63),
    (2, 3, 17, 'completed', 'NETS',   'paid',    5.50, 0.50, 0.42,  6.42),
    (3, 5,  5, 'preparing', 'Cash',   'pending', 5.00, 0.00, 0.35,  5.35);

CREATE TABLE OrderItem (
    orderItemID INT IDENTITY(1,1) PRIMARY KEY,
    orderID     INT NOT NULL REFERENCES Orders(orderID),
    menuItemID  INT NOT NULL REFERENCES MenuItem(menuItemID),
    itemName    VARCHAR(255) NOT NULL,                    -- snapshot at time of order
    unitPrice   DECIMAL(10,2) NOT NULL,                  -- snapshot at time of order
    quantity    INT NOT NULL,
    addons      VARCHAR(500),                             -- e.g. "extra egg, no chilli"
    itemTotal   AS (unitPrice * quantity)                 -- computed column
);
-- itemName and unitPrice are stored as snapshots deliberately.
-- If a vendor later edits their menu prices, past receipts remain accurate.

INSERT INTO OrderItem (orderID, menuItemID, itemName, unitPrice, quantity, addons) VALUES
    (1, 1,  'Steamed Chicken Rice', 4.50, 2, 'No chilli'),
    (2, 7,  'Char Kway Teow',       5.50, 1, 'Extra cockles'),
    (3, 13, 'Wonton Noodles',       5.00, 1, NULL);

CREATE TABLE Payment (
    paymentID      INT IDENTITY(1,1) PRIMARY KEY,
    orderID        INT NOT NULL UNIQUE REFERENCES Orders(orderID),
    method         VARCHAR(20) NOT NULL,
    status         VARCHAR(20) DEFAULT 'pending',
    transactionRef VARCHAR(255),
    paidAt         DATETIME
);
-- method can be: 'cash', 'NETS', 'PayNow'
-- status can be: 'pending', 'success', 'failed'

INSERT INTO Payment (orderID, method, status, transactionRef, paidAt) VALUES
    (1, 'PayNow', 'success', 'TXN-PAY-001', '2025-06-01 12:35:00'),
    (2, 'NETS',   'success', 'TXN-NET-002', '2025-06-02 13:10:00'),
    (3, 'Cash',   'pending', NULL,           NULL);


-- ============================================================
-- SECTION: CUSTOMER (continued)
-- Feedback, MenuItemLike, Complaint, Notification, LoyaltyAccount
-- depend on Orders existing
-- ============================================================

-- Ratings and written comments for a stall
CREATE TABLE Feedback (
    feedbackID INT IDENTITY(1,1) PRIMARY KEY,
    customerID INT NOT NULL REFERENCES Customer(customerID),
    stallID    INT NOT NULL REFERENCES Stall(stallID),
    orderID    INT NOT NULL REFERENCES Orders(orderID),   -- must have ordered to review
    rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments   VARCHAR(2000),
    createdAt  DATETIME DEFAULT GETDATE(),
    UNIQUE (customerID, stallID)                          -- one review per customer per stall
);

INSERT INTO Feedback (customerID, stallID, orderID, rating, comments) VALUES
    (1, 1, 1, 5, 'Best chicken rice in Singapore, will definitely come back!'),
    (2, 3, 2, 4, 'Great char kway teow, slightly too oily for my taste.'),
    (3, 5, 3, 4, 'Noodles were springy and the broth was flavourful.');

-- Likes on individual menu items (one like per customer per item)
CREATE TABLE MenuItemLike (
    likeID     INT IDENTITY(1,1) PRIMARY KEY,
    customerID INT NOT NULL REFERENCES Customer(customerID),
    menuItemID INT NOT NULL REFERENCES MenuItem(menuItemID),
    createdAt  DATETIME DEFAULT GETDATE(),
    UNIQUE (customerID, menuItemID)
);

INSERT INTO MenuItemLike (customerID, menuItemID) VALUES
    (1, 1),
    (2, 7),
    (3, 13);

-- Formal complaints linked to a stall
CREATE TABLE Complaint (
    complaintID INT IDENTITY(1,1) PRIMARY KEY,
    customerID  INT NOT NULL REFERENCES Customer(customerID),
    stallID     INT NOT NULL REFERENCES Stall(stallID),
    category    VARCHAR(50) NOT NULL,                     -- Hygiene / Service / Food Quality / Other
    description VARCHAR(2000) NOT NULL,
    status      VARCHAR(20) DEFAULT 'open',
    -- status can be: 'open', 'underReview', 'resolved', 'closed'
    createdAt   DATETIME DEFAULT GETDATE(),
    resolvedAt  DATETIME
);

INSERT INTO Complaint (customerID, stallID, category, description, status) VALUES
    (1, 3, 'Hygiene',      'Noticed the cooking area was unclean during my visit.', 'underReview'),
    (2, 5, 'Service',      'Staff was rude when I asked to customise my order.',    'open'),
    (3, 1, 'Food Quality', 'Rice was undercooked on my last visit.',                'resolved');

-- In-app notifications (e.g. new promotions)
CREATE TABLE Notification (
    notificationID INT IDENTITY(1,1) PRIMARY KEY,
    customerID     INT NOT NULL REFERENCES Customer(customerID),
    title          VARCHAR(255) NOT NULL,
    message        VARCHAR(1000) NOT NULL,
    isRead         BIT DEFAULT 0,
    createdAt      DATETIME DEFAULT GETDATE()
);

INSERT INTO Notification (customerID, title, message, isRead) VALUES
    (1, 'New Promotion!',      'Tian Tian is offering 10% off on weekdays this month.', 1),
    (2, 'Order Ready',         'Your order #17 at Lao Wang is ready for collection.',   1),
    (3, 'Welcome to HawkerGo', 'Explore hawker centres near you and start ordering!',   0);

-- Loyalty points balance per customer
CREATE TABLE LoyaltyAccount (
    loyaltyID  INT IDENTITY(1,1) PRIMARY KEY,
    customerID INT NOT NULL UNIQUE REFERENCES Customer(customerID),
    points     INT DEFAULT 0,
    updatedAt  DATETIME DEFAULT GETDATE()
);

INSERT INTO LoyaltyAccount (customerID, points) VALUES
    (1, 150),
    (2,  80),
    (3,  20);


-- ============================================================
-- SECTION: NEA OFFICER
-- NEAOfficer, Inspection, HygieneGrade
-- ============================================================

CREATE TABLE NEAOfficer (
    officerID   INT IDENTITY(1,1) PRIMARY KEY,
    userID      INT NOT NULL UNIQUE REFERENCES Users(userID),
    firstName   VARCHAR(100) NOT NULL,
    lastName    VARCHAR(100) NOT NULL,
    badgeNumber VARCHAR(20) NOT NULL UNIQUE,
    department  VARCHAR(100)
);

INSERT INTO NEAOfficer (userID, firstName, lastName, badgeNumber, department) VALUES
    (13, 'Mary',   'Ong',  'NEA-001', 'Food Safety'),
    (14, 'Nathan', 'Yeo',  'NEA-002', 'Food Safety'),
    (15, 'Olivia', 'Chan', 'NEA-003', 'Environmental Health');

CREATE TABLE Inspection (
    inspectionID   INT IDENTITY(1,1) PRIMARY KEY,
    stallID        INT NOT NULL REFERENCES Stall(stallID),
    officerID      INT NOT NULL REFERENCES NEAOfficer(officerID),
    scheduledDate  DATE,
    inspectionDate DATE,
    score          INT CHECK (score BETWEEN 0 AND 100),
    remarks        VARCHAR(2000),
    status         VARCHAR(20) DEFAULT 'scheduled',
    createdAt      DATETIME DEFAULT GETDATE()
);
-- status can be: 'scheduled', 'completed', 'cancelled'

-- Stall 3 has two completed inspections to support the historical HygieneGrade below
INSERT INTO Inspection (stallID, officerID, scheduledDate, inspectionDate, score, remarks, status) VALUES
    (1, 1, '2025-05-10', '2025-05-10', 88, 'Generally clean, minor grease buildup on exhaust hood.', 'completed'),
    (3, 2, '2024-05-15', '2024-05-15', 91, 'Excellent hygiene standards across the board.',           'completed'),
    (3, 2, '2025-05-15', '2025-05-15', 74, 'Food storage temperature not maintained properly.',       'completed'),
    (5, 3, '2025-06-20', NULL,          NULL, NULL,                                                   'scheduled');

-- Hygiene grade issued after an inspection
CREATE TABLE HygieneGrade (
    gradeID      INT IDENTITY(1,1) PRIMARY KEY,
    stallID      INT NOT NULL REFERENCES Stall(stallID),
    inspectionID INT NOT NULL REFERENCES Inspection(inspectionID),
    grade        CHAR(1) NOT NULL,                        -- A, B, C or D
    issuedDate   DATE NOT NULL,
    expiryDate   DATE NOT NULL,
    isActive     BIT DEFAULT 1
);

-- Stall 3 has a historical grade (from inspectionID 2) and a current grade (from inspectionID 3)
INSERT INTO HygieneGrade (stallID, inspectionID, grade, issuedDate, expiryDate, isActive) VALUES
    (1, 1, 'A', '2025-05-10', '2026-05-10', 1),
    (3, 2, 'A', '2024-05-15', '2025-05-15', 0),  -- previous grade, now inactive
    (3, 3, 'B', '2025-05-15', '2026-05-15', 1);
