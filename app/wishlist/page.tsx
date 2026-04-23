"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useWishlist } from "@/lib/wishlistContext";
import ProductCard, { ProductCardData } from "@/components/ProductCard";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";

export default function WishlistPage() {
  const { wishlistIds, wishlistCount, removeFromWishlist, toggleWishlist } =
    useWishlist();

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Batch Firestore 'in' queries (max 10 per query)
  async function fetchWishlistProducts(ids: string[]): Promise<ProductCardData[]> {
    if (ids.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }

    const results: ProductCardData[] = [];
    await Promise.all(
      chunks.map(async (chunk) => {
        const q = query(
          collection(db, "products"),
          where(documentId(), "in", chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          const data = d.data();
          results.push({
            id:             d.id,
            name:           data.name           ?? "",
            category:       data.category       ?? "",
            price:          data.price          ?? 0,
            compareAtPrice: data.compareAtPrice ?? undefined,
            images:         data.images         ?? [],
            hasColors:      data.hasColors      ?? false,
            colors:         (data.colors ?? []).map(
              (c: Record<string, unknown>) => ({
                name: String(c.name ?? ""),
                hex:  String(c.hex  ?? "#000000"),
              })
            ),
            hasVariants:    data.hasVariants    ?? false,
            variants:       data.variants       ?? [],
          });
        });
      })
    );
    return results;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (wishlistIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    fetchWishlistProducts(wishlistIds).then((fetched) => {
      if (!cancelled) {
        // preserve wishlist order
        const ordered = wishlistIds
          .map((id) => fetched.find((p) => p.id === id))
          .filter(Boolean) as ProductCardData[];
        setProducts(ordered);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [wishlistIds]);

  const handleRemove = (productId: string) => {
    setRemovingIds((prev) => new Set(prev).add(productId));
    setTimeout(() => {
      toggleWishlist(productId);
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }, 300);
  };

  const handleClearAll = () => {
    [...wishlistIds].forEach((id) => removeFromWishlist(id));
    setShowClearConfirm(false);
  };

  // ── Skeleton ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-8 pb-[80px] md:pb-8">
        <div className="h-7 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (wishlistIds.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center pb-[80px] md:pb-0">
        <Heart className="w-16 h-16 text-lightColor mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-bold text-darkColor mb-2">
          Your wishlist is empty
        </h1>
        <p className="text-sm text-gray-400 mb-8 max-w-xs">
          Save items you love and come back to them later
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-brand_red text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-brand_red_hover transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  // ── Product grid ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8 pb-[80px] md:pb-12">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-darkColor">My Wishlist</h1>
          <span className="bg-brand_red text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
            {wishlistCount}
          </span>
        </div>
        {showClearConfirm ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-lightColor">Clear all items?</span>
            <button
              onClick={handleClearAll}
              className="font-semibold text-brand_red hover:underline"
            >
              Yes, Clear
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="font-medium text-lightColor hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-lightColor hover:text-brand_red transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className={`transition-all duration-300 ${
              removingIds.has(product.id)
                ? "opacity-0 scale-95 pointer-events-none"
                : "opacity-100 scale-100"
            }`}
          >
            <div className="relative">
              <ProductCard product={product} />
              {/* Remove overlay button — tapping heart on ProductCard already works,
                  but this gives an explicit "remove" path without navigating */}
              <button
                onClick={() => handleRemove(product.id)}
                aria-label="Remove from wishlist"
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm z-10"
              >
                <Heart className="w-4 h-4 fill-current text-brand_red" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
