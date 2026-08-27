CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_place_id` text NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`address` text,
	`country_code` text,
	`region` text,
	`city` text,
	`category` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_provider_place_id_unique` ON `places` (`provider`,`provider_place_id`);--> statement-breakpoint
CREATE INDEX `places_name_idx` ON `places` (`name`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`google_avatar_url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_links` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_links_profile_id_idx` ON `profile_links` (`profile_id`);--> statement-breakpoint
CREATE TABLE `visit_links` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`og_title` text,
	`og_description` text,
	`og_image_url` text,
	`og_site_name` text,
	`og_fetched_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `visit_links_visit_id_idx` ON `visit_links` (`visit_id`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`visited_date` text NOT NULL,
	`title` text,
	`note_markdown` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visits_place_id_visited_date_unique` ON `visits` (`place_id`,`visited_date`);--> statement-breakpoint
CREATE INDEX `visits_visited_date_idx` ON `visits` (`visited_date`);--> statement-breakpoint
CREATE INDEX `visits_place_id_idx` ON `visits` (`place_id`);