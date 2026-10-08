CREATE TABLE `lot_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`movement_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`qty` real NOT NULL,
	FOREIGN KEY (`movement_id`) REFERENCES `stock_movements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lot_movements_movement_idx` ON `lot_movements` (`movement_id`);--> statement-breakpoint
CREATE INDEX `lot_movements_lot_idx` ON `lot_movements` (`lot_id`);--> statement-breakpoint
CREATE TABLE `lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`import_item_id` integer,
	`qty_in` real NOT NULL,
	`remaining` real NOT NULL,
	`cost_price` integer NOT NULL,
	`expires_on` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_item_id`) REFERENCES `import_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lots_product_idx` ON `lots` (`product_id`,`expires_on`,`id`);--> statement-breakpoint
CREATE INDEX `lots_expires_idx` ON `lots` (`expires_on`);--> statement-breakpoint
ALTER TABLE `import_items` ADD `expires_on` text;--> statement-breakpoint
ALTER TABLE `supplier_return_items` ADD `lot_id` integer REFERENCES lots(id);
--> statement-breakpoint
INSERT INTO `lots` (`product_id`, `import_item_id`, `qty_in`, `remaining`, `cost_price`, `expires_on`, `note`, `created_at`)
SELECT `id`, NULL, `stock`, `stock`, `cost_price`, NULL, 'Tồn đầu', `updated_at` FROM `products` WHERE `stock` <> 0;
