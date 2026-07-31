import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), "public", "black-hole-explorer", "index.html"),
    "utf8"
  );

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
