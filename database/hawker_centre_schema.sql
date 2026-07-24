CREATE LOGIN bed_user WITH PASSWORD = 'YourPassword123';
GO

CREATE DATABASE HawkerCentreDatabase;
GO

USE HawkerCentreDatabase;
GO

CREATE USER hawker_admin FOR LOGIN bed_user;
ALTER ROLE db_owner ADD MEMBER hawker_admin;
GO

-- ============================================================
-- SECTION: SHARED
-- Tables used across all roles
-- ============================================================

CREATE TABLE Users (
    userID           INT IDENTITY(1,1) PRIMARY KEY,
    email            VARCHAR(255) NOT NULL UNIQUE,
    passwordHash     VARCHAR(255) NOT NULL,
    role             VARCHAR(20)  NOT NULL,      -- 'customer', 'stallOwner', 'operator', 'neaOfficer'
    createdAt        DATETIME DEFAULT GETDATE(),
    isActive         BIT DEFAULT 1,
    profilePictureURL VARCHAR(500)               -- shared across all roles; set via PUT /account/picture
);

-- Seeded plaintext passwords (for testing login only): <Name>123! e.g. Alice123!, Bob123!, ...
INSERT INTO Users (email, passwordHash, role) VALUES
    ('alice@email.com',    '$2b$10$YAl2JoMRHkVW7gluIob.dud5p0qUF9NYhAfmKCVZWhLT4Fe0/vkf.',    'customer'),
    ('bob@email.com',      '$2b$10$mGWEMGP5RFXX91gWDIHmrObpmif0SskOQf1fiagFzL45HZ6kZdycG',    'customer'),
    ('charlie@email.com',  '$2b$10$SCetqPCvbMaQbCVqZ43/qO.izJAR9JEGVrALUob5uAYJ5cZ8aQIne',    'customer'),
    ('diana@email.com',    '$2b$10$PKoakfHAkOXyZKHvlCroWuqB9yAH12/Sd.yHKD5tO35DJR2ZD6i4a',    'stallOwner'),
    ('evan@email.com',     '$2b$10$IIa7RL/wVDQQ6fms5mXTs.1kfolRErcUNGbKtM15vtAy2RB22q4XG',    'stallOwner'),
    ('fiona@email.com',    '$2b$10$LQvb6i4MMQsBKIqujTSzo.2yfWhz9S02wINP.UR/oLLJ0LosNzXCa',    'stallOwner'),
    ('grace@email.com',    '$2b$10$oOV/5m5PiOJOhENgWTx0nO4DNhajmUBNzEBAS2UjyXkT0bOfEw/rK',    'stallOwner'),
    ('henry@email.com',    '$2b$10$OJTkOkXM4h1MzOApWPxfouJxcFOVoEhACN4j14Uj1RmheYCx49urK',    'stallOwner'),
    ('iris@email.com',     '$2b$10$xk5/yyYlrBI7dyJPB2MNFO4DQBRR9kIEFfm3Np0psnYACVMZJZLVi',    'stallOwner'),
    ('james@email.com',    '$2b$10$BLXKpziO91lZtPePDihwYeItZJTUX7iZfarOzah36w.7WADQJ3.SO',    'operator'),
    ('karen@email.com',    '$2b$10$PCbVU52JDNpJCH61cQcCo.KApXT4vuL25Dr8vL0b.zRrO3un6W4Z2',    'operator'),
    ('leon@email.com',     '$2b$10$X84pNif9n20vaq5AAsTwOubp7JiKOqHllJq6mHNBAP8QhshCNmhGy',    'operator'),
    ('mary@email.com',     '$2b$10$mG.4EUWsMNn5M6zZqe3OgetpzkzpwAYGNEq9bdAoJ7g.x.CITTd.i',    'neaOfficer'),
    ('nathan@email.com',   '$2b$10$PJMG1ArBZPDlR4XIZgHiqOVpdKeLW6EeuRCyqOxuomsOju9iFSBRG',    'neaOfficer'),
    ('olivia@email.com',   '$2b$10$9FC3jS7v/INpxMS4L70tSuVtK5do/fG73eI6k0HkZC22bLzzBGile',    'neaOfficer');


-- ============================================================
-- SECTION: OPERATOR
-- Operator, HawkerCentre
-- (OperatorAccounts and RentalAgreement also belong to this role,
--  but are defined further down since they reference Stall)
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

