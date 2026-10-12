-- Repeating Standalone Notes (issue 458, ADR 0041). A nullable column only,
-- so the API serving during deployment keeps working and every existing Note
-- reads as not repeating. It holds the same canonical JSON a Task's Repeat
-- holds in threads.moves_json.

ALTER TABLE `notes` ADD `repeat` text;
