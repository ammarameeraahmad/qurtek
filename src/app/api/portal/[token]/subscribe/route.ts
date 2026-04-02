import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();

    const endpoint = String(body?.endpoint ?? "").trim();
    const p256dh = String(body?.keys?.p256dh ?? "").trim();
    const auth = String(body?.keys?.auth ?? "").trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Subscription tidak valid." }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: shohibul, error: shohibulError } = await supabase
      .from("shohibul")
      .select("id")
      .eq("unique_token", token)
      .maybeSingle();

    if (shohibulError) throw shohibulError;
    if (!shohibul) {
      return NextResponse.json({ error: "Link shohibul tidak valid." }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .eq("shohibul_id", shohibul.id)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("push_subscriptions")
        .update({ p256dh_key: p256dh, auth_key: auth, is_active: true })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("push_subscriptions").insert([
        {
          shohibul_id: shohibul.id,
          endpoint,
          p256dh_key: p256dh,
          auth_key: auth,
          is_active: true,
        },
      ]);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan subscription." },
      { status: 500 }
    );
  }
}
