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
    <div className="relative min-h-screen overflow-hidden bg-[#050b0e] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-[-10%] h-96 w-96 rounded-full bg-[#00878F]/10 blur-3xl" />
        <div className="absolute top-20 right-[-8%] h-[28rem] w-[28rem] rounded-full bg-[#E47128]/8 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[30%] h-96 w-96 rounded-full bg-[#21935B]/8 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-8">
          <div className="fade-up inline-flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.2em] text-white/70">
            <span className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#E47128]" />
              March 21, 2026
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span>Asia Pacific College, Makati</span>
          </div>

          <div className="fade-up fade-delay-1 flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="font-display text-5xl leading-[0.95] text-white sm:text-6xl lg:text-7xl">
                <span className="block text-[#00878F]">Arduino</span>
                <span className="block text-[#E47128]">Day</span>
                <span className="block text-[#21935B]">Philippines</span>
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
              className="rounded-full bg-[#00878F] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#007078]"
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
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#E47128] px-1 text-[0.6rem] font-semibold text-white">
                {cartCount}
              </span>
            </button>
          </div>
        </header>

        <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {merchLoading ? (
            <div className="glass-panel fade-up rounded-3xl p-6 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-white/70">Loading merch...</p>
            </div>
          ) : merchError ? (
            <div className="glass-panel fade-up rounded-3xl p-6 md:col-span-2 lg:col-span-3">
              <p className="text-sm text-[#E47128]">{merchError}</p>
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
                className="glass-panel fade-up rounded-3xl p-7"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPreviewImage({ src: item.image, alt: item.name })
                  }
                  className={`relative h-52 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${item.tone}`}
                  aria-label={`View ${item.name} image`}
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    priority={index === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                </button>
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
                    <span className="inline-flex rounded-full border border-[#21935B]/40 bg-[#21935B]/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/90">
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
                              ? "border-[#21935B]/80 bg-[#21935B]/20 text-white/90"
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
        <div
          className={`fixed inset-0 z-20 bg-black/60 transition ${
            checkoutOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setCheckoutOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-black/60 transition ${
            confirmationOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setConfirmationOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-black/70 transition ${
            previewImage ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setPreviewImage(null)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!sizeGuideOpen}
          className={`fixed left-1/2 top-1/2 z-30 max-h-[85vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-3xl border border-white/10 bg-[#050b0e] p-6 transition duration-300 ${
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
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
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
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
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
        <aside
          className={`checkout-scroll fixed right-0 top-0 z-30 h-full w-full max-w-md transform overflow-y-auto border-l border-white/10 bg-[#050b0e] p-6 transition duration-300 ${
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
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    ) : null}
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-white/60">
                        Size {item.size} · Qty {item.quantity}
                      </p>
                    </div>
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

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-white/60">
              Subtotal
            </span>
            <span className="text-sm font-semibold text-white">
              PHP {cartSubtotal.toFixed(0)}
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                setCheckoutOpen(true);
              }}
              className="rounded-full bg-[#00878F] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#007078]"
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

        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!checkoutOpen}
          className={`checkout-scroll fixed left-1/2 top-1/2 z-30 max-h-[85vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto rounded-3xl border border-white/10 bg-[#050b0e] p-6 transition duration-300 ${
            checkoutOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Place Your Order</h3>
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-sm leading-6 text-white/70">
                Fill up the form and attach your GCash receipt to confirm your
                merch order.
              </p>
              <div className="mt-6 grid gap-4 text-xs uppercase tracking-[0.25em] text-white/60">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#E47128]" />
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
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#21935B]/70 focus:outline-none focus:ring-2 focus:ring-[#21935B]/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Email
                <input
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#21935B]/70 focus:outline-none focus:ring-2 focus:ring-[#21935B]/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Contact Number
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="0917 000 0000"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#21935B]/70 focus:outline-none focus:ring-2 focus:ring-[#21935B]/30"
                />
              </label>

              <label className="text-sm text-white/80">
                Address
                <input
                  type="text"
                  name="address"
                  placeholder="House No., Street, City"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#21935B]/70 focus:outline-none focus:ring-2 focus:ring-[#21935B]/30"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  Fulfillment Method
                </p>
                <label className="mt-3 flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="pickup"
                    defaultChecked
                    className="h-4 w-4 border-white/30 bg-white/10 text-[#21935B] focus:ring-[#21935B]/40"
                  />
                  Pickup
                </label>
                <label className="mt-2 flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="radio"
                    name="fulfillmentMethod"
                    value="delivery"
                    className="h-4 w-4 border-white/30 bg-white/10 text-[#21935B] focus:ring-[#21935B]/40"
                  />
                  Delivery
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  Payment Method
                </p>
                <label className="mt-3 flex items-center gap-3 text-sm text-white/80">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    defaultChecked
                    className="h-4 w-4 border-white/30 bg-white/10 text-[#21935B] focus:ring-[#21935B]/40"
                  />
                  GCash
                </label>
                <p className="mt-2 text-xs text-white/60">
                  Upload your GCash receipt before confirming the order.
                </p>
              </div>

              <label className="text-sm text-white/80">
                GCash Reference No.
                <input
                  type="text"
                  name="gcashReference"
                  placeholder="0000000000"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-[#21935B]/70 focus:outline-none focus:ring-2 focus:ring-[#21935B]/30"
                />
              </label>

              <label className="text-sm text-white/80">
                GCash Receipt Screenshot
                <input
                  type="file"
                  name="gcashReceipt"
                  accept="image/*"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-white/80"
                />
              </label>

              {submitError ? (
                <p className="text-xs uppercase tracking-[0.2em] text-[#E47128]">
                  {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p className="text-xs uppercase tracking-[0.2em] text-[#21935B]">
                  {submitSuccess}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-full bg-[#00878F] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#007078] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Order"}
              </button>
            </form>
          </div>
        </aside>

        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!confirmationOpen}
          className={`fixed left-1/2 top-1/2 z-30 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-3xl border border-white/10 bg-[#050b0e] p-6 text-center transition duration-300 ${
            confirmationOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#21935B]/50 bg-[#21935B]/15">
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
          <p className="mt-2 text-sm text-white/70">
            We received your order and will verify your GCash receipt shortly.
          </p>
          <button
            type="button"
            onClick={() => setConfirmationOpen(false)}
            className="mt-5 rounded-full border border-white/20 px-6 py-2 text-xs uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Close
          </button>
        </aside>

        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!previewImage}
          className={`fixed left-1/2 top-1/2 z-30 w-[94%] max-w-5xl -translate-x-1/2 -translate-y-1/2 transform rounded-3xl border border-white/10 bg-[#050b0e] p-4 transition duration-300 ${
            previewImage
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
              Image Preview
            </h3>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="relative mt-4 h-[70vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
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

        {cartToast ? (
          <div className="cart-toast pointer-events-none fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#21935B]/40 bg-[#21935B]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:right-6 md:left-auto md:translate-x-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="h-4 w-4 text-[#21935B]"
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

        <footer className="mt-8 border-t border-white/10 pt-6 text-center text-xs uppercase tracking-[0.2em] text-white/60">
          Arduino Day Philippines 2026 · Merch Orders
        </footer>
      </main>
    </div>
  );
}
