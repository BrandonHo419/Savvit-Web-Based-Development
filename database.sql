-- MySQL dump 10.13  Distrib 8.0.32, for Linux (x86_64)
--
-- Host: localhost    Database: pinterest_clone
-- ------------------------------------------------------
-- Server version	8.0.32-0ubuntu0.22.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `board_follows`
--

DROP TABLE IF EXISTS `board_follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board_follows` (
  `user_id` int NOT NULL,
  `board_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`board_id`),
  KEY `board_id` (`board_id`),
  CONSTRAINT `board_follows_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `board_follows_ibfk_2` FOREIGN KEY (`board_id`) REFERENCES `boards` (`board_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `board_follows`
--

LOCK TABLES `board_follows` WRITE;
/*!40000 ALTER TABLE `board_follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `board_follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `board_pins`
--

DROP TABLE IF EXISTS `board_pins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board_pins` (
  `board_id` int NOT NULL,
  `pin_id` int NOT NULL,
  PRIMARY KEY (`board_id`,`pin_id`),
  KEY `pin_id` (`pin_id`),
  CONSTRAINT `board_pins_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`board_id`),
  CONSTRAINT `board_pins_ibfk_2` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `board_pins`
--

LOCK TABLES `board_pins` WRITE;
/*!40000 ALTER TABLE `board_pins` DISABLE KEYS */;
/*!40000 ALTER TABLE `board_pins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `boards`
--

DROP TABLE IF EXISTS `boards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boards` (
  `board_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `visibility` enum('public','private') DEFAULT 'public',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`board_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `boards_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `boards`
--

LOCK TABLES `boards` WRITE;
/*!40000 ALTER TABLE `boards` DISABLE KEYS */;
INSERT INTO `boards` VALUES (1,1,'fdfds',NULL,'public','2025-06-08 17:46:41'),(2,1,'fdfds',NULL,'public','2025-06-08 17:46:41'),(3,1,'hello',NULL,'public','2025-06-08 17:54:19'),(4,1,'hello',NULL,'public','2025-06-08 18:01:49'),(5,1,'demo1',NULL,'public','2025-06-08 18:05:54'),(6,1,'d',NULL,'public','2025-06-08 18:15:56'),(7,1,'dd',NULL,'public','2025-06-08 18:16:09'),(8,1,'demo2',NULL,'public','2025-06-08 18:29:54'),(9,1,'1',NULL,'public','2025-06-10 18:25:06'),(10,1,'1',NULL,'public','2025-06-10 18:25:15'),(11,1,'1',NULL,'public','2025-06-10 19:37:35'),(12,1,'1',NULL,'public','2025-06-10 20:28:47'),(13,1,'d',NULL,'public','2025-06-10 20:37:47'),(14,1,'1',NULL,'public','2025-06-11 05:40:56');
/*!40000 ALTER TABLE `boards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,1,25,'d',0,'2025-06-09 04:36:05'),(2,1,25,'d',0,'2025-06-09 04:36:08'),(3,1,26,'d',0,'2025-06-09 04:39:00'),(4,1,25,'ddd',0,'2025-06-09 04:39:37'),(5,1,26,'ddddd',0,'2025-06-09 04:39:46'),(6,1,26,'dd',0,'2025-06-09 04:39:53'),(7,1,23,'dds',0,'2025-06-09 04:40:45'),(8,1,25,'ddd',0,'2025-06-09 05:36:54'),(9,1,26,'d',0,'2025-06-09 05:41:40'),(10,1,25,'d',0,'2025-06-09 05:46:53'),(11,1,26,'d',0,'2025-06-09 05:46:59'),(12,1,25,'Dd',0,'2025-06-09 05:47:06'),(13,1,26,'ddd',0,'2025-06-09 05:47:11'),(14,1,23,'ddd',0,'2025-06-09 05:50:18'),(15,1,24,'d',0,'2025-06-09 05:50:40'),(19,1,24,'poke',0,'2025-06-09 06:38:52'),(20,1,25,'ddd',0,'2025-06-09 06:48:18'),(21,1,23,'ddd',0,'2025-06-09 06:48:22'),(23,1,23,'!!!!',0,'2025-06-09 07:00:32'),(24,1,26,'!!!!',0,'2025-06-09 07:01:10'),(26,1,25,'ddd',0,'2025-06-12 06:55:29'),(27,1,24,'dd',0,'2025-06-12 06:55:32'),(29,1,25,'ddd',0,'2025-06-12 06:55:41'),(30,1,25,'d',0,'2025-06-12 06:55:43'),(31,1,23,'dd',0,'2025-06-12 06:55:53'),(32,1,25,'dddddasdsa',0,'2025-06-12 06:55:59'),(33,1,26,'d',0,'2025-06-12 06:56:05'),(38,1,25,'d',0,'2025-06-12 07:18:09'),(39,1,25,'ddd',0,'2025-06-12 07:18:24'),(40,1,34,'d',0,'2025-06-12 13:02:40'),(41,1,34,'ddd',0,'2025-06-12 13:11:11'),(42,1,34,'!',0,'2025-06-12 17:21:56');
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `engagements`
--

DROP TABLE IF EXISTS `engagements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `engagements`
--

LOCK TABLES `engagements` WRITE;
/*!40000 ALTER TABLE `engagements` DISABLE KEYS */;
INSERT INTO `engagements` VALUES (60,1,24,'like','2025-06-09 06:38:06'),(73,1,26,'like','2025-06-09 07:00:58'),(82,1,34,'like','2025-06-12 18:50:19');
/*!40000 ALTER TABLE `engagements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follows`
--

DROP TABLE IF EXISTS `follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follows` (
  `follower_id` int NOT NULL,
  `followee_id` int NOT NULL,
  PRIMARY KEY (`follower_id`,`followee_id`),
  KEY `followee_id` (`followee_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`followee_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follows`
--

LOCK TABLES `follows` WRITE;
/*!40000 ALTER TABLE `follows` DISABLE KEYS */;
/*!40000 ALTER TABLE `follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `image_metadata`
--

DROP TABLE IF EXISTS `image_metadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `image_metadata`
--

LOCK TABLES `image_metadata` WRITE;
/*!40000 ALTER TABLE `image_metadata` DISABLE KEYS */;
/*!40000 ALTER TABLE `image_metadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pin_categories`
--

DROP TABLE IF EXISTS `pin_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pin_categories` (
  `pin_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`pin_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `pin_categories_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`),
  CONSTRAINT `pin_categories_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pin_categories`
--

LOCK TABLES `pin_categories` WRITE;
/*!40000 ALTER TABLE `pin_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `pin_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pin_tags`
--

DROP TABLE IF EXISTS `pin_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pin_tags` (
  `pin_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`pin_id`,`tag_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `pin_tags_ibfk_1` FOREIGN KEY (`pin_id`) REFERENCES `pins` (`pin_id`),
  CONSTRAINT `pin_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pin_tags`
--

LOCK TABLES `pin_tags` WRITE;
/*!40000 ALTER TABLE `pin_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `pin_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pin_views`
--

DROP TABLE IF EXISTS `pin_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pin_views`
--

LOCK TABLES `pin_views` WRITE;
/*!40000 ALTER TABLE `pin_views` DISABLE KEYS */;
/*!40000 ALTER TABLE `pin_views` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pins`
--

DROP TABLE IF EXISTS `pins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pins`
--

LOCK TABLES `pins` WRITE;
/*!40000 ALTER TABLE `pins` DISABLE KEYS */;
INSERT INTO `pins` VALUES (11,1,'dsadsa','dasdsa','/uploads/1749393690560.png',NULL,'dasdsa','public','2025-06-08 14:41:30',NULL),(12,1,'wewd','sadasd','/uploads/1749393708492.png',NULL,'asdsadsa','public','2025-06-08 14:41:48',NULL),(13,1,'cat','dsadas','/uploads/1749393724597.jpg',NULL,'dasdsad','public','2025-06-08 14:42:04',NULL),(14,1,'flower',':)','/uploads/1749393738145.png',NULL,'dddd','public','2025-06-08 14:42:18',NULL),(15,1,'helliodsa','dsadsa','/uploads/1749394388493.gif',NULL,'dsadsad','public','2025-06-08 14:53:08',NULL),(16,1,'sdasd','dasd','/uploads/1749402035663.png',NULL,'dasdas','public','2025-06-08 17:00:35',NULL),(17,1,'sdsf','dfs','/uploads/1749402882060.jpg',NULL,'das','public','2025-06-08 17:14:42',NULL),(18,1,'dasdsad','dasdsa','/uploads/1749405271120.jpg',NULL,'dasdsa','public','2025-06-08 17:54:31',NULL),(19,1,'sd','asdf','/uploads/1749405719602.jpg',NULL,'asd','public','2025-06-08 18:01:59',NULL),(20,1,'demo1','ddd','/uploads/1749405966305.jpg',NULL,'ddd','public','2025-06-08 18:06:06',NULL),(21,1,'d','d','/uploads/1749405993657.gif',NULL,'d','public','2025-06-08 18:06:33',NULL),(22,1,'ddd','dd','/uploads/1749406565428.gif',NULL,'dd','public','2025-06-08 18:16:05',NULL),(23,1,'dsadsad','sadasdsa','/uploads/1749407404141.gif',NULL,'dasdsad','public','2025-06-08 18:30:04',7),(24,1,'sdfgh','sdfg','/uploads/1749407704256.jpg',NULL,'dfgh','public','2025-06-08 18:35:04',7),(25,1,'d','d','/uploads/1749441734170.jpg',NULL,'d','public','2025-06-09 04:02:14',7),(26,1,'d','d','/uploads/1749442107123.gif',NULL,'d','public','2025-06-09 04:08:27',7),(28,1,'dasdsa','sdasdsa','/uploads/1749452512585.gif',NULL,'dssadsa','public','2025-06-09 07:01:52',7),(31,1,'lonmg','d','/uploads/1749452605628.png',NULL,'d','public','2025-06-09 07:03:25',11),(32,1,'d','d','/uploads/1749587874885.jpg',NULL,'d','public','2025-06-10 20:37:54',12),(33,1,'YouTube Video','With rumors of a Red Gyarados rampaging in the Lake of Rage, Lance of the Elite Four decides to investigate.\n\nPokémon Generations revisits each generation of the Pokémon video game series to shed new light on some timeless moments. From the earliest days in the Kanto region to the splendor of the Kalos region, go behind the scenes and witness Pokémon history with new eyes! These bite-sized adventures, about 3 to 5 minutes long, will be released every week through December 23, 2016.\n\nOfficial site: http://www.pokemon.com \nShop: http://www.pokemoncenter.com\nFacebook: http://www.facebook.com/Pokemon \nTwitter: http://www.twitter.com/Pokemon \nInstagram: http://www.instagram.com/pokemon \nTumblr: http://www.pokemon.tumblr.com','https://img.youtube.com/vi/hlh4jKv184E/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=hlh4jKv184E','public','2025-06-12 11:32:42',1),(34,1,'YouTube Video','A new challenger approaches to test his abilities against the Kanto region’s Elite Four. Will he prove himself worthy?\n\nPokémon Generations revisits each generation of the Pokémon video game series to shed new light on some timeless moments. From the earliest days in the Kanto region to the splendor of the Kalos region, go behind the scenes and witness Pokémon history with new eyes! These bite-sized adventures, about 3 to 5 minutes long, will be released every week through December 23, 2016.\n\nOfficial site: http://www.pokemon.com \nShop: http://www.pokemoncenter.com\nFacebook: http://www.facebook.com/Pokemon \nTwitter: http://www.twitter.com/Pokemon \nInstagram: http://www.instagram.com/pokemon \nTumblr: http://www.pokemon.tumblr.com','https://img.youtube.com/vi/ktskEn5q7gg/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=ktskEn5q7gg','public','2025-06-12 11:33:02',7),(35,1,'YouTube Video','YouTube Rewind 2016. Celebrating the videos, people, music and moves that made 2016. #YouTubeRewind\n\nSpend more time with your favorite creators, videos and trends from 2016: http://yt.be/rewind2016\nWatch trending videos from 2016: http://youtube.com/rewind\nSee trends as they happen: http://youtube.com/trending\nWatch the BTS video: https://youtu.be/Y8MuxHNLfZ8\nWatch all the easter eggs: https://goo.gl/WihKvv\n\nMusic by The Hood Internet https://www.youtube.com/user/thehoodinternet\nWith an original remix by Major Lazer https://www.youtube.com/user/majorlazer\n\nAlex Wassabi https://www.youtube.com/user/hoiitsroi\nAlfie https://www.youtube.com/user/PointlessBlog\nAIB https://www.youtube.com/user/allindiabakchod\nAmazingPhil https://www.youtube.com/user/AmazingPhil\nAndreasChoice https://www.youtube.com/user/AndreasChoice\nBethany Mota https://www.youtube.com/user/Macbarbie07\nBFvsGF https://www.youtube.com/user/BFvsGF\nBibisBeautyPalace https://www.youtube.com/user/BibisBeautyPalace\nBie The Ska https://www.youtube.com/user/bomberball\nCaELiKe https://www.youtube.com/user/CaELiKe\nCasey Neistat https://www.youtube.com/user/caseyneistat\nCaspar https://www.youtube.com/user/dicasp\nConnor Franta https://www.youtube.com/user/ConnorFranta\nCyprien https://www.youtube.com/user/MonsieurDream\ndanisnotonfire https://www.youtube.com/user/danisnotonfire\nDude Perfect https://www.youtube.com/user/corycotton\nDwayne \"The Rock\" Johnson https://www.youtube.com/user/therock\nEeOneGuy https://www.youtube.com/user/EeOneGuy\nelrubiusOMG https://www.youtube.com/user/elrubiusOMG\nenchufetv https://www.youtube.com/user/enchufetv\nGigi Gorgeous https://www.youtube.com/user/GregoryGORGEOUS\nGrace Helbig https://www.youtube.com/user/graciehinabox\nhajimesyacho https://www.youtube.com/user/0214mex\nHannah Hart https://www.youtube.com/user/MyHarto/\nHayla https://www.youtube.com/user/HaylaTV\nHevesh5 https://www.youtube.com/user/Hevesh5\nHolaSoyGerman https://www.youtube.com/user/HolaSoyGerman\niHasCupquake https://www.youtube.com/user/iHasCupquake\nIngrid Nilsen https://www.youtube.com/user/missglamorazzi\njacksepticeye https://www.youtube.com/user/jacksepticeye\nJenn McAllister https://www.youtube.com/user/jennxpenn\nJoey Graceffa https://www.youtube.com/user/JoeyGraceffa\nJoutJout Prazer https://www.youtube.com/user/joutjoutprazer\nKianAndJC https://www.youtube.com/user/KianAndJc\nKSI https://www.youtube.com/user/KSIOlajidebt\nKurt Hugo Schneider https://www.youtube.com/user/KurtHugoSchneider\nLaurDIY https://www.youtube.com/user/LaurDIY\nLilly Singh https://www.youtube.com/user/IISuperwomanII\nLiza Koshy https://www.youtube.com/channel/UCxSz6JVYmzVhtkraHWZC7HQ\nLosPolinesios https://www.youtube.com/user/LosPolinesios\nLuisito Rey https://www.youtube.com/user/luisitorey\nLuzu https://www.youtube.com/user/luzugames\nMamrie Hart https://www.youtube.com/user/YouDeserveADrink\nMarkiplier https://www.youtube.com/user/markiplierGAME\nMarques Brownlee https://www.youtube.com/user/marquesbrownlee\nMatPat https://www.youtube.com/user/MatthewPatrick13\nMatt Steffanina https://www.youtube.com/user/MattSDance\nMeg DeAngelis https://www.youtube.com/user/maybabytumbler\nMeredith Foster https://www.youtube.com/user/StilaBabe09\nNicky Jam https://www.youtube.com/channel/UCpb_iJuhFe8V6rQdbNqfAlQ\nPewDiePie https://www.youtube.com/user/PewDiePie\nPIKOTARO https://www.youtube.com/channel/UCKpIOnsk-gcwHXIzuk24ExA\nPorta dos Fundos https://www.youtube.com/user/portadosfundos\nPrankvsPrank https://www.youtube.com/user/PrankvsPrank\nRADIO FISH https://www.youtube.com/channel/UCok3jJg7q1-PKV6XYDYTA_A\nRclbeauty101 https://www.youtube.com/user/Rclbeauty101\nRhett & Link https://www.youtube.com/user/RhettandLink\nSebastián Villalobos https://www.youtube.com/user/VillalobosSebastian\nSeth Meyers https://www.youtube.com/user/LateNightSeth\nSQUEEZIE https://www.youtube.com/user/aMOODIEsqueezie\nsWooZie https://www.youtube.com/user/swoozie06\nThe Dolan Twins https://www.youtube.com/user/TheDolanTwins\nThe Late Late Show with James Corden https://www.youtube.com/channel/UCJ0uqCI0Vqr2Rrt1HseGirg\nThe Slow Mo Guys https://www.youtube.com/user/theslowmoguys\nTheWillyrex https://www.youtube.com/user/TheWillyrex\nTre Melvin https://www.youtube.com/user/ThisIsACommentary\nTrevor Noah https://www.youtube.com/channel/UCwWhs_6x42TyRM4Wstoq8HA\nUnbox Therapy https://www.youtube.com/user/unboxtherapy\nVanossGaming https://www.youtube.com/user/VanossGaming\nVRZOchannel https://www.youtube.com/user/VrzoChannel\nWerevertumorro https://www.youtube.com/user/werevertumorro\nWhat\'s Inside? https://www.youtube.com/user/lincolnmarkham\nwhatdafaqshow https://www.youtube.com/user/WHATDAFAQSHOW\nWhinderssonNunes https://www.youtube.com/user/whinderssonnunes\nYosStoP https://www.youtube.com/user/YosStoP\nYuka Kinoshita https://www.youtube.com/user/kinoyuu0204\nYuya https://www.youtube.com/user/lady16makeup\n& more!\n\nYouTube Rewind 2016 produced by Portal A','https://img.youtube.com/vi/_GuOjXYl5ew/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=_GuOjXYl5ew','public','2025-06-12 11:44:18',1),(36,1,'YouTube Video','YouTube Rewind 2017. Celebrating the videos, people, music and memes that made 2017. #YouTubeRewind\n\nMeet the featured Creators in Rewind: https://rewind2017.withyoutube.com/creators\nSpend more time with your favorite Creators, videos and trends from 2017: https://yt.be/rewind2017\nTest your Rewind knowledge with our trivia game: http://yt.be/dejaview\n\nWatch trending videos from 2017: http://youtube.com/rewind\nSee the trends as they happen: http://youtube.com/trending\n\nWatch the Behind the Scenes video: https://youtu.be/OIQQ8jmsbMM  \nSee all the Easter Eggs: https://goo.gl/3U9otg\n\nMusic by The Hood Internet: https://www.youtube.com/thehoodinternet\n\nYouTube Rewind 2017 produced by Portal A','https://img.youtube.com/vi/FlsCjmMhFmw/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=FlsCjmMhFmw','public','2025-06-12 11:56:17',8),(37,1,'YouTube Video','YouTube Rewind 2017. Celebrating the videos, people, music and memes that made 2017. #YouTubeRewind\n\nMeet the featured Creators in Rewind: https://rewind2017.withyoutube.com/creators\nSpend more time with your favorite Creators, videos and trends from 2017: https://yt.be/rewind2017\nTest your Rewind k…','https://img.youtube.com/vi/FlsCjmMhFmw/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=FlsCjmMhFmw','public','2025-06-12 12:26:24',1),(38,1,'YouTube Video','Robert Irwin is following in Steve\'s footsteps with the release of his own Australia Zoo tour! Come behind the scenes with Robert on this interactive tour of Australia Zoo.\n\nKeep up to date with all things Irwin -\n\nInstagram : \n\nBindi - https://www.instagram.com/bindisueirwin/?hl=en \nRobert - https:…','https://img.youtube.com/vi/y699qXKDVwE/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=y699qXKDVwE','public','2025-06-12 17:20:35',8),(39,1,'YouTube Video','With rumors of a Red Gyarados rampaging in the Lake of Rage, Lance of the Elite Four decides to investigate.\n\nPokémon Generations revisits each generation of the Pokémon video game series to shed new light on some timeless moments. From the earliest days in the Kanto region to the splendor of the Ka…','https://img.youtube.com/vi/hlh4jKv184E/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=hlh4jKv184E','public','2025-06-12 17:28:02',8),(40,1,'YouTube Video','With rumors of a Red Gyarados rampaging in the Lake of Rage, Lance of the Elite Four decides to investigate.\n\nPokémon Generations revisits each generation of the Pokémon video game series to shed new light on some timeless moments. From the earliest days in the Kanto region to the splendor of the Ka…','https://img.youtube.com/vi/hlh4jKv184E/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=hlh4jKv184E','public','2025-06-12 17:28:25',8),(41,1,'YouTube Video','With rumors of a Red Gyarados rampaging in the Lake of Rage, Lance of the Elite Four decides to investigate.\n\nPokémon Generations revisits each generation of the Pokémon video game series to shed new light on some timeless moments. From the earliest days in the Kanto region to the splendor of the Ka…','https://img.youtube.com/vi/hlh4jKv184E/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=hlh4jKv184E','public','2025-06-12 17:45:50',8),(42,1,'dsa','dasd','/uploads/1749751068581.jpg',NULL,'dasda','public','2025-06-12 17:57:48',7),(43,1,'YouTube Video','YouTube Rewind 2016. Celebrating the videos, people, music and moves that made 2016. #YouTubeRewind\n\nSpend more time with your favorite creators, videos and trends from 2016: http://yt.be/rewind2016\nWatch trending videos from 2016: http://youtube.com/rewind\nSee trends as they happen: http://youtube.…','https://img.youtube.com/vi/_GuOjXYl5ew/maxresdefault.jpg',NULL,'https://www.youtube.com/watch?v=_GuOjXYl5ew','public','2025-06-12 18:15:11',8),(44,1,'Pixabay Image','hello, cry, seed','https://pixabay.com/get/gbe5774086993bac6584dd9a4217f4f6449e908ddae2056c89f05f03ed392df8435af7fc1bf5e4b87eb5086816964fb4d6685afb576647f15b35cca89c475ceb4_640.jpg',NULL,'https://pixabay.com/photos/hello-cry-seed-6526241/','public','2025-06-12 20:54:21',14),(45,1,'Pixabay Image','no, thanks, hello, then','https://pixabay.com/get/g85cb8978e44235463dd48ed92654a11b2cb21d14ca5f18efc3fea2a79cf97dbc27876463528c7635e2a837e1360f9dda43b9cd21667f26f8100baf9812cea544_640.jpg',NULL,'https://pixabay.com/photos/no-thanks-hello-then-4642814/','public','2025-06-12 20:59:44',13),(46,1,'Pixabay Image','no, thanks, hello, then','https://pixabay.com/get/g85cb8978e44235463dd48ed92654a11b2cb21d14ca5f18efc3fea2a79cf97dbc27876463528c7635e2a837e1360f9dda43b9cd21667f26f8100baf9812cea544_640.jpg',NULL,'https://pixabay.com/photos/no-thanks-hello-then-4642814/','public','2025-06-12 21:02:37',8),(47,1,'Pixabay Image','frog, nature, pond, tree frog, leaf, wildlife, animal','https://pixabay.com/get/g3cb51b7d8027b39ee81119fc6c08a3bc6a07008b872ea6d23262aeb20f76fa8b5c65930ab6a90276198e7799f42b5c968610a8187c8a1027168d71e544dd8065_640.jpg',NULL,'https://pixabay.com/photos/frog-pond-tree-frog-leaf-wildlife-7255741/','public','2025-06-12 21:19:00',8);
/*!40000 ALTER TABLE `pins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `replies`
--

DROP TABLE IF EXISTS `replies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `replies`
--

LOCK TABLES `replies` WRITE;
/*!40000 ALTER TABLE `replies` DISABLE KEYS */;
INSERT INTO `replies` VALUES (1,24,NULL,1,'1111',0,'2025-06-09 07:01:17'),(2,1,NULL,1,'ddd',0,'2025-06-12 06:55:20');
/*!40000 ALTER TABLE `replies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `tag_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`tag_id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `avatar_url` text,
  `bio` text,
  `preferences` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) DEFAULT 'user',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'demo@example.com','demo_user','some_hashed_password',NULL,NULL,NULL,'2025-06-08 14:41:11','user');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-13  3:32:12
