CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_likes_user_id` ON `user_likes` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_user_id` ON `watched` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watched_user_tmdb` ON `watched` (`user_id`,`tmdb_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_user_id` ON `watchlist` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_watchlist_user_tmdb` ON `watchlist` (`user_id`,`tmdb_id`);