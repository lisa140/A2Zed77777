import { Search } from "lucide-react";

/**
 * Desktop-only wide search bar (Row 1 of the navbar).
 * No search logic yet — UI placeholder only.
 */
const NavSearch = () => {
  return (
    <div className="flex-1 min-w-0 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search for products, brands and more..."
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-gray-50 text-sm text-darkColor placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand_green/20 focus:border-brand_green focus:bg-white transition-all duration-200"
        />
      </div>
    </div>
  );
};

export default NavSearch;
