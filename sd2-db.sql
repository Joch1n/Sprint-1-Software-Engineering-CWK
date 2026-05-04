-- ZeroWaste Connect Database Schema
-- Updated for Advanced Features

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `avatar` VARCHAR(500),
  `postcode` VARCHAR(20),
  `bio` TEXT,
  `phone` VARCHAR(20),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Food Listings Table
-- ============================================
CREATE TABLE `food_listings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `food_name` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `postcode` VARCHAR(20) NOT NULL,
  `image` VARCHAR(500),
  `status` ENUM('available', 'claimed', 'expired') DEFAULT 'available',
  `quantity` VARCHAR(100),
  `expiry_date` DATE,
  `favorites_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `user_idx` (`user_id`),
  INDEX `category_idx` (`category`),
  INDEX `status_idx` (`status`),
  INDEX `created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Reviews & Ratings Table
-- ============================================
CREATE TABLE `reviews` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL,
  `reviewer_id` INT NOT NULL,
  `rating` INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`listing_id`) REFERENCES `food_listings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `listing_idx` (`listing_id`),
  INDEX `reviewer_idx` (`reviewer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Favorites Table
-- ============================================
CREATE TABLE `favorites` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `listing_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `food_listings`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `user_listing_unique` (`user_id`, `listing_id`),
  INDEX `user_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Transactions/Claims Table
-- ============================================
CREATE TABLE `transactions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `listing_id` INT NOT NULL,
  `claimant_id` INT NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  `claim_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completion_date` DATETIME,
  FOREIGN KEY (`listing_id`) REFERENCES `food_listings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`claimant_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `listing_idx` (`listing_id`),
  INDEX `claimant_idx` (`claimant_id`),
  INDEX `status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Messages/Notifications Table
-- ============================================
CREATE TABLE `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `message` TEXT NOT NULL,
  `listing_id` INT,
  `is_read` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`listing_id`) REFERENCES `food_listings`(`id`) ON DELETE SET NULL,
  INDEX `user_idx` (`user_id`),
  INDEX `created_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- Sample Data
-- ============================================

-- Sample Users
INSERT INTO `users` (`id`, `name`, `email`, `password`, `avatar`, `postcode`, `bio`) VALUES
(1, 'Sarah Johnson', 'sarah@example.com', 'hashed_password_1', 'https://api.avataaars.io/svg?avatarStyle=Circle&topType=LongHairStraight&hairColor=Brown', 'SW1A 1AA', 'Community food sharing enthusiast'),
(2, 'Marcus Lee', 'marcus@example.com', 'hashed_password_2', 'https://api.avataaars.io/svg?avatarStyle=Circle&topType=ShortHairShaggy&hairColor=Black', 'E1 6AN', 'Local baker sharing surplus'),
(3, 'Emma Wilson', 'emma@example.com', 'hashed_password_3', 'https://api.avataaars.io/svg?avatarStyle=Circle&topType=LongHairCurly&hairColor=Red', 'N1 9GU', 'Organic farmer supporting zero waste');

-- Sample Food Listings
INSERT INTO `food_listings` (`id`, `user_id`, `food_name`, `description`, `category`, `postcode`, `status`, `created_at`) VALUES
(1, 1, 'Fresh Apples', 'Basket of crisp red apples from my garden', 'fruits', 'SW1A 1AA', 'available', NOW() - INTERVAL 2 HOUR),
(2, 2, 'Homemade Bread', 'Freshly baked sourdough, warm from oven', 'baked', 'E1 6AN', 'available', NOW() - INTERVAL 1 HOUR),
(3, 3, 'Organic Vegetables', 'Mixed veggies: carrots, potatoes, spinach', 'vegetables', 'N1 9GU', 'available', NOW() - INTERVAL 3 HOUR),
(4, 1, 'Fresh Milk', 'Farm-fresh dairy milk, non-homogenized', 'dairy', 'SW1A 1AA', 'available', NOW() - INTERVAL 5 HOUR),
(5, 2, 'Prepared Meals', 'Healthy vegetarian meals - rice bowls and pasta', 'prepared', 'E1 6AN', 'available', NOW() - INTERVAL 30 MINUTE);

-- Sample Reviews
INSERT INTO `reviews` (`listing_id`, `reviewer_id`, `rating`, `comment`) VALUES
(1, 2, 5, 'Fresh and delicious!'),
(1, 3, 4, 'Great quality apples'),
(2, 1, 5, 'Best sourdough in town!'),
(3, 1, 4, 'Very fresh vegetables');

-- ============================================
-- Indexes and Auto Increment
-- ============================================
ALTER TABLE `users` AUTO_INCREMENT = 4;
ALTER TABLE `food_listings` AUTO_INCREMENT = 6;
ALTER TABLE `reviews` AUTO_INCREMENT = 5;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
