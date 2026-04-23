"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProductCard, {
  ProductCardData,
  ProductCardSkeleton,
} from "@/components/ProductCard";

export default function FeaturedProducts() {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("featured", "==", true),
          where("active", "==", true),
          orderBy("createdAt", "desc"),
          limit(8)
        );
        const snap = await getDocs(q);
        const docs: ProductCardData[] = snap.docs.map((d) => ({
          id:             d.id,
          name:           d.data().name           ?? "",
          category:       d.data().category       ?? "",
          price:          d.data().price          ?? 0,
          compareAtPrice: d.data().compareAtPrice ?? undefined,
          images:         d.data().images         ?? [],
        }));
        setProducts(docs);
      } catch (err) {
        console.error("FeaturedProducts fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // No empty state — render nothing if no featured products
  if (!loading && products.length === 0) return null;

  return (
    <section className="py-8 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">
          Featured Products
        </h2>
        <Link
          href="/shop"
          className="text-sm font-semibold text-brand_green hover:text-brand_green_hover transition-colors"
        >
          View All →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
