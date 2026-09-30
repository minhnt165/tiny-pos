CREATE TABLE `stocktake_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stocktake_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`counted` real NOT NULL,
	`expected` real NOT NULL,
	`counted_at` text NOT NULL,
	FOREIGN KEY (`stocktake_id`) REFERENCES `stocktakes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stocktake_items_uq` ON `stocktake_items` (`stocktake_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `stocktakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stocktakes_code_unique` ON `stocktakes` (`code`);--> statement-breakpoint
CREATE TABLE `supplier_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`import_id` integer,
	`amount` integer NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_tx_supplier_idx` ON `supplier_transactions` (`supplier_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`note` text,
	`debt` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `import_items` ADD `product_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_items` ADD `unit_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_items` ADD `factor` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `import_items` ADD `unit_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `import_items` ADD `amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Sửa tay: SQLite không cho ADD COLUMN NOT NULL không có DEFAULT, nên dựng lại bảng `imports` thay cho 5 lệnh ALTER drizzle-kit sinh.
-- Sửa tay: xóa dòng import_items trước khi DROP `imports` để ON DELETE CASCADE không xóa mất dữ liệu; nạp lại ngay sau khi đổi tên bảng.
CREATE TABLE `__import_items_backup` AS SELECT * FROM `import_items`;--> statement-breakpoint
DELETE FROM `import_items`;--> statement-breakpoint
CREATE TABLE `__new_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`supplier_id` integer,
	`supplier_name` text,
	`total` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'done' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`cancelled_at` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Sửa tay: drizzle-kit không chọn cột `code` nên phiếu cũ phải tự sinh mã PN-OLD-<id>; các cột mới còn lại nhận DEFAULT.
INSERT INTO `__new_imports`("id", "code", "supplier_name", "total", "note", "created_at") SELECT "id", 'PN-OLD-' || "id", "supplier_name", "total", "note", "created_at" FROM `imports`;--> statement-breakpoint
DROP TABLE `imports`;--> statement-breakpoint
ALTER TABLE `__new_imports` RENAME TO `imports`;--> statement-breakpoint
-- Sửa tay: nạp lại các dòng import_items đã sao lưu (giữ nguyên id, các cột mới nhận DEFAULT).
INSERT INTO `import_items` SELECT * FROM `__import_items_backup`;--> statement-breakpoint
DROP TABLE `__import_items_backup`;--> statement-breakpoint
CREATE UNIQUE INDEX `imports_code_unique` ON `imports` (`code`);--> statement-breakpoint
CREATE INDEX `imports_created_idx` ON `imports` (`created_at`);