import copy
import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

from convex_to_d1 import MigrationError, project, read_snapshot, render_sql, validate


ROOT = Path(__file__).resolve().parents[1]


def fixture():
    return {
        "user": [dict(_id="user-a", _creationTime=1, name="A", email="a@example.test",
                      emailVerified=True, createdAt=1, updatedAt=2),
                 dict(_id="user-b", name="B", email="b@example.test",
                      emailVerified=False, createdAt=3, updatedAt=4)],
        "account": [dict(_id="account-a", accountId="a@example.test", providerId="credential",
                         userId="user-a", password="hashed-password", createdAt=1, updatedAt=2)],
        "verification": [dict(_id="verify-a", identifier="a@example.test", value="token",
                              expiresAt=100, createdAt=1, updatedAt=2)],
        "session": [dict(_id="old-session", userId="user-a")],
        "rateLimit": [], "twoFactor": [], "oauthApplication": [],
        "oauthAccessToken": [], "oauthConsent": [], "jwks": [],
        "areas": [dict(_id="area-a", userId="user-a", name="Area", slug="area",
                       condition="healthy", icon="Compass", order=2, createdAt=10)],
        "threads": [dict(_id="thread-a", userId="user-a", areaId="area-a", title="Thread",
                         slug="thread", order=5, state="open", nextMove="First",
                         upNext=["Second", "Third"], lastActivityAt=31,
                         lastActivityContent="Set next move", createdAt=20)],
        "tasks": [dict(_id="note-a", userId="user-a", text="Write", when=50,
                       state="done", completedAt=60, createdAt=25, updatedAt=60)],
        "threadNotes": [dict(_id="thread-note-a", userId="user-a", threadId="thread-a",
                             body="Context", updatedAt=33, state="done", completedAt=40,
                             createdAt=30)],
        "activityLogs": [dict(_id="log-a", userId="user-a", threadId="thread-a",
                              type="next_action_change", content="Set next move",
                              previousValue="Old", newValue="First", createdAt=31)],
    }


def as_convex_numbers(value):
    """Convex exports every number as a float, e.g. 1747000000000.0."""
    if type(value) is int:
        return float(value)
    if isinstance(value, dict):
        return {key: as_convex_numbers(item) for key, item in value.items()}
    if isinstance(value, list):
        return [as_convex_numbers(item) for item in value]
    return value


def make_snapshot(path, source):
    auth = {"user", "account", "verification", "session", "rateLimit", "twoFactor",
            "oauthApplication", "oauthAccessToken", "oauthConsent", "jwks", "passkey"}
    with zipfile.ZipFile(path, "w") as archive:
        for table, rows in source.items():
            prefix = "_components/betterAuth/" if table in auth else ""
            archive.writestr(prefix + table + "/documents.jsonl",
                             "\n".join(json.dumps(as_convex_numbers(row)) for row in rows) + "\n")


# The import targets the schema as it stood at the Convex cutover. Migrations
# written after it (0004 onward) run over the imported data like any other.
CUTOVER_SCHEMA_MIGRATIONS = 3


def target_database(target):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    for migration in sorted((ROOT / "migrations").glob("*.sql")):
        if int(migration.name.split("_", 1)[0]) > CUTOVER_SCHEMA_MIGRATIONS:
            continue
        connection.executescript(migration.read_text())
    connection.executescript(render_sql(target))
    return connection


