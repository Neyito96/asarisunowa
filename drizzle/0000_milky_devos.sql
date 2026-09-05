CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`tag` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comments_playlist_status` ON `comments` (`playlist_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_comments_created` ON `comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `outbound_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clicks_playlist` ON `outbound_clicks` (`playlist_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` text NOT NULL,
	`visitor_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reactions_playlist_visitor` ON `reactions` (`playlist_id`,`visitor_key`);--> statement-breakpoint
CREATE INDEX `idx_reactions_playlist` ON `reactions` (`playlist_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_key` text NOT NULL,
	`path` text DEFAULT '/' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_created` ON `visits` (`created_at`);