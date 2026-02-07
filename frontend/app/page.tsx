"use client";

import { useMemo, useState } from "react";

const merchItems = [
  {
    name: "Merch 01",
    tone: "from-teal-500/20 to-transparent",
    tag: "Heavyweight",
  },
  {
    name: "Merch 02",
    tone: "from-amber-500/25 to-transparent",
    tag: "Best Seller",
  },
  {
    name: "Merch 03",
    tone: "from-green-500/25 to-transparent",
    tag: "New",
  },
  {
    name: "Merch 04",
    tone: "from-teal-400/20 to-transparent",
    tag: "Adjustable",
  },
  {
    name: "Merch 05",
    tone: "from-amber-400/20 to-transparent",
    tag: "Canvas",
  },
  {
    name: "Merch 06",
    tone: "from-green-400/25 to-transparent",
    tag: "Limited",
  },
];

const merchSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const;

type CartItem = {
  name: string;
  size: string;
  quantity: number;
};

export default function Home() {
  const [quantities, setQuantities] = useState<number[]>(() =>
    merchItems.map(() => 0)
  );
  const [selectedSizes, setSelectedSizes] = useState<(string | null)[]>(() =>
    merchItems.map(() => null)
  );
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

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
    const size = selectedSizes[index];
    const quantity = quantities[index];
    if (!size || quantity <= 0) {
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.name === merchItems[index].name && item.size === size
      );
      if (existingIndex === -1) {
        return [...prev, { name: merchItems[index].name, size, quantity }];
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
          {merchItems.map((item, index) => (
            <article
              key={item.name}
              className="glass-panel fade-up rounded-3xl p-6"
            >
              <div
                className={`h-40 w-full rounded-2xl bg-gradient-to-br ${item.tone} border border-white/10`}
              />
              <div className="mt-5 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {item.name}
                  </h3>
                  <p className="text-sm text-white/60">{item.tag}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {merchSizes.map((size) => {
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
          ))}
        </section>

        <div
          className={`fixed inset-0 z-20 bg-black/60 transition ${
            cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setCartOpen(false)}
        />
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

            <form className="flex flex-col gap-5">
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

              <button
                type="submit"
                className="mt-2 rounded-full bg-gradient-to-r from-teal-500 via-green-500 to-amber-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:brightness-110"
              >
                Submit Order
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
