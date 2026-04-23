"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Heart, X, AlertTriangle, Check, Truck, Package, Undo2 } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import ProductCard, { ProductCardData } from "@/components/ProductCard";
import { useCart } from "@/lib/cartContext";
import { useWishlist } from "@/lib/wishlistContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SizeEntry {
  label: string;
  stock: number;
}

interface ColorEntry {
  name: string;
  hex: string;
  images: string[];
  variants: SizeEntry[];
}

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
  active: boolean;
  hasColors: boolean;
  hasVariants: boolean;
  variantType: "size" | "custom" | null;
  sizingType?: "US" | "UK-numeric" | "UK-alpha";
  variantLabel?: string;
  variants?: SizeEntry[];
  colors?: ColorEntry[];
}

type AccordionKey = "details" | "delivery" | "care" | "";

// ── PageSkeleton ──────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Desktop */}
      <div className="hidden md:flex max-w-screen-xl mx-auto">
        <div className="w-[55%] flex gap-3 p-6">
          <div className="w-20 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-20 h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="flex-1 aspect-[3/4] bg-gray-200 rounded-lg" />
        </div>
        <div className="w-[45%] p-10 space-y-4">
          <div className="h-3 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-7 w-3/4 bg-gray-200 rounded" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="h-px bg-gray-200 w-full" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-7 h-7 bg-gray-200 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-12 h-10 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="h-12 bg-gray-200 rounded-lg" />
          <div className="h-12 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
      {/* Mobile */}
      <div className="md:hidden">
        <div className="aspect-[3/4] bg-gray-200 w-full" />
        <div className="p-4 space-y-3">
          <div className="h-6 w-3/4 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="flex gap-2 mt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-7 h-7 bg-gray-200 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-12 h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AccordionSection ──────────────────────────────────────────────────────────

function AccordionSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-4 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-darkColor">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {/* Animated expand via CSS grid trick */}
      <div
        className={`grid transition-all duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-sm text-gray-600 leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── H&M-style cart toast ──────────────────────────────────────────────────────

interface ToastProduct {
  name: string;
  price: number;
  colorName?: string;
  size?: string;
  quantity: number;
  image: string;
}

function HMToast({
  visible,
  product: tp,
  onClose,
}: {
  visible: boolean;
  product: ToastProduct | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const handleViewCart = () => {
    onClose();
    router.push("/cart");
  };

  return (
    <>
      {/* DESKTOP — slides in from right, below navbar */}
      <div
        className={`hidden md:flex fixed top-[60px] right-4 z-[9999] w-[380px] flex-col bg-white border border-[#e5e5e5] shadow-xl transition-all duration-300 ease-out ${
          visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
      >
        {tp && (
          <>
            <div className="flex relative">
              {/* Product image */}
              <div className="w-[100px] h-[100px] shrink-0 overflow-hidden bg-gray-100">
                <img
                  src={tp.image}
                  alt={tp.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Product details */}
              <div className="flex-1 p-3 flex flex-col justify-center gap-1 min-w-0">
                <p className="text-sm font-semibold text-darkColor uppercase leading-tight truncate">
                  {tp.name}
                </p>
                <p className="text-sm font-bold text-darkColor">
                  K {tp.price.toLocaleString()}
                </p>
                {tp.colorName && (
                  <p className="text-xs leading-tight">
                    <span className="text-lightColor">Colour&nbsp;&nbsp;</span>
                    <span className="text-darkColor font-medium">{tp.colorName}</span>
                  </p>
                )}
                {tp.size && (
                  <p className="text-xs leading-tight">
                    <span className="text-lightColor">Size&nbsp;&nbsp;</span>
                    <span className="text-darkColor font-medium">{tp.size}</span>
                  </p>
                )}
                <p className="text-xs leading-tight">
                  <span className="text-lightColor">Quantity&nbsp;&nbsp;</span>
                  <span className="text-darkColor font-medium">{tp.quantity}</span>
                </p>
              </div>
              {/* Close */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-2 right-2 text-lightColor hover:text-darkColor transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* VIEW CART */}
            <button
              onClick={handleViewCart}
              className="w-full h-10 bg-[#1A1A1A] text-white text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors"
            >
              VIEW CART
            </button>
          </>
        )}
      </div>

      {/* MOBILE — slides down from top, below navbar */}
      <div
        className={`md:hidden fixed top-[56px] left-0 right-0 z-[9999] flex flex-col bg-white shadow-xl transition-all duration-300 ease-out ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        {tp && (
          <>
            <div className="flex relative">
              {/* Product image */}
              <div className="w-[80px] h-[80px] shrink-0 overflow-hidden bg-gray-100">
                <img
                  src={tp.image}
                  alt={tp.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Product details */}
              <div className="flex-1 p-3 flex flex-col justify-center gap-1 min-w-0">
                <p className="text-sm font-semibold text-darkColor uppercase leading-tight truncate">
                  {tp.name}
                </p>
                <p className="text-sm font-bold text-darkColor">
                  K {tp.price.toLocaleString()}
                </p>
                {tp.colorName && (
                  <p className="text-xs leading-tight">
                    <span className="text-lightColor">Colour&nbsp;&nbsp;</span>
                    <span className="text-darkColor font-medium">{tp.colorName}</span>
                  </p>
                )}
                {tp.size && (
                  <p className="text-xs leading-tight">
                    <span className="text-lightColor">Size&nbsp;&nbsp;</span>
                    <span className="text-darkColor font-medium">{tp.size}</span>
                  </p>
                )}
                <p className="text-xs leading-tight">
                  <span className="text-lightColor">Quantity&nbsp;&nbsp;</span>
                  <span className="text-darkColor font-medium">{tp.quantity}</span>
                </p>
              </div>
              {/* Close */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-2 right-2 text-lightColor hover:text-darkColor transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* VIEW CART */}
            <button
              onClick={handleViewCart}
              className="w-full h-10 bg-[#1A1A1A] text-white text-sm font-semibold uppercase tracking-wider hover:bg-black transition-colors"
            >
              VIEW CART
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ── ProductDetailPage ─────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  // ── State ─────────────────────────────────────────────────────────────────
  const [product,       setProduct]       = useState<Product | null>(null);
  const [related,       setRelated]       = useState<ProductCardData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [activeImg,     setActiveImg]     = useState(0);
  const [selectedColor, setSelectedColor] = useState<ColorEntry | null>(null);
  const [selectedSize,  setSelectedSize]  = useState<string | null>(null);

  const { addToCart, items: cartItems } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [toastVisible,  setToastVisible]  = useState(false);
  const [toastProduct,  setToastProduct]  = useState<ToastProduct | null>(null);
  const [openSection,   setOpenSection]   = useState<AccordionKey>("details");
  const [sizeError,     setSizeError]     = useState(false);
  const [sizeFlash,     setSizeFlash]     = useState(false);

  // Sentinel ref for mobile sticky bar (FIX 2)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  // Embla (mobile slider)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
  const [activeSlide, setActiveSlide] = useState(0);

  // ── Hooks ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveSlide(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const scrollToSlide = useCallback(
    (index: number) => {
      setActiveImg(index);
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  // Re-init Embla when color changes (slides swap out)
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit();
    emblaApi.scrollTo(0, true);
    setActiveSlide(0);
    setActiveImg(0);
  }, [emblaApi, selectedColor]);

  // IntersectionObserver — show sticky bar when sentinel scrolls off-screen
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Active images — derived with useMemo (handles null product)
  const activeImages = useMemo(() => {
    if (!product) return [];
    const colorImgs = (selectedColor?.images ?? []).filter(Boolean);
    if (colorImgs.length > 0) return colorImgs;
    return product.images.length > 0 ? product.images : ["/placeholder.jpg"];
  }, [product, selectedColor]);

  // Active variants (size chips or custom variants)
  const activeVariants = useMemo((): SizeEntry[] => {
    if (!product) return [];
    if (product.variantType !== "size" && product.variantType !== "custom") return [];
    if (selectedColor) return selectedColor.variants ?? [];
    return product.variants ?? [];
  }, [product, selectedColor]);

  // Selected variant entry
  const selectedVariant = useMemo(
    () => activeVariants.find((v) => v.label === selectedSize) ?? null,
    [activeVariants, selectedSize]
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const run = async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists() || snap.data().active === false) {
          setNotFound(true);
          return;
        }
        const d = snap.data();
        const colors: ColorEntry[] = (d.colors ?? []).map(
          (c: Record<string, unknown>) => ({
            name:     String(c.name     ?? ""),
            hex:      String(c.hex      ?? "#000000"),
            images:   Array.isArray(c.images) ? (c.images as string[]).filter(Boolean) : [],
            variants: Array.isArray(c.variants) ? c.variants as SizeEntry[] : [],
          })
        );
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
          active:         d.active         ?? true,
          hasColors:      d.hasColors      ?? false,
          hasVariants:    d.hasVariants    ?? false,
          variantType:    d.variantType    ?? null,
          sizingType:     d.sizingType     ?? undefined,
          variantLabel:   d.variantLabel   ?? undefined,
          variants:       d.variants       ?? undefined,
          colors:         colors.length > 0 ? colors : undefined,
        };
        setProduct(p);
        if (p.hasColors && p.colors && p.colors.length > 0) {
          setSelectedColor(p.colors[0]);
        } else {
          setSelectedColor(null);
        }
        setSelectedSize(null);
        setActiveImg(0);
        setActiveSlide(0);

        // Related products
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
              hasColors:      rd.data().hasColors      ?? false,
              colors:         (rd.data().colors ?? []).map(
                (c: Record<string, unknown>) => ({
                  name: String(c.name ?? ""),
                  hex:  String(c.hex  ?? "#000000"),
                })
              ),
              hasVariants:    rd.data().hasVariants    ?? false,
              variants:       (rd.data().variants ?? []) as SizeEntry[],
            }));
          setRelated(docs);
        }
      } catch (err) {
        console.error("ProductDetail fetch error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) return <PageSkeleton />;

  if (notFound || !product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-xl font-bold text-darkColor mb-2 uppercase tracking-wide">
          Product not found
        </p>
        <p className="text-sm text-gray-400 mb-8">
          This item may no longer be available.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-semibold text-darkColor underline underline-offset-4 hover:text-brand_green transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Shop
        </Link>
      </div>
    );
  }

  // ── Derived (product is non-null here) ────────────────────────────────────

  const needsVariant = product.variantType === "size" || product.variantType === "custom";

  const availableStock = needsVariant
    ? (selectedVariant ? selectedVariant.stock : 0)
    : product.stock;

  // Genuinely OOS: all size variants are 0 stock, or (no variant type) product.stock === 0
  const genuinelyOOS = needsVariant
    ? (activeVariants.length === 0 || activeVariants.every((v) => v.stock === 0))
    : product.stock === 0;

  // Convenience: the specific selected size turned out to be OOS
  const selectedVariantOOS = !!selectedSize && availableStock === 0;

  const onSale   = !!product.compareAtPrice && product.compareAtPrice > product.price;
  const discount = onSale ? Math.round((1 - product.price / product.compareAtPrice!) * 100) : 0;
  const shopHref = `/shop?category=${encodeURIComponent(product.category)}`;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (tp: ToastProduct) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastProduct(tp);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 4000);
  };

  const closeToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastVisible(false);
  };

  const handleColorSelect = (color: ColorEntry) => {
    setSelectedColor(color);
    setSelectedSize(null);
    setSizeError(false);
    setSizeFlash(false);
  };

  const handleSizeSelect = (label: string, stock: number) => {
    if (stock === 0) return;
    setSelectedSize((prev) => (prev === label ? null : label));
    setSizeError(false);
    setSizeFlash(false);
  };

  const handleAddToCart = () => {
    if (genuinelyOOS) return;

    if (needsVariant && !selectedSize) {
      // Show inline error + flash the size selector border
      setSizeError(true);
      setSizeFlash(true);
      setTimeout(() => setSizeError(false), 3000);
      setTimeout(() => setSizeFlash(false), 2000);
      return;
    }

    if (selectedVariantOOS) return;

    setSizeError(false);
    const cartItemId = product.id + (selectedColor?.name ?? "") + (selectedSize ?? "");
    const productImage = selectedColor?.images?.[0] || activeImages[0] || "";
    addToCart({
      id:        cartItemId,
      productId: product.id,
      name:      product.name,
      price:     product.price,
      image:     productImage,
      colorName: selectedColor?.name,
      colorHex:  selectedColor?.hex,
      size:      selectedSize ?? undefined,
      maxStock:  availableStock > 0 ? availableStock : product.stock,
    });
    // Compute new quantity (existing + 1, capped at maxStock)
    const existing = cartItems.find((i) => i.id === cartItemId);
    const newQty = existing
      ? Math.min(existing.quantity + 1, existing.maxStock)
      : 1;
    showToast({
      name:      product.name,
      price:     product.price,
      colorName: selectedColor?.name,
      size:      selectedSize ?? undefined,
      quantity:  newQty,
      image:     productImage,
    });
  };

  const toggleAccordion = (key: AccordionKey) =>
    setOpenSection((prev) => (prev === key ? "" : key));

  // ── Shared UI blocks ──────────────────────────────────────────────────────

  // ── Color swatches
  const colorSwatches =
    product.hasColors && product.colors && product.colors.length > 0 ? (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-darkColor">
            Colour:
          </span>
          <span className="text-[11px] text-gray-500 font-medium">
            {selectedColor?.name}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {product.colors.map((c, i) => (
            <button
              key={i}
              onClick={() => handleColorSelect(c)}
              title={c.name}
              aria-label={`Select colour ${c.name}`}
              className={`w-7 h-7 rounded-full border-2 transition-all duration-150 ${
                selectedColor?.hex === c.hex
                  ? "border-brand_green ring-2 ring-brand_green ring-offset-1 scale-110"
                  : "border-gray-300 hover:border-gray-500"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>
    ) : null;

  // ── Size / variant selector
  const variantSelector =
    activeVariants.length > 0 ? (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-darkColor">
            {product.variantType === "size"
              ? "Size"
              : (product.variantLabel ?? "Variant")}
          </span>
          {product.variantType === "size" && (
            <button className="text-[11px] underline text-gray-500 hover:text-darkColor transition-colors">
              Size Guide
            </button>
          )}
        </div>
        {/* Flash border wraps just the size chips */}
        <div
          className={`flex flex-wrap gap-2 rounded-lg p-1.5 border-2 transition-colors duration-300 ${
            sizeFlash ? "border-brand_red" : "border-transparent"
          }`}
        >
          {activeVariants.map((v) => (
            <button
              key={v.label}
              onClick={() => handleSizeSelect(v.label, v.stock)}
              disabled={v.stock === 0}
              className={`min-w-[48px] h-10 px-3 rounded border text-sm font-medium transition-colors ${
                v.stock === 0
                  ? "border-gray-200 text-gray-300 line-through cursor-not-allowed bg-gray-50"
                  : selectedSize === v.label
                    ? "bg-darkColor text-white border-darkColor"
                    : "bg-white text-darkColor border-gray-300 hover:border-darkColor"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {/* Inline error — only appears after user clicks Add to Cart without a size */}
        {sizeError && (
          <p className="text-sm text-brand_red font-medium flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Please select a size to continue
          </p>
        )}
        {/* Stock status for selected size */}
        {selectedSize && selectedVariant && (
          <p
            className={`text-[11px] font-semibold ${
              selectedVariant.stock === 0
                ? "text-brand_red"
                : selectedVariant.stock <= 5
                  ? "text-brand_gold"
                  : "text-brand_green"
            }`}
          >
            {selectedVariant.stock === 0
              ? "Out of Stock"
              : selectedVariant.stock <= 5
                ? `Only ${selectedVariant.stock} left!`
                : <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" />In Stock</span>}
          </p>
        )}
      </div>
    ) : null;

  // ── Action buttons
  const addToCartBtn = (
    <button
      onClick={handleAddToCart}
      disabled={genuinelyOOS}
      className={`w-full h-12 rounded-lg font-semibold text-sm uppercase tracking-widest transition-colors ${
        genuinelyOOS
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-brand_red text-white hover:bg-brand_red_hover"
      }`}
    >
      {genuinelyOOS ? "Out of Stock" : "Add to Cart"}
    </button>
  );

  const wishlisted = product ? isInWishlist(product.id) : false;

  const wishlistBtn = (
    <button
      onClick={() => product && toggleWishlist(product.id)}
      className={`w-full h-12 rounded-lg font-semibold text-sm border-2 transition-colors ${
        wishlisted
          ? "border-brand_red text-brand_red hover:bg-brand_red/5 bg-white"
          : "border-brand_green text-brand_green hover:bg-brand_green/5 bg-white"
      }`}
    >
      {wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
    </button>
  );

  // ── Delivery info box
  const deliveryBox = (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm text-gray-600">
      <p className="flex items-center gap-2"><Truck   className="w-4 h-4 text-brand_green shrink-0" /> Free delivery on orders over K500 in Lusaka</p>
      <p className="flex items-center gap-2"><Package className="w-4 h-4 text-brand_green shrink-0" /> Delivery within 3–7 business days</p>
      <p className="flex items-center gap-2"><Undo2   className="w-4 h-4 text-brand_green shrink-0" /> Easy returns within 7 days</p>
    </div>
  );

  // ── Product accordions
  const accordions = (
    <div className="border-t border-gray-200">
      <AccordionSection
        title="Product Details"
        isOpen={openSection === "details"}
        onToggle={() => toggleAccordion("details")}
      >
        <p>{product.description || "No description provided."}</p>
      </AccordionSection>
      <AccordionSection
        title="Delivery & Returns"
        isOpen={openSection === "delivery"}
        onToggle={() => toggleAccordion("delivery")}
      >
        <ul className="space-y-2">
          <li className="flex items-center gap-2"><Truck   className="w-4 h-4 text-brand_green shrink-0" /> Free delivery on orders over K500 in Lusaka</li>
          <li className="flex items-center gap-2"><Package className="w-4 h-4 text-brand_green shrink-0" /> Standard delivery: 3–7 business days nationwide</li>
          <li className="flex items-center gap-2"><Undo2   className="w-4 h-4 text-brand_green shrink-0" /> Easy returns within 7 days of receipt — no questions asked</li>
        </ul>
      </AccordionSection>
      <AccordionSection
        title="Care Instructions"
        isOpen={openSection === "care"}
        onToggle={() => toggleAccordion("care")}
      >
        <p>Handle with care. See label for instructions.</p>
      </AccordionSection>
    </div>
  );

  // ── Global stock badge (shown only when no variant type)
  const globalStockBadge = !needsVariant ? (
    product.stock === 0 ? (
      <p className="text-xs font-semibold text-brand_red">Out of Stock</p>
    ) : product.stock <= 5 ? (
      <p className="text-xs font-semibold text-brand_gold">
        Only {product.stock} left!
      </p>
    ) : null
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white min-h-screen">
      {/* H&M-style toast */}
      <HMToast visible={toastVisible} product={toastProduct} onClose={closeToast} />

      {/* ╔══════════════════════════════════════════════════════════╗
          ║  DESKTOP LAYOUT  (md and above)                         ║
          ╚══════════════════════════════════════════════════════════╝ */}
      <div className="hidden md:flex max-w-screen-xl mx-auto">

        {/* ── Left 55%: thumbnail strip + main image ── */}
        <div className="w-[55%] shrink-0 flex gap-3 p-4 lg:p-6 items-start">

          {/* Vertical thumbnail strip — shown only when > 1 image */}
          {activeImages.length > 1 && (
            <div className="flex flex-col gap-2 w-20 shrink-0 overflow-y-auto max-h-[600px] pr-0.5">
              {activeImages.map((src, i) => (
                <button
                  key={`${selectedColor?.hex ?? "default"}-${i}`}
                  onClick={() => scrollToSlide(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`relative w-20 h-20 shrink-0 overflow-hidden rounded border-2 transition-colors ${
                    i === activeImg
                      ? "border-brand_green"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <Image
                    src={src}
                    alt={`${product.name} ${i + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div className="flex-1 relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={activeImages[activeImg] ?? activeImages[0]}
              alt={product.name}
              fill
              sizes="(max-width: 1280px) 50vw, 700px"
              className="object-cover transition-transform duration-500 hover:scale-105"
              priority
            />
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
              {onSale && (
                <span className="bg-brand_red text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide rounded">
                  -{discount}% OFF
                </span>
              )}
              {product.featured && (
                <span className="bg-brand_gold text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide rounded">
                  Featured
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right 45%: sticky info panel ── */}
        <div className="w-[45%] self-start sticky top-0 px-6 lg:px-10 py-6 lg:py-10 max-h-screen overflow-y-auto space-y-5">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 flex-wrap">
            <Link href="/" className="hover:text-darkColor transition-colors">
              Home
            </Link>
            <span>›</span>
            <Link
              href={shopHref}
              className="hover:text-darkColor transition-colors capitalize"
            >
              {product.category}
            </Link>
            {product.subcategory && (
              <>
                <span>›</span>
                <span className="capitalize">{product.subcategory}</span>
              </>
            )}
            <span>›</span>
            <span className="text-gray-600 line-clamp-1 max-w-[160px]">
              {product.name}
            </span>
          </nav>

          {/* Category tag */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-lightColor">
            {product.category}
            {product.subcategory ? ` · ${product.subcategory}` : ""}
          </p>

          {/* Product name */}
          <h1 className="text-2xl font-bold text-darkColor leading-tight">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xl font-bold text-brand_green">
              K {product.price.toLocaleString()}
            </span>
            {onSale && (
              <>
                <span className="text-sm text-gray-400 line-through">
                  K {product.compareAtPrice!.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-white bg-brand_red px-2 py-0.5 rounded">
                  -{discount}%
                </span>
              </>
            )}
          </div>

          {/* Global stock badge */}
          {globalStockBadge}

          <hr className="border-gray-200" />

          {/* Colour swatches */}
          {colorSwatches}

          {/* Size / variant selector */}
          {variantSelector}


          {/* Add to cart + wishlist */}
          <div className="space-y-3 pt-1">
            {addToCartBtn}
            {wishlistBtn}
          </div>

          {/* Delivery info */}
          {deliveryBox}

          {/* Accordions */}
          {accordions}
        </div>
      </div>

      {/* ╔══════════════════════════════════════════════════════════╗
          ║  MOBILE LAYOUT  (below md)                              ║
          ╚══════════════════════════════════════════════════════════╝ */}
      <div className="md:hidden pb-[136px]">

        {/* Image slider — Embla */}
        <div className="relative">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex">
              {activeImages.map((src, i) => (
                <div
                  key={`${selectedColor?.hex ?? "default"}-${i}`}
                  className="flex-[0_0_100%] min-w-0 relative aspect-[3/4] bg-gray-100"
                >
                  <Image
                    src={src}
                    alt={`${product.name} — image ${i + 1}`}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Top-right overlay: counter + heart */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            {activeImages.length > 1 && (
              <span className="bg-black/50 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {activeSlide + 1}/{activeImages.length}
              </span>
            )}
            <button
              onClick={() => product && toggleWishlist(product.id)}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  wishlisted ? "fill-current text-brand_red" : "text-gray-500"
                }`}
              />
            </button>
          </div>

          {/* Sale badge */}
          {onSale && (
            <div className="absolute top-3 left-3 z-10">
              <span className="bg-brand_red text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide rounded">
                -{discount}%
              </span>
            </div>
          )}

          {/* Dot indicators */}
          {activeImages.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              {activeImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSlide(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === activeSlide
                      ? "w-5 h-1.5 bg-brand_green"
                      : "w-1.5 h-1.5 bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="px-4 pt-4 pb-2 space-y-4">

          {/* Category */}
          <Link
            href={shopHref}
            className="text-[11px] font-semibold uppercase tracking-widest text-lightColor hover:text-brand_green transition-colors"
          >
            {product.category}
            {product.subcategory ? ` · ${product.subcategory}` : ""}
          </Link>

          {/* Name */}
          <h1 className="text-xl font-bold text-darkColor leading-snug">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-xl font-bold text-brand_green">
              K {product.price.toLocaleString()}
            </span>
            {onSale && (
              <>
                <span className="text-sm text-gray-400 line-through">
                  K {product.compareAtPrice!.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-white bg-brand_red px-2 py-0.5 rounded">
                  -{discount}%
                </span>
              </>
            )}
          </div>

          {/* Global stock badge */}
          {globalStockBadge}

          <hr className="border-gray-200" />

          {/* Colour swatches */}
          {colorSwatches}

          {/* Size / variant selector */}
          {variantSelector}

          {/* Sentinel — sticky bar slides in once this scrolls off-screen */}
          <div ref={sentinelRef} aria-hidden />

          {/* Inline action buttons — visible while sentinel is on screen */}
          {!showStickyBar && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={genuinelyOOS}
                className={`flex-1 h-11 rounded-lg font-semibold text-sm transition-colors ${
                  genuinelyOOS
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-brand_red text-white hover:bg-brand_red_hover"
                }`}
              >
                {genuinelyOOS ? "Out of Stock" : "Add to Cart"}
              </button>
              <button
                onClick={() => product && toggleWishlist(product.id)}
                disabled={genuinelyOOS}
                className={`flex-1 h-11 rounded-lg font-semibold text-sm border-2 transition-colors ${
                  genuinelyOOS
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : wishlisted
                      ? "border-brand_red text-brand_red"
                      : "border-brand_green text-brand_green"
                }`}
              >
                {wishlisted ? "Wishlisted" : "Wishlist"}
              </button>
            </div>
          )}

          {/* Delivery info */}
          {deliveryBox}

          {/* Accordions */}
          {accordions}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          YOU MAY ALSO LIKE
          ══════════════════════════════════════════════════════════════ */}
      {related.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-4 pb-12 pt-4 md:pt-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-darkColor">
              You May Also Like
            </h2>
            <Link
              href={shopHref}
              className="text-xs font-semibold text-brand_green underline underline-offset-2 hover:text-brand_green_hover transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0">
            {related.map((p) => (
              <div key={p.id} className="w-[185px] shrink-0 md:w-auto md:shrink">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MOBILE FIXED BOTTOM BAR (above bottom nav at 60px)
          ══════════════════════════════════════════════════════════════ */}
      <div className={`md:hidden fixed bottom-[60px] left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 transition-transform duration-300 ${
        showStickyBar ? "translate-y-0" : "translate-y-full"
      }`}>
        <div className="flex gap-2">
          <button
            onClick={handleAddToCart}
            disabled={genuinelyOOS}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm transition-colors ${
              genuinelyOOS
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-brand_red text-white hover:bg-brand_red_hover"
            }`}
          >
            {genuinelyOOS ? "Out of Stock" : "Add to Cart"}
          </button>
          <button
            onClick={() => product && toggleWishlist(product.id)}
            disabled={genuinelyOOS}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm border-2 transition-colors ${
              genuinelyOOS
                ? "border-gray-200 text-gray-400 cursor-not-allowed"
                : wishlisted
                  ? "border-brand_red text-brand_red"
                  : "border-brand_green text-brand_green"
            }`}
          >
            {wishlisted ? "Wishlisted" : "Wishlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
