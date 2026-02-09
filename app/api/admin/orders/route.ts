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
  const adminRole =
    adminUser.app_metadata?.role ?? adminUser.user_metadata?.role;
  if (adminRole !== "admin") {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id,full_name,email,phone,address,payment_method,gcash_reference,gcash_receipt_url,items,status,fulfillment_method,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 },
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
  const adminRole =
    adminUser.app_metadata?.role ?? adminUser.user_metadata?.role;
  if (adminRole !== "admin") {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    email?: string;
    phone?: string;
    address?: string;
    items?: any[];
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing order id." }, { status: 400 });
  }

  const updates: any = {};
  if (body.status) updates.status = body.status;
  if (body.email) updates.email = body.email;
  if (body.phone) updates.phone = body.phone;
  if (body.address) updates.address = body.address;
  if (body.items) updates.items = body.items;

  const { error } = await supabaseAdmin
    .from("orders")
    .update(updates)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: "Unable to update order status." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
