import { NextResponse } from "next/server";
import {
  dbForOrg,
  exportEntity,
  writeWorkbook,
  writeCsv,
  IMPORT_ENTITIES,
} from "@axona/db";
import { getCurrentUser } from "@/lib/session";

// IO.2 — export the SAME IO.1 entities in the SAME descriptor columns, so an export
// round-trips straight back through the importer (zero diffs). Read-only over the
// caller's own org (org-scoped via dbForOrg); reuses exportEntity + writeWorkbook /
// writeCsv from the IO.1 core — no second exporter, no second parser.
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entity = searchParams.get("entity") ?? "";
  const format = (searchParams.get("format") ?? "xlsx").toLowerCase();
  const d = IMPORT_ENTITIES[entity];
  if (!d)
    return NextResponse.json(
      { error: `unknown export entity "${entity}"` },
      { status: 400 },
    );
  if (!d.columns || !d.readRows)
    return NextResponse.json(
      { error: `entity "${entity}" is not exportable` },
      { status: 400 },
    );

  const db = dbForOrg(user.orgId);
  const { headers, rows } = await exportEntity(db, d);
  const base = `${entity}-export-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new Response(writeCsv(headers, rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }
  return new Response(Buffer.from(writeWorkbook(headers, rows)), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
