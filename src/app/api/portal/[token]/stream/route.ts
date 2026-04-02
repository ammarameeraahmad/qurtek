import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseServerClient();

  const { data: shohibul, error } = await supabase
    .from("shohibul")
    .select("id")
    .eq("unique_token", token)
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
