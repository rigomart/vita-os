"""Prepare and verify a Convex snapshot for the canonical Vita OS D1 schema.

This tool never connects to production. Wrangler applies the generated SQL and
exports the target database for verification; see docs/migrations/data-cutover.md.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import zipfile
from pathlib import Path
from typing import Any


APP_TABLES = ("areas", "threads", "tasks", "threadNotes", "activityLogs")
AUTH_TABLES = ("user", "account", "verification")
EXCLUDED_AUTH_TABLES = {"session", "rateLimit"}
UNSUPPORTED_AUTH_TABLES = {
    "twoFactor", "oauthApplication", "oauthAccessToken", "oauthConsent", "jwks"
}
TARGET_TABLES = (
    "user", "account", "verification", "areas", "threads", "notes",
    "thread_notes", "activity_log_entries"
)
LEGACY_NOTE_TYPES = {"note", "reference", "waiting", "decision"}
ACTIVITY_TYPES = {
    "area_move", "next_move_change", "state_change", "follow_up_change"
}
SOURCE_FIELDS = {
    "areas": {"userId", "name", "slug", "standard", "condition", "icon", "order", "createdAt"},
    "threads": {"userId", "title", "slug", "summary", "areaId", "order", "state",
                "nextMove", "upNext", "followUp", "lastActivityAt", "lastActivityContent", "createdAt"},
    "tasks": {"userId", "text", "updatedAt", "when", "state", "completedAt", "createdAt"},
    "threadNotes": {"userId", "threadId", "body", "updatedAt", "state", "completedAt", "createdAt"},
    "activityLogs": {"userId", "threadId", "type", "content", "previousValue", "newValue", "createdAt"},
    "user": {"name", "email", "emailVerified", "image", "createdAt", "updatedAt", "userId"},
    "account": {"accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken",
                "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt"},
    "verification": {"identifier", "value", "expiresAt", "createdAt", "updatedAt"},
}


class MigrationError(ValueError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise MigrationError(message)


def text(row: dict[str, Any], field: str, table: str) -> str:
    value = row.get(field)
    require(isinstance(value, str) and bool(value), f"{table}: invalid {field}")
    return value


def optional_text(row: dict[str, Any], field: str, table: str) -> str | None:
    value = row.get(field)
    require(value is None or isinstance(value, str), f"{table}: invalid {field}")
    return value


def integer(row: dict[str, Any], field: str, table: str) -> int:
    value = row.get(field)
    require(type(value) is int and abs(value) <= 2**53 - 1, f"{table}: invalid {field}")
    return value


def optional_integer(row: dict[str, Any], field: str, table: str) -> int | None:
    if row.get(field) is None:
        return None
    return integer(row, field, table)


def choice(row: dict[str, Any], field: str, values: set[str], table: str) -> str:
    value = text(row, field, table)
    require(value in values, f"{table}: unsupported {field} {value!r}")
    return value


def read_snapshot(path: Path) -> dict[str, list[dict[str, Any]]]:
    require(path.is_file(), f"Snapshot does not exist: {path}")
    result: dict[str, list[dict[str, Any]]] = {}
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        for table in (*APP_TABLES, *AUTH_TABLES, *EXCLUDED_AUTH_TABLES,
                      *UNSUPPORTED_AUTH_TABLES):
            suffix = (
                f"_components/betterAuth/{table}/documents.jsonl"
                if table in (*AUTH_TABLES, *EXCLUDED_AUTH_TABLES, *UNSUPPORTED_AUTH_TABLES)
                else f"{table}/documents.jsonl"
            )
            matches = [name for name in names if name == suffix or name.endswith("/" + suffix)]
            require(len(matches) <= 1, f"Ambiguous snapshot table: {suffix}")
            if table == "user":
                require(bool(matches), "Snapshot has no Better Auth user table")
            rows: list[dict[str, Any]] = []
            if matches:
                for line_number, line in enumerate(archive.read(matches[0]).decode("utf-8").splitlines(), 1):
                    if not line.strip():
                        continue
                    try:
                        row = json.loads(line)
                    except json.JSONDecodeError as error:
                        raise MigrationError(f"{suffix}:{line_number}: invalid JSON") from error
                    require(isinstance(row, dict), f"{suffix}:{line_number}: expected object")
                    rows.append(row)
            result[table] = rows
        known = set((*AUTH_TABLES, *EXCLUDED_AUTH_TABLES, *UNSUPPORTED_AUTH_TABLES))
        for name in names:
            marker = "_components/betterAuth/"
            if marker in name and name.endswith("/documents.jsonl"):
                table = name.split(marker, 1)[1].split("/", 1)[0]
                if table not in known:
                    require(not archive.read(name).strip(),
                            f"Unsupported nonempty Better Auth table: {table}")
            elif name.endswith("/documents.jsonl") and "_components/" not in name:
                table = name.rsplit("/", 2)[-2]
                if table not in APP_TABLES and not table.startswith("_"):
                    require(not archive.read(name).strip(),
                            f"Unsupported nonempty application table: {table}")
    for table in UNSUPPORTED_AUTH_TABLES:
        require(not result[table], f"Unsupported nonempty Better Auth table: {table}")
    return result


def unique(rows: list[dict[str, Any]], table: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        id_ = text(row, "_id", table)
        require(id_ not in result, f"{table}: duplicate ID {id_}")
        result[id_] = row
    return result


def project(source: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, int]]:
    for table, fields in SOURCE_FIELDS.items():
        for row in source[table]:
            extra = set(row) - fields - {"_id", "_creationTime"}
            if table == "user":
                disabled_features = {"twoFactorEnabled", "isAnonymous", "phoneNumberVerified"}
                extra = {field for field in extra
                         if not (field in disabled_features and row[field] in (None, False))
                         and not (field in {"username", "displayUsername", "phoneNumber"}
                                  and row[field] is None)}
            require(not extra, f"{table}: unmapped fields {sorted(extra)}")
    indexes = {table: unique(source[table], table) for table in (*APP_TABLES, *AUTH_TABLES)}
    users = indexes["user"]
    areas = indexes["areas"]
    threads = indexes["threads"]
    target: dict[str, list[dict[str, Any]]] = {table: [] for table in TARGET_TABLES}
    transformed_notes = 0
    owner_ids = {id_: id_ for id_ in users}
    for user in source["user"]:
        alias = optional_text(user, "userId", "user")
        if alias:
            require(alias not in owner_ids or owner_ids[alias] == user["_id"],
                    f"user: ambiguous application userId {alias}")
            owner_ids[alias] = user["_id"]

    def owner(row: dict[str, Any], table: str) -> str:
        user_id = text(row, "userId", table)
        require(user_id in owner_ids, f"{table}: unknown owner {user_id}")
        return owner_ids[user_id]

    for row in source["user"]:
        require(type(row.get("emailVerified")) is bool, "user: invalid emailVerified")
        target["user"].append(dict(
            id=text(row, "_id", "user"), name=text(row, "name", "user"),
            email=text(row, "email", "user"), emailVerified=int(row["emailVerified"]),
            image=optional_text(row, "image", "user"),
            createdAt=integer(row, "createdAt", "user"),
            updatedAt=integer(row, "updatedAt", "user"),
        ))
    for row in source["account"]:
        owner(row, "account")
        target["account"].append(dict(
            id=text(row, "_id", "account"),
            accountId=text(row, "accountId", "account"),
            providerId=text(row, "providerId", "account"),
            userId=owner(row, "account"),
            accessToken=optional_text(row, "accessToken", "account"),
            refreshToken=optional_text(row, "refreshToken", "account"),
            idToken=optional_text(row, "idToken", "account"),
            accessTokenExpiresAt=optional_integer(row, "accessTokenExpiresAt", "account"),
            refreshTokenExpiresAt=optional_integer(row, "refreshTokenExpiresAt", "account"),
            scope=optional_text(row, "scope", "account"),
            password=optional_text(row, "password", "account"),
            createdAt=integer(row, "createdAt", "account"),
            updatedAt=integer(row, "updatedAt", "account"),
        ))
    for row in source["verification"]:
        target["verification"].append(dict(
            id=text(row, "_id", "verification"),
            identifier=text(row, "identifier", "verification"),
            value=text(row, "value", "verification"),
            expiresAt=integer(row, "expiresAt", "verification"),
            createdAt=integer(row, "createdAt", "verification"),
            updatedAt=integer(row, "updatedAt", "verification"),
        ))
    for row in source["areas"]:
        target["areas"].append(dict(
            id=text(row, "_id", "areas"), user_id=owner(row, "areas"),
            name=text(row, "name", "areas"), slug=text(row, "slug", "areas"),
            standard=optional_text(row, "standard", "areas"),
            condition=choice(row, "condition", {"healthy", "needs_attention", "critical"}, "areas"),
            icon=text(row, "icon", "areas"), sort_order=integer(row, "order", "areas"),
            created_at=integer(row, "createdAt", "areas"),
        ))
    for row in source["threads"]:
        user_id = owner(row, "threads")
        area_id = text(row, "areaId", "threads")
        require(area_id in areas and owner(areas[area_id], "areas") == user_id,
                f"threads: missing or foreign Area {area_id}")
        up_next = row.get("upNext")
        require(up_next is None or
                (isinstance(up_next, list) and bool(up_next) and
                 all(isinstance(move, str) and bool(move) for move in up_next)),
                "threads: invalid Up Next")
        next_move = optional_text(row, "nextMove", "threads")
        require(up_next is None or next_move is not None,
                "threads: Up Next exists without Next Move")
        target["threads"].append(dict(
            id=text(row, "_id", "threads"), user_id=user_id, area_id=area_id,
            title=text(row, "title", "threads"), slug=text(row, "slug", "threads"),
            summary=optional_text(row, "summary", "threads"),
            sort_order=integer(row, "order", "threads"),
            state=choice(row, "state", {"open", "resolved"}, "threads"),
            next_move=next_move,
            up_next_json=json.dumps(up_next, separators=(",", ":"), ensure_ascii=False)
            if up_next is not None else None,
            follow_up=optional_integer(row, "followUp", "threads"),
            last_activity_at=optional_integer(row, "lastActivityAt", "threads"),
            last_activity_content=optional_text(row, "lastActivityContent", "threads"),
            created_at=integer(row, "createdAt", "threads"), revision=0,
            last_change_token=None,
        ))
    for row in source["tasks"]:
        target["notes"].append(dict(
            id=text(row, "_id", "tasks"), user_id=owner(row, "tasks"),
            body=text(row, "text", "tasks"),
            attention_date=optional_integer(row, "when", "tasks"),
            state=choice(row, "state", {"open", "done"}, "tasks"),
            completed_at=optional_integer(row, "completedAt", "tasks"),
            created_at=integer(row, "createdAt", "tasks"),
            updated_at=optional_integer(row, "updatedAt", "tasks"),
        ))
    for row in source["threadNotes"]:
        user_id = owner(row, "threadNotes")
        thread_id = text(row, "threadId", "threadNotes")
        require(thread_id in threads and owner(threads[thread_id], "threads") == user_id,
                f"threadNotes: missing or foreign Thread {thread_id}")
        target["thread_notes"].append(dict(
            id=text(row, "_id", "threadNotes"), user_id=user_id,
            thread_id=thread_id, body=text(row, "body", "threadNotes"),
            state=choice(row, "state", {"open", "done"}, "threadNotes"),
            completed_at=optional_integer(row, "completedAt", "threadNotes"),
            created_at=integer(row, "createdAt", "threadNotes"),
            updated_at=integer(row, "updatedAt", "threadNotes"),
        ))
    for row in source["activityLogs"]:
        user_id = owner(row, "activityLogs")
        thread_id = text(row, "threadId", "activityLogs")
        require(thread_id in threads and owner(threads[thread_id], "threads") == user_id,
                f"activityLogs: missing or foreign Thread {thread_id}")
        type_ = text(row, "type", "activityLogs")
        if type_ in LEGACY_NOTE_TYPES:
            transformed_notes += 1
            target["thread_notes"].append(dict(
                id=text(row, "_id", "activityLogs"), user_id=user_id,
                thread_id=thread_id, body=text(row, "content", "activityLogs"),
                state="open", completed_at=None,
                created_at=integer(row, "createdAt", "activityLogs"),
                updated_at=row["createdAt"],
            ))
            for thread in target["threads"]:
                if thread["id"] == thread_id and thread["last_activity_at"] == row["createdAt"] and thread["last_activity_content"] == row["content"]:
                    thread["last_activity_content"] = None
            continue
        if type_ == "next_action_change":
            type_ = "next_move_change"
        elif type_ == "status_change":
            type_ = "state_change"
        require(type_ in ACTIVITY_TYPES, f"activityLogs: unsupported type {type_!r}")
        target["activity_log_entries"].append(dict(
            id=text(row, "_id", "activityLogs"), user_id=user_id,
            thread_id=thread_id, type=type_,
            content=text(row, "content", "activityLogs"),
            previous_value=optional_text(row, "previousValue", "activityLogs"),
            new_value=optional_text(row, "newValue", "activityLogs"),
            created_at=integer(row, "createdAt", "activityLogs"),
        ))
    for table, rows in target.items():
        ids = [row["id"] for row in rows]
        require(len(ids) == len(set(ids)), f"{table}: duplicate target ID")
        rows.sort(key=lambda row: row["id"])
    require(len({row["email"] for row in target["user"]}) == len(target["user"]),
            "user: duplicate email")
    pairs = [(row["providerId"], row["accountId"]) for row in target["account"]]
    require(len(pairs) == len(set(pairs)), "account: duplicate provider/account pair")
    for table in ("areas", "threads"):
        slugs = [(row["user_id"], row["slug"]) for row in target[table]]
        require(len(slugs) == len(set(slugs)), f"{table}: duplicate owner/slug; resolve before cutover")
    for thread in target["threads"]:
        logs = [row for row in target["activity_log_entries"] if row["thread_id"] == thread["id"]]
        notes = [row for row in target["thread_notes"] if row["thread_id"] == thread["id"]]
        stamp = thread["last_activity_at"]
        content = thread["last_activity_content"]
        require(stamp is not None or (not logs and not notes and content is None),
                f"threads/{thread['id']}: missing activity metadata")
        if stamp is not None:
            require(bool(logs or notes) and stamp == max(
                [log["created_at"] for log in logs] + [note["created_at"] for note in notes]
            ),
                    f"threads/{thread['id']}: inconsistent activity timestamp")
            require((content is not None and any(log["created_at"] == stamp and
                                                 log["content"] == content for log in logs))
                    or (content is None and any(note["created_at"] == stamp for note in notes)),
                    f"threads/{thread['id']}: inconsistent activity content")
    return target, {"legacy_activity_notes": transformed_notes,
                    "discarded_sessions": len(source["session"]),
                    "discarded_rate_limits": len(source["rateLimit"])}


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if type(value) is int:
        return str(value)
    require(isinstance(value, str), "Unsupported SQL value")
    return "'" + value.replace("'", "''") + "'"


def render_sql(target: dict[str, list[dict[str, Any]]]) -> str:
    lines = ["-- Vita OS snapshot import. Apply only to a migrated, empty D1 database.",
             "-- This guard rejects an occupied target and any replay.",
             "CREATE TABLE migration_import_guard (id TEXT PRIMARY KEY NOT NULL, empty_check INTEGER NOT NULL CHECK (empty_check = 0));",
             "INSERT INTO migration_import_guard (id, empty_check) VALUES ('convex-snapshot-v1', (" +
             " + ".join(f'(SELECT count(*) FROM "{table}")' for table in TARGET_TABLES) + "));" ]
    for table in TARGET_TABLES:
        for row in target[table]:
            columns = ", ".join('"' + key + '"' for key in row)
            values = ", ".join(sql_literal(value) for value in row.values())
            lines.append(f'INSERT INTO "{table}" ({columns}) VALUES ({values});')
    return "\n".join(lines) + "\n"


def load_d1_export(path: Path) -> sqlite3.Connection:
    require(path.is_file(), f"D1 export does not exist: {path}")
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    try:
        connection.executescript(path.read_text(encoding="utf-8"))
    except sqlite3.Error as error:
        connection.close()
        raise MigrationError(f"Could not read D1 SQL export: {error}") from error
    return connection


def validate(target: dict[str, list[dict[str, Any]]], connection: sqlite3.Connection,
             transformations: dict[str, int]) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for table in TARGET_TABLES:
        try:
            actual = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}" ORDER BY id')]
        except sqlite3.Error as error:
            raise MigrationError(f"Target table {table} is missing: {error}") from error
        expected = target[table]
        counts[table] = len(expected)
        require(len(actual) == len(expected),
                f"{table}: count mismatch; source={len(expected)}, target={len(actual)}")
        for wanted, found in zip(expected, actual):
            for field, value in wanted.items():
                require(found.get(field) == value,
                        f"{table}/{wanted['id']}: mismatch in {field}")
    require(connection.execute("SELECT count(*) FROM session").fetchone()[0] == 0,
            "Active sessions were imported unexpectedly")
    guard = connection.execute("SELECT id FROM migration_import_guard").fetchall()
    require(len(guard) == 1 and guard[0][0] == "convex-snapshot-v1",
            "Migration import guard is missing")
    require(connection.execute("PRAGMA foreign_key_check").fetchall() == [],
            "D1 export contains foreign-key violations")
    return {"status": "pass", "counts": counts, "transformations": transformations}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    prepare = subcommands.add_parser("prepare", help="Generate deterministic D1 import SQL")
    prepare.add_argument("snapshot", type=Path)
    prepare.add_argument("output", type=Path, help="New private SQL file")
    check = subcommands.add_parser("validate", help="Compare snapshot with a Wrangler D1 SQL export")
    check.add_argument("snapshot", type=Path)
    check.add_argument("d1_export", type=Path)
    check.add_argument("--report", type=Path, help="Optional concise JSON report")
    args = parser.parse_args()
    try:
        target, transformations = project(read_snapshot(args.snapshot))
        if args.command == "prepare":
            require(not args.output.exists(), f"Refusing to overwrite {args.output}")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            import os
            descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                output.write(render_sql(target))
            print(f"Prepared {sum(map(len, target.values()))} rows in {args.output}")
        else:
            connection = load_d1_export(args.d1_export)
            try:
                report = validate(target, connection, transformations)
            finally:
                connection.close()
            output = json.dumps(report, indent=2, sort_keys=True)
            if args.report:
                require(not args.report.exists(), f"Refusing to overwrite {args.report}")
                args.report.write_text(output + "\n", encoding="utf-8")
            print(output)
    except (MigrationError, zipfile.BadZipFile, OSError) as error:
        print(f"Migration failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
