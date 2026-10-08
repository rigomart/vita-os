"""Keep Drizzle's product schema and baseline aligned with Wrangler's history."""

import json
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path


API = Path(__file__).resolve().parents[1]
ROOT = API.parents[1]
MIGRATIONS = API / "migrations"
SCHEMA = API / "src/platform/d1/schema.ts"
KIT = API / "node_modules/drizzle-kit/bin.cjs"
PRODUCT_TABLES = {"areas", "threads", "activity_log_entries", "notes", "thread_notes"}


def generate(destination, schema=SCHEMA):
    result = subprocess.run(
        [
            "bun", str(KIT), "generate", "--dialect=sqlite",
            f"--schema={schema}", f"--out={os.path.relpath(destination, ROOT)}",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    # Kit can print an error while exiting successfully. Tests also require
    # the expected output files / no-change message, rather than just exit 0.
    return result.stdout + result.stderr


def checks(create_sql):
    values = []
    for match in re.finditer(r"\bCHECK\s*\(", create_sql, re.I):
        start = match.end()
        depth = 1
        end = start
        while depth:
            character = create_sql[end]
            depth += (character == "(") - (character == ")")
            end += 1
        value = create_sql[start:end - 1]
        # Drizzle qualifies columns and names CHECK constraints; SQLite's
        # original inline constraints have the same expressions without that.
        value = re.sub(r'"[a-z_]+"\.', "", value)
        value = value.replace('"', "").replace("`", "")
        values.append(" ".join(value.lower().split()))
    return sorted(values)


def shape(database, table):
    columns = [
        (name, kind.lower(), bool(required), default, bool(primary))
        for _, name, kind, required, default, primary
        in database.execute(f'PRAGMA table_info("{table}")')
    ]
    indexes = []
    for _, name, unique, origin, partial in database.execute(
        f'PRAGMA index_list("{table}")'
    ):
        if origin == "pk":
            continue
        index_columns = tuple(
            (column, bool(descending))
            for _, _, column, descending, _, key
            in database.execute(f'PRAGMA index_xinfo("{name}")')
            if key
        )
        # SQLite's inline UNIQUE creates an internal autoindex; Drizzle models
        # it as a named unique index. Compare its enforcement, not that name.
        indexes.append(("" if unique else name, bool(unique), partial, index_columns))
    foreign_keys = sorted(
        (target, source, destination, update.lower(), delete.lower())
        for _, _, target, source, destination, update, delete, _
        in database.execute(f'PRAGMA foreign_key_list("{table}")')
    )
    create_sql = database.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)
    ).fetchone()[0]
    return columns, sorted(indexes), foreign_keys, checks(create_sql)


class DrizzleSchemaTests(unittest.TestCase):
    def test_schema_matches_all_existing_migrations(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            generate(output)
            generated_files = list(output.glob("*.sql"))
            self.assertEqual(len(generated_files), 1)
            with sqlite3.connect(":memory:") as existing, sqlite3.connect(":memory:") as generated:
                existing.execute("PRAGMA foreign_keys = ON")
                for migration in sorted(MIGRATIONS.glob("*.sql")):
                    existing.executescript(migration.read_text())
                generated.executescript(generated_files[0].read_text())
                managed_tables = {
                    row[0] for row in generated.execute(
                        "SELECT name FROM sqlite_master WHERE type = 'table'"
                    )
                }
                self.assertEqual(managed_tables, PRODUCT_TABLES)
                for table in PRODUCT_TABLES:
                    with self.subTest(table=table):
                        self.assertEqual(shape(existing, table), shape(generated, table))

    def test_baseline_generation_is_a_noop(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            shutil.copytree(MIGRATIONS / "meta", output / "meta")
            before = {path.name: path.read_bytes() for path in (output / "meta").iterdir()}
            result = generate(output)
            self.assertIn("No schema changes, nothing to migrate", result)
            self.assertEqual(list(output.glob("*.sql")), [])
            self.assertEqual(
                before, {path.name: path.read_bytes() for path in (output / "meta").iterdir()}
            )
            journal = json.loads((output / "meta/_journal.json").read_text())
            latest = journal["entries"][-1]
            self.assertEqual(latest["idx"], 7)
            self.assertEqual(latest["tag"], "0007_drop_thread_follow_up")
            self.assertTrue((MIGRATIONS / f'{latest["tag"]}.sql').exists())

    def test_next_column_change_generates_only_0008(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "migrations"
            shutil.copytree(MIGRATIONS / "meta", output / "meta")
            schema = Path(temporary) / "schema.ts"
            source = SCHEMA.read_text().replace(
                "focused_move_id: text(),",
                "focused_move_id: text(),\n    generation_probe: text(),",
            )
            self.assertNotEqual(source, SCHEMA.read_text())
            # The temporary schema resolves the installed dependencies from
            # this checkout, while all generated files stay outside the repo.
            for module, entry in [("drizzle-orm", "index.js"), ("drizzle-orm/sqlite-core", "sqlite-core/index.js")]:
                target = (API / "node_modules/drizzle-orm" / entry).resolve()
                source = source.replace(f'from "{module}"', f'from "{target}"')
            schema.write_text(source)
            generate(output, schema)
            files = list(output.glob("*.sql"))
            self.assertEqual(len(files), 1)
            self.assertTrue(files[0].name.startswith("0008_"))
            self.assertEqual(
                files[0].read_text().strip(),
                'ALTER TABLE `threads` ADD `generation_probe` text;',
            )

    def test_historical_slug_uniqueness_requires_manual_rebuild(self):
        # Kit cannot drop SQLite's historical inline UNIQUE via its modeled
        # named index. Characterize that assumption so upgrades require a
        # deliberate migration-policy review rather than silently trusting SQL.
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "migrations"
            shutil.copytree(MIGRATIONS / "meta", output / "meta")
            schema = Path(temporary) / "schema.ts"
            source = SCHEMA.read_text().replace(
                "unique().on(table.user_id, table.slug),", "", 1
            )
            for module, entry in [("drizzle-orm", "index.js"), ("drizzle-orm/sqlite-core", "sqlite-core/index.js")]:
                target = (API / "node_modules/drizzle-orm" / entry).resolve()
                source = source.replace(f'from "{module}"', f'from "{target}"')
            schema.write_text(source)
            generate(output, schema)
            files = list(output.glob("*.sql"))
            self.assertEqual(len(files), 1)
            with sqlite3.connect(":memory:") as existing:
                for migration in sorted(MIGRATIONS.glob("*.sql")):
                    existing.executescript(migration.read_text())
                with self.assertRaisesRegex(sqlite3.OperationalError, "no such index"):
                    existing.executescript(files[0].read_text())
                existing.execute("INSERT INTO areas VALUES ('first', 'owner', 'One', 'same', 'Home', 0, 0)")
                with self.assertRaises(sqlite3.IntegrityError):
                    existing.execute("INSERT INTO areas VALUES ('second', 'owner', 'Two', 'same', 'Home', 1, 0)")


if __name__ == "__main__":
    unittest.main()
