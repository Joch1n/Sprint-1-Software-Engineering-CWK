CREATE DATABASE IF NOT EXISTS zerowaste;
USE zerowaste;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS food_listings;
DROP TABLE IF EXISTS users;

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,

    avatar VARCHAR(500),
    postcode VARCHAR(20),
    bio TEXT,
    phone VARCHAR(20),

    failed_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FOOD LISTINGS TABLE
-- ============================================

CREATE TABLE food_listings (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT,

    food_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    quantity VARCHAR(100),

    category VARCHAR(100),

    postcode VARCHAR(20),

    expiry_date DATE,

    image VARCHAR(500),

    lat DECIMAL(10, 7),
    lon DECIMAL(10, 7),

    status ENUM('available','claimed','expired')
    DEFAULT 'available',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- ============================================
-- REVIEWS TABLE
-- ============================================

CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,

    listing_id INT NOT NULL,

    reviewer_id INT NOT NULL,

    rating INT NOT NULL,

    comment TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (listing_id)
    REFERENCES food_listings(id)
    ON DELETE CASCADE,

    FOREIGN KEY (reviewer_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- ============================================
-- FAVORITES TABLE
-- ============================================

CREATE TABLE favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    listing_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

    FOREIGN KEY (listing_id)
    REFERENCES food_listings(id)
    ON DELETE CASCADE
);

-- ============================================
-- MESSAGES TABLE
-- ============================================

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,

    listing_id INT NOT NULL,

    sender_id INT NOT NULL,

    receiver_id INT NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sender_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

    FOREIGN KEY (receiver_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

    FOREIGN KEY (listing_id)
    REFERENCES food_listings(id)
    ON DELETE CASCADE
);

-- ============================================
-- SAMPLE MESSAGES
-- ============================================

INSERT INTO messages
(listing_id, sender_id, receiver_id, message)
VALUES
(1, 2, 1, 'Hi Sarah, are the apples still available?'),
(1, 1, 2, 'Yes, they are. You can collect them this afternoon.');

-- ============================================
-- SAMPLE USERS
-- ============================================

INSERT INTO users (username, email, password)
VALUES
('Sarah', 'sarah@example.com', '$2b$10$gQBKzckEJicT8f5EeAI5POIYgJmySoBu3IlSZaTeWjak0cPAl2F1q'),
('Marcus', 'marcus@example.com', '$2b$10$gQBKzckEJicT8f5EeAI5POIYgJmySoBu3IlSZaTeWjak0cPAl2F1q');

-- ============================================
-- SAMPLE FOOD LISTINGS
-- ============================================

INSERT INTO food_listings
(user_id, food_name, description, quantity, category, postcode, image, expiry_date, lat, lon)
VALUES
(
1,
'Fresh Apples',
'Basket of fresh apples',
'5 bags',
'Fruit',
'SW1A 1AA',
'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6',
'2026-06-01',
51.5010095,
-0.1415881
),

(
2,
'Bread',
'Fresh sourdough bread',
'2 loaves',
'Bakery',
'E1 6AN',
'https://images.unsplash.com/photo-1509440159596-0249088772ff',
'2026-06-03',
51.5211238,
-0.0717531
);

-- ============================================
-- SAMPLE REVIEWS
-- ============================================

INSERT INTO reviews
(listing_id, reviewer_id, rating, comment)
VALUES
(1, 2, 5, 'Amazing apples!'),
(2, 1, 4, 'Really fresh bread.');
