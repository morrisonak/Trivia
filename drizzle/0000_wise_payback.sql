CREATE TABLE `game_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`connection_id` text,
	`is_host` integer DEFAULT 0,
	`is_display` integer DEFAULT 0,
	`score` integer DEFAULT 0,
	`status` text DEFAULT 'connected',
	`joined_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_connection_id_unique` ON `game_players` (`connection_id`);--> statement-breakpoint
CREATE TABLE `game_questions` (
	`game_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`question_order` integer NOT NULL,
	`asked_at` text,
	PRIMARY KEY(`game_id`, `question_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`host_player_id` text NOT NULL,
	`status` text DEFAULT 'lobby',
	`max_players` integer DEFAULT 4,
	`question_count` integer DEFAULT 10,
	`time_per_question` integer DEFAULT 15,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`started_at` text,
	`ended_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_room_code_unique` ON `games` (`room_code`);--> statement-breakpoint
CREATE TABLE `player_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`question_id` integer NOT NULL,
	`answer` text,
	`is_correct` integer DEFAULT 0,
	`points_earned` integer DEFAULT 0,
	`time_taken_ms` integer,
	`answered_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `game_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`option_a` text NOT NULL,
	`option_b` text NOT NULL,
	`option_c` text NOT NULL,
	`option_d` text NOT NULL,
	`correct_answer` text NOT NULL,
	`category` text DEFAULT 'general',
	`difficulty` integer DEFAULT 1,
	`commentary` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