class MigrationTest(unittest.TestCase):
    def test_snapshot_import_and_full_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.zip"
            make_snapshot(path, fixture())
            target, changes = project(read_snapshot(path))
            self.assertEqual(target["notes"][0]["id"], "note-a")
            self.assertEqual(target["notes"][0]["attention_date"], 50)
            self.assertEqual(target["threads"][0]["up_next_json"], '["Second","Third"]')
            self.assertEqual(target["activity_log_entries"][0]["type"], "next_move_change")
            self.assertEqual(target["account"][0]["password"], "hashed-password")
            self.assertEqual(changes["discarded_sessions"], 1)

            connection = target_database(target)
            report = validate(target, connection, changes)
            self.assertEqual(report["status"], "pass")
            self.assertEqual(report["counts"]["thread_notes"], 1)
            self.assertEqual(connection.execute("SELECT count(*) FROM session").fetchone()[0], 0)
            with self.assertRaises(sqlite3.OperationalError):
                connection.executescript(render_sql(target))
            connection.close()

    def test_validator_catches_identity_owner_timestamp_and_history_changes(self):
        target, changes = project(fixture())
        for table, id_, field, value in (
            ("areas", "area-a", "sort_order", 999),
            ("threads", "thread-a", "last_activity_at", 999),
            ("notes", "note-a", "completed_at", 999),
            ("activity_log_entries", "log-a", "content", "changed"),
        ):
            with self.subTest(table=table, field=field):
                connection = target_database(target)
                connection.execute(f'UPDATE "{table}" SET "{field}"=? WHERE id=?', (value, id_))
                with self.assertRaisesRegex(MigrationError, f"mismatch in {field}"):
                    validate(target, connection, changes)
                connection.close()

    def test_rejects_foreign_relationship_missing_user_and_duplicate_id(self):
        for table, field, value in (
            ("threads", "areaId", "missing"),
            ("threadNotes", "userId", "user-b"),
            ("tasks", "userId", "missing"),
        ):
            with self.subTest(table=table):
                source = fixture()
                source[table][0][field] = value
                with self.assertRaises(MigrationError):
                    project(source)
        source = fixture()
        source["tasks"].append(copy.deepcopy(source["tasks"][0]))
        with self.assertRaisesRegex(MigrationError, "duplicate ID"):
            project(source)

    def test_legacy_log_note_becomes_thread_note_and_unmapped_auth_fails(self):
        source = fixture()
        source["activityLogs"].append(dict(_id="legacy-note", userId="user-a",
                                           threadId="thread-a", type="note", content="Old note",
                                           createdAt=30))
        target, changes = project(source)
        self.assertEqual(changes["legacy_activity_notes"], 1)
        self.assertEqual({row["id"] for row in target["thread_notes"]},
                         {"thread-note-a", "legacy-note"})
        source = fixture()
        source["twoFactor"] = [dict(_id="secret", userId="user-a")]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.zip"
            make_snapshot(path, source)
            with self.assertRaisesRegex(MigrationError, "Unsupported nonempty Better Auth"):
                read_snapshot(path)

    def test_rejects_inconsistent_activity_metadata_and_unmapped_fields(self):
        source = fixture()
        source["threads"][0]["lastActivityContent"] = "wrong"
        with self.assertRaisesRegex(MigrationError, "inconsistent activity content"):
            project(source)
        source = fixture()
        source["threads"][0]["lastActivityAt"] = 30
        source["threads"][0].pop("lastActivityContent")
        with self.assertRaisesRegex(MigrationError, "inconsistent activity timestamp"):
            project(source)
        source = fixture()
        source["user"][0]["twoFactorEnabled"] = True
        with self.assertRaisesRegex(MigrationError, "unmapped fields"):
            project(source)

    def test_maps_legacy_application_owner_id_to_auth_user(self):
        source = fixture()
        source["user"][0]["userId"] = "legacy-app-user"
        for table in ("areas", "threads", "tasks", "threadNotes", "activityLogs"):
            source[table][0]["userId"] = "legacy-app-user"
        target, changes = project(source)
        self.assertEqual(target["areas"][0]["user_id"], "user-a")
        self.assertEqual(target["threads"][0]["user_id"], "user-a")
        self.assertEqual(target["thread_notes"][0]["user_id"], "user-a")
        connection = target_database(target)
        self.assertEqual(validate(target, connection, changes)["status"], "pass")
        connection.close()

    def test_thread_note_can_be_the_latest_activity_after_legacy_log_migration(self):
        source = fixture()
        source["activityLogs"] = []
        source["threads"][0]["lastActivityAt"] = 30
        source["threads"][0].pop("lastActivityContent")
        target, changes = project(source)
        connection = target_database(target)
        self.assertEqual(validate(target, connection, changes)["status"], "pass")
        connection.close()

    def test_skips_component_system_tables_and_discards_convex_signing_keys(self):
        source = fixture()
        source["jwks"] = [dict(_id="key-a", publicKey="public", privateKey="private",
                               createdAt=1)]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.zip"
            make_snapshot(path, source)
            with zipfile.ZipFile(path, "a") as archive:
                archive.writestr("_tables/documents.jsonl", '{"name":"areas"}\n')
                archive.writestr("_components/betterAuth/_tables/documents.jsonl",
                                 '{"name":"user"}\n')
            target, changes = project(read_snapshot(path))
        self.assertEqual(changes["discarded_signing_keys"], 1)
        connection = target_database(target)
        self.assertEqual(validate(target, connection, changes)["status"], "pass")
        connection.close()

    def test_discards_retired_tables_and_rejects_other_unknown_tables(self):
        source = fixture()
        source["projects"] = [dict(_id="project-a", userId="user-a", name="Old")]
        source["projectLogs"] = [dict(_id="project-log-a", projectId="project-a"),
                                 dict(_id="project-log-b", projectId="project-a")]
        source["items"] = [dict(_id="item-a", userId="user-a", text="Old")]
        source["userSettings"] = [dict(_id="settings-a", userId="user-a")]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.zip"
            make_snapshot(path, source)
            target, changes = project(read_snapshot(path))
            self.assertEqual(changes["discarded_retired_rows"],
                             {"items": 1, "projects": 1, "projectLogs": 2, "userSettings": 1})
            connection = target_database(target)
            self.assertEqual(validate(target, connection, changes)["status"], "pass")
            connection.close()

            source["reviews"] = [dict(_id="review-a")]
            path = Path(directory) / "unknown.zip"
            make_snapshot(path, source)
            with self.assertRaisesRegex(MigrationError, "Unsupported nonempty application table: reviews"):
                read_snapshot(path)

    def test_rejects_fractional_numbers_instead_of_rounding(self):
        source = fixture()
        source["areas"][0]["order"] = 2.5
        with self.assertRaisesRegex(MigrationError, "areas: invalid order"):
            project(source)

    def test_deleted_newest_thread_note_keeps_its_activity_stamp(self):
        source = fixture()
        source["threads"][0]["lastActivityAt"] = 45
        source["threads"][0].pop("lastActivityContent")
        target, changes = project(source)
        self.assertEqual(target["threads"][0]["last_activity_at"], 45)
        connection = target_database(target)
        self.assertEqual(validate(target, connection, changes)["status"], "pass")
        connection.close()


if __name__ == "__main__":
    unittest.main()
