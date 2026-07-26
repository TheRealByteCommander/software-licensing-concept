ALTER TABLE `billingPlans` ADD `billingModel` enum('subscription','one_time') NOT NULL DEFAULT 'one_time';
--> statement-breakpoint
UPDATE `billingPlans` SET `billingModel` = 'subscription' WHERE `licenseType` = 'subscription';
