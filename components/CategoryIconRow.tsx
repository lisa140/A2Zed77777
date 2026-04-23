import Link from "next/link";

const categories = [
  { label: "Women",        href: "/shop?category=women",       special: false },
  { label: "Men",          href: "/shop?category=men",         special: false },
  { label: "Electronics",  href: "/shop?category=electronics", special: false },
  { label: "Beauty",       href: "/shop?category=beauty",      special: false },
  { label: "Home",         href: "/shop?category=home-living", special: false },
  { label: "Car Parts",    href: "/shop?category=car-parts",   special: false },
  { label: "Accessories",  href: "/shop?category=accessories", special: false },
  { label: "Custom Order", href: "/custom-order",              special: true  },
];

/**
 * Text-only pill row — shown on the home page below the hero slider.
 * Horizontally scrollable on mobile, centered on desktop.
 */
const CategoryIconRow = () => {
  return (
    <div className="bg-white border-t border-b border-gray-100">
      <div className="flex overflow-x-auto no-scrollbar lg:justify-center gap-3 px-4 py-4">
        {categories.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className={[
              "flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium border hoverEffect whitespace-nowrap",
              cat.special
                ? "bg-brand_red text-white border-brand_red"
                : "bg-white text-gray-800 border-gray-200 hover:bg-brand_green hover:text-white hover:border-brand_green",
            ].join(" ")}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CategoryIconRow;
