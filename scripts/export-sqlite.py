"""Convert a Wrangler D1 SQL export to JSON without uploading source data."""
import json
import sqlite3
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:3])
connection = sqlite3.connect(":memory:")
connection.row_factory = sqlite3.Row
connection.executescript(source.read_text())
tables = {}
for (table,) in connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
    quoted = '"' + table.replace('"', '""') + '"'
    tables[table.upper()] = [dict(row) for row in connection.execute("SELECT * FROM " + quoted)]
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(tables, indent=2))
target.chmod(0o600)
print(f"Exported {len(tables)} tables; data saved privately to {target}.")
