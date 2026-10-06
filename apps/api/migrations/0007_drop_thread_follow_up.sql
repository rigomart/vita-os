-- Close the Thread Follow-up compatibility window (issue 402, ADR 0032).
-- 0006 folded these dates into Tasks; the API no longer reads or writes this
-- column. It has no index, view, trigger, or constraint depending on it.
-- Tasks, Notes, and historical Activity Log entries stay as they were saved.

ALTER TABLE threads DROP COLUMN follow_up;
