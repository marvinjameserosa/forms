"use server";

import { supabaseAdmin } from "../../lib/supabase/admin";
import {
  sendOrderStatusEmail,
  type OrderEmailRecord,
} from "../../lib/email/orderEmail";

type AdminUser = {
  app_metadata?: {
    role?: string;
  };
  user_metadata?: {
    role?: string;
  };
};

type AdminAuthResult =
  | { ok: true; user: AdminUser }
  | { ok: false; error: string };

type UpdateOrderInput = {
  id: string;
  status?: string;
  email?: string;
  phone?: string;
  address?: string;
  items?: unknown[];
};

type UpdateOrderResult =
  | { ok: true; emailError?: string }
  | { ok: false; error: string };

const requireAdmin = async (token: string): Promise<AdminAuthResult> => {
  if (!token) {
    return { ok: false, error: "Missing token." };
  }

  const { data: userData, error: userError } =
    await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false, error: "Invalid token." };
  }

  const adminUser = userData.user as AdminUser;
  const adminRole =
    adminUser.app_metadata?.role ?? adminUser.user_metadata?.role;
  if (adminRole !== "admin") {
    return { ok: false, error: "Admin access required." };
  }

  return { ok: true, user: adminUser };
};

export const getOrdersAction = async (token: string) => {
  const auth = await requireAdmin(token);
  if (!auth.ok) {
    return { error: auth.error };
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id,full_name,email,phone,address,payment_method,gcash_reference,gcash_receipt_url,items,delivery_fee,total_amount,status,fulfillment_method,created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return { error: "Unable to load orders." };
  }

  return { orders: data ?? [] };
};

export const updateOrderAction = async (
  token: string,
  updatesInput: UpdateOrderInput,
) => {
  const auth = await requireAdmin(token);
  if (!auth.ok) {
    return { ok: false, error: auth.error } as UpdateOrderResult;
  }

  if (!updatesInput?.id) {
    return { ok: false, error: "Missing order id." } as UpdateOrderResult;
  }

  const { data: existingOrder, error: existingError } = await supabaseAdmin
    .from("orders")
    .select("id,email,full_name,items,status")
    .eq("id", updatesInput.id)
    .maybeSingle();

  if (existingError || !existingOrder) {
    return { ok: false, error: "Order not found." } as UpdateOrderResult;
  }

  const updates: Record<string, unknown> = {};
  if (updatesInput.status) updates.status = updatesInput.status;
  if (updatesInput.email) updates.email = updatesInput.email;
  if (updatesInput.phone) updates.phone = updatesInput.phone;
  if (updatesInput.address) updates.address = updatesInput.address;
  if (updatesInput.items) updates.items = updatesInput.items;

  const { error } = await supabaseAdmin
    .from("orders")
    .update(updates)
    .eq("id", updatesInput.id);

  if (error) {
    return { ok: false, error: "Unable to update order status." };
  }

  if (
    updatesInput.status &&
    updatesInput.status !== String(existingOrder.status)
  ) {
    const emailResult = await sendOrderStatusEmail({
      order: existingOrder as OrderEmailRecord,
      status: updatesInput.status,
    });

    if (!emailResult.ok) {
      return { ok: true, emailError: emailResult.error };
    }
  }

  return { ok: true };
};
