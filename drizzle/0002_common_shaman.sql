CREATE TABLE `activationTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(255) NOT NULL,
	`licenseKey` varchar(128) NOT NULL,
	`deviceId` varchar(255) NOT NULL,
	`deviceInfo` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activationTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `activationTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `twoFASecrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`secret` varchar(255) NOT NULL,
	`backupCodes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `twoFASecrets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `require2FA` boolean DEFAULT false NOT NULL;