-- Priced add-ons (category = 'add-on'): optional extras a customer can add to their cart
-- alongside a main dish. Unlike OrderItem.addons (a free-text note), these are ordinary
-- MenuItem rows with their own price, so they appear as their own itemized line on the
-- receipt. menuItemID 19+ so the hardcoded IDs above (1-18) stay unchanged.
INSERT INTO MenuItem (stallID, name, description, price, category, isAvailable) VALUES
    (1, 'Extra Chicken',        'Additional serving of chicken',             2.50, 'add-on', 1),
    (1, 'Extra Rice',           'Additional serving of fragrant rice',       1.00, 'add-on', 1),
    (2, 'Extra Mutton',         'Additional serving of mutton',              3.00, 'add-on', 1),
    (2, 'Papadum',              'Crispy lentil cracker',                     0.80, 'add-on', 1),
    (3, 'Extra Cockles',        'Additional serving of cockles',             1.50, 'add-on', 1),
    (3, 'Fried Egg',            'Add a fried egg',                           0.80, 'add-on', 1),
    (4, 'Extra Curry Gravy',    'Additional serving of curry gravy',         0.80, 'add-on', 1),
    (4, 'Papadum',              'Crispy lentil cracker',                     0.80, 'add-on', 1),
    (5, 'Extra Noodles',        'Additional serving of noodles',             1.50, 'add-on', 1),
    (5, 'Pork Wontons (3pc)',   'Additional pork wontons',                   2.00, 'add-on', 1),
    (6, 'Extra Ikan Bilis',     'Additional serving of ikan bilis & peanuts', 1.00, 'add-on', 1),
    (6, 'Fried Egg',            'Add a fried egg',                           0.80, 'add-on', 1);

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
    startDate     DATE NULL,
    endDate       DATE NULL,
    isActive      BIT DEFAULT 1,
    createdAt     DATETIME DEFAULT GETDATE()
);
-- discountType can be: 'percentage', 'fixed', 'points'

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
    paymentMethod  VARCHAR(20) NOT NULL,                  -- Cash / NETS / PayNow
    paymentStatus  VARCHAR(20) DEFAULT 'pending',
    subtotal       DECIMAL(10,2) NOT NULL,
    packagingFee   DECIMAL(10,2) DEFAULT 0,
    gstAmount      DECIMAL(10,2) DEFAULT 0,
    totalAmount    DECIMAL(10,2) NOT NULL,
    notes          VARCHAR(500),
    createdAt      DATETIME DEFAULT GETDATE(),
    updatedAt      DATETIME DEFAULT GETDATE()
);
-- status can be: 'pending', 'preparing', 'ready', 'completed', 'abandoned'
-- paymentStatus can be: 'pending', 'paid', 'failed'

-- createdAt defaults to GETDATE(), so these orders are dated the day the script is run.
-- orderID 4 seeds Stall 1's live queue for the queue-advance demo: it sits at queue #43
-- (current), so a customer who checks out at Stall 1 next becomes #44 and is the one emailed
-- when the owner advances. This only works if the schema is run on the SAME day you record.
INSERT INTO Orders (customerID, stallID, queueNumber, status, paymentMethod, paymentStatus, subtotal, packagingFee, gstAmount, totalAmount) VALUES
    (1, 1, 42, 'completed', 'PayNow', 'paid',    9.00, 0.00, 0.81,  9.81),
    (2, 3, 17, 'completed', 'NETS',   'paid',    5.50, 0.50, 0.54,  6.54),
    (3, 5,  5, 'preparing', 'Cash',   'pending', 5.00, 0.00, 0.45,  5.45),
    (2, 1, 43, 'preparing', 'PayNow', 'paid',    4.50, 0.00, 0.41,  4.91);  -- orderID 4: seeds Stall 1's queue (see note above)

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
    (3, 13, 'Wonton Noodles',       5.00, 1, NULL),
    (4, 1,  'Steamed Chicken Rice', 4.50, 1, NULL);

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
    (3, 'Cash',   'pending', NULL,           NULL),
    (4, 'PayNow', 'success', 'TXN-PAY-004', GETDATE());


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
    createdAt   DATETIME DEFAULT GETDATE(),
    resolvedAt  DATETIME
);
-- status can be: 'open', 'underReview', 'resolved', 'closed'

INSERT INTO Complaint (customerID, stallID, category, description, status) VALUES
    (1, 3, 'Hygiene',      'Noticed the cooking area was unclean during my visit.', 'underReview'),
    (2, 5, 'Service',      'Staff was rude when I asked to customise my order.',    'open'),
    (3, 1, 'Food Quality', 'Rice was undercooked on my last visit.',                'resolved');

