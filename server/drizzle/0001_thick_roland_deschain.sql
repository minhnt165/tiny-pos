PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`unit` text NOT NULL,
	`qty` real NOT NULL,
	`price` integer NOT NULL,
	`cost_price` integer NOT NULL,
	`factor` real DEFAULT 1 NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_order_items`("id", "order_id", "product_id", "product_name", "unit", "qty", "price", "cost_price") SELECT "id", "order_id", "product_id", "product_name", "unit", "qty", "price", "cost_price" FROM `order_items`;--> statement-breakpoint
DROP TABLE `order_items`;--> statement-breakpoint
ALTER TABLE `__new_order_items` RENAME TO `order_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelled_at` text;