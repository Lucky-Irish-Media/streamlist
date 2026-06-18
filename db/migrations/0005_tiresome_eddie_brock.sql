CREATE TABLE `watchlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `watchlists`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_watchlist_items_list_id` ON `watchlist_items` (`list_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_items_list_tmdb` ON `watchlist_items` (`list_id`,`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlists_user_id` ON `watchlists` (`user_id`);