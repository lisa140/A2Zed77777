"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ProductCard, {
  ProductCardData,
  ProductCardSkeleton,
} from "@/components/ProductCard";

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First" },
  { value: "price-asc",  label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "featured",   label: "Featured First" },
];

const PAGE_SIZE = 12;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FirestoreProduct extends ProductCardData {
  description: string;
  featured: boolean;
  stock: number;
  subcategory: string;
  createdAt?: { seconds: number };
}

// ── Dual range slider (no external package) ───────────────────────────────────

function DualRangeSlider({
  min,
  max,
  low,
  high,
  onLowChange,
  onHighChange,
}: {
  min: number;
  max: number;
  low: number;
  high: number;
  onLowChange: (v: number) => void;
  onHighChange: (v: number) => void;
}) {
  const range   = max - min || 1;
  const lowPct  = ((low  - min) / range) * 100;
  const highPct = ((high - min) / range) * 100;

  return (
    <div className="relative h-6 w-full select-none">
      {/* Base track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full" />
      {/* Active fill */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1 bg-brand_green rounded-full pointer-events-none"
        style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
      />
      {/* Min (low) thumb — transparent range input */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={low}
        onChange={(e) => onLowChange(Math.min(Number(e.target.value), high - 1))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: low > max - range * 0.1 ? 5 : 3 }}
      />
      {/* Max (high) thumb — transparent range input */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={high}
        onChange={(e) => onHighChange(Math.max(Number(e.target.value), low + 1))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ zIndex: 4 }}
      />
      {/* Visual low thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-brand_green rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{ left: `calc(${lowPct}% - 8px)` }}
      />
      {/* Visual high thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-brand_green rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{ left: `calc(${highPct}% - 8px)` }}
      />
    </div>
  );
}

// ── Filter panel (shared by desktop sidebar + mobile sheet) ───────────────────

interface FilterPanelProps {
  subcats: string[];                            // fetched dynamically from Firestore
  selectedSubcategories: string[];
  onSubcategoryChange: (sub: string) => void;  // "" means clear all
  priceMin: number;
  priceMax: number;
  dynamicMax: number;
  onPriceMinChange: (v: number) => void;
  onPriceMaxChange: (v: number) => void;
  onReset: () => void;
}

function FilterPanel({
  subcats,
  selectedSubcategories,
  onSubcategoryChange,
  priceMin,
  priceMax,
  dynamicMax,
  onPriceMinChange,
  onPriceMaxChange,
  onReset,
}: FilterPanelProps) {

  const hasActiveFilters =
    priceMin > 0 ||
    (dynamicMax > 0 && priceMax < dynamicMax) ||
    selectedSubcategories.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-4">

      {/* ── Header row: Filters + Reset ── */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Filters</span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-brand_green underline cursor-pointer hover:text-brand_green_hover transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Filter sections — always expanded ── */}
      <div className="flex flex-col gap-6">

        {/* 1. SUBCATEGORY — shown only when Firestore subcats exist for this category */}
        {subcats.length > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              Subcategory
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSubcategoryChange("")}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedSubcategories.length === 0
                    ? "bg-brand_green text-white border-brand_green"
                    : "bg-white text-gray-600 border-gray-200 hover:border-brand_green hover:text-brand_green"
                }`}
              >
                All
              </button>
              {subcats.map((sub) => {
                const active = selectedSubcategories.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => onSubcategoryChange(sub)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-brand_green text-white border-brand_green"
                        : "bg-white text-gray-600 border-gray-200 hover:border-brand_green hover:text-brand_green"
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 border-b border-gray-100" />
          </div>
        )}

        {/* 2. PRICE RANGE */}
        {dynamicMax > 0 && (
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              Price Range
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                <span>K {priceMin.toLocaleString()}</span>
                <span>K {priceMax.toLocaleString()}</span>
              </div>
              <DualRangeSlider
                min={0}
                max={dynamicMax}
                low={priceMin}
                high={priceMax}
                onLowChange={onPriceMinChange}
                onHighChange={onPriceMaxChange}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────

function ShopInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Fetch all active products once ────────────────────────────────────────
  const [allProducts, setAllProducts] = useState<FirestoreProduct[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const q = query(
          collection(db, "products"),
          where("active", "==", true)
        );
        const snap = await getDocs(q);
        const docs: FirestoreProduct[] = snap.docs.map((d) => ({
          id:             d.id,
          name:           d.data().name           ?? "",
          category:       d.data().category       ?? "",
          subcategory:    d.data().subcategory    ?? "",
          description:    d.data().description    ?? "",
          price:          d.data().price          ?? 0,
          compareAtPrice: d.data().compareAtPrice ?? undefined,
          images:         d.data().images         ?? [],
          featured:       d.data().featured       ?? false,
          stock:          d.data().stock          ?? 0,
          createdAt:      d.data().createdAt      ?? undefined,
        }));
        console.log("Fetched", docs.length, "products from Firestore");
        setAllProducts(docs);
      } catch (err) {
        console.error("ShopPage fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Dynamic price ceiling (max product price × 1.2, rounded to 100) ───────
  const dynamicMax = useMemo(() => {
    if (allProducts.length === 0) return 0;
    const top = Math.max(...allProducts.map((p) => p.price));
    return Math.ceil((top * 1.2) / 100) * 100;
  }, [allProducts]);

  // ── Filter state ───────────────────────────────────────────────────────────
  const urlCategory = searchParams.get("category") ?? "";
  const urlQ        = searchParams.get("q")        ?? "";

  const [category, setCategory]                   = useState(urlCategory);
  const [selectedSubcategories, setSelectedSubs]  = useState<string[]>([]);
  const [sort, setSort]                           = useState("newest");
  const [priceMin, setPriceMin]                   = useState(0);
  const [priceMax, setPriceMax]                   = useState(0);
  const [page, setPage]                           = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen]   = useState(false);

  // ── Dynamic subcategories (Firestore, cached per category) ─────────────────
  const subcatCache = useRef<Record<string, string[]>>({});
  const [subcats, setSubcats] = useState<string[]>([]);

  useEffect(() => {
    if (!category) {
      setSubcats([]);
      return;
    }
    // Return cached result immediately to avoid flicker
    if (subcatCache.current[category]) {
      setSubcats(subcatCache.current[category]);
      return;
    }
    const fetchSubcats = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "subcategories"), where("category", "==", category))
        );
        const names = snap.docs
          .map((d) => d.data().name as string)
          .filter(Boolean)
          .sort();
        subcatCache.current[category] = names;
        setSubcats(names);
      } catch (err) {
        console.error("Subcategory fetch error:", err);
        setSubcats([]);
      }
    };
    fetchSubcats();
  }, [category]);

  // Initialise price range when products load (runs once)
  useEffect(() => {
    if (dynamicMax > 0 && priceMax === 0) {
      setPriceMax(dynamicMax);
    }
  }, [dynamicMax, priceMax]);

  // Sync category from URL (back/forward nav, CategoryNav links)
  useEffect(() => {
    const next = searchParams.get("category") ?? "";
    setCategory(next);
    setSelectedSubs([]);  // reset subcategory pills when category changes
    setPage(1);
    // Invalidate cache for this category so admin edits surface on next visit
    if (next) delete subcatCache.current[next];
  }, [searchParams]);

  useEffect(() => { setPage(1); }, [sort]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  // "" = clear all subcategories; otherwise toggle the sub
  const handleSubcategoryChange = (sub: string) => {
    if (sub === "") {
      setSelectedSubs([]);
    } else {
      setSelectedSubs((prev) =>
        prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
      );
    }
    setPage(1);
  };

  const handlePriceMinChange = (v: number) => { setPriceMin(v); setPage(1); };
  const handlePriceMaxChange = (v: number) => { setPriceMax(v); setPage(1); };

  const handleReset = () => {
    setCategory("");
    setSelectedSubs([]);
    setPriceMin(0);
    setPriceMax(dynamicMax);
    setPage(1);
    const params = new URLSearchParams();
    if (urlQ) params.set("q", urlQ);
    router.push(params.size ? `/shop?${params.toString()}` : "/shop", {
      scroll: false,
    });
  };

  const clearSearchHref = category
    ? `/shop?category=${encodeURIComponent(category)}`
    : "/shop";

  // ── Client-side filter + sort ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    console.log("Active category filter:", category || "(none)");
    const q = urlQ.trim().toLowerCase();
    const result = allProducts
      .filter((p) => {
        // Always hide out-of-stock products silently
        if (p.stock === 0) return false;
        // Category (case-insensitive)
        if (category && p.category.toLowerCase() !== category.toLowerCase()) return false;
        // Subcategory (case-insensitive exact match; "" means all)
        if (selectedSubcategories.length > 0) {
          const sub = p.subcategory.toLowerCase();
          if (!selectedSubcategories.some((s) => s.toLowerCase() === sub)) return false;
        }
        // Search query
        if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
        // Price range (only when slider has been initialised)
        if (dynamicMax > 0 && p.price < priceMin) return false;
        if (dynamicMax > 0 && p.price > priceMax) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "price-asc":  return a.price - b.price;
          case "price-desc": return b.price - a.price;
          case "featured":   return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
          case "newest":
          default:
            return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
        }
      });
    console.log("Filtered products count:", result.length);
    return result;
  }, [allProducts, category, selectedSubcategories, urlQ, sort, priceMin, priceMax, dynamicMax]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const pageTitle = urlQ ? "Search Results" : category || "All Products";

  const filterPanelProps: FilterPanelProps = {
    subcats,
    selectedSubcategories,
    onSubcategoryChange:  handleSubcategoryChange,
    priceMin,
    priceMax,
    dynamicMax,
    onPriceMinChange:     handlePriceMinChange,
    onPriceMaxChange:     handlePriceMaxChange,
    onReset:              handleReset,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">

      {/* Slim breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-screen-xl mx-auto px-4 py-2">
          <nav className="text-xs text-gray-400 flex items-center gap-1.5">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <span className="text-gray-300">›</span>
            <Link href="/shop" className="hover:text-gray-600 transition-colors">Shop</Link>
            {category && (
              <>
                <span className="text-gray-300">›</span>
                <span className="text-gray-600 font-medium">{category}</span>
              </>
            )}
            {urlQ && (
              <>
                <span className="text-gray-300">›</span>
                <span className="text-gray-600 font-medium">Search</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile: title + filter/sort pills */}
      <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="hidden md:flex items-baseline gap-2">
            <h1 className="text-base font-bold text-gray-900">{pageTitle}</h1>
            {!loading && (
              <>
                <span className="text-gray-300 text-sm">•</span>
                <span className="text-sm text-gray-400">{filtered.length} items</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:border-brand_green transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
            </button>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 bg-white focus:outline-none hover:border-brand_green cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-xl mx-auto px-4 py-4">

        {/* Search banner */}
        {urlQ && (
          <div className="mb-3 inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>
              Results for: <strong className="text-gray-900">"{urlQ}"</strong>
            </span>
            <Link
              href={clearSearchHref}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex gap-5 items-start">

          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-[220px] shrink-0">
            <div className="sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
              <FilterPanel {...filterPanelProps} />
            </div>
          </aside>

          {/* Product column */}
          <div className="flex-1 min-w-0">

            {/* Desktop title + sort bar */}
            <div className="hidden lg:flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
                {!loading && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-sm text-gray-400">
                      {filtered.length} {filtered.length === 1 ? "item" : "items"}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="appearance-none text-sm text-gray-700 border border-gray-200 bg-white pl-3 pr-7 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_green/20 focus:border-brand_green cursor-pointer"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 text-gray-400 bg-white rounded-lg border border-gray-100">
                <p className="text-base font-medium">No products found.</p>
                <p className="text-sm mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pageItems.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 text-sm text-gray-500">
                    <span>Page {currentPage} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPage((p) => Math.max(1, p - 1));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        disabled={currentPage === 1}
                        className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white font-medium hover:border-brand_green disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="inline w-4 h-4" /> Prev
                      </button>
                      <button
                        onClick={() => {
                          setPage((p) => Math.min(totalPages, p + 1));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        disabled={currentPage === totalPages}
                        className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white font-medium hover:border-brand_green disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next <ChevronRight className="inline w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile floating product count pill — sits above bottom nav */}
      {!loading && (
        <div className="md:hidden fixed bottom-[68px] left-0 right-0 flex justify-center z-30 pointer-events-none">
          <span className="bg-brand_green text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-auto">
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </span>
        </div>
      )}

      {/* Mobile filter sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b border-gray-100">
            <SheetTitle className="text-sm font-bold text-gray-800 text-left">
              Filters
            </SheetTitle>
          </SheetHeader>
          <div className="p-0">
            <FilterPanel {...filterPanelProps} />
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

const ShopPage = () => (
  <Suspense>
    <ShopInner />
  </Suspense>
);

export default ShopPage;
