CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`place_types_json` text DEFAULT '[]' NOT NULL,
	`sf_symbol` text DEFAULT 'tag' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` integer NOT NULL,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`payload_json` text
);
--> statement-breakpoint
CREATE INDEX `event_log_at_idx` ON `event_log` (`at`);--> statement-breakpoint
CREATE INDEX `event_log_type_idx` ON `event_log` (`type`);--> statement-breakpoint
CREATE TABLE `home_exit_checklist` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`category_id` text NOT NULL,
	`unit` text DEFAULT 'adet' NOT NULL,
	`default_qty` real DEFAULT 1 NOT NULL,
	`barcode` text,
	`notes` text,
	`on_list` integer DEFAULT false NOT NULL,
	`list_qty` real,
	`list_added_at` integer,
	`expiry_date` text,
	`suggestion_dismissed` integer DEFAULT false NOT NULL,
	`category_locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_barcode_unique` ON `items` (`barcode`);--> statement-breakpoint
CREATE INDEX `items_normalized_idx` ON `items` (`name_normalized`);--> statement-breakpoint
CREATE INDEX `items_on_list_idx` ON `items` (`on_list`);--> statement-breakpoint
CREATE INDEX `items_expiry_idx` ON `items` (`expiry_date`);--> statement-breakpoint
CREATE TABLE `list_reminder_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`rrule_json` text NOT NULL,
	`time` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `osm_cache` (
	`cell_key` text PRIMARY KEY NOT NULL,
	`fetched_at` integer NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `osm_hidden` (
	`osm_id` text PRIMARY KEY NOT NULL,
	`hidden_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`radius_m` integer DEFAULT 150 NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`osm_id` text,
	`brand` text,
	`enabled` integer DEFAULT true NOT NULL,
	`last_notified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `places_type_idx` ON `places` (`type`);--> statement-breakpoint
CREATE TABLE `purchase_events` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`purchased_at` integer NOT NULL,
	`qty` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_events_item_idx` ON `purchase_events` (`item_id`);--> statement-breakpoint
CREATE TABLE `scheduled_refs` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`external_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`fire_at` integer,
	`content_hash` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scheduled_refs_kind_idx` ON `scheduled_refs` (`kind`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_occurrence_states` (
	`task_id` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`status` text NOT NULL,
	`snoozed_until` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `occurrence_key`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`due_time` text,
	`rrule_json` text,
	`reminder_type` text DEFAULT 'none' NOT NULL,
	`lead_minutes` integer DEFAULT 0 NOT NULL,
	`important` integer DEFAULT false NOT NULL,
	`location_trigger_json` text,
	`on_home_exit` integer DEFAULT false NOT NULL,
	`on_home_arrive` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_archived_idx` ON `tasks` (`archived_at`);