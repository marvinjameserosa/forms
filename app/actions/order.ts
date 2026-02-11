"use server";

import { supabaseAdmin } from "../../lib/supabase/admin";
import {
  sendOrderStatusEmail,
  type OrderEmailRecord,
} from "../../lib/email/orderEmail";

type OrderItemInput = {
  item_id: string;
  name: string;
  size: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  weight_grams: number;
  line_weight_grams: number;
};

type CreateOrderInput = {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  payment_method: string;
  fulfillment_method: "pickup" | "delivery";
  gcash_reference: string;
  gcash_receipt_url: string;
  items: OrderItemInput[];
  delivery_fee: number;
  total_amount: number;
  total_weight: number;
  weight_unit: "g" | "kg";
  status?: "pending";
};

type CreateOrderResult =
  | { ok: true; orderId: string; emailError?: string }
  | { ok: false; error: string };

export const createOrderAction = async (
  input: CreateOrderInput,
): Promise<CreateOrderResult> => {
  if (!input?.email || !input?.full_name) {
    return { ok: false, error: "Missing customer details." };
  }

  const payload = {
    ...input,
    status: "pending" as const,
  };

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert(payload)
    .select("id,email,full_name,items,status")
    .single();

  if (error || !data) {
    return { ok: false, error: "Unable to submit order. Please try again." };
  }

  const emailResult = await sendOrderStatusEmail({
    order: data as OrderEmailRecord,
    status: "pending",
  });

  if (!emailResult.ok) {
    return { ok: true, orderId: data.id, emailError: emailResult.error };
  }

  return { ok: true, orderId: data.id };
};
