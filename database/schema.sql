-- Fresh installations only. No sample users, content, credentials or destructive statements.
-- Use scripts/init-fresh-db.cjs against a newly provisioned, empty MySQL 8 database.

CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `avatar_url` text,
  `bio` text,
  `preferences` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `team_title` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tags` (
  `tag_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `boards` (
  `board_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `visibility` enum('public','private','semi-private') DEFAULT 'private',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`board_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `boards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pins` (
  `pin_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `image_url` longtext,
  `image_name` varchar(255) DEFAULT NULL,
  `link_url` text,
  `visibility` enum('public','private') DEFAULT 'public',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `board_id` int DEFAULT NULL,
  PRIMARY KEY (`pin_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `pins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `board_follows` (
  `user_id` int NOT NULL,
  `board_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`board_id`),
  KEY `board_id` (`board_id`),
  CONSTRAINT `board_follows_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `board_follows_ibfk_2` FOREIGN KEY (`board_id`) REFERENCES `boards` (`board_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `board_pins` (
  `board_id` int NOT NULL,
  `pin_id` int NOT NULL,
  PRIMARY KEY (`board_id`,`pin_id`),
  KEY `pin_id` (`pin_id`),
  CONSTRAINT `board_pins_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`board_id`),
  CONSTRAINT `board_pins_ibfk_2` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `comments` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `pin_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`comment_id`),
  KEY `user_id` (`user_id`),
  KEY `pin_id` (`pin_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `engagements` (
  `engagement_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `pin_id` int DEFAULT NULL,
  `type` enum('like','save') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`engagement_id`),
  KEY `user_id` (`user_id`),
  KEY `pin_id` (`pin_id`),
  CONSTRAINT `engagements_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `engagements_ibfk_2` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `follows` (
  `follower_id` int NOT NULL,
  `followee_id` int NOT NULL,
  PRIMARY KEY (`follower_id`,`followee_id`),
  KEY `followee_id` (`followee_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`followee_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `image_metadata` (
  `image_id` int NOT NULL AUTO_INCREMENT,
  `pin_id` int DEFAULT NULL,
  `image_format` varchar(50) DEFAULT NULL,
  `image_size` int DEFAULT NULL,
  `width` int DEFAULT NULL,
  `height` int DEFAULT NULL,
  PRIMARY KEY (`image_id`),
  KEY `pin_id` (`pin_id`),
  CONSTRAINT `image_metadata_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pin_categories` (
  `pin_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`pin_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `pin_categories_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`),
  CONSTRAINT `pin_categories_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pin_tags` (
  `pin_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`pin_id`,`tag_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `pin_tags_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`),
  CONSTRAINT `pin_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `pin_views` (
  `view_id` int NOT NULL AUTO_INCREMENT,
  `pin_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `viewed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`view_id`),
  KEY `pin_id` (`pin_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `pin_views_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`),
  CONSTRAINT `pin_views_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `replies` (
  `reply_id` int NOT NULL AUTO_INCREMENT,
  `comment_id` int DEFAULT NULL,
  `parent_reply_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reply_id`),
  KEY `comment_id` (`comment_id`),
  KEY `parent_reply_id` (`parent_reply_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `replies_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`comment_id`),
  CONSTRAINT `replies_ibfk_2` FOREIGN KEY (`parent_reply_id`) REFERENCES `replies` (`reply_id`),
  CONSTRAINT `replies_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE board_viewers (
  board_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (board_id, user_id),
  CONSTRAINT board_viewers_board_fk FOREIGN KEY (board_id) REFERENCES boards(board_id) ON DELETE CASCADE,
  CONSTRAINT board_viewers_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

