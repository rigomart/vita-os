-- A Thread's Follow-up date folds into its Tasks (issue 401, ADR 0032).
--
-- A Thread comes back at its soonest dated Task, so each Open Thread that
-- holds a Follow-up date gains one Task named "Follow up" carrying that same
-- instant, time of day included, so every Thread stays in the same column and
-- under the same heading. The new Task joins the END of the Thread's Tasks
-- (the array is created when the Thread had none) and is not focused. Every
-- Task gets a new ID. A Resolved Thread holds no Tasks and keeps its row as it
-- is. Activity Log entries are left exactly as they were written.
--
-- Each changed Thread's revision goes up by one, so a client holding the
-- pre-migration Thread is refused as stale and refreshes (ADR 0022).
--
-- The `follow_up` column STAYS, no longer read or written, so a rollback loses
-- nothing. A later cleanup (issue 402) drops it. Notes keep their dates.

UPDATE threads
SET moves_json = CASE
  WHEN moves_json IS NULL THEN json_array(
    json_object(
      'id', lower(hex(randomblob(16))),
      'text', 'Follow up',
      'date', follow_up
    )
  )
  ELSE json_insert(
    moves_json,
    '$[#]',
    json_object(
      'id', lower(hex(randomblob(16))),
      'text', 'Follow up',
      'date', follow_up
    )
  )
END,
  revision = revision + 1
WHERE state = 'open' AND follow_up IS NOT NULL;
