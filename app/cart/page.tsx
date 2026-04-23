"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Minus, Plus, Trash2, Tag, Lock, Package, RotateCcw } from "lucide-react";
import { useCart } from "@/lib/cartContext";

const DELIVERY_FEE = 60;

export default function CartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();
  const [promoCode, setPromoCode] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const router = useRouter();

  // Sentinel — sticky checkout bar shows when promo section scrolls off-screen
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyCheckout, setShowStickyCheckout] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyCheckout(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const orderTotal = totalPrice + DELIVERY_FEE;

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-gray-300" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-darkColor">Your cart is empty</h1>
          <p className="text-sm text-gray-400">
            Looks like you haven&apos;t added anything yet.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg bg-brand_red text-white font-semibold text-sm hover:bg-brand_red_hover transition-colors"
          >
            Browse Products
          </Link>
          <Link
            href="/#featured"
            className="inline-flex items-center justify-center h-12 px-6 rounded-lg border-2 border-brand_green text-brand_green font-semibold text-sm hover:bg-brand_green/5 transition-colors"
          >
            View Featured
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          Looking for something specific?{" "}
          <Link
            href="/custom-order"
            className="underline underline-offset-2 hover:text-darkColor transition-colors"
          >
            Try our custom order page
          </Link>
        </p>
      </div>
    );
  }

  // ── Order summary card (shared desktop/mobile) ────────────────────────────────
  const summaryCard = (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="text-base font-bold text-darkColor">Order Summary</h2>

      {/* Line items */}
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">
            Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})
          </span>
          <span className="font-semibold text-darkColor">
            K {totalPrice.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Delivery</span>
          <span className="text-gray-500">
            K {DELIVERY_FEE} <span className="text-[11px]">(Lusaka)</span>
          </span>
        </div>
        <p className="text-[11px] text-gray-400 italic">
          Delivery fee confirmed at checkout based on your location.
        </p>
      </div>

      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
        <span className="font-bold text-darkColor">Total</span>
        <span className="text-lg font-bold text-darkColor">
          K {orderTotal.toLocaleString()}
        </span>
      </div>

      {/* Promo code */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" /> Promo Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
            className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green focus:ring-1 focus:ring-brand_green/20"
          />
          <button className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
            Apply
          </button>
        </div>
      </div>

      {/* Sentinel — sticky bar appears once this scrolls off-screen (mobile only) */}
      <div ref={sentinelRef} aria-hidden />

      {/* Checkout button — always visible on desktop; on mobile only when sentinel is in view */}
      <button
        onClick={() => router.push("/checkout")}
        className={`w-full h-12 rounded-lg bg-brand_red text-white font-semibold text-sm uppercase tracking-widest hover:bg-brand_red_hover transition-colors md:block ${
          showStickyCheckout ? "hidden" : "block"
        }`}
      >
        Proceed to Checkout
      </button>

      {/* Continue shopping */}
      <p className="text-center">
        <Link
          href="/shop"
          className="text-sm text-brand_green hover:text-brand_green_hover underline underline-offset-2 transition-colors"
        >
          Continue Shopping
        </Link>
      </p>

      {/* Trust badges */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Secure Checkout</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span>Free delivery on orders over K500</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Easy returns within 7 days</span>
        </div>
      </div>
    </div>
  );

  // ── Cart items list ───────────────────────────────────────────────────────────
  const itemsList = (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
        >
          <div className="flex gap-4">
            {/* Product image */}
            <Link href={`/product/${item.productId}`} className="shrink-0">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                    No img
                  </div>
                )}
              </div>
            </Link>

            {/* Right side */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Name */}
              <Link href={`/product/${item.productId}`}>
                <p className="font-semibold text-darkColor text-sm leading-snug hover:text-brand_green transition-colors line-clamp-2">
                  {item.name}
                </p>
              </Link>

              {/* Color */}
              {item.colorName && (
                <p className="flex items-center gap-1.5 text-xs text-lightColor">
                  {item.colorHex && (
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  )}
                  {item.colorName}
                </p>
              )}

              {/* Size */}
              {item.size && (
                <p className="text-xs text-lightColor">Size: {item.size}</p>
              )}

              {/* Price */}
              <p className="text-sm font-bold text-brand_green">
                K {item.price.toLocaleString()}
              </p>

              {/* Qty controls + remove + subtotal */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {/* Quantity stepper */}
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-darkColor border-x border-gray-300 select-none">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                      aria-label="Increase quantity"
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Remove — inline confirmation */}
                  {confirmingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Remove item?</span>
                      <button
                        onClick={() => { removeFromCart(item.id); setConfirmingId(null); }}
                        className="text-xs font-semibold text-brand_red hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="text-xs font-semibold text-gray-500 hover:underline"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(item.id)}
                      className="flex items-center gap-1 text-xs text-lightColor hover:text-brand_red transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                {/* Item subtotal */}
                <p className="text-sm font-bold text-darkColor">
                  K {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">

        {/* Page title */}
        <h1 className="text-xl md:text-2xl font-bold text-darkColor mb-6">
          My Cart
          <span className="ml-2 text-base font-normal text-gray-400">
            ({totalItems} item{totalItems !== 1 ? "s" : ""})
          </span>
        </h1>

        {/* ── DESKTOP: two-column ── */}
        <div className="hidden md:grid md:grid-cols-[65%_35%] md:gap-6 items-start">
          {/* Left — items */}
          <div>{itemsList}</div>

          {/* Right — sticky summary */}
          <div className="sticky top-4">{summaryCard}</div>
        </div>

        {/* ── MOBILE: single column ── */}
        <div className="md:hidden space-y-4 pb-[80px]">
          {itemsList}
          {summaryCard}
        </div>
      </div>

      {/* ── MOBILE sticky checkout button above bottom nav ── */}
      <div className={`md:hidden fixed bottom-[60px] left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 py-3 transition-transform duration-300 ${
        showStickyCheckout ? "translate-y-0" : "translate-y-full"
      }`}>
        <button
          onClick={() => router.push("/checkout")}
          className="w-full h-12 rounded-lg bg-brand_red text-white font-semibold text-sm uppercase tracking-widest hover:bg-brand_red_hover transition-colors"
        >
          Checkout — K {orderTotal.toLocaleString()}
        </button>
      </div>
    </div>
  );
}
