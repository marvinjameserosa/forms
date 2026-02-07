import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabase/admin";

type AdminUser = {
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    role?: string;
  };
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 401 });
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const adminUser = userData.user as AdminUser;
  const adminRole = adminUser.app_metadata?.role ?? adminUser.user_metadata?.role;
  if (adminRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id,full_name,email,phone,address,payment_method,gcash_reference,gcash_receipt_url,item_name,size,quantity,unit_price,line_total,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 }
    );
  }

  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 401 });
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  const adminUser = userData.user as AdminUser;
  const adminRole = adminUser.app_metadata?.role ?? adminUser.user_metadata?.role;
  if (adminRole !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: string; status?: "pending" | "paid" }
    | null;

  if (!body?.id || !body.status) {
    return NextResponse.json(
      { error: "Missing order id or status." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: body.status })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: "Unable to update order status." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
