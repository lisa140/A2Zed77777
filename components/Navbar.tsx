"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  Search,
  ShoppingBag,
  X,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import Container from "./Container";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";
import CategoryNav from "./CategoryNav";
import AuthButtons from "./AuthButtons";
import NotificationBell from "./NotificationBell";
import { useCart } from "@/lib/cartContext";

// ── Reusable search bar ────────────────────────────────────────────────────────

function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    router.push(`/shop?q=${encodeURIComponent(q)}`);
    setValue("");
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        onClick={submit}
        aria-label="Search"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Search for products, brands and more..."
        className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-gray-50 text-sm text-darkColor placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand_green/20 focus:border-brand_green focus:bg-white transition-all duration-200"
      />
    </div>
  );
}

// ── Cart drawer ───────────────────────────────────────────────────────────────

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();

  if (!open) return null;

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full w-[400px] max-w-full bg-white z-[70] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-darkColor">
            My Cart {totalItems > 0 && `(${totalItems})`}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <ShoppingBag className="w-12 h-12 text-lightColor" />
              <p className="font-medium text-darkColor">Your cart is empty</p>
              <Link
                href="/shop"
                onClick={onClose}
                className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-brand_red text-white text-sm font-semibold hover:bg-brand_red_hover transition-colors"
              >
                Browse Products
              </Link>
              <Link
                href="/custom-order"
                onClick={onClose}
                className="text-sm text-brand_green hover:text-brand_green_hover transition-colors"
              >
                Custom Order
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                {/* Image */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                      No img
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-darkColor leading-snug line-clamp-1">
                    {item.name}
                  </p>
                  {/* Color + size */}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {item.colorName && (
                      <span className="flex items-center gap-1 text-[11px] text-lightColor">
                        {item.colorHex && (
                          <span
                            className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: item.colorHex }}
                          />
                        )}
                        {item.colorName}
                      </span>
                    )}
                    {item.size && (
                      <span className="text-[11px] text-lightColor">
                        Size: {item.size}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-brand_green mt-0.5">
                    K {item.price.toLocaleString()}
                  </p>

                  {/* Qty + remove */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 h-7 flex items-center justify-center text-sm font-semibold text-darkColor border-x border-gray-300 select-none">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.maxStock}
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                      className="text-gray-300 hover:text-brand_red transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-darkColor">
                    K {(item.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — only shown when cart has items */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-darkColor">
                K {totalPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Delivery</span>
              <span className="text-gray-500">Confirmed at checkout</span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/cart"
                onClick={onClose}
                className="flex-1 h-10 flex items-center justify-center rounded-lg border-2 border-brand_green text-brand_green text-sm font-semibold hover:bg-brand_green/5 transition-colors"
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={onClose}
                className="flex-1 h-10 flex items-center justify-center rounded-lg bg-brand_red text-white text-sm font-semibold hover:bg-brand_red_hover transition-colors"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

const Navbar = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { totalItems } = useCart();
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 bg-white">

        {/* ══════════════════════════════════════════════════════════
            DESKTOP — Row 1: Logo · Search · Wishlist / Cart / Auth
            ══════════════════════════════════════════════════════════ */}
        <div className="hidden lg:block border-b border-gray-100">
          <Container className="flex items-center gap-6 h-16">

            <Logo />
            <SearchBar className="flex-1 min-w-0 max-w-2xl" />

            {/* Right group */}
            <div className="ml-auto flex items-center gap-6 flex-shrink-0 text-lightColor">

              <Link
                href="/wishlist"
                className="flex flex-col items-center gap-0.5 hover:text-darkColor hoverEffect group"
              >
                <Heart className="w-[22px] h-[22px]" />
                <span className="text-[11px] font-medium text-lightColor group-hover:text-darkColor hoverEffect">
                  Wishlist
                </span>
              </Link>

              <NotificationBell />

              {/* Cart — opens drawer on desktop, navigates on /cart page */}
              <button
                onClick={() => pathname === "/cart" ? undefined : setDrawerOpen(true)}
                className="flex flex-col items-center gap-0.5 hover:text-darkColor hoverEffect group"
                aria-label="Open cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-[22px] h-[22px]" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-brand_red text-white h-4 min-w-[16px] px-0.5 rounded-full text-[10px] font-bold flex items-center justify-center">
                      {totalItems > 99 ? "99+" : totalItems}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-lightColor group-hover:text-darkColor hoverEffect">
                  Cart
                </span>
              </button>

              <div className="flex items-center flex-shrink-0">
                <AuthButtons />
              </div>
            </div>
          </Container>
        </div>

        {/* ══════════════════════════════════════════════════════════
            DESKTOP — Row 2: Category nav
            ══════════════════════════════════════════════════════════ */}
        <div className="hidden lg:block">
          <CategoryNav />
        </div>

        {/* ══════════════════════════════════════════════════════════
            MOBILE — Hamburger (left) · Logo (centred)
            ══════════════════════════════════════════════════════════ */}
        <div className="lg:hidden">
          <div className="border-b border-gray-100">
            <Container>
              <div className="relative flex items-center h-14 text-lightColor">
                <div className="flex-shrink-0 z-10">
                  <MobileMenu />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="pointer-events-auto">
                    <Logo />
                  </div>
                </div>
                <div className="ml-auto flex-shrink-0 z-10">
                  <NotificationBell />
                </div>
              </div>
            </Container>
          </div>
        </div>

      </header>

      {/* Cart drawer — rendered outside <header> so it covers full viewport */}
      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default Navbar;
