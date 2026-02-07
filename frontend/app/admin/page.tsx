"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabase/client";

type OrderItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentMethod: string;
  gcashReference: string;
  gcashReceiptUrl: string;
  item: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: "pending" | "paid";
  createdAt: string;
};


const statusStyles: Record<OrderItem["status"], string> = {
  pending: "bg-amber-400/20 text-amber-200 border-amber-400/40",
  paid: "bg-emerald-400/20 text-emerald-200 border-emerald-400/40",
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

    const response = await fetch("/api/admin/orders", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setOrdersError(payload?.error || "Unable to load orders.");
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    const payload = (await response.json()) as {
      orders: Array<{
        id: string;
        full_name: string;
        email: string;
        phone: string;
        address: string;
        payment_method: string;
        gcash_reference: string;
        gcash_receipt_url: string;
        item_name: string;
        size: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        status: OrderItem["status"];
        created_at: string;
      }>;
    };

    setOrders(
      (payload.orders ?? []).map((order) => ({
        id: order.id,
        name: order.full_name,
        email: order.email,
        phone: order.phone,
        address: order.address,
        paymentMethod: order.payment_method,
        gcashReference: order.gcash_reference,
        gcashReceiptUrl: order.gcash_receipt_url,
        item: order.item_name,
        size: order.size,
        quantity: order.quantity,
        unitPrice: Number(order.unit_price ?? 0),
        lineTotal: Number(order.line_total ?? 0),
        status: order.status,
        createdAt: order.created_at,
      }))
    );
    setOrdersLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) {
        return;
      }
      const isLoggedIn = Boolean(data.session);
      setLoggedIn(isLoggedIn);
      if (isLoggedIn) {
        loadOrders();
      }
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
        [
        order.id,
        order.name,
        order.email,
        order.phone,
        order.item,
        order.size,
        order.paymentMethod,
        order.gcashReference,
        order.gcashReceiptUrl,
        order.status,
        ].some((field) => field.toLowerCase().includes(normalized));
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const totalItems = useMemo(
    () => orders.reduce((sum, order) => sum + order.quantity, 0),
    [orders]
  );
  const totalOrders = useMemo(() => orders.length, [orders]);
  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === "pending").length,
    [orders]
  );
  const paidCount = useMemo(
    () => orders.filter((order) => order.status === "paid").length,
    [orders]
  );

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your admin email and password.");
      return;
    }
    setError("");
    supabase.auth
      .signInWithPassword({ email, password })
      .then(({ error: authError }) => {
        if (authError) {
          setError("Invalid admin credentials.");
          return;
        }
        setLoggedIn(true);
        loadOrders();
      });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setOrders([]);
  };

  const handleStatusChange = async (
    orderId: string,
    status: OrderItem["status"]
  ) => {
    setStatusUpdatingId(orderId);
    setOrdersError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setOrdersError("Admin session expired. Please log in again.");
      setStatusUpdatingId(null);
      return;
    }

    const response = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: orderId, status }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setOrdersError(payload?.error || "Unable to update status.");
      setStatusUpdatingId(null);
      return;
    }

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    );
    setStatusUpdatingId(null);
  };

  const handleExportCsv = () => {
    const headers = [
      "Order",
      "Customer",
      "Email",
      "Phone",
      "Address",
      "Payment Method",
      "GCash Reference",
      "GCash Receipt",
      "Item",
      "Size",
      "Qty",
      "Unit Price",
      "Line Total",
      "Status",
      "Date",
    ];

    const rows = filteredOrders.map((order) => [
      order.id,
      order.name,
      order.email,
      order.phone,
      order.address,
      order.paymentMethod,
      order.gcashReference,
      order.gcashReceiptUrl,
      order.item,
      order.size,
      String(order.quantity),
      order.unitPrice.toFixed(2),
      order.lineTotal.toFixed(2),
      order.status,
      formatDate(order.createdAt),
    ]);

    const escapeValue = (value: string) =>
      value.includes(",") || value.includes("\n") || value.includes('"')
        ? `"${value.replace(/"/g, '""')}"`
        : value;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeValue).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orders.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b0e] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(11,122,122,0.4),transparent_70%)] blur-3xl" />
        <div className="absolute top-24 right-[-8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(240,138,26,0.35),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-12%] left-[30%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(30,166,107,0.35),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>

      <main
        className={`relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-16 ${
          loggedIn ? "gap-10" : "items-center justify-center"
        }`}
      >
        {loggedIn ? (
          <header className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  <img
                    src="/arduinoday.jpg"
                    alt="Arduino Day Philippines"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Admin Dashboard
                  </p>
                  <h1 className="text-2xl font-semibold text-white">
                    Merch Orders
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Back to Site
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Log Out
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-white/65">
                Review, update, and confirm merch orders.
              </p>
            </div>
          </header>
        ) : null}

        {!loggedIn ? (
          <section className="glass-panel mx-auto w-full max-w-md rounded-3xl p-8 md:p-10">
            <div className="text-center">
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                Admin Access Only
              </span>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                Admin Login
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Sign in to view and manage merch orders.
              </p>
            </div>
            <form className="mt-8 flex flex-col gap-5" onSubmit={handleLogin}>
              <label className="text-sm text-white/80">
                Email
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@arduinoday.ph"
                  autoComplete="email"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>
              <label className="text-sm text-white/80">
                Password
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-white/60">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-white/30 bg-white/10 text-emerald-300 focus:ring-emerald-300/40"
                  />
                  Remember this device
                </label>
                <span className="text-white/40">Organizers only</span>
              </div>
              {error ? (
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="mt-2 rounded-full bg-gradient-to-r from-teal-500 via-green-500 to-amber-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-[0_16px_40px_rgba(16,185,129,0.25)] transition hover:brightness-110"
              >
                Login
              </button>
            </form>
          </section>
        ) : (
          <section className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Total Orders
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {totalOrders}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
                  Pending
                </p>
                <p className="mt-3 text-3xl font-semibold text-amber-100">
                  {pendingCount}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
                  Paid
                </p>
                <p className="mt-3 text-3xl font-semibold text-emerald-100">
                  {paidCount}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-sky-200/80">
                  Items
                </p>
                <p className="mt-3 text-3xl font-semibold text-sky-100">
                  {totalItems}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search order, name, email"
                  aria-label="Search order, name, email"
                  className="w-60 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs tracking-[0.2em] text-white placeholder-white/60 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="appearance-none rounded-full border border-white/15 bg-white/5 px-4 py-2 pr-10 text-xs tracking-[0.2em] text-white focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] text-white/60">
                    v
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Orders Database
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    {totalOrders} total orders · {totalItems} items
                  </p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1300px] text-left text-sm text-white/80">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-white/60">
                    <tr>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Address</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="bg-white/0">
                        <td className="px-4 py-3 text-white">
                          <div className="text-sm font-semibold">
                            {order.id}
                          </div>
                          <div className="text-xs text-white/50">
                            {order.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {order.name}
                          </div>
                          <div className="text-xs text-white/50">
                            {order.phone}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          <span className="block max-w-[220px] truncate">
                            {order.address}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                            {order.paymentMethod}
                          </div>
                          <div className="text-sm font-semibold text-white">
                            {order.gcashReference}
                          </div>
                          {order.gcashReceiptUrl ? (
                            <a
                              href={order.gcashReceiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs uppercase tracking-[0.2em] text-emerald-200 hover:text-emerald-100"
                            >
                              View Receipt
                            </a>
                          ) : (
                            <div className="text-xs text-white/40">
                              Missing receipt
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {order.item}
                          </div>
                          <div className="text-xs text-white/50">
                            Size {order.size}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {order.quantity}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                            PHP {order.unitPrice.toFixed(0)}
                          </div>
                          <div className="text-sm font-semibold text-white">
                            PHP {order.lineTotal.toFixed(0)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={order.status}
                            onChange={(event) =>
                              handleStatusChange(
                                order.id,
                                event.target.value as OrderItem["status"]
                              )
                            }
                            disabled={statusUpdatingId === order.id}
                            className={`appearance-none rounded-full border bg-[#050b0e] px-3 py-1 text-xs uppercase tracking-[0.2em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-300/30 ${
                              statusStyles[order.status]
                            } disabled:opacity-60`}
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ordersLoading ? (
                <p className="mt-4 text-sm text-white/60">
                  Loading orders...
                </p>
              ) : ordersError ? (
                <p className="mt-4 text-sm text-amber-200">{ordersError}</p>
              ) : filteredOrders.length === 0 ? (
                <p className="mt-4 text-sm text-white/60">
                  No orders match your search.
                </p>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
