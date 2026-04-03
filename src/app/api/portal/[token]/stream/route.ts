import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveExistingColumn, resolveTableName } from "@/lib/supabase-compat";

export const dynamic = "force-dynamic";

const configuredMin = Number(process.env.PORTAL_TOKEN_MIN_LENGTH ?? "24");
const TOKEN_MIN_LEN = Number.isFinite(configuredMin)
  ? Math.min(Math.max(configuredMin, 6), 120)
  : 24;
const TOKEN_REGEX = new RegExp(`^[A-Za-z0-9_-]{${TOKEN_MIN_LEN},120}$`);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = enforceRateLimit(req, {
    key: "portal-stream",
    maxRequests: 60,
    windowMs: 60_000,
    message: "Terlalu banyak koneksi realtime. Coba lagi dalam 1 menit.",
  });
  if (limited) return limited;

  const { token } = await params;
  if (!TOKEN_REGEX.test(token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getSupabaseServerClient();

  const shohibulTable = await resolveTableName(supabase, "shohibul");
  if (!shohibulTable) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tokenColumn = await resolveExistingColumn(supabase, shohibulTable, [
    "unique_token",
    "link_unik",
    "token",
  ]);
  if (!tokenColumn) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: shohibul, error } = await supabase
    .from(shohibulTable)
    .select("id")
    .eq(tokenColumn, token)
    .maybeSingle();

  if (error || !shohibul) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "portal-update", timestamp: Date.now() })}\n\n`)
        );
      };

      send();
      const interval = setInterval(send, 10000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
