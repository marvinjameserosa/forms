"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getOrdersAction, updateOrderAction } from "./actions";
import { supabase } from "../../lib/supabase/client";

type OrderLine = {
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: string;
  gcashReference: string | null;
  gcashReceiptUrl: string | null;
  items: OrderLine[];
  itemsSummary: string;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status:
    | "pending"
    | "paid"
    | "confirmed"
    | "packing"
    | "shipped"
    | "intransit"
    | "delivered"
    | "cancelled";
  fulfillment: "delivery" | "pickup";
  createdAt: string;
};

type OrderLineRecord = {
  name?: string | null;
  size?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  unitPrice?: number | null;
  line_total?: number | null;
  lineTotal?: number | null;
};

type OrderRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  payment_method: string;
  gcash_reference: string | null;
  gcash_receipt_url: string | null;
  items: OrderLineRecord[] | null;
  delivery_fee: number | null;
  total_amount: number | null;
  status: OrderItem["status"];
  fulfillment_method: OrderItem["fulfillment"];
  created_at: string;
};

const statusStyles: Record<OrderItem["status"], string> = {
  pending: "bg-[#E47128]/20 text-[#E47128] border-[#E47128]/40",
  paid: "bg-[#00878F]/20 text-[#00878F] border-[#00878F]/40",
  confirmed: "bg-sky-400/20 text-sky-200 border-sky-400/40",
  packing: "bg-indigo-400/20 text-indigo-200 border-indigo-400/40",
  shipped: "bg-blue-400/20 text-blue-200 border-blue-400/40",
  intransit: "bg-slate-400/20 text-slate-200 border-slate-400/40",
  delivered: "bg-[#21935B]/20 text-[#21935B] border-[#21935B]/40",
  cancelled: "bg-red-400/20 text-red-200 border-red-400/40",
};

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setOrdersError("Admin session expired. Please log in again.");
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    try {
      const payload = await getOrdersAction(token);
      if (payload?.error) {
        setOrdersError(payload.error || "Unable to load orders.");
        setOrders([]);
        return;
      }

      setOrders(
        (payload.orders ?? []).map((order: OrderRecord) => {
          const rawItems = Array.isArray(order.items) ? order.items : [];
          const items = rawItems
            .map((item: OrderLineRecord) => ({
              name: String(item?.name ?? ""),
              size: String(item?.size ?? ""),
              quantity: Number(item?.quantity ?? 0),
              unitPrice: Number(item?.unit_price ?? item?.unitPrice ?? 0),
              lineTotal: Number(item?.line_total ?? item?.lineTotal ?? 0),
            }))
            .filter(
              (item: OrderLine) =>
                item.name &&
                item.size &&
                Number.isFinite(item.quantity) &&
                item.quantity > 0,
            );
          const itemCount = items.reduce(
            (sum: number, item: OrderLine) => sum + item.quantity,
            0,
          );
          const subtotal = items.reduce(
            (sum: number, item: OrderLine) => sum + item.lineTotal,
            0,
          );
          const deliveryFee = Number(order.delivery_fee ?? 0);
          const totalAmount = Number(
            order.total_amount ?? subtotal + deliveryFee,
          );
          const itemsSummary = items.length
            ? items
                .map(
                  (item: OrderLine) =>
                    `${item.name} (${item.size}) x${item.quantity}`,
                )
                .join(" · ")
            : "No items";

          return {
            id: order.id,
            name: order.full_name,
            email: order.email,
            phone: order.phone,
            address: order.address,
            paymentMethod: order.payment_method,
            gcashReference: order.gcash_reference,
            gcashReceiptUrl: order.gcash_receipt_url,
            items,
            itemsSummary,
            itemCount,
            subtotal,
            deliveryFee,
            totalAmount,
            status: order.status,
            fulfillment: order.fulfillment_method,
            createdAt: order.created_at,
          };
        }),
      );
    } catch {
      setOrdersError("A network error occurred.");
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) return;
      const isLoggedIn = Boolean(data.session);
      setLoggedIn(isLoggedIn);
      if (isLoggedIn) loadOrders();
    });
    return () => {
      isActive = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery =
        !normalized ||
        [order.id, order.name, order.email, order.itemsSummary].some((f) =>
          f?.toLowerCase().includes(normalized),
        );
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      items: orders.reduce((sum, o) => sum + o.itemCount, 0),
      pending: orders.filter((o) => o.status === "pending").length,
      confirmed: orders.filter((o) => o.status === "confirmed").length,
    }),
    [orders],
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError("Invalid admin credentials.");
    } else {
      setLoggedIn(true);
      loadOrders();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setOrders([]);
  };

  const handleStatusChange = async (
    orderId: string,
    status: OrderItem["status"],
  ) => {
    setStatusUpdatingId(orderId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setOrdersError("Admin session expired. Please log in again.");
      setStatusUpdatingId(null);
      return;
    }

    const result = await updateOrderAction(token ?? "", {
      id: orderId,
      status,
    });

    if (result.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
      if (result.emailError) {
        setOrdersError(result.emailError);
      }
    } else {
      setOrdersError(result.error || "Unable to update order status.");
    }
    setStatusUpdatingId(null);
  };

  const handleSaveOrder = async (updatedOrder: OrderItem) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      alert("Admin session expired. Please log in again.");
      return;
    }

    const result = await updateOrderAction(token ?? "", {
      id: updatedOrder.id,
      email: updatedOrder.email,
      phone: updatedOrder.phone,
      address: updatedOrder.address,
      items: updatedOrder.items,
      status: updatedOrder.status, // Preserve status or allow updates if needed
    });

    if (result.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      );
      setEditingOrder(null);
      if (result.emailError) {
        alert(result.emailError);
      }
    } else {
      alert(result.error || "Failed to save order");
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Email",
      "Phone",
      "Address",
      "Items",
      "Item Count",
      "Delivery Fee",
      "Total",
      "GCash Ref",
      "Receipt URL",
      "Fulfillment",
      "Status",
      "Date",
    ];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.name,
      o.email,
      o.phone,
      `"${o.address}"`,
      `"${o.itemsSummary}"`,
      o.itemCount,
      o.deliveryFee,
      o.totalAmount,
      `"${o.gcashReference || ""}"`,
      o.gcashReceiptUrl || "",
      o.fulfillment,
      o.status,
      o.createdAt,
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orders.csv";
    link.click();
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
  };

  return (
    <div className="relative min-h-screen bg-[#050b0e] text-white">
      {/* Background Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-[-10%] h-80 w-80 rounded-full bg-[#00878F]/10 blur-3xl" />
        <div className="absolute top-24 right-[-8%] h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <main
        className={`relative z-10 mx-auto max-w-7xl px-6 py-16 ${loggedIn ? "flex flex-col gap-10" : "flex items-center justify-center"}`}
      >
        {!loggedIn ? (
          <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-md">
            <h2 className="text-center text-2xl font-bold">Admin Login</h2>
            <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button className="rounded-full bg-[#00878F] py-3 font-bold text-white transition hover:bg-[#007078]">
                Login
              </button>
            </form>
          </section>
        ) : (
          <>
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Merch Orders</h1>
                <p className="text-white/60">
                  Manage your Arduino Day Philippines orders.
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full border border-white/20 px-6 py-2 hover:bg-white/10"
              >
                Log Out
              </button>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Orders" value={stats.total} />
              <StatCard title="Pending" value={stats.pending} color="amber" />
              <StatCard title="Confirmed" value={stats.confirmed} color="sky" />
              <StatCard title="Total Items" value={stats.items} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex flex-wrap gap-4 justify-between">
                <input
                  type="search"
                  placeholder="Search orders..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="rounded-full bg-white/5 border border-white/10 px-4 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm"
                  >
                    <option value="all">All Status</option>
                    {Object.keys(statusStyles).map((s) => (
                      <option key={s} value={s}>
                        {s === "intransit"
                          ? "In Transit"
                          : s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleExportCsv}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-white/40">
                    <tr>
                      <th className="pb-4 whitespace-nowrap pr-4">
                        Order / Customer
                      </th>
                      <th className="pb-4 whitespace-nowrap pr-4">Email</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Phone</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Address</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Items</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Total</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Ref No.</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Receipt</th>
                      <th className="pb-4 whitespace-nowrap pr-4">
                        Fulfillment
                      </th>
                      <th className="pb-4 whitespace-nowrap pr-4">Status</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Date</th>
                      <th className="pb-4 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ordersLoading ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="py-6 text-center text-white/60"
                        >
                          Loading orders...
                        </td>
                      </tr>
                    ) : ordersError ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="py-6 text-center text-red-300"
                        >
                          {ordersError}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id}>
                        <td className="py-4 whitespace-nowrap pr-4">
                          <div className="font-bold">{order.name}</div>
                          <div className="text-xs text-white/40">
                            {order.id}
                          </div>
                        </td>
                        <td className="py-4 whitespace-nowrap text-white/80 pr-4">
                          {order.email}
                        </td>
                        <td className="py-4 whitespace-nowrap text-white/80 pr-4">
                          {order.phone}
                        </td>
                        <td
                          className="py-4 text-white/80 max-w-xs truncate pr-4"
                          title={order.address}
                        >
                          {order.address}
                        </td>
                        <td className="py-4 text-white/80 min-w-[300px] pr-4">
                          <div className="flex flex-col gap-1">
                            {order.items.length > 0 ? (
                              order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between rounded bg-white/5 px-2 py-1 text-xs"
                                >
                                  <span className="truncate pr-2">
                                    {item.name}{" "}
                                    <span className="text-white/40">
                                      ({item.size})
                                    </span>
                                  </span>
                                  <span className="font-mono font-bold text-[#00878F]">
                                    x{item.quantity}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-white/40 italic">
                                No items
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 whitespace-nowrap pr-4">
                          PHP {order.totalAmount}
                        </td>
                        <td className="py-4 whitespace-nowrap pr-4 font-mono text-xs">
                          {order.gcashReference || "-"}
                        </td>
                        <td className="py-4 whitespace-nowrap pr-4">
                          {order.gcashReceiptUrl ? (
                            <button
                              onClick={() =>
                                setViewingReceipt(order.gcashReceiptUrl)
                              }
                              className="text-[#00878F] hover:text-[#007078] text-xs font-bold uppercase underline"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-white/20 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-4 whitespace-nowrap capitalize pr-4">
                          {order.fulfillment}
                        </td>
                        <td className="py-4 whitespace-nowrap pr-4">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleStatusChange(
                                order.id,
                                e.target.value as OrderItem["status"],
                              )
                            }
                            disabled={statusUpdatingId === order.id}
                            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${statusStyles[order.status]}`}
                          >
                            {Object.keys(statusStyles).map((s) => (
                              <option key={s} value={s} className="bg-black">
                                {s === "intransit"
                                  ? "In Transit"
                                  : s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 whitespace-nowrap text-white/60 pr-4">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="py-4 whitespace-nowrap">
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="text-[#00878F] hover:text-[#007078] font-bold text-xs uppercase"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {editingOrder && (
          <EditOrderModal
            order={editingOrder}
            onClose={() => setEditingOrder(null)}
            onSave={handleSaveOrder}
          />
        )}

        {viewingReceipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setViewingReceipt(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl border border-white/10 shadow-2xl">
              <Image
                src={viewingReceipt}
                alt="Receipt"
                fill
                sizes="90vw"
                className="object-contain"
                unoptimized
              />
              <button
                onClick={() => setViewingReceipt(null)}
                className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  color = "white",
}: {
  title: string;
  value: number;
  color?: "amber" | "sky" | "white";
}) {
  const colors: Record<"amber" | "sky" | "white", string> = {
    amber: "border-[#E47128]/20 bg-[#E47128]/10 text-[#E47128]",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    white: "border-white/10 bg-white/5 text-white",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest opacity-70">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EditOrderModal({
  order,
  onClose,
  onSave,
}: {
  order: OrderItem;
  onClose: () => void;
  onSave: (updatedOrder: OrderItem) => Promise<void>;
}) {
  const [formData, setFormData] = useState<OrderItem>(order);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const updateItem = (
    index: number,
    field: keyof OrderLine,
    value: OrderLine[keyof OrderLine],
  ) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Recalculate line total if quantity or price changes
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].lineTotal =
        newItems[index].quantity * newItems[index].unitPrice;
    }

    const subtotal = newItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);

    // update summary
    const itemsSummary = newItems.length
      ? newItems
          .map((item) => `${item.name} (${item.size}) x${item.quantity}`)
          .join(" · ")
      : "No items";

    setFormData({
      ...formData,
      items: newItems,
      subtotal,
      itemCount,
      itemsSummary,
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const subtotal = newItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsSummary = newItems.length
      ? newItems
          .map((item) => `${item.name} (${item.size}) x${item.quantity}`)
          .join(" · ")
      : "No items";
    setFormData({
      ...formData,
      items: newItems,
      subtotal,
      itemCount,
      itemsSummary,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0a0f12] p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="mb-6 text-xl font-bold">Edit Order</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase text-white/40">Email</label>
            <input
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase text-white/40">Phone</label>
            <input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <label className="text-xs uppercase text-white/40">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm"
              rows={2}
            />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-sm font-bold uppercase text-white/60">
            Items
          </h3>
          <div className="flex flex-col gap-2">
            {formData.items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-2 items-center bg-white/5 p-2 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="text-xs text-white/40">
                    {item.size} - PHP {item.unitPrice}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/40">Qty</label>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, "quantity", Number(e.target.value))
                    }
                    className="w-16 rounded border border-white/10 bg-black p-1 text-center text-sm"
                    min="1"
                  />
                </div>
                <div className="text-sm font-mono w-20 text-right">
                  {item.lineTotal}
                </div>
                <button
                  onClick={() => removeItem(idx)}
                  className="text-red-400 hover:text-red-300 p-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-4 text-sm">
            <span className="text-white/60">
              Total Items:{" "}
              <span className="text-white font-bold">{formData.itemCount}</span>
            </span>
            <span className="text-white/60">
              Subtotal:{" "}
              <span className="text-[#00878F] font-bold">
                PHP {formData.subtotal}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full px-6 py-2 hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-[#00878F] px-6 py-2 font-bold text-white hover:bg-[#007078] transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
