"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  gcashReference: string;
  gcashReceiptUrl: string;
  items: OrderLine[];
  itemsSummary: string;
  itemCount: number;
  subtotal: number;
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

const statusStyles: Record<OrderItem["status"], string> = {
  pending: "bg-amber-400/20 text-amber-200 border-amber-400/40",
  paid: "bg-teal-400/20 text-teal-200 border-teal-400/40",
  confirmed: "bg-sky-400/20 text-sky-200 border-sky-400/40",
  packing: "bg-indigo-400/20 text-indigo-200 border-indigo-400/40",
  shipped: "bg-blue-400/20 text-blue-200 border-blue-400/40",
  intransit: "bg-purple-400/20 text-purple-200 border-purple-400/40",
  delivered: "bg-emerald-400/20 text-emerald-200 border-emerald-400/40",
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
      const response = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setOrdersError(payload?.error || "Unable to load orders.");
        setOrders([]);
        return;
      }

      const payload = await response.json();
      setOrders(
        (payload.orders ?? []).map((order: any) => {
          const rawItems = Array.isArray(order.items) ? order.items : [];
          const items = rawItems
            .map((item: any) => ({
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
            status: order.status,
            fulfillment: order.fulfillment_method,
            createdAt: order.created_at,
          };
        }),
      );
    } catch (err) {
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

    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: orderId, status }),
    });

    if (response.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
    }
    setStatusUpdatingId(null);
  };

  const handleExportCsv = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Email",
      "Address",
      "Items",
      "Item Count",
      "Total",
      "Fulfillment",
      "Status",
      "Date",
    ];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.name,
      o.email,
      `"${o.address}"`,
      `"${o.itemsSummary}"`,
      o.itemCount,
      o.subtotal,
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
        <div className="absolute -top-32 left-[-10%] h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" />
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
              <button className="rounded-full bg-teal-500 py-3 font-bold text-black transition hover:bg-teal-400">
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
                      <th className="pb-4 whitespace-nowrap pr-4">Address</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Items</th>
                      <th className="pb-4 whitespace-nowrap pr-4">Total</th>
                      <th className="pb-4 whitespace-nowrap pr-4">
                        Fulfillment
                      </th>
                      <th className="pb-4 whitespace-nowrap pr-4">Status</th>
                      <th className="pb-4 whitespace-nowrap">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredOrders.map((order) => (
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
                                  <span className="font-mono font-bold text-teal-200">
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
                          PHP {order.subtotal}
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
                                e.target.value as any,
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
                        <td className="py-4 whitespace-nowrap text-white/60">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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
  color?: string;
}) {
  const colors: any = {
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
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
