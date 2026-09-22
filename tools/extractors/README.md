# AHSP extractors

The tracked scripts in `scripts/extract-*.py` read a regulation workbook the maintainer supplies. They do not embed a machine path.

```text
uv run --project tools/extractors python scripts/extract-bina-marga-2022.py --input <workbook.xls>
uv run --project tools/extractors python scripts/extract-cipta-karya.py --input <workbook.xlsx>
uv run --project tools/extractors python scripts/extract-cipta-karya-hsd.py --input <workbook.xlsx>
uv run --project tools/extractors python scripts/extract-lansekap.py --input <workbook.xlsx>
```

`--output` defaults to the package data directory for that script. Pass another directory when checking a fixture so production JSON is not replaced.

Obtain the workbooks from the official regulation (Permen PUPR 1/2022 for Bina Marga, SE Bina Konstruksi 68/2024 for Cipta Karya). Do not commit the workbooks. Record the file checksum in the review that regenerates data.

Run the fixture tests with:

```text
uv run --project tools/extractors pytest tools/extractors/tests
uv lock --project tools/extractors --check
```
