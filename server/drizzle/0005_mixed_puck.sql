CREATE TABLE `supplier_return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`unit_name` text NOT NULL,
	`factor` real DEFAULT 1 NOT NULL,
	`qty` real NOT NULL,
	`unit_price` integer NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `supplier_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_return_items_return_idx` ON `supplier_return_items` (`return_id`);--> statement-breakpoint
CREATE TABLE `supplier_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`supplier_name` text NOT NULL,
	`total` integer NOT NULL,
	`debt_reduced` integer DEFAULT 0 NOT NULL,
	`cash_received` integer DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'done' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`cancelled_at` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_returns_code_unique` ON `supplier_returns` (`code`);--> statement-breakpoint
CREATE INDEX `supplier_returns_created_idx` ON `supplier_returns` (`created_at`);--> statement-breakpoint
CREATE INDEX `supplier_returns_supplier_idx` ON `supplier_returns` (`supplier_id`);