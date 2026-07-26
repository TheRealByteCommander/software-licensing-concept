ALTER TABLE `customers` ADD `stripeCustomerId` varchar(255);
--> statement-breakpoint
ALTER TABLE `licenses` ADD `stripeSubscriptionId` varchar(255);
--> statement-breakpoint
CREATE TABLE `billingPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`stripePriceId` varchar(255) NOT NULL,
	`licenseType` enum('subscription','perpetual','node_locked','user_based','feature_based') NOT NULL,
	`maxActivations` int DEFAULT 1,
	`renewalPeriodDays` int DEFAULT 365,
	`autoRenew` boolean NOT NULL DEFAULT true,
	`features` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `billingPlans_stripePriceId_unique` UNIQUE(`stripePriceId`)
);
--> statement-breakpoint
CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stripeEventId` varchar(255) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_stripeEventId_unique` UNIQUE(`stripeEventId`)
);
--> statement-breakpoint
CREATE TABLE `stripePayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingPlanId` int NOT NULL,
	`customerId` int,
	`licenseKey` varchar(128),
	`stripeCheckoutSessionId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`stripeCustomerId` varchar(255),
	`stripeInvoiceId` varchar(255),
	`amountTotal` int,
	`currency` varchar(8),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripePayments_id` PRIMARY KEY(`id`)
);
