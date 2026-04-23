"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/wishlistContext";

// ── Shared product shape used by ProductCard ──────────────────────────────────

export interface ProductCardData {
  id: string;
  name: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  // Optional — present on products with colour/size variants
  hasColors?: boolean;
  colors?: Array<{ name: string; hex: string }>;
  hasVariants?: boolean;
  variants?: Array<{ label: string; stock: number }>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mt-1" />
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function ProductCard({ product }: { product: ProductCardData }) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const wishlisted = isInWishlist(product.id);
  const onSale =
    !!product.compareAtPrice && product.compareAtPrice > product.price;

  // Available sizes count (only for non-colour products with size variants)
  const availableSizeCount =
    !product.hasColors && product.hasVariants && product.variants
      ? product.variants.filter((v) => v.stock > 0).length
      : 0;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-100 transition-transform duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col"
    >
      {/* Image area */}
      <div className="relative aspect-square bg-gray-100 block">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No image
          </div>
        )}

        {/* Sale badge */}
        {onSale && (
          <span className="absolute top-2 left-2 bg-brand_red text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">
            Sale
          </span>
        )}

        {/* Wishlist icon */}
        <button
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center transition-colors shadow-sm"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              wishlisted
                ? "fill-current text-brand_red"
                : "text-lightColor"
            }`}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">
          {product.category}
        </p>

        <span className="text-sm font-semibold text-gray-900 truncate leading-snug">
          {product.name}
        </span>

        {/* Colour swatches — up to 4 circles */}
        {product.hasColors && product.colors && product.colors.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {product.colors.slice(0, 4).map((c, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
            {product.colors.length > 4 && (
              <span className="text-[10px] text-gray-400 leading-none">
                +{product.colors.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Sizes available text */}
        {availableSizeCount > 0 && (
          <p className="text-[11px] text-lightColor">
            {availableSizeCount} size{availableSizeCount !== 1 ? "s" : ""} available
          </p>
        )}

        {/* Price row */}
        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="text-base font-bold text-brand_green">
            K {product.price.toLocaleString()}
          </span>
          {onSale && (
            <span className="text-xs text-gray-400 line-through">
              K {product.compareAtPrice!.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
