"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, ChevronLeft, ChevronRight, Star, Package } from "lucide-react";
import ProductCard, {
  ProductCardData,
  ProductCardSkeleton,
} from "@/components/ProductCard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  featured: boolean;
  stock: number;
  createdAt?: { seconds: number };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-4 w-48 bg-gray-200 rounded mb-6" />
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Image column */}
        <div className="lg:w-[52%] space-y-3">
          <div className="aspect-square bg-gray-200 rounded-2xl" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-16 h-16 bg-gray-200 rounded-xl shrink-0" />
            ))}
          </div>
        </div>
        {/* Info column */}
        <div className="flex-1 space-y-4 pt-2">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-7 w-3/4 bg-gray-200 rounded" />
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-20 w-full bg-gray-200 rounded" />
          <div className="h-12 w-full bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [product,  setProduct]  = useState<Product | null>(null);
  const [related,  setRelated]  = useState<ProductCardData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);

  // ── Fetch product ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) { setNotFound(true); return; }
        const d = snap.data();
        const p: Product = {
          id:             snap.id,
          name:           d.name           ?? "",
          category:       d.category       ?? "",
          subcategory:    d.subcategory    ?? "",
          description:    d.description    ?? "",
          price:          d.price          ?? 0,
          compareAtPrice: d.compareAtPrice ?? undefined,
          images:         d.images         ?? [],
          featured:       d.featured       ?? false,
          stock:          d.stock          ?? 0,
          createdAt:      d.createdAt      ?? undefined,
        };
        setProduct(p);
        setActiveImg(0);

        // Fetch related — same category, excluding this product, limit 4
        if (p.category) {
          const rq = query(
            collection(db, "products"),
            where("category", "==", p.category),
            where("active", "==", true),
            limit(8)
          );
          const rsnap = await getDocs(rq);
          const docs: ProductCardData[] = rsnap.docs
            .filter((rd) => rd.id !== snap.id)
            .slice(0, 4)
            .map((rd) => ({
              id:             rd.id,
              name:           rd.data().name           ?? "",
              category:       rd.data().category       ?? "",
              price:          rd.data().price          ?? 0,
              compareAtPrice: rd.data().compareAtPrice ?? undefined,
              images:         rd.data().images         ?? [],
            }));
          setRelated(docs);
        }
      } catch (err) {
        console.error("ProductDetail fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  if (notFound || !product) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-24 text-center">
        <p className="text-xl font-semibold text-gray-700">Product not found.</p>
        <Link
          href="/shop"
          className="inline-block mt-4 text-sm font-semibold text-brand_green hover:underline"
        >
          <ChevronLeft className="inline w-4 h-4" /> Back to Shop
        </Link>
      </div>
    );
  }

  const onSale    = !!product.compareAtPrice && product.compareAtPrice > product.price;
  const inStock   = product.stock > 0;
  const discount  = onSale
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;

  const shopHref = product.category
    ? `/shop?category=${encodeURIComponent(product.category)}`
    : "/shop";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4 py-2">
          <nav className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <span className="text-gray-300">›</span>
            <Link href="/shop" className="hover:text-gray-600 transition-colors">Shop</Link>
            {product.category && (
              <>
                <span className="text-gray-300">›</span>
                <Link href={shopHref} className="hover:text-gray-600 transition-colors">
                  {product.category}
                </Link>
              </>
            )}
            <span className="text-gray-300">›</span>
            <span className="text-gray-600 font-medium line-clamp-1 max-w-[200px]">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">

        {/* Back button — mobile */}
        <button
          onClick={() => router.back()}
          className="lg:hidden flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* Two-column product section */}
        <div className="flex flex-col lg:flex-row gap-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">

          {/* ── Left: Image gallery ── */}
          <div className="lg:w-[52%]">
            {/* Main image */}
            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
              {product.images[activeImg] ? (
                <Image
                  src={product.images[activeImg]}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                  No image
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {onSale && (
                  <span className="bg-brand_red text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    -{discount}% OFF
                  </span>
                )}
                {product.featured && (
                  <span className="bg-brand_gold text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    Featured
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail strip */}
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {product.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border-2 transition-colors ${
                      i === activeImg
                        ? "border-brand_green"
                        : "border-gray-200 hover:border-brand_green/40"
                    }`}
                  >
                    <Image
                      src={src}
                      alt={`${product.name} ${i + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Product info ── */}
          <div className="flex-1 flex flex-col gap-4">

            {/* Category + subcategory */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={shopHref}
                className="text-xs font-semibold text-brand_green uppercase tracking-widest hover:text-brand_green_hover transition-colors"
              >
                {product.category}
              </Link>
              {product.subcategory && (
                <>
                  <span className="text-gray-300 text-xs">›</span>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">
                    {product.subcategory}
                  </span>
                </>
              )}
            </div>

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl font-bold text-brand_green">
                K {product.price.toLocaleString()}
              </span>
              {onSale && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    K {product.compareAtPrice!.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-brand_gold bg-brand_gold/10 px-2 py-0.5 rounded-full">
                    Save K {(product.compareAtPrice! - product.price).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {/* Stock status */}
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-gray-400 shrink-0" />
              {inStock ? (
                <span className="text-green-700 font-medium">
                  In stock{product.stock <= 5 ? ` — only ${product.stock} left` : ""}
                </span>
              ) : (
                <span className="text-red-500 font-medium">Out of stock</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                {product.description}
              </div>
            )}

            {/* Quantity selector */}
            {inStock && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Qty:</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors font-bold text-lg"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-gray-900 select-none">
                    {qty}
                  </span>
                  <button
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex gap-3 flex-col sm:flex-row mt-1">
              <button
                disabled={!inStock}
                onClick={() => console.log("add to cart", product.id, "qty", qty)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand_red text-white text-sm font-bold hover:bg-brand_red_hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" />
                {inStock ? "Add to Cart" : "Out of Stock"}
              </button>
              <button
                onClick={() => setWishlisted((w) => !w)}
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-bold transition-colors ${
                  wishlisted
                    ? "bg-red-50 border-red-200 text-red-500"
                    : "bg-white border-gray-200 text-gray-600 hover:border-brand_green hover:text-brand_green"
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500" : ""}`} />
                {wishlisted ? "Wishlisted" : "Wishlist"}
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 pt-3 border-t border-gray-100 flex-wrap">
              {[
                "Free delivery on K500+",
                "Easy 7-day returns",
                "100% authentic",
              ].map((b) => (
                <div key={b} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Star className="w-3 h-3 text-brand_green shrink-0" />
                  {b}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Related products */}
        {(related.length > 0 || loading) && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                More from {product.category}
              </h2>
              <Link
                href={shopHref}
                className="text-sm font-semibold text-brand_green hover:text-brand_green_hover transition-colors"
              >
                View All <ChevronRight className="inline w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {related.length === 0
                ? [...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)
                : related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
