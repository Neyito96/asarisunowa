ALTER TABLE `comments` ADD `visitor_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_comments_visitor_created` ON `comments` (`visitor_key`,`created_at`);