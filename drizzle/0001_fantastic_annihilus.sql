CREATE TABLE `academy_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(32) NOT NULL,
	`published` text NOT NULL,
	`draft` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `academy_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `academy_settings_scope_unique` UNIQUE(`scope`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(64) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`mustChangePassword` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `owner_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `owner_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`ownerId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
