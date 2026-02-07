"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase/client";

type MerchItem = {
  id: string;
  name: string;
  image: string;
  tone: string;
  tag: string;
  price: number;
  sizes: string[];
};

type CartItem = {
  itemId: string;
  name: string;
  price: number;
  size: string;
  quantity: number;
};

export default function Home() {
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [merchLoading, setMerchLoading] = useState(true);
  const [merchError, setMerchError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<(string | null)[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadMerch = async () => {
      setMerchLoading(true);
      const { data, error } = await supabase
        .from("merch_items")
        .select("id,name,image,tone,tag,price,sizes")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!isActive) {
        return;
      }

      if (error) {
        setMerchError("Unable to load merch right now.");
        setMerchItems([]);
      } else {
        setMerchError(null);
        setMerchItems(
          (data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            image: item.image,
            tone: item.tone,
            tag: item.tag,
            price: Number(item.price ?? 0),
            sizes:
              Array.isArray(item.sizes) && item.sizes.length > 0
                ? item.sizes
                : ["One Size"],
          }))
        );
      }
      setMerchLoading(false);
    };

    loadMerch();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setQuantities((prev) =>
      merchItems.map((_, index) => prev[index] ?? 0)
    );
    setSelectedSizes((prev) =>
      merchItems.map(
        (item, index) =>
          prev[index] ?? (item.sizes.length === 1 ? item.sizes[0] : null)
      )
    );
  }, [merchItems]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (sizeGuideOpen) {
        setSizeGuideOpen(false);
      }
      if (cartOpen) {
        setCartOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartOpen, sizeGuideOpen]);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const adjustQuantity = (index: number, delta: number) => {
    setQuantities((prev) =>
      prev.map((qty, i) =>
        i === index ? Math.max(0, qty + delta) : qty
      )
    );
  };

  const updateQuantity = (index: number, value: number) => {
    const normalized = Number.isNaN(value) ? 0 : value;
    setQuantities((prev) =>
      prev.map((qty, i) => (i === index ? Math.max(0, normalized) : qty))
    );
  };

  const selectSize = (index: number, size: string) => {
    setSelectedSizes((prev) =>
      prev.map((current, i) => (i === index ? size : current))
    );
  };

  const addToCart = (index: number) => {
    const merchItem = merchItems[index];
    const size = selectedSizes[index];
    const quantity = quantities[index];
    if (!merchItem) {
      return;
    }
    if (!size || quantity <= 0) {
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.itemId === merchItem.id && item.size === size
      );
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            itemId: merchItem.id,
            name: merchItem.name,
            price: merchItem.price ?? 0,
            size,
            quantity,
          },
        ];
      }
      return prev.map((item, i) =>
        i === existingIndex
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    });

    setQuantities((prev) => prev.map((qty, i) => (i === index ? 0 : qty)));
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitError(null);
    setSubmitSuccess(null);

    if (cartItems.length === 0) {
      setSubmitError("Add items to your cart before submitting.");
      return;
    }

    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("contactNumber") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();

    if (!fullName || !email || !phone || !address) {
      setSubmitError("Please complete all contact fields.");
      return;
    }

    setSubmitting(true);

    const orderRows = cartItems.map((item) => ({
      full_name: fullName,
      email,
      phone,
      address,
      item_id: item.itemId,
      item_name: item.name,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
      status: "pending" as const,
    }));

    const { error } = await supabase.from("orders").insert(orderRows);

    if (error) {
      setSubmitError("Unable to submit order. Please try again.");
      setSubmitting(false);
      return;
    }

    setCartItems([]);
    setQuantities((prev) => prev.map(() => 0));
    form.reset();
    setSubmitSuccess("Order received! We'll email you with next steps.");
    setSubmitting(false);
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050b0e] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[-10%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(11,122,122,0.5),transparent_70%)] blur-3xl" />
        <div className="absolute top-20 right-[-8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(240,138,26,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-12%] left-[30%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(30,166,107,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-8">
          <div className="fade-up inline-flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] text-white/70">
            <span className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
              March 21, 2026
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span>Asia Pacific College, Makati</span>
          </div>

          <div className="fade-up fade-delay-1 flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="font-display text-5xl leading-[0.95] text-white sm:text-6xl lg:text-7xl">
                <span className="block text-teal-400">Arduino Day</span>
                <span className="block text-green-400">Philippines</span>
                <span className="block text-white">2026 Merch</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">
                A clothing capsule for builders, creators, and tinkerers. Pick
                your pieces, then scroll to place an order.
              </p>
            </div>
          </div>

          <div className="fade-up fade-delay-2 flex flex-wrap justify-center gap-4">
            <a
              href="#order-form"
              className="rounded-full bg-gradient-to-r from-teal-500 via-green-500 to-amber-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:brightness-110"
            >
              Order Now
            </a>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
            >
              View Sizing Guide
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Cart
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[0.6rem] font-semibold text-black">
                {cartCount}
              </span>
            </button>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {merchLoading ? (
            <div className="glass-panel fade-up rounded-3xl p-6 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-white/70">Loading merch...</p>
            </div>
          ) : merchError ? (
            <div className="glass-panel fade-up rounded-3xl p-6 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-amber-200">{merchError}</p>
            </div>
          ) : merchItems.length === 0 ? (
            <div className="glass-panel fade-up rounded-3xl p-6 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-white/70">
                No merch is available yet.
              </p>
            </div>
          ) : (
            merchItems.map((item, index) => (
              <article
                key={item.id}
                className="glass-panel fade-up rounded-3xl p-6"
              >
                <div
                  className={`relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${item.tone}`}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                </div>
                <div className="mt-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {item.name}
                    </h3>
                    <p className="text-sm text-white/60">{item.tag}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Price
                    </p>
                    <p className="text-lg font-semibold text-white">
                      PHP {(item.price ?? 0).toFixed(0)}
                    </p>
                  </div>
                </div>
                {item.sizes.length === 1 ? (
                  <div className="mt-4">
                    <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-300/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                      {item.sizes[0]}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.sizes.map((size) => {
                      const isSelected = selectedSizes[index] === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => selectSize(index, size)}
                          className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                            isSelected
                              ? "border-emerald-300/80 bg-emerald-300/20 text-emerald-100"
                              : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"
                          }`}
                          aria-pressed={isSelected}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex flex-1 items-center justify-between gap-2 rounded-full border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/60">
                    <span>Qty</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustQuantity(index, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-base text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={quantities[index] ?? 0}
                        onChange={(event) =>
                          updateQuantity(index, Number(event.target.value))
                        }
                        className="w-12 bg-transparent text-center text-sm text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => adjustQuantity(index, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-base text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(index)}
                    disabled={
                      quantities[index] <= 0 || selectedSizes[index] === null
                    }
                    className="flex-1 rounded-full bg-white/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <div
          className={`fixed inset-0 z-20 bg-black/60 transition ${
            cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setCartOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-black/60 transition ${
            sizeGuideOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setSizeGuideOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!sizeGuideOpen}
          className={`fixed left-1/2 top-1/2 z-30 w-[90%] max-w-2xl -translate-x-1/2 -translate-y-1/2 transform rounded-3xl border border-white/10 bg-[#050b0e] p-6 transition duration-300 ${
            sizeGuideOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Sizing Guide</h3>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(false)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img
              src="/shirt_size.jpg"
              alt="Shirt sizing guide"
              className="h-full w-full object-contain"
            />
          </div>
        </aside>
        <aside
          className={`fixed right-0 top-0 z-30 h-full w-full max-w-md transform border-l border-white/10 bg-[#050b0e] p-6 transition duration-300 ${
            cartOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Your Cart</h3>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {cartItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-white/60">
                Your cart is empty.
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div
                  key={`${item.name}-${item.size}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.name}
                    </p>
                    <p className="text-xs text-white/60">
                      Size {item.size} · Qty {item.quantity}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(index)}
                    className="rounded-full border border-white/20 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Items
            </span>
            <span className="text-sm font-semibold text-white">{cartCount}</span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                document.getElementById("order-form")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
              className="rounded-full bg-gradient-to-r from-teal-500 via-green-500 to-amber-400 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:brightness-110"
            >
              Checkout
            </button>
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
              disabled={cartItems.length === 0}
            >
              Clear Cart
            </button>
          </div>
        </aside>

        <section id="order-form" className="scroll-mt-24">
          <div className="glass-panel fade-up grid gap-8 rounded-3xl p-8 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h2 className="text-3xl font-semibold text-white">
                Place Your Order
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Fill up the form below to reserve your merch. We will follow up
                with payment details and size confirmation.
              </p>
              <div className="mt-6 grid gap-4 text-xs uppercase tracking-[0.25em] text-white/60">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Limited quantities
                </div>
              </div>
            </div>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <label className="text-sm text-white/80">
                Full Name
                <input
                  type="text"
                  name="fullName"
                  placeholder="Juan Dela Cruz"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Email
                <input
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Contact Number
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="0917 000 0000"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Address
                <input
                  type="text"
                  name="address"
                  placeholder="House No., Street, City"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/30"
                />
              </label>

              {submitError ? (
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                  {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                  {submitSuccess}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-full bg-gradient-to-r from-teal-500 via-green-500 to-amber-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Order"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
