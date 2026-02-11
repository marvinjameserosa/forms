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
  includeStatusLine = true,
  fulfillmentNote,
}: {
  order: OrderEmailRecord;
  status: string;
  includeStatusLine?: boolean;
  fulfillmentNote?: string;
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
  const statusLabel = status.toUpperCase();
  const introLine =
    "We are delighted to confirm that your Arduino Day Official Merchandise order has been successfully placed.";
  const prepLine =
    "Our team is currently preparing your items with the utmost care.";
  const textLines = [
    introLine,
    "",
    prepLine,
    "",
    `Order Reference: ${order.id}`,
    `Items: ${itemsSummary}`,
  ];
  if (includeStatusLine) {
    textLines.push(`Status: ${statusLabel}`);
  }
  if (fulfillmentNote) {
    textLines.push("", fulfillmentNote);
  }
  const textBody = textLines.join("\n");
  const template = await loadEmailTemplate();
  const statusBlock = includeStatusLine
    ? `
      <div
        style="
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #e6f4f2;
          border: 1px solid #c9e7e2;
        "
      >
        <span style="font-size: 12px; color: #285e5a; letter-spacing: 0.6px;">
          STATUS
        </span>
        <div
          style="
            margin-top: 4px;
            font-size: 14px;
            font-weight: 700;
            color: #003333;
            letter-spacing: 1px;
          "
        >
          ${escapeHtml(statusLabel)}
        </div>
      </div>
    `
    : "";
  const fulfillmentBlock = fulfillmentNote
    ? `
      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="
          border-collapse: collapse;
          margin: 0 0 24px 0;
          border: 1px solid #e7eceb;
          border-radius: 12px;
          overflow: hidden;
          background: #fdf7ef;
        "
      >
        <tr>
          <td
            style="
              padding: 14px 16px;
              font-family: &quot;IBM Plex Sans&quot;, sans-serif;
              color: #6a4a1f;
              font-size: 14px;
              line-height: 1.7;
            "
          >
            ${escapeHtml(fulfillmentNote)}
          </td>
        </tr>
      </table>
    `
    : "";
  const htmlBody = template
    .replace("{recipient}", escapeHtml(order.full_name ?? "Customer"))
    .replace("{order_id}", escapeHtml(order.id))
    .replace("{order_items}", escapeHtml(itemsSummary))
    .replace("{status_block}", statusBlock)
    .replace("{fulfillment_note}", fulfillmentBlock);

  await transporter.sendMail({
    from: `${senderName} <${senderEmail}>`,
    to: order.email,
    subject: `Order ${order.id} status update`,
    text: textBody,
    html: htmlBody,
  });

  return { ok: true };
};
