CREATE TABLE `activations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseKey` varchar(128) NOT NULL,
	`deviceId` varchar(255) NOT NULL,
	`deviceInfo` text,
	`activatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastValidatedAt` timestamp NOT NULL DEFAULT (now()),
	`deactivatedAt` timestamp,
	CONSTRAINT `activations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`name` text,
	`company` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`licenseKey` varchar(128) NOT NULL,
	`productId` int NOT NULL,
	`customerId` int,
	`type` enum('subscription','perpetual','node_locked','user_based','feature_based') NOT NULL,
	`status` enum('active','expired','revoked','grace_period') NOT NULL DEFAULT 'active',
	`maxActivations` int DEFAULT 1,
	`expiresAt` timestamp,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `licenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `licenses_licenseKey_unique` UNIQUE(`licenseKey`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