-- In-app notifications (e.g. new promotions)
CREATE TABLE Notification (
    notificationID INT IDENTITY(1,1) PRIMARY KEY,
    customerID     INT NOT NULL REFERENCES Customer(customerID),
    orderID        INT REFERENCES Orders(orderID),      -- queue notifications link to the order
    channel        VARCHAR(20) DEFAULT 'inApp',         -- 'inApp' | 'email'
    title          VARCHAR(255) NOT NULL,
    message        VARCHAR(1000) NOT NULL,
    status         VARCHAR(20) DEFAULT 'sent',          -- 'sent' | 'failed' (third-party delivery result)
    isRead         BIT DEFAULT 0,
    createdAt      DATETIME DEFAULT GETDATE()
);
-- channel can be: 'inApp', 'email'   |   status can be: 'sent', 'failed'

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

-- Inspection dates are quarter-spaced across 2024-2026 so the grades below fall due in
-- different quarters (see HygieneGrade). Stall 3 has two completed inspections (a historical
-- grade and a current one). inspectionID 4 is an upcoming *scheduled* re-inspection for Stall 5.
-- Each grade is issued on the day of its backing inspection.
INSERT INTO Inspection (stallID, officerID, scheduledDate, inspectionDate, score, remarks, status) VALUES
    (1, 1, '2025-09-01', '2025-09-01', 88, 'Generally clean, minor grease buildup on exhaust hood.', 'completed'),      -- inspectionID 1  (Stall 1)
    (3, 2, '2024-12-01', '2024-12-01', 91, 'Excellent hygiene standards across the board.',           'completed'),      -- inspectionID 2  (Stall 3, historical)
    (3, 2, '2026-01-01', '2026-01-01', 74, 'Food storage temperature not maintained properly.',       'completed'),      -- inspectionID 3  (Stall 3, current)
    (5, 3, '2026-08-15', NULL,          NULL, NULL,                                                   'scheduled'),       -- inspectionID 4  (Stall 5, upcoming re-inspection)
    (2, 1, '2026-07-01', '2026-07-01', 90, 'Well-maintained prep area, proper food handling observed.', 'completed'),    -- inspectionID 5  (Stall 2, this quarter)
    (4, 2, '2026-04-01', '2026-04-01', 82, 'Satisfactory overall, reminded staff on glove usage.',      'completed'),    -- inspectionID 6  (Stall 4, Q2 2026)
    (5, 3, '2025-11-01', '2025-11-01', 95, 'Immaculate stall, exemplary hygiene practices.',            'completed'),    -- inspectionID 7  (Stall 5, Q4 2025)
    (6, 1, '2026-02-01', '2026-02-01', 68, 'Some cleanliness lapses at wash station, needs improvement.', 'completed');  -- inspectionID 8  (Stall 6, Q1 2026)

-- Hygiene grade issued after an inspection
CREATE TABLE HygieneGrade (
    gradeID      INT IDENTITY(1,1) PRIMARY KEY,
    stallID      INT NOT NULL REFERENCES Stall(stallID),
    inspectionID INT NOT NULL REFERENCES Inspection(inspectionID),
    grade        CHAR(1) NOT NULL,
    issuedDate   DATE NOT NULL,
    expiryDate   DATE NOT NULL,
    isActive     BIT DEFAULT 1
);
-- grade can be: 'A', 'B', 'C', 'D'

-- Every stall (1-6) has exactly one active grade so the officer/customer views always show a
-- grade. Grades are quarter-spaced and issued on the day of their backing inspection, giving a
-- range of validity to talk through in the demo: Stall 2 was graded this quarter, Stall 1 is
-- close to expiry (a natural cue for the upcoming re-inspection), and the others sit in between.
-- Stall 3 also keeps one deliberately expired historical grade (isActive = 0) to show grade history.
-- NOTE: these are fixed dates chosen to be valid across the assignment period (through the demo).
-- They do not auto-roll, so refresh them if this data is reused far beyond 2026.
INSERT INTO HygieneGrade (stallID, inspectionID, grade, issuedDate, expiryDate, isActive) VALUES
    (1, 1, 'A', '2025-09-01', '2026-09-01', 1),  -- Stall 1: valid, expiring soon (cue for re-inspection)
    (3, 2, 'A', '2024-12-01', '2025-12-01', 0),  -- Stall 3: historical grade, now expired/inactive
    (3, 3, 'B', '2026-01-01', '2027-01-01', 1),  -- Stall 3: current grade (dropped A -> B after re-inspection)
    (2, 5, 'A', '2026-07-01', '2027-07-01', 1),  -- Stall 2: freshly issued this quarter (Q3 2026)
    (4, 6, 'B', '2026-04-01', '2027-04-01', 1),  -- Stall 4: issued Q2 2026
    (5, 7, 'A', '2025-11-01', '2026-11-01', 1),  -- Stall 5: valid, expiring Q4 2026
    (6, 8, 'C', '2026-02-01', '2027-02-01', 1);  -- Stall 6: issued Q1 2026
