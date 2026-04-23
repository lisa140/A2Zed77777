"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Container from "./Container";
import { Sparkles } from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const toSlug = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface CategoryItem {
  label: string;
  href: string;
  hasMega?: boolean;
  isSpecial?: boolean;
}

const categories: CategoryItem[] = [
  { label: "Women",        href: "/shop?category=women",        hasMega: true },
  { label: "Men",          href: "/shop?category=men",          hasMega: true },
  { label: "Electronics",  href: "/shop?category=electronics",  hasMega: true },
  { label: "Beauty",       href: "/shop?category=beauty",       hasMega: true },
  { label: "Home & Living",href: "/shop?category=home-living",  hasMega: true },
  { label: "Car Parts",    href: "/shop?category=car-parts" },
  { label: "Accessories",  href: "/shop?category=accessories",  hasMega: true },
  { label: "Custom Order", href: "/custom-order",               isSpecial: true },
];

interface MegaSection {
  heading: string;
  subcategories: string[];
  parentSlug: string;
}

const megaData: Record<string, MegaSection> = {
  Women: {
    heading: "Women's Fashion",
    parentSlug: "women",
    subcategories: [
      "Dresses",
      "Tops & Blouses",
      "Skirts",
      "Handbags",
      "Jewellery",
      "Shoes",
      "Lingerie",
    ],
  },
  Men: {
    heading: "Men's Fashion",
    parentSlug: "men",
    subcategories: [
      "T-Shirts",
      "Shirts",
      "Trousers",
      "Shoes",
      "Belts & Wallets",
      "Watches",
    ],
  },
  Electronics: {
    heading: "Electronics & Gadgets",
    parentSlug: "electronics",
    subcategories: [
      "Phones & Accessories",
      "Earphones",
      "Chargers & Cables",
      "Smart Watches",
      "Laptops & Tablets",
    ],
  },
  Beauty: {
    heading: "Beauty & Care",
    parentSlug: "beauty",
    subcategories: [
      "Skincare",
      "Haircare",
      "Makeup",
      "Perfumes & Body Mists",
      "Nail Care",
    ],
  },
  "Home & Living": {
    heading: "Home & Living",
    parentSlug: "home-living",
    subcategories: [
      "Kitchen & Dining",
      "Bedding & Cushions",
      "Storage & Organisation",
      "Décor",
      "Lighting",
    ],
  },
  Accessories: {
    heading: "Accessories",
    parentSlug: "accessories",
    subcategories: [
      "Bags",
      "Sunglasses",
      "Caps & Hats",
      "Belts",
      "Scarves & Wraps",
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

const CategoryNav = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Delay close by 150 ms so moving mouse into the dropdown cancels it */
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setActiveCategory(null), 150);
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleItemEnter = (label: string, hasMega?: boolean) => {
    cancelClose();
    setActiveCategory(hasMega ? label : null);
  };

  const activeMega = activeCategory ? megaData[activeCategory] : null;
  const activeHref = activeCategory
    ? categories.find((c) => c.label === activeCategory)?.href ?? "#"
    : "#";

  return (
    // position:relative is the anchor for the absolute mega panel
    <div className="relative border-b border-gray-100">
      <Container>
        <nav
          className="flex items-center justify-center gap-4 xl:gap-8"
          onMouseLeave={scheduleClose}
        >
          {categories.map((cat) => (
            <div
              key={cat.label}
              onMouseEnter={() => handleItemEnter(cat.label, cat.hasMega)}
              className="relative"
            >
              <Link
                href={cat.href}
                className={[
                  "inline-flex items-center gap-1.5 px-4 xl:px-5 py-3 text-sm font-medium hoverEffect border-b-2",
                  cat.isSpecial
                    ? "text-brand_red border-brand_red"
                    : activeCategory === cat.label
                    ? "text-darkColor border-brand_green"
                    : "text-darkColor border-transparent hover:text-darkColor hover:border-brand_green",
                ]
                  .join(" ")
                  .trim()}
              >
                {cat.isSpecial && (
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="whitespace-nowrap">{cat.label}</span>
              </Link>
            </div>
          ))}
        </nav>
      </Container>

      {/* ── Mega dropdown ─────────────────────────────────────────────── */}
      {activeMega && (
        <div
          className="absolute left-0 right-0 top-full bg-white shadow-xl border-t border-gray-100 z-50"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <Container className="py-8">
            <div className="flex gap-16">
              {/* Subcategory list */}
              <div className="min-w-[180px]">
                <h3 className="text-xs font-bold text-darkColor mb-4 uppercase tracking-widest">
                  {activeMega.heading}
                </h3>
                <ul className="space-y-3">
                  {activeMega.subcategories.map((sub) => (
                    <li key={sub}>
                      <Link
                        href={`/shop?category=${activeMega.parentSlug}&subcategory=${toSlug(sub)}`}
                        onClick={() => setActiveCategory(null)}
                        className="text-sm text-lightColor hover:text-brand_green hover:pl-1 hoverEffect block"
                      >
                        {sub}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={activeHref}
                  onClick={() => setActiveCategory(null)}
                  className="inline-block mt-6 text-xs font-semibold text-brand_green hover:text-brand_green_hover hoverEffect"
                >
                  View all {activeCategory} →
                </Link>
              </div>
            </div>
          </Container>
        </div>
      )}
    </div>
  );
};

export default CategoryNav;
