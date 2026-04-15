ALTER TABLE `sessions` ADD COLUMN `ip_address` text;
ALTER TABLE `sessions` ADD COLUMN `user_agent` text;
ALTER TABLE `sessions` ADD COLUMN `ended_at` integer;
CREATE TABLE IF NOT EXISTS `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`success` integer NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL
);