CREATE TABLE `return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`order_item_id` integer NOT NULL,
	`qty` real NOT NULL,
	`restock` integer DEFAULT true NOT NULL,
	`amount` integer NOT NULL,
	`cost` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `return_items_return_idx` ON `return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `return_items_order_item_idx` ON `return_items` (`order_item_id`);--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`order_id` integer NOT NULL,
	`refund` integer NOT NULL,
	`debt_reduced` integer DEFAULT 0 NOT NULL,
	`cash_refund` integer DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'done' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`cancelled_at` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `returns_code_unique` ON `returns` (`code`);--> statement-breakpoint
CREATE INDEX `returns_created_idx` ON `returns` (`created_at`);--> statement-breakpoint
CREATE INDEX `returns_order_idx` ON `returns` (`order_id`);