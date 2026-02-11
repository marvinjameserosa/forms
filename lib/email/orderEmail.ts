import { readFile } from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";

export type OrderItemRecord = {
  name?: string | null;
  size?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unitPrice?: number | null;
  line_total?: number | null;
  lineTotal?: number | null;
};

export type OrderEmailRecord = {
  id: string;
  email: string;
  full_name: string | null;
  items: OrderItemRecord[] | null;
  status: string;
};

const buildItemsSummary = (items: OrderItemRecord[] | null) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "No items";
  }

  const summary = items
    .map((item) => {
      const name = String(item?.name ?? "").trim();
      const size = String(item?.size ?? "").trim();
      const qty = Number(item?.quantity ?? 0);
      if (!name || !size || !Number.isFinite(qty) || qty <= 0) {
        return null;
      }
      return `${name} (${size}) x${qty}`;
    })
    .filter(Boolean)
    .join(" · ");

  return summary || "No items";
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildItemsListHtml = (items: OrderItemRecord[] | null) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "<li>No items</li>";
  }

  const listItems = items
    .map((item) => {
      const name = String(item?.name ?? "").trim();
      const size = String(item?.size ?? "").trim();
      const qty = Number(item?.quantity ?? 0);
      if (!name || !size || !Number.isFinite(qty) || qty <= 0) {
        return null;
      }
      const text = `${name} (${size}) x${qty}`;
      return `<li>${escapeHtml(text)}</li>`;
    })
    .filter(Boolean)
    .join("");

  return listItems || "<li>No items</li>";
};

const loadEmailTemplate = async () => {
  const templatePath = path.join(process.cwd(), "public", "adph.html");
  return readFile(templatePath, "utf8");
};

export const sendOrderStatusEmail = async ({
  order,
  status,
}: {
  order: OrderEmailRecord;
  status: string;
}) => {
  const senderEmail = process.env.ARDUINODAYPH_SENDER_EMAIL;
  const senderPassword = process.env.ARDUINODAYPH_SENDER_PASSWORD;
  const senderName =
    process.env.ARDUINODAYPH_SENDER_NAME ?? "Arduino Day Philippines";

  if (!senderEmail || !senderPassword) {
    return { ok: false, error: "Missing SMTP sender credentials." };
  }

  const smtpHost = process.env.ARDUINODAYPH_SMTP_HOST ?? "smtp.gmail.com";
  const smtpPort = Number(process.env.ARDUINODAYPH_SMTP_PORT ?? 465);
  const smtpSecure =
    (process.env.ARDUINODAYPH_SMTP_SECURE ?? "true").toLowerCase() ===
    "true";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: senderEmail,
      pass: senderPassword,
    },
  });

  const itemsSummary = buildItemsSummary(order.items);
  const statusLine = `Your order with an order id of ${order.id} has updated with a status of ${status}.`;
  const textBody = `${statusLine}\n\nItems: ${itemsSummary}`;
  const template = await loadEmailTemplate();
  const htmlBody = template
    .replace("{recipient}", escapeHtml(order.full_name ?? "Customer"))
    .replace("{order_id}", escapeHtml(order.id))
    .replace("{order_status}", escapeHtml(status))
    .replace("{order_items}", buildItemsListHtml(order.items));

  await transporter.sendMail({
    from: `${senderName} <${senderEmail}>`,
    to: order.email,
    subject: `Order ${order.id} status update`,
    text: textBody,
    html: htmlBody,
  });

  return { ok: true };
};
