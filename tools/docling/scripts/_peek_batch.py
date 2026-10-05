import json
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = json.loads(p.read_text(encoding="utf-8"))
md = data["markdown"]
tables = data["tables"]

print("=== BATCH META ===")
print(f"pages: {data['page_start']}-{data['page_end']}")
print(f"markdown chars: {len(md)}")
print(f"tables: {len(tables)}")
print()
print("=== MARKDOWN PREVIEW (first 4000 chars) ===")
print(md[:4000])
print()
print("=== TABLES SUMMARY ===")
for i, t in enumerate(tables):
    print(f"Table {i+1}: {t['rows']} rows x {t['cols']} cols")
    print(f"  columns: {t['columns']}")
    for j, rec in enumerate(t["records"][:3]):
        print(f"  row{j}: {rec}")
    if t["rows"] > 3:
        print(f"  ... ({t['rows'] - 3} more rows)")
    print()
