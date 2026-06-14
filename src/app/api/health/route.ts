import { jsonOk } from "@/lib/api";

export async function GET() {
  return jsonOk({ ok: true, time: new Date().toISOString() });
}
