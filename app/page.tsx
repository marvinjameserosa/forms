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
              item.quantity > 0,
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
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [region, setRegion] = useState<
    "ncr" | "luzon" | "visayas" | "mindanao"
  >("ncr");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "sets" | "individual"
  >("all");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
    "default",
  );

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
        setQuantities((prev) => nextItems.map((_, index) => prev[index] ?? 0));
        setSelectedSizes((prev) =>
          nextItems.map(
            (item, index) =>
              prev[index] ?? (item.sizes.length === 1 ? item.sizes[0] : null),
          ),
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

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
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
    [cartItems],
  );
  const cartSubtotal = useMemo(
    () =>
      cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  const filteredItems = useMemo(() => {
    let items = merchItems.map((item, originalIndex) => ({
      ...item,
      originalIndex,
    }));

    if (activeFilter === "sets") {
      items = items.filter((item) => item.tag !== "Individual Item");
    } else if (activeFilter === "individual") {
      items = items.filter((item) => item.tag === "Individual Item");
    }

    if (sortBy === "price-asc") {
      items = [...items].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      items = [...items].sort((a, b) => b.price - a.price);
    }

    return items;
  }, [merchItems, activeFilter, sortBy]);

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
                sIndex === index ? item.sizes[0] : current,
              ),
            );
          }
        }
        return nextQty;
      }),
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
                sIndex === index ? item.sizes[0] : current,
              ),
            );
          }
        }
        return nextQty;
      }),
    );
  };

  const selectSize = (index: number, size: string) => {
    setSelectedSizes((prev) =>
      prev.map((current, i) => (i === index ? size : current)),
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
        (item) => item.itemId === merchItem.id && item.size === size,
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
          : item,
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
    const fulfillmentMethod = fulfillment;

    let address = "Pickup at venue";
    if (fulfillmentMethod === "delivery") {
      const houseNo = String(formData.get("houseNo") ?? "").trim();
      const street = String(formData.get("street") ?? "").trim();
      const barangay = String(formData.get("barangay") ?? "").trim();
      const district = String(formData.get("district") ?? "").trim();
      const city = String(formData.get("city") ?? "").trim();
      const zipcode = String(formData.get("zipcode") ?? "").trim();
      const regionLabel = region.toUpperCase();
      if (!houseNo || !street || !barangay || !city || !zipcode) {
        setSubmitError("Please complete all address fields.");
        return;
      }
      address = [
        houseNo,
        street,
        barangay,
        district,
        city,
        regionLabel,
        zipcode,
      ]
        .filter(Boolean)
        .join(", ");
    }

    const paymentMethod = "gcash";
    const gcashReference = String(formData.get("gcashReference") ?? "").trim();
    const receiptFile = formData.get("gcashReceipt");

    if (!fullName || !email || !phone) {
      setSubmitError("Please complete all contact fields.");
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
          : "Unable to submit order. Please try again.",
      );
      setSubmitting(false);
      return;
    }

    setCartItems([]);
    setQuantities((prev) => prev.map(() => 0));
    form.reset();
    setSubmitSuccess("Order received! We'll verify your GCash receipt.");
    setCheckoutOpen(false);
    setCheckoutStep(0);
    setPrivacyConsent(false);
    setFulfillment("pickup");
    setRegion("ncr");
    setConfirmationOpen(true);
    setSubmitting(false);
  };

  return (
    <div className="relative min-h-screen bg-[#0a1116] text-white">
      {/* ── Sticky Navbar ── */}
      <nav className="sticky top-0 z-20 bg-[#0a1116]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="hidden text-[0.7rem] uppercase tracking-widest text-white/30 sm:block">
              Merch Store
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Size Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-4.5 w-4.5"
                aria-hidden="true"
              >
                <path
                  d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 6h18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 10a4 4 0 01-8 0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#E47128] px-1.5 text-[0.6rem] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Bottom divider with brand gradient */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00878F]/30 to-transparent" />
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#081214]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 right-[-5%] h-64 w-64 rounded-full bg-[#00878F]/6 blur-3xl" />
          <div className="absolute bottom-0 left-[-5%] h-48 w-48 rounded-full bg-[#E47128]/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-[#E47128]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-[#E47128]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E47128]" />
                  March 21, 2026
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-white/40">
                  Asia Pacific College
                </span>
              </div>
              <h1 className="font-display text-4xl leading-none sm:text-5xl lg:text-6xl">
                <span className="text-[#00878F]">Arduino </span>
                <span className="text-[#E47128]">Day </span>
                <span className="text-[#21935B]">Philippines</span>
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/45">
                Official merch for builders, creators, and tinkerers. Grab
                limited-edition sets and individual items.
              </p>
            </div>
            <a
              href="#products"
              className="flex-shrink-0 rounded-full bg-[#00878F] px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-[#007078]"
            >
              Shop Now
            </a>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </section>

      {/* ── Product Grid ── */}
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
        {/* Filter & Sort bar */}
        <div
          id="products"
          className="mb-6 flex flex-col gap-4 scroll-mt-28 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2">
            {(["all", "sets", "individual"] as const).map((f) => {
              const labels = {
                all: "All",
                sets: "Sets & Bundles",
                individual: "Individual",
              };
              const isActive = activeFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                    isActive
                      ? "bg-[#00878F] text-white"
                      : "bg-white/5 text-white/40 hover:bg-white/8 hover:text-white/70"
                  }`}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {!merchLoading && !merchError && (
              <span className="text-xs text-white/30">
                {filteredItems.length}{" "}
                {filteredItems.length === 1 ? "item" : "items"}
              </span>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/60 focus:border-[#00878F]/40 focus:outline-none"
            >
              <option value="default" className="bg-[#0d1a1f]">
                Default
              </option>
              <option value="price-asc" className="bg-[#0d1a1f]">
                Price: Low to High
              </option>
              <option value="price-desc" className="bg-[#0d1a1f]">
                Price: High to Low
              </option>
            </select>
          </div>
        </div>

        {merchLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-xl border border-white/6 bg-white/3 p-4"
              >
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
            <p className="text-sm text-white/50">
              No merch is available yet. Check back soon.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item, renderIndex) => {
                const index = item.originalIndex;
                const qty = quantities[index] ?? 0;
                const size = selectedSizes[index];
                const canAdd = qty > 0 && size !== null;
                const isBundle = item.tag !== "Individual Item";

                return (
                  <article
                    key={item.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/6 bg-[#0d1a1f] transition hover:border-white/15"
                  >
                    {/* Product image */}
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({ src: item.image, alt: item.name })
                      }
                      className="relative aspect-square w-full overflow-hidden bg-[#111f26]"
                      aria-label={`View ${item.name} image`}
                    >
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-105"
                        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        priority={renderIndex === 0}
                      />
                      {isBundle && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-[#00878F] px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white">
                          Set
                        </span>
                      )}
                    </button>

                    {/* Product details */}
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      {/* Name + Price */}
                      <div>
                        <h3 className="text-sm font-semibold leading-snug text-white">
                          {item.name}
                        </h3>
                        {isBundle && (
                          <p className="mt-1 text-[0.65rem] leading-relaxed text-white/35">
                            {item.tag}
                          </p>
                        )}
                        <p className="mt-1.5 text-lg font-bold text-[#00878F]">
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
                          <p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-white/40">
                            Size
                          </p>
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
                        <p className="text-[0.65rem] uppercase tracking-wider text-white/40">
                          Qty
                        </p>
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

            {/* Empty filter state */}
            {filteredItems.length === 0 &&
              !merchLoading &&
              !merchError &&
              merchItems.length > 0 && (
                <div className="rounded-xl border border-white/8 bg-white/3 px-6 py-10 text-center">
                  <p className="text-sm text-white/50">
                    No items match this filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("all");
                      setSortBy("default");
                    }}
                    className="mt-3 text-xs font-semibold text-[#00878F] transition hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
          </>
        )}

        {/* ── Order summary bar (like Amazon's "Proceed to checkout" strip) ── */}
        {cartItems.length > 0 && (
          <div
            id="order-form"
            className="mt-10 scroll-mt-32 rounded-xl border border-white/8 bg-[#0d1a1f] p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/50">
                  Subtotal ({cartCount} {cartCount === 1 ? "item" : "items"}):{" "}
                  <span className="text-lg font-bold text-white">
                    PHP {cartSubtotal.toLocaleString()}
                  </span>
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
        className={`fixed left-1/2 top-1/2 z-40 max-h-[92vh] w-[96%] max-w-6xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-2xl border border-white/8 bg-[#0d1a1f] p-6 sm:p-8 transition duration-300 ${
          sizeGuideOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Sizing Guide</h3>
          <button
            type="button"
            onClick={() => setSizeGuideOpen(false)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-white/40">
          Refer to the charts below for accurate sizing. All measurements are in
          centimeters.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#00878F]">
              Shirt Sizing
            </h4>
            <div className="relative mt-4 aspect-[4/3] w-full">
              <Image
                src="/shirt_size.png"
                alt="Shirt sizing guide"
                fill
                className="object-contain"
                sizes="(min-width: 768px) 45vw, 90vw"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#00878F]">
              Vest Sizing
            </h4>
            <div className="relative mt-4 aspect-[4/3] w-full">
              <Image
                src="/vest_size.png"
                alt="Vest sizing guide"
                fill
                className="object-contain"
                sizes="(min-width: 768px) 45vw, 90vw"
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

      {/* ── Checkout Modal (3-step wizard) ── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!checkoutOpen}
        className={`checkout-scroll fixed left-1/2 top-1/2 z-40 max-h-[90vh] w-[94%] max-w-2xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-2xl border border-white/8 bg-[#0d1a1f] transition duration-300 ${
          checkoutOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {/* Checkout header */}
        <div className="sticky top-0 z-10 border-b border-white/8 bg-[#0d1a1f] px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Checkout</h3>
            <button
              type="button"
              onClick={() => {
                setCheckoutOpen(false);
                setCheckoutStep(0);
              }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </div>

          {/* Step dots */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {["Data Privacy", "Personal Info", "Fulfillment & Payment"].map(
              (label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (i === 0) setCheckoutStep(0);
                    if (i === 1 && privacyConsent) setCheckoutStep(1);
                    if (i === 2 && privacyConsent) setCheckoutStep(2);
                  }}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      checkoutStep === i
                        ? "bg-[#00878F] text-white"
                        : checkoutStep > i
                          ? "bg-[#21935B] text-white"
                          : "bg-white/10 text-white/40"
                    }`}
                  >
                    {checkoutStep > i ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 12.5l4.5 4.5L19 7.5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={`hidden text-xs sm:inline ${
                      checkoutStep === i ? "text-white" : "text-white/40"
                    }`}
                  >
                    {label}
                  </span>
                  {i < 2 && (
                    <span className="hidden h-px w-6 bg-white/10 sm:block" />
                  )}
                </button>
              ),
            )}
          </div>
        </div>

        <form className="p-6" onSubmit={handleSubmit}>
          {/* ── Step 1: Data Privacy ── */}
          {checkoutStep === 0 && (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <h4 className="text-sm font-semibold text-white">
                  Data Privacy Consent
                </h4>
                <p className="mt-3 text-xs leading-relaxed text-white/50">
                  By proceeding with this order, you agree to the collection and
                  processing of your personal data (full name, email address,
                  and contact number) solely for the purpose of fulfilling your
                  Arduino Day Philippines 2026 merch order. Your information
                  will not be shared with third parties and will be stored
                  securely. You may request deletion of your data by contacting
                  the organizers.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-white/50">
                  In compliance with the{" "}
                  <span className="text-white/70">Republic Act No. 10173</span>{" "}
                  (Data Privacy Act of 2012), we ensure that your personal
                  information is handled with strict confidentiality.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-[#00878F] focus:ring-[#00878F]/30"
                />
                <span className="text-sm text-white/70">
                  I have read and agree to the data privacy terms above.
                </span>
              </label>
              <button
                type="button"
                disabled={!privacyConsent}
                onClick={() => setCheckoutStep(1)}
                className="w-full rounded-lg bg-[#00878F] py-3 text-sm font-bold text-white transition hover:bg-[#007078] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Personal Info ── */}
          {checkoutStep === 1 && (
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">
                Personal Information
              </h4>

              <label className="flex flex-col gap-1.5 text-xs text-white/50">
                Full Name
                <input
                  type="text"
                  name="fullName"
                  placeholder="Juan Dela Cruz"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                />
                <span className="text-[0.65rem] text-white/30">
                  First name, middle initial, last name
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs text-white/50">
                Email Address
                <input
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                />
                <span className="text-[0.65rem] text-white/30">
                  We will send order updates to this email
                </span>
              </label>

              <label className="flex flex-col gap-1.5 text-xs text-white/50">
                Contact Number
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="09XX XXX XXXX"
                  pattern="[0-9\s\-\+]{10,15}"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                />
                <span className="text-[0.65rem] text-white/30">
                  Format: 09XX XXX XXXX (Philippine mobile number)
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutStep(0)}
                  className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutStep(2)}
                  className="flex-1 rounded-lg bg-[#00878F] py-2.5 text-sm font-bold text-white transition hover:bg-[#007078]"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Fulfillment & Payment ── */}
          {checkoutStep === 2 && (
            <div className="flex flex-col gap-5">
              {/* Fulfillment */}
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">
                  Fulfillment
                </h4>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFulfillment("pickup")}
                    className={`flex-1 rounded-lg border py-3 text-sm font-semibold transition ${
                      fulfillment === "pickup"
                        ? "border-[#00878F] bg-[#00878F]/10 text-[#00878F]"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    Pickup at Venue
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillment("delivery")}
                    className={`flex-1 rounded-lg border py-3 text-sm font-semibold transition ${
                      fulfillment === "delivery"
                        ? "border-[#00878F] bg-[#00878F]/10 text-[#00878F]"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    Delivery
                  </button>
                </div>
                <input
                  type="hidden"
                  name="fulfillmentMethod"
                  value={fulfillment}
                />
              </div>

              {/* Delivery address fields */}
              {fulfillment === "delivery" && (
                <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    Delivery Address
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-[#E47128]/10 px-3 py-2 text-xs text-[#E47128]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4 flex-shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Delivery orders will be shipped after March 21, 2026.
                    Shipping fees may apply depending on your location.
                  </div>

                  {/* Region toggle */}
                  <div>
                    <p className="mb-2 text-xs text-white/40">Region</p>
                    <div className="grid grid-cols-4 gap-1.5 rounded-lg border border-white/8 bg-white/3 p-1">
                      {(["ncr", "luzon", "visayas", "mindanao"] as const).map(
                        (r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRegion(r)}
                            className={`rounded-md py-1.5 text-xs font-semibold uppercase transition ${
                              region === r
                                ? "bg-[#00878F] text-white"
                                : "text-white/40 hover:text-white/70"
                            }`}
                          >
                            {r === "ncr"
                              ? "NCR"
                              : r.charAt(0).toUpperCase() + r.slice(1)}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      House / Unit No.
                      <input
                        type="text"
                        name="houseNo"
                        placeholder="123"
                        required
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      Street
                      <input
                        type="text"
                        name="street"
                        placeholder="Rizal St."
                        required
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      Barangay
                      <input
                        type="text"
                        name="barangay"
                        placeholder="Brgy. San Antonio"
                        required
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      District
                      <input
                        type="text"
                        name="district"
                        placeholder="District 1 (optional)"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      City / Municipality
                      <input
                        type="text"
                        name="city"
                        placeholder="Makati City"
                        required
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-white/50">
                      Zip Code
                      <input
                        type="text"
                        name="zipcode"
                        placeholder="1200"
                        pattern="[0-9]{4}"
                        required
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                      />
                    </label>
                  </div>
                </div>
              )}

              {fulfillment === "pickup" && (
                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <p className="text-sm text-white/60">
                    Pick up your order at{" "}
                    <span className="text-white">
                      Asia Pacific College, Makati
                    </span>{" "}
                    on March 21, 2026.
                  </p>
                </div>
              )}

              {/* Payment */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Payment via GCash
                </p>
                <p className="mt-1.5 text-xs text-white/40">
                  Scan the QR code below to send payment, then upload your
                  receipt to confirm the order.
                </p>

                {/* GCash QR Code */}
                <div className="mt-4 flex justify-center">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-white p-2">
                    <div className="relative h-48 w-48 sm:h-56 sm:w-56">
                      <Image
                        src="/gcash-qr.jpg"
                        alt="GCash QR Code - Scan to pay"
                        fill
                        className="object-contain"
                        sizes="224px"
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-center text-[0.65rem] text-white/30">
                  Scan with your GCash app to send payment
                </p>

                <label className="mt-4 flex flex-col gap-1 text-xs text-white/50">
                  GCash Reference No.
                  <input
                    type="text"
                    name="gcashReference"
                    placeholder="0000000000"
                    required
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[#00878F]/50 focus:outline-none focus:ring-1 focus:ring-[#00878F]/30"
                  />
                  <span className="text-[0.65rem] text-white/30">
                    13-digit reference number from GCash
                  </span>
                </label>

                <label className="mt-3 flex flex-col gap-1 text-xs text-white/50">
                  GCash Receipt Screenshot
                  <input
                    type="file"
                    name="gcashReceipt"
                    accept="image/*"
                    required
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white/70"
                  />
                </label>
              </div>

              {/* Order Summary */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Order Summary
                </h4>
                <div className="mt-3 flex flex-col gap-2">
                  {cartItems.map((item, cIndex) => (
                    <div
                      key={`summary-${item.name}-${item.size}-${cIndex}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex-1">
                        <p className="text-white/80">{item.name}</p>
                        <p className="text-xs text-white/40">
                          {item.size} x {item.quantity}
                        </p>
                      </div>
                      <span className="text-white/70">
                        PHP {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-white/8 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white/60">
                      Total
                    </span>
                    <span className="text-lg font-bold text-[#00878F]">
                      PHP {cartSubtotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutStep(1)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#E47128] py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#d0641f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Place Order"}
                </button>
              </div>
            </div>
          )}
        </form>
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
          <h3 className="text-sm font-semibold text-white/50">Image Preview</h3>
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
