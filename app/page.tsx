"use client";

import Image from "next/image";
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
  image?: string;
  price: number;
  size: string;
  quantity: number;
};

const GCASH_BUCKET = "gcash-receipts";
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const CART_STORAGE_KEY = "adph-cart-items";

export default function Home() {
  const [merchItems, setMerchItems] = useState<MerchItem[]>([]);
  const [merchLoading, setMerchLoading] = useState(true);
  const [merchError, setMerchError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<(string | null)[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as CartItem[];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              item &&
              typeof item.itemId === "string" &&
              typeof item.name === "string" &&
              (!item.image || typeof item.image === "string") &&
              typeof item.price === "number" &&
              typeof item.size === "string" &&
              typeof item.quantity === "number" &&
              item.quantity > 0
          )
        : [];
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<
    { src: string; alt: string } | null
  >(null);
  const [cartToast, setCartToast] = useState<string | null>(null);
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
        const nextItems = (data ?? []).map((item) => ({
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
        }));

        setMerchItems(nextItems);
        setQuantities((prev) =>
          nextItems.map((_, index) => prev[index] ?? 0)
        );
        setSelectedSizes((prev) =>
          nextItems.map(
            (item, index) =>
              prev[index] ?? (item.sizes.length === 1 ? item.sizes[0] : null)
          )
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
    if (typeof window === "undefined") {
      return;
    }

    if (cartItems.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cartItems)
    );
  }, [cartItems]);

  useEffect(() => {
    if (!cartToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCartToast(null);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [cartToast]);

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
      if (checkoutOpen) {
        setCheckoutOpen(false);
      }
      if (confirmationOpen) {
        setConfirmationOpen(false);
      }
      if (previewImage) {
        setPreviewImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartOpen, sizeGuideOpen, checkoutOpen, confirmationOpen, previewImage]);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );
  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      ),
    [cartItems]
  );

  const adjustQuantity = (index: number, delta: number) => {
    setQuantities((prev) =>
      prev.map((qty, i) => {
        if (i !== index) {
          return qty;
        }
        const nextQty = Math.max(0, qty + delta);
        if (nextQty > 0 && selectedSizes[index] === null) {
          const item = merchItems[index];
          if (item?.sizes?.length) {
            setSelectedSizes((sizes) =>
              sizes.map((current, sIndex) =>
                sIndex === index ? item.sizes[0] : current
              )
            );
          }
        }
        return nextQty;
      })
    );
  };

  const updateQuantity = (index: number, value: number) => {
    const normalized = Number.isNaN(value) ? 0 : value;
    setQuantities((prev) =>
      prev.map((qty, i) => {
        if (i !== index) {
          return qty;
        }
        const nextQty = Math.max(0, normalized);
        if (nextQty > 0 && selectedSizes[index] === null) {
          const item = merchItems[index];
          if (item?.sizes?.length) {
            setSelectedSizes((sizes) =>
              sizes.map((current, sIndex) =>
                sIndex === index ? item.sizes[0] : current
              )
            );
          }
        }
        return nextQty;
      })
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
            image: merchItem.image,
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
    setCartToast(`${merchItem.name} added to cart`);
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
    const paymentMethod = String(formData.get("paymentMethod") ?? "gcash");
    const fulfillmentMethod = String(
      formData.get("fulfillmentMethod") ?? "pickup"
    );
    const gcashReference = String(
      formData.get("gcashReference") ?? ""
    ).trim();
    const receiptFile = formData.get("gcashReceipt");

    if (!fullName || !email || !phone || !address) {
      setSubmitError("Please complete all contact fields.");
      return;
    }

    if (paymentMethod !== "gcash") {
      setSubmitError("Select GCash as your payment method.");
      return;
    }

    if (fulfillmentMethod !== "pickup" && fulfillmentMethod !== "delivery") {
      setSubmitError("Select pickup or delivery for your order.");
      return;
    }

    if (!gcashReference) {
      setSubmitError("Enter your GCash reference number.");
      return;
    }

    if (!(receiptFile instanceof File) || receiptFile.size === 0) {
      setSubmitError("Upload your GCash receipt screenshot.");
      return;
    }

    if (!receiptFile.type.startsWith("image/")) {
      setSubmitError("Receipt screenshot must be an image file.");
      return;
    }

    if (receiptFile.size > MAX_RECEIPT_SIZE) {
      setSubmitError("Receipt image must be 5MB or smaller.");
      return;
    }

    setSubmitting(true);

    const fileExtension =
      receiptFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const uploadPath = `gcash/${crypto.randomUUID()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from(GCASH_BUCKET)
      .upload(uploadPath, receiptFile, {
        contentType: receiptFile.type,
      });

    if (uploadError) {
      setSubmitError("Unable to upload receipt. Please try again.");
      setSubmitting(false);
      return;
    }

    const receiptUrl = supabase.storage
      .from(GCASH_BUCKET)
      .getPublicUrl(uploadPath).data.publicUrl;

    const orderItems = cartItems.map((item) => ({
      item_id: item.itemId,
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }));

    const orderPayload = {
      full_name: fullName,
      email,
      phone,
      address,
      payment_method: "gcash",
      fulfillment_method: fulfillmentMethod,
      gcash_reference: gcashReference,
      gcash_receipt_url: receiptUrl,
      items: orderItems,
      status: "pending" as const,
    };

    const { error } = await supabase.from("orders").insert(orderPayload);

    if (error) {
      setSubmitError(
        error.message
          ? `Unable to submit order: ${error.message}`
          : "Unable to submit order. Please try again."
      );
      setSubmitting(false);
      return;
    }

    setCartItems([]);
    setQuantities((prev) => prev.map(() => 0));
    form.reset();
    setSubmitSuccess("Order received! We'll verify your GCash receipt.");
    setCheckoutOpen(false);
    setConfirmationOpen(true);
    setSubmitting(false);
  };

  return (
    <div className="relative min-h-screen bg-[#0a1116] text-white">
      {/* ── Sticky Navbar ── */}
      <nav className="sticky top-0 z-20 border-b border-white/8 bg-[#0d1a1f]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl leading-none text-[#00878F]">ADPH</span>
            <span className="hidden text-xs uppercase tracking-[0.15em] text-white/50 sm:inline">Merch Store</span>
          </div>

          {/* Nav secondary bar */}
          <div className="hidden items-center gap-1 text-xs text-white/60 md:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E47128]" />
              March 21, 2026
            </span>
            <span className="mx-2 h-3 w-px bg-white/15" />
            <span>Asia Pacific College, Makati</span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="hidden rounded-md px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-white sm:inline-flex"
            >
              Size Guide
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 rounded-lg bg-[#00878F]/15 px-3 py-2 text-sm font-medium text-[#00878F] transition hover:bg-[#00878F]/25"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 6h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#E47128] px-1.5 text-[0.65rem] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sub-nav: categories strip (Amazon-style) */}
        <div className="border-t border-white/5 bg-[#0a1518]">
          <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-4 py-2 text-xs text-white/50 lg:px-6">
            <a href="#products" className="flex-shrink-0 text-white/80 transition hover:text-[#00878F]">All Products</a>
            <span className="h-3 w-px bg-white/10" />
            <button type="button" onClick={() => setSizeGuideOpen(true)} className="flex-shrink-0 transition hover:text-white/80 sm:hidden">Size Guide</button>
            <span className="h-3 w-px bg-white/10 sm:hidden" />
            <a href="#order-form" className="flex-shrink-0 transition hover:text-white/80">Place Order</a>
            <span className="h-3 w-px bg-white/10" />
            <span className="flex-shrink-0 text-[#E47128]/80">Limited Stock</span>
          </div>
        </div>
      </nav>

      {/* ── Hero Banner ── */}
      <section className="relative border-b border-white/5 bg-[#081214]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-10 text-center lg:px-6 lg:py-14">
          <h1 className="font-display text-balance text-4xl leading-[1] sm:text-5xl lg:text-6xl">
            <span className="text-[#00878F]">Arduino </span>
            <span className="text-[#E47128]">Day </span>
            <span className="text-[#21935B]">Philippines</span>
            <span className="block text-white">2026 Official Merch</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">
            Exclusive gear for builders, creators, and tinkerers. Limited quantities available -- order now and pick up at the event or get it delivered.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#products"
              className="rounded-lg bg-[#00878F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#007078]"
            >
              Shop Now
            </a>
            <button
              type="button"
              onClick={() => {
                if (cartItems.length > 0) {
                  setCheckoutOpen(true);
                } else {
                  setCartOpen(true);
                }
              }}
              className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              {cartItems.length > 0 ? `Checkout (${cartCount})` : "View Cart"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Product Grid ── */}
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
        {/* Results bar */}
        <div id="products" className="mb-6 flex items-center justify-between scroll-mt-32">
          <div>
            <h2 className="text-lg font-semibold text-white">Available Merch</h2>
            {!merchLoading && !merchError && (
              <p className="mt-0.5 text-xs text-white/45">
                {merchItems.length} {merchItems.length === 1 ? "item" : "items"} available
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSizeGuideOpen(true)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
          >
            Sizing Guide
          </button>
        </div>

        {merchLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="animate-pulse rounded-xl border border-white/6 bg-white/3 p-4">
                <div className="aspect-square rounded-lg bg-white/5" />
                <div className="mt-4 h-4 w-3/4 rounded bg-white/5" />
                <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
                <div className="mt-4 h-8 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : merchError ? (
          <div className="rounded-xl border border-[#E47128]/20 bg-[#E47128]/5 px-6 py-10 text-center">
            <p className="text-sm text-[#E47128]">{merchError}</p>
          </div>
        ) : merchItems.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/3 px-6 py-10 text-center">
            <p className="text-sm text-white/50">No merch is available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {merchItems.map((item, index) => {
              const qty = quantities[index] ?? 0;
              const size = selectedSizes[index];
              const canAdd = qty > 0 && size !== null;

              return (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/6 bg-[#0d1a1f] transition hover:border-white/12"
                >
                  {/* Product image */}
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: item.image, alt: item.name })}
                    className="relative aspect-square w-full overflow-hidden bg-[#111f26]"
                    aria-label={`View ${item.name} image`}
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      priority={index === 0}
                    />
                    <span className="absolute left-3 top-3 rounded-md bg-[#0d1a1f]/90 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white/80">
                      {item.tag}
                    </span>
                  </button>

                  {/* Product details */}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {/* Name + Price */}
                    <div>
                      <h3 className="text-sm font-semibold leading-snug text-white">{item.name}</h3>
                      <p className="mt-1 text-lg font-bold text-[#00878F]">
                        {"PHP "}
                        {(item.price ?? 0).toLocaleString()}
                      </p>
                    </div>

                    {/* Size selector */}
                    {item.sizes.length === 1 ? (
                      <span className="inline-flex w-fit rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
                        {item.sizes[0]}
                      </span>
                    ) : (
                      <div>
                        <p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-white/40">Size</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.sizes.map((s) => {
                            const isSelected = selectedSizes[index] === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => selectSize(index, s)}
                                className={`rounded-md border px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-wider transition ${
                                  isSelected
                                    ? "border-[#00878F] bg-[#00878F]/15 text-[#00878F]"
                                    : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80"
                                }`}
                                aria-pressed={isSelected}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quantity selector */}
                    <div className="flex items-center gap-2">
                      <p className="text-[0.65rem] uppercase tracking-wider text-white/40">Qty</p>
                      <div className="flex items-center rounded-md border border-white/10">
                        <button
                          type="button"
                          onClick={() => adjustQuantity(index, -1)}
                          className="flex h-8 w-8 items-center justify-center text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={(event) =>
                            updateQuantity(index, Number(event.target.value))
                          }
                          className="h-8 w-10 border-x border-white/10 bg-transparent text-center text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => adjustQuantity(index, 1)}
                          className="flex h-8 w-8 items-center justify-center text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Add to Cart button */}
                    <button
                      type="button"
                      onClick={() => addToCart(index)}
                      disabled={!canAdd}
                      className="mt-auto w-full rounded-lg bg-[#E47128] py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#d0641f] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Add to Cart
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Order summary bar (like Amazon's "Proceed to checkout" strip) ── */}
        {cartItems.length > 0 && (
          <div id="order-form" className="mt-10 scroll-mt-32 rounded-xl border border-white/8 bg-[#0d1a1f] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/50">
                  Subtotal ({cartCount} {cartCount === 1 ? "item" : "items"}):{" "}
                  <span className="text-lg font-bold text-white">PHP {cartSubtotal.toLocaleString()}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className="rounded-lg border border-white/12 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  View Cart
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(true)}
                  className="rounded-lg bg-[#00878F] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#007078]"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Overlays ── */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition ${
          cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setCartOpen(false)}
      />
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition ${
          sizeGuideOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSizeGuideOpen(false)}
      />
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition ${
          checkoutOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setCheckoutOpen(false)}
      />
      <div
        className={`fixed inset-0 z-30 bg-black/60 transition ${
          confirmationOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setConfirmationOpen(false)}
      />
      <div
        className={`fixed inset-0 z-30 bg-black/70 transition ${
          previewImage ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setPreviewImage(null)}
      />

      {/* ── Size Guide Modal ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!sizeGuideOpen}
        className={`fixed left-1/2 top-1/2 z-40 max-h-[85vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-2xl border border-white/8 bg-[#0d1a1f] p-6 transition duration-300 ${
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
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Shirt Sizing
            </h4>
            <div className="relative mt-3 aspect-[4/3] w-full">
              <Image
                src="/shirt_size.png"
                alt="Shirt sizing guide"
                fill
                className="object-contain"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Vest Sizing
            </h4>
            <div className="relative mt-3 aspect-[4/3] w-full">
              <Image
                src="/vest_size.png"
                alt="Vest sizing guide"
                fill
                className="object-contain"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Cart Drawer ── */}
      <aside
        className={`checkout-scroll fixed right-0 top-0 z-40 h-full w-full max-w-md transform overflow-y-auto border-l border-white/8 bg-[#0d1a1f] transition duration-300 ${
          cartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#0d1a1f] px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Shopping Cart</h3>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-3">
            {cartItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center text-sm text-white/40">
                Your cart is empty.
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div
                  key={`${item.name}-${item.size}-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/3 p-3"
                >
                  {item.image ? (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/8">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  ) : null}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-white/50">
                      Size: {item.size} | Qty: {item.quantity}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#00878F]">
                      PHP {(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(index)}
                    className="flex-shrink-0 text-xs text-[#E47128]/80 transition hover:text-[#E47128]"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              <div className="mt-5 border-t border-white/8 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">
                    Subtotal ({cartCount} {cartCount === 1 ? "item" : "items"})
                  </span>
                  <span className="text-lg font-bold text-white">
                    PHP {cartSubtotal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  className="w-full rounded-lg bg-[#00878F] py-3 text-sm font-bold text-white transition hover:bg-[#007078]"
                >
                  Proceed to Checkout
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  className="w-full rounded-lg border border-white/10 py-2.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
                >
                  Clear Cart
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Checkout Modal ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!checkoutOpen}
        className={`checkout-scroll fixed left-1/2 top-1/2 z-40 max-h-[90vh] w-[94%] max-w-3xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-2xl border border-white/8 bg-[#0d1a1f] transition duration-300 ${
          checkoutOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {/* Checkout header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#0d1a1f] px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Checkout</h3>
          <button
            type="button"
            onClick={() => setCheckoutOpen(false)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.8fr]">
          {/* Order form */}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">Contact Information</h4>

            <label className="text-xs text-white/50">
              Full Name
              <input
                type="text"
                name="fullName"
                placeholder="Juan Dela Cruz"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
              />
            </label>

            <label className="text-xs text-white/50">
              Email
              <input
                type="email"
                name="email"
                placeholder="you@email.com"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
              />
            </label>

            <label className="text-xs text-white/50">
              Contact Number
              <input
                type="tel"
                name="contactNumber"
                placeholder="0917 000 0000"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
              />
            </label>

            <label className="text-xs text-white/50">
              Address
              <input
                type="text"
                name="address"
                placeholder="House No., Street, City"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
              />
            </label>

            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Fulfillment
              </p>
              <label className="mt-2.5 flex items-center gap-2.5 text-sm text-white/70">
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value="pickup"
                  defaultChecked
                  className="h-4 w-4 border-white/20 bg-white/5 text-[#00878F] focus:ring-[#00878F]/30"
                />
                Pickup at venue
              </label>
              <label className="mt-2 flex items-center gap-2.5 text-sm text-white/70">
                <input
                  type="radio"
                  name="fulfillmentMethod"
                  value="delivery"
                  className="h-4 w-4 border-white/20 bg-white/5 text-[#00878F] focus:ring-[#00878F]/30"
                />
                Delivery
              </label>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                Payment
              </p>
              <label className="mt-2.5 flex items-center gap-2.5 text-sm text-white/70">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="gcash"
                  defaultChecked
                  className="h-4 w-4 border-white/20 bg-white/5 text-[#00878F] focus:ring-[#00878F]/30"
                />
                GCash
              </label>
              <p className="mt-1.5 text-xs text-white/40">
                Upload your receipt to confirm the order.
              </p>
            </div>

            <label className="text-xs text-white/50">
              GCash Reference No.
              <input
                type="text"
                name="gcashReference"
                placeholder="0000000000"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
              />
            </label>

            <label className="text-xs text-white/50">
              GCash Receipt Screenshot
              <input
                type="file"
                name="gcashReceipt"
                accept="image/*"
                required
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white/70"
              />
            </label>

            {submitError ? (
              <p className="rounded-lg bg-[#E47128]/10 px-3 py-2 text-xs text-[#E47128]">
                {submitError}
              </p>
            ) : null}
            {submitSuccess ? (
              <p className="rounded-lg bg-[#21935B]/10 px-3 py-2 text-xs text-[#21935B]">
                {submitSuccess}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#E47128] py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#d0641f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Place Order"}
            </button>
          </form>

          {/* Order summary sidebar */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 lg:sticky lg:top-4 lg:self-start">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">Order Summary</h4>
            <div className="mt-3 flex flex-col gap-2">
              {cartItems.map((item, index) => (
                <div key={`summary-${item.name}-${item.size}-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="text-white/80">{item.name}</p>
                    <p className="text-xs text-white/40">{item.size} x {item.quantity}</p>
                  </div>
                  <span className="text-white/70">PHP {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/8 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/60">Total</span>
                <span className="text-lg font-bold text-[#00878F]">PHP {cartSubtotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#E47128]/8 px-3 py-2 text-xs text-[#E47128]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E47128]" />
              Limited quantities -- order while supplies last
            </div>
          </div>
        </div>
      </aside>

      {/* ── Confirmation Modal ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!confirmationOpen}
        className={`fixed left-1/2 top-1/2 z-40 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-white/8 bg-[#0d1a1f] p-6 text-center transition duration-300 ${
          confirmationOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#21935B]/15">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="h-7 w-7 text-[#21935B]"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">
          Order submitted successfully
        </h3>
        <p className="mt-2 text-sm text-white/60">
          We received your order and will verify your GCash receipt shortly.
        </p>
        <button
          type="button"
          onClick={() => setConfirmationOpen(false)}
          className="mt-5 rounded-lg border border-white/12 px-5 py-2 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
        >
          Close
        </button>
      </aside>

      {/* ── Image Preview Modal ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!previewImage}
        className={`fixed left-1/2 top-1/2 z-40 w-[94%] max-w-5xl -translate-x-1/2 -translate-y-1/2 transform rounded-2xl border border-white/8 bg-[#0d1a1f] p-4 transition duration-300 ${
          previewImage
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/50">
            Image Preview
          </h3>
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="relative mt-4 h-[70vh] w-full overflow-hidden rounded-xl border border-white/6 bg-white/3">
          {previewImage ? (
            <Image
              src={previewImage.src}
              alt={previewImage.alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          ) : null}
        </div>
      </aside>

      {/* ── Cart Toast ── */}
      {cartToast ? (
        <div className="cart-toast pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#21935B] px-4 py-2.5 text-xs font-semibold text-white shadow-lg md:right-6 md:left-auto md:translate-x-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{cartToast}</span>
        </div>
      ) : null}

      {/* ── Footer ── */}
      <footer className="border-t border-white/6 bg-[#0a1116]">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-white/30 lg:px-6">
          Arduino Day Philippines 2026 -- Merch Orders
        </div>
      </footer>
    </div>
  );
}
