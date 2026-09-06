CREATE TABLE `localAdminCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`passwordHash` varchar(512) NOT NULL,
	`totpSecretEncrypted` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localAdminCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `localAdminCredentials_openId_unique` UNIQUE(`openId`)
);
