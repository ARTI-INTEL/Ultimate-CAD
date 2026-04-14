CREATE DATABASE IF NOT EXISTS `ultimate_cad` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `ultimate_cad`;

SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `iduser`     INT          NOT NULL AUTO_INCREMENT,
  `discord_id` VARCHAR(32)  NOT NULL,
  `username`   VARCHAR(64)  NOT NULL,
  `created_at` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`iduser`),
  UNIQUE KEY `discord_id` (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- SERVERS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `servers`;
CREATE TABLE `servers` (
  `idserver`    INT           NOT NULL AUTO_INCREMENT,
  `discord_id`  VARCHAR(32)   NULL DEFAULT NULL,
  `name`        VARCHAR(128)  NOT NULL,
  `join_code`   VARCHAR(32)   NOT NULL,
  `description` VARCHAR(255)  DEFAULT NULL,
  `icon_url`    VARCHAR(512)  DEFAULT NULL,
  `owner_id`    INT           NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idserver`),
  UNIQUE KEY `join_code` (`join_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- SERVER MEMBERS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `server_members`;
CREATE TABLE `server_members` (
  `id`        INT  NOT NULL AUTO_INCREMENT,
  `user_id`   INT  NOT NULL,
  `server_id` INT  NOT NULL,
  `joined_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_member` (`user_id`, `server_id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `sm_user_fk`   FOREIGN KEY (`user_id`)   REFERENCES `users`   (`iduser`)   ON DELETE CASCADE,
  CONSTRAINT `sm_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`idserver`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- OFFICERS  (clocked-in sessions)
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `officers`;
CREATE TABLE `officers` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `user_id`      INT          NOT NULL,
  `server_id`    INT          NOT NULL,
  `name`         VARCHAR(64)  NOT NULL,
  `callsign`     VARCHAR(32)  NOT NULL,
  `department`   VARCHAR(128) NOT NULL,
  `status`       ENUM('AVAILABLE','UNAVAILABLE','ON SCENE','ENROUTE','BUSY') DEFAULT 'AVAILABLE',
  `current_call` INT          DEFAULT NULL,
  `location`     VARCHAR(128) DEFAULT '',
  `clocked_in`   TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id`   (`user_id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `off_user_fk`   FOREIGN KEY (`user_id`)   REFERENCES `users`   (`iduser`)   ON DELETE CASCADE,
  CONSTRAINT `off_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`idserver`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- CALLS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `calls`;
CREATE TABLE `calls` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `server_id`  INT          NOT NULL,
  `nature`     VARCHAR(128) NOT NULL,
  `location`   VARCHAR(128) NOT NULL,
  `priority`   ENUM('Low','Medium','High','Critical') DEFAULT 'Low',
  `status`     ENUM('ACTIVE','CLOSED') DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at`  TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `call_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`idserver`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- BOLOs
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `bolos`;
CREATE TABLE `bolos` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `server_id`   INT           NOT NULL,
  `type`        ENUM('Vehicle','Person','Ped') NOT NULL,
  `reason`      VARCHAR(256)  NOT NULL,
  `description` TEXT          NOT NULL,
  `active`      TINYINT(1)    DEFAULT 1,
  `created_at`  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `bolo_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`idserver`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- CHARACTERS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `characters`;
CREATE TABLE `characters` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `server_id`  INT          NOT NULL,
  `user_id`    INT          NOT NULL,
  `first_name` VARCHAR(64)  NOT NULL,
  `last_name`  VARCHAR(64)  NOT NULL,
  `dob`        VARCHAR(16)  NOT NULL,
  `gender`     VARCHAR(32)  DEFAULT NULL,
  `occupation` VARCHAR(64)  DEFAULT NULL,
  `height`     VARCHAR(16)  DEFAULT NULL,
  `weight`     VARCHAR(16)  DEFAULT NULL,
  `skin_tone`  VARCHAR(32)  DEFAULT NULL,
  `hair_tone`  VARCHAR(32)  DEFAULT NULL,
  `eye_color`  VARCHAR(32)  DEFAULT NULL,
  `address`    VARCHAR(128) DEFAULT NULL,
  `flags`      JSON         DEFAULT NULL,
  `created_at` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `user_id`   (`user_id`),
  CONSTRAINT `char_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`  (`idserver`) ON DELETE CASCADE,
  CONSTRAINT `char_user_fk`   FOREIGN KEY (`user_id`)   REFERENCES `users`    (`iduser`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- VEHICLES
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `vehicles`;
CREATE TABLE `vehicles` (
  `id`                 INT          NOT NULL AUTO_INCREMENT,
  `server_id`          INT          NOT NULL,
  `owner_id`           INT          DEFAULT NULL,
  `plate`              VARCHAR(16)  NOT NULL,
  `vin`                VARCHAR(32)  DEFAULT NULL,
  `model`              VARCHAR(64)  NOT NULL,
  `color`              VARCHAR(32)  DEFAULT NULL,
  `registration_expiry` VARCHAR(16) DEFAULT NULL,
  `insurance_status`   ENUM('Active','Expired') DEFAULT 'Active',
  `insurance_expiry`   VARCHAR(16)  DEFAULT NULL,
  `stolen`             TINYINT(1)   DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `owner_id`  (`owner_id`),
  CONSTRAINT `veh_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`    (`idserver`) ON DELETE CASCADE,
  CONSTRAINT `veh_char_fk`   FOREIGN KEY (`owner_id`)  REFERENCES `characters` (`id`)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- FIREARMS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `firearms`;
CREATE TABLE `firearms` (
  `id`         INT         NOT NULL AUTO_INCREMENT,
  `server_id`  INT         NOT NULL,
  `owner_id`   INT         DEFAULT NULL,
  `serial`     VARCHAR(32) NOT NULL,
  `name`       VARCHAR(64) DEFAULT NULL,
  `type`       VARCHAR(64) NOT NULL,
  `stolen`     TINYINT(1)  DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  KEY `owner_id`  (`owner_id`),
  CONSTRAINT `fa_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`    (`idserver`) ON DELETE CASCADE,
  CONSTRAINT `fa_char_fk`   FOREIGN KEY (`owner_id`)  REFERENCES `characters` (`id`)       ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────
-- REPORTS
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id`             INT          NOT NULL AUTO_INCREMENT,
  `server_id`      INT          NOT NULL,
  `officer_id`     INT          DEFAULT NULL,
  `call_id`        INT          DEFAULT NULL,
  `type`           VARCHAR(64)  NOT NULL,
  `subject_name`   VARCHAR(128) DEFAULT NULL,
  `subject_plate`  VARCHAR(16)  DEFAULT NULL,
  `details`        JSON         DEFAULT NULL,
  `created_at`     TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `server_id` (`server_id`),
  CONSTRAINT `rep_server_fk` FOREIGN KEY (`server_id`) REFERENCES `servers` (`idserver`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;