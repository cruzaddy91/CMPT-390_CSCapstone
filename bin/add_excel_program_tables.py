#!/usr/bin/env python3
"""
Add native Excel Table parts to a *copy* of the program template by editing the
OOXML package (zip) in place in memory. We do not use openpyxl save(), which
drops parts (e.g. sharedStrings, webExtensions) and can produce files Mac Excel
refuses to open.

Read-only: source FINAL .xlsx. Write-only: dest path.
"""
from __future__ import annotations

import argparse
import sys
import xml.sax.saxutils as saxutils
import zipfile
from pathlib import Path

ROW_BLOCKS = ((1, 16), (18, 32), (34, 48), (50, 64))
GROUPS_2 = ((3, 11), (14, 22))
GROUPS_4 = ((3, 11), (14, 22), (25, 33), (36, 44))

TABLE_HEADER_NAMES = (
    "Exercise",
    "Sets",
    "Reps",
    "% 1RM",
    "RPE",
    "Weight",
    "Tempo",
    "Rest",
    "Notes",
)

SHEET_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_TABLE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table"
)
RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
TABLE_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"
)


def _col_letters(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def _ref_block(min_col: int, max_col: int, r1: int, r2: int, header_row: int) -> str:
    return f"{_col_letters(min_col)}{header_row}:{_col_letters(max_col)}{r2}"


def _header_row(r1: int) -> int:
    return 1 if r1 == 1 else r1 - 1


def _autofilter_row(min_col: int, max_col: int, header_row: int) -> str:
    return f"{_col_letters(min_col)}{header_row}:{_col_letters(max_col)}{header_row}"


def _esc_attr(s: str) -> str:
    return saxutils.escape(s, {"\n": "&#10;"})


def _table_xml(
    table_num: int,
    display_name: str,
    ref: str,
    auto_filter: str,
) -> bytes:
    col_xml = "".join(
        f'<tableColumn id="{i}" name="{_esc_attr(h)}"/>'
        for i, h in enumerate(TABLE_HEADER_NAMES, start=1)
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<table id="{table_num}" name="{display_name}" displayName="{display_name}" '
        f'ref="{ref}" headerRowCount="1" xmlns="{SHEET_MAIN_NS}">\n'
        f'<autoFilter ref="{auto_filter}"/>\n'
        f'<tableColumns count="{len(TABLE_HEADER_NAMES)}">{col_xml}</tableColumns>\n'
        f'<tableStyleInfo name="TableStyleLight1" showFirstColumn="0" '
        f"showLastColumn=\"0\" showRowStripes=\"0\" showColumnStripes=\"0\"/>"
        f"\n</table>\n"
    ).encode("utf-8")


def _rels_for_tables(file_indices: list[int]) -> bytes:
    body = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        f'<Relationships xmlns="{RELS_NS}">',
    ]
    for i, tidx in enumerate(file_indices, start=1):
        body.append(
            f'<Relationship Type="{REL_TABLE}" Id="rId{i}" '
            f'Target="../tables/table{tidx}.xml"/>'
        )
    body.append("</Relationships>")
    return "\n".join(body).encode("utf-8")


def _table_parts(count: int) -> bytes:
    inner = "".join(
        f'<tablePart r:id="rId{i}"/>' for i in range(1, count + 1)
    )
    return f'<tableParts count="{count}">{inner}</tableParts>'.encode("utf-8")


def _insert_table_parts(sheet: bytes, n_tables: int) -> bytes:
    if sheet.count(b"</worksheet>") != 1:
        raise ValueError("Expected a single </worksheet>")
    return sheet.replace(b"</worksheet>", _table_parts(n_tables) + b"</worksheet>", 1)


def _patch_content_types(ct: bytes, n_table_parts: int) -> bytes:
    t = ct.decode("utf-8")
    ovr = "\n" + "\n".join(
        f'<Override PartName="/xl/tables/table{n}.xml" ContentType="{TABLE_CONTENT_TYPE}"/>'
        for n in range(1, n_table_parts + 1)
    )
    return t.replace("</Types>", ovr + "\n</Types>", 1).encode("utf-8")


