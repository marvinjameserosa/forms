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
        setMerchError("Unable to load collection.");
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
    setCartToast(`${merchItem.name} added to bag`);
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
      setSubmitError("Add items to your bag before submitting.");
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
      setSubmitError("Please complete all fields.");
      return;
    }

    if (paymentMethod !== "gcash") {
      setSubmitError("Select GCash as your payment method.");
      return;
    }

    if (fulfillmentMethod !== "pickup" && fulfillmentMethod !== "delivery") {
      setSubmitError("Select pickup or delivery.");
      return;
    }

    if (!gcashReference) {
      setSubmitError("Enter your GCash reference number.");
      return;
    }

    if (!(receiptFile instanceof File) || receiptFile.size === 0) {
      setSubmitError("Upload your GCash receipt.");
      return;
    }

    if (!receiptFile.type.startsWith("image/")) {
      setSubmitError("Receipt must be an image file.");
      return;
    }

    if (receiptFile.size > MAX_RECEIPT_SIZE) {
      setSubmitError("Receipt image must be under 5MB.");
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
    setSubmitSuccess("Order placed successfully.");
    setCheckoutOpen(false);
    setConfirmationOpen(true);
    setSubmitting(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Subtle ambient lighting - toned down for luxury */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-60 left-[-15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(10,122,122,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute top-40 right-[-12%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(240,138,26,0.1),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(30,166,107,0.1),transparent_70%)] blur-3xl" />
      </div>

      {/* Navigation bar */}
      <nav className="fade-up relative z-20 flex items-center justify-between px-6 py-6 lg:px-12">
        <span className="font-serif text-2xl font-light tracking-wide text-foreground">
          ADPH
        </span>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setSizeGuideOpen(true)}
            className="text-xs font-light uppercase tracking-[0.2em] text-foreground/50 transition hover:text-foreground"
          >
            Size Guide
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative text-xs font-light uppercase tracking-[0.2em] text-foreground/50 transition hover:text-foreground"
          >
            Bag
            {cartCount > 0 && (
              <span className="absolute -right-4 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--teal)] px-1 text-[0.55rem] font-medium text-foreground">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 lg:px-12">
        {/* Hero Section - editorial luxury */}
        <header className="flex flex-col items-center py-16 lg:py-24">
          <div className="fade-up text-center">
            <p className="text-[0.65rem] font-light uppercase tracking-[0.35em] text-foreground/40">
              March 21, 2026 &mdash; Asia Pacific College, Makati
            </p>
          </div>

          <div className="fade-up fade-delay-1 mt-8 flex flex-col items-center text-center">
            <h1 className="font-serif text-6xl font-light leading-[1.05] text-foreground sm:text-7xl lg:text-[6.5rem]">
              <span className="block text-balance">Arduino Day</span>
              <span className="block italic text-[var(--teal)]">Philippines</span>
              <span className="block text-balance">2026</span>
            </h1>
            <div className="luxury-divider mx-auto mt-10 w-16" />
            <p className="mt-8 max-w-lg text-sm font-light leading-relaxed text-foreground/50">
              A curated capsule for builders, creators, and tinkerers.
              Explore the collection below.
            </p>
          </div>

          <div className="fade-up fade-delay-2 mt-10 flex items-center gap-6">
            <a
              href="#collection"
              className="border-b border-foreground/30 pb-1 text-xs font-light uppercase tracking-[0.25em] text-foreground/70 transition hover:border-foreground hover:text-foreground"
            >
              Shop Collection
            </a>
            <span className="text-foreground/15">|</span>
            <a
              href="#order-form"
              className="border-b border-foreground/30 pb-1 text-xs font-light uppercase tracking-[0.25em] text-foreground/70 transition hover:border-foreground hover:text-foreground"
            >
              Place Order
            </a>
          </div>
        </header>

        {/* Collection Grid */}
        <section id="collection" className="scroll-mt-8">
          <div className="fade-up mb-12 flex items-center gap-6">
            <div className="luxury-divider flex-1" />
            <h2 className="font-serif text-lg font-light tracking-wide text-foreground/60">
              The Collection
            </h2>
            <div className="luxury-divider flex-1" />
          </div>

          <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
            {merchLoading ? (
              <div className="fade-up bg-background p-12 md:col-span-2 xl:col-span-3">
                <p className="text-center text-xs font-light uppercase tracking-[0.2em] text-foreground/40">
                  Loading collection...
                </p>
              </div>
            ) : merchError ? (
              <div className="fade-up bg-background p-12 md:col-span-2 xl:col-span-3">
                <p className="text-center text-xs font-light uppercase tracking-[0.2em] text-[var(--amber)]">
                  {merchError}
                </p>
              </div>
            ) : merchItems.length === 0 ? (
              <div className="fade-up bg-background p-12 md:col-span-2 xl:col-span-3">
                <p className="text-center text-xs font-light uppercase tracking-[0.2em] text-foreground/40">
                  Collection coming soon.
                </p>
              </div>
            ) : (
              merchItems.map((item, index) => (
                <article
                  key={item.id}
                  className="fade-up group flex flex-col bg-background"
                >
                  {/* Product image - tall editorial crop */}
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({ src: item.image, alt: item.name })
                    }
                    className={`relative aspect-[3/4] w-full overflow-hidden bg-[#0a1116]`}
                    aria-label={`View ${item.name}`}
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050b0e]/60 via-transparent to-transparent" />
                    {/* Tag overlay */}
                    <span className="absolute bottom-4 left-4 text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/60">
                      {item.tag}
                    </span>
                  </button>

                  {/* Product details */}
                  <div className="flex flex-col gap-5 p-6">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-serif text-xl font-light text-foreground">
                        {item.name}
                      </h3>
                      <p className="text-sm font-light tabular-nums text-foreground/70">
                        PHP {(item.price ?? 0).toFixed(0)}
                      </p>
                    </div>

                    {/* Size selector */}
                    {item.sizes.length === 1 ? (
                      <div>
                        <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                          {item.sizes[0]}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {item.sizes.map((size) => {
                          const isSelected = selectedSizes[index] === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => selectSize(index, size)}
                              className={`border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.25em] transition ${
                                isSelected
                                  ? "border-foreground/60 bg-foreground/10 text-foreground"
                                  : "border-border text-foreground/40 hover:border-foreground/30 hover:text-foreground/70"
                              }`}
                              aria-pressed={isSelected}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Quantity + Add to bag */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 border border-border px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => adjustQuantity(index, -1)}
                          className="flex h-6 w-6 items-center justify-center text-sm text-foreground/40 transition hover:text-foreground"
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
                          className="w-8 bg-transparent text-center text-xs text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => adjustQuantity(index, 1)}
                          className="flex h-6 w-6 items-center justify-center text-sm text-foreground/40 transition hover:text-foreground"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(index)}
                        disabled={
                          quantities[index] <= 0 || selectedSizes[index] === null
                        }
                        className="flex-1 border border-foreground/20 bg-transparent py-2 text-[0.6rem] uppercase tracking-[0.25em] text-foreground/70 transition hover:border-foreground/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Add to Bag
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Overlays */}
        <div
          className={`fixed inset-0 z-20 bg-[#050b0e]/80 backdrop-blur-sm transition duration-300 ${
            cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setCartOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-[#050b0e]/80 backdrop-blur-sm transition duration-300 ${
            sizeGuideOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setSizeGuideOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-[#050b0e]/80 backdrop-blur-sm transition duration-300 ${
            checkoutOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setCheckoutOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-[#050b0e]/80 backdrop-blur-sm transition duration-300 ${
            confirmationOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setConfirmationOpen(false)}
        />
        <div
          className={`fixed inset-0 z-20 bg-[#050b0e]/90 transition duration-300 ${
            previewImage ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setPreviewImage(null)}
        />

        {/* Size Guide Modal */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!sizeGuideOpen}
          className={`fixed left-1/2 top-1/2 z-30 max-h-[85vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto border border-border bg-background p-8 transition duration-300 ${
            sizeGuideOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-2xl font-light text-foreground">
              Size Guide
            </h3>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(false)}
              className="text-xs font-light uppercase tracking-[0.2em] text-foreground/40 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="luxury-divider mt-6" />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="border border-border p-5">
              <h4 className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                Shirt Sizing
              </h4>
              <div className="relative mt-4 aspect-[4/3] w-full">
                <Image
                  src="/shirt_size.png"
                  alt="Shirt sizing guide"
                  fill
                  className="object-contain"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
              </div>
            </div>
            <div className="border border-border p-5">
              <h4 className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                Vest Sizing
              </h4>
              <div className="relative mt-4 aspect-[4/3] w-full">
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

        {/* Cart Drawer */}
        <aside
          className={`checkout-scroll fixed right-0 top-0 z-30 h-full w-full max-w-md transform overflow-y-auto border-l border-border bg-background p-8 transition duration-300 ${
            cartOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-2xl font-light text-foreground">
              Your Bag
            </h3>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="text-xs font-light uppercase tracking-[0.2em] text-foreground/40 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="luxury-divider mt-6" />

          <div className="mt-6 flex flex-col gap-4">
            {cartItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-serif text-lg font-light italic text-foreground/30">
                  Your bag is empty
                </p>
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div
                  key={`${item.name}-${item.size}-${index}`}
                  className="flex items-center justify-between border-b border-border pb-4"
                >
                  <div className="flex items-center gap-4">
                    {item.image ? (
                      <div className="relative h-16 w-12 overflow-hidden bg-[#0a1116]">
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
                      <p className="text-sm font-light text-foreground">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] font-light text-foreground/40">
                        {item.size} &mdash; Qty {item.quantity}
                      </p>
                      <p className="mt-0.5 text-xs font-light text-foreground/60">
                        PHP {(item.price * item.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(index)}
                    className="text-[0.6rem] font-light uppercase tracking-[0.2em] text-foreground/30 transition hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              <div className="luxury-divider mt-6" />
              <div className="mt-6 flex items-center justify-between">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Total
                </span>
                <span className="font-serif text-lg font-light text-foreground">
                  PHP {cartSubtotal.toFixed(0)}
                </span>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  className="w-full bg-foreground py-3.5 text-[0.65rem] font-light uppercase tracking-[0.25em] text-background transition hover:bg-foreground/90"
                >
                  Proceed to Checkout
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  className="w-full border border-border py-3 text-[0.65rem] font-light uppercase tracking-[0.25em] text-foreground/50 transition hover:border-foreground/30 hover:text-foreground"
                  disabled={cartItems.length === 0}
                >
                  Clear Bag
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Checkout Modal */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!checkoutOpen}
          className={`checkout-scroll fixed left-1/2 top-1/2 z-30 max-h-[85vh] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2 transform overflow-y-auto border border-border bg-background p-8 transition duration-300 ${
            checkoutOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-2xl font-light text-foreground">
              Checkout
            </h3>
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="text-xs font-light uppercase tracking-[0.2em] text-foreground/40 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="luxury-divider mt-6" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="font-serif text-lg font-light italic text-foreground/50">
                Complete your details and attach your GCash receipt to confirm
                your order.
              </p>
              <div className="luxury-divider mt-6" />
              <div className="mt-6">
                <p className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/30">
                  Order Summary
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-foreground/60">
                      <span>{item.name} ({item.size}) x{item.quantity}</span>
                      <span>PHP {(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="luxury-divider mt-2" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">Total</span>
                    <span className="font-serif text-base text-foreground">PHP {cartSubtotal.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Full Name
                </span>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Juan Dela Cruz"
                  required
                  className="border-b border-border bg-transparent pb-2 text-sm font-light text-foreground placeholder:text-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Email
                </span>
                <input
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  required
                  className="border-b border-border bg-transparent pb-2 text-sm font-light text-foreground placeholder:text-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Contact Number
                </span>
                <input
                  type="tel"
                  name="contactNumber"
                  placeholder="0917 000 0000"
                  required
                  className="border-b border-border bg-transparent pb-2 text-sm font-light text-foreground placeholder:text-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Address
                </span>
                <input
                  type="text"
                  name="address"
                  placeholder="House No., Street, City"
                  required
                  className="border-b border-border bg-transparent pb-2 text-sm font-light text-foreground placeholder:text-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </label>

              <div className="border border-border p-5">
                <p className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Fulfillment
                </p>
                <div className="mt-4 flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-light text-foreground/60 cursor-pointer">
                    <input
                      type="radio"
                      name="fulfillmentMethod"
                      value="pickup"
                      defaultChecked
                      className="h-3.5 w-3.5 border-foreground/20 bg-transparent text-[var(--teal)] focus:ring-[var(--teal)]/30"
                    />
                    Pickup
                  </label>
                  <label className="flex items-center gap-2 text-xs font-light text-foreground/60 cursor-pointer">
                    <input
                      type="radio"
                      name="fulfillmentMethod"
                      value="delivery"
                      className="h-3.5 w-3.5 border-foreground/20 bg-transparent text-[var(--teal)] focus:ring-[var(--teal)]/30"
                    />
                    Delivery
                  </label>
                </div>
              </div>

              <div className="border border-border p-5">
                <p className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Payment
                </p>
                <label className="mt-4 flex items-center gap-2 text-xs font-light text-foreground/60 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    defaultChecked
                    className="h-3.5 w-3.5 border-foreground/20 bg-transparent text-[var(--teal)] focus:ring-[var(--teal)]/30"
                  />
                  GCash
                </label>
                <p className="mt-2 text-[0.6rem] font-light text-foreground/30">
                  Attach your receipt screenshot below.
                </p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  GCash Reference No.
                </span>
                <input
                  type="text"
                  name="gcashReference"
                  placeholder="0000000000"
                  required
                  className="border-b border-border bg-transparent pb-2 text-sm font-light text-foreground placeholder:text-foreground/20 focus:border-foreground/40 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
                  Receipt Screenshot
                </span>
                <input
                  type="file"
                  name="gcashReceipt"
                  accept="image/*"
                  required
                  className="text-xs font-light text-foreground/50 file:mr-3 file:border file:border-border file:bg-transparent file:px-4 file:py-2 file:text-[0.6rem] file:uppercase file:tracking-[0.2em] file:text-foreground/50 file:cursor-pointer hover:file:border-foreground/30 hover:file:text-foreground"
                />
              </label>

              {submitError ? (
                <p className="text-[0.65rem] font-light uppercase tracking-[0.15em] text-[var(--amber)]">
                  {submitError}
                </p>
              ) : null}
              {submitSuccess ? (
                <p className="text-[0.65rem] font-light uppercase tracking-[0.15em] text-[var(--green)]">
                  {submitSuccess}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full bg-foreground py-3.5 text-[0.65rem] font-light uppercase tracking-[0.25em] text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Placing Order..." : "Place Order"}
              </button>
            </form>
          </div>
        </aside>

        {/* Confirmation Modal */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!confirmationOpen}
          className={`fixed left-1/2 top-1/2 z-30 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 transform border border-border bg-background p-10 text-center transition duration-300 ${
            confirmationOpen
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0"
          }`}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[var(--green)]/40">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="h-5 w-5 text-[var(--green)]"
            >
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mt-6 font-serif text-2xl font-light text-foreground">
            Order Confirmed
          </h3>
          <p className="mt-3 text-xs font-light leading-relaxed text-foreground/50">
            We received your order and will verify your GCash receipt shortly.
          </p>
          <div className="luxury-divider mx-auto mt-6 w-12" />
          <button
            type="button"
            onClick={() => setConfirmationOpen(false)}
            className="mt-6 border border-border px-8 py-2.5 text-[0.6rem] font-light uppercase tracking-[0.25em] text-foreground/60 transition hover:border-foreground/30 hover:text-foreground"
          >
            Continue Shopping
          </button>
        </aside>

        {/* Image Preview Modal */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-hidden={!previewImage}
          className={`fixed left-1/2 top-1/2 z-30 w-[94%] max-w-5xl -translate-x-1/2 -translate-y-1/2 transform border border-border bg-background p-4 transition duration-300 ${
            previewImage
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.98] opacity-0"
          }`}
        >
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[0.6rem] font-light uppercase tracking-[0.3em] text-foreground/40">
              Preview
            </h3>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="text-xs font-light uppercase tracking-[0.2em] text-foreground/40 transition hover:text-foreground"
            >
              Close
            </button>
          </div>
          <div className="relative mt-3 h-[70vh] w-full overflow-hidden bg-[#0a1116]">
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

        {/* Toast */}
        {cartToast ? (
          <div className="cart-toast pointer-events-none fixed bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 border border-border bg-background px-6 py-3 text-[0.6rem] font-light uppercase tracking-[0.25em] text-foreground/70 md:right-8 md:left-auto md:translate-x-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="h-3.5 w-3.5 text-[var(--green)]"
            >
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{cartToast}</span>
          </div>
        ) : null}

        {/* Footer */}
        <footer className="mt-20">
          <div className="luxury-divider" />
          <div className="flex flex-col items-center gap-3 pt-8">
            <span className="font-serif text-lg font-light tracking-wide text-foreground/30">
              ADPH
            </span>
            <p className="text-[0.55rem] font-light uppercase tracking-[0.35em] text-foreground/20">
              Arduino Day Philippines 2026
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