def _build_table_entries() -> tuple[list[dict], int]:
    """
    Returns a list of dicts: sheet path, list of (display_name, ref, af), file index.
    Fills global table part indices 1..N.
    """
    entries: list[dict] = []
    tid = 1

    # 4 Week: sheet2 — 4 tables, cols C:K
    t4: list[dict] = []
    for bi, (r1, r2) in enumerate(ROW_BLOCKS, start=1):
        h = _header_row(r1)
        t4.append(
            {
                "name": f"tbl_4w_b{bi}",
                "id": tid,
                "ref": _ref_block(3, 11, r1, r2, h),
                "af": _autofilter_row(3, 11, h),
            }
        )
        tid += 1
    entries.append({"path": "xl/worksheets/sheet2.xml", "tables": t4})

    t8: list[dict] = []
    for bi, (r1, r2) in enumerate(ROW_BLOCKS, start=1):
        h = _header_row(r1)
        for gi, (c0, c1) in enumerate(GROUPS_2, start=1):
            t8.append(
                {
                    "name": f"tbl_8w_b{bi}_g{gi}",
                    "id": tid,
                    "ref": _ref_block(c0, c1, r1, r2, h),
                    "af": _autofilter_row(c0, c1, h),
                }
            )
            tid += 1
    entries.append({"path": "xl/worksheets/sheet3.xml", "tables": t8})

    t16: list[dict] = []
    for bi, (r1, r2) in enumerate(ROW_BLOCKS, start=1):
        h = _header_row(r1)
        for gi, (c0, c1) in enumerate(GROUPS_4, start=1):
            t16.append(
                {
                    "name": f"tbl_16w_b{bi}_g{gi}",
                    "id": tid,
                    "ref": _ref_block(c0, c1, r1, r2, h),
                    "af": _autofilter_row(c0, c1, h),
                }
            )
            tid += 1
    entries.append({"path": "xl/worksheets/sheet4.xml", "tables": t16})

    n_total = tid - 1
    return entries, n_total


def _write_ooxml_package_with_tables(source: Path, dest: Path) -> int:
    """
    Read all parts, merge table additions, write a new zip.
    Preserves all original part names; dict iteration order = zip order, then
    new parts appended. Returns n_tables.
    """
    with zipfile.ZipFile(source, "r") as zin:
        part_bytes: dict[str, bytes] = {
            i.filename: zin.read(i.filename) for i in zin.infolist()
        }
        order: list[str] = [i.filename for i in zin.infolist()]

    sheet_entries, n_tables = _build_table_entries()
    flat: list[dict] = [t for e in sheet_entries for t in e["tables"]]
    for t in flat:
        i = t["id"]
        path = f"xl/tables/table{i}.xml"
        if path in part_bytes:
            raise SystemExit(f"Refuse overwrite of {path!r}")
        part_bytes[path] = _table_xml(i, t["name"], t["ref"], t["af"])
        order.append(path)

    for e in sheet_entries:
        sheet_p = e["path"]
        base = sheet_p.split("worksheets/")[-1]  # sheet2.xml
        rels_p = f"xl/worksheets/_rels/{base.replace('.xml', '.xml.rels')}"
        if rels_p in part_bytes:
            raise SystemExit(
                f"Refusing to clobber existing {rels_p!r}; add merge for existing rels"
            )
        fidx = [t["id"] for t in e["tables"]]
        part_bytes[rels_p] = _rels_for_tables(fidx)
        order.append(rels_p)
        n_tbl = len(e["tables"])
        part_bytes[sheet_p] = _insert_table_parts(part_bytes[sheet_p], n_tbl)

    if "[Content_Types].xml" not in part_bytes:
        raise SystemExit("No [Content_Types].xml")
    part_bytes["[Content_Types].xml"] = _patch_content_types(
        part_bytes["[Content_Types].xml"], n_tables
    )

    if set(part_bytes) != set(order) or len(part_bytes) != len(order):
        raise SystemExit(
            f"Part/order mismatch: parts={len(part_bytes)} order={len(order)}"
        )

    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in order:
            zout.writestr(name, part_bytes[name], compress_type=zipfile.ZIP_DEFLATED)

    with zipfile.ZipFile(source, "r") as z0:
        orig = set(z0.namelist())
    with zipfile.ZipFile(dest, "r") as z1:
        nxt = set(z1.namelist())
    if not orig <= nxt:
        raise SystemExit("Lost original parts: " + ", ".join(sorted(orig - nxt)))
    return n_tables


def build_ooxml_tables_on_copy(source: Path, dest: Path) -> int:
    if not source.is_file():
        raise FileNotFoundError(source)
    return _write_ooxml_package_with_tables(source, dest)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Add Excel tables to a copy of the template (OOXML-safe; FINAL read-only).",
    )
    ap.add_argument("source", type=Path, help="FINAL .xlsx (read only)")
    ap.add_argument("dest", type=Path, help="Output .xlsx path")
    args = ap.parse_args()
    try:
        n = build_ooxml_tables_on_copy(args.source, args.dest)
    except FileNotFoundError as e:
        print(f"Not found: {e}", file=sys.stderr)
        return 1
    print(
        f"Wrote {args.dest} (all original parts retained; {n} table parts + 3 rels + tableParts)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
