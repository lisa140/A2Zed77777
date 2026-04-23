"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Grid2x2, Heart, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useCart } from "@/lib/cartContext";
import { useWishlist } from "@/lib/wishlistContext";

const BRAND_GREEN = "#1B6B2F";
const LIGHT_COLOR = "#6B7280";

const mainNav = [
  { label: "Home",     href: "/",        Icon: Home },
  { label: "Shop",     href: "/shop",    Icon: Grid2x2 },
  { label: "Wishlist", href: "/wishlist", Icon: Heart, wishlistBadge: true },
  { label: "Cart",     href: "/cart",    Icon: ShoppingBag, badge: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const { totalItems } = useCart();
  const { wishlistCount } = useWishlist();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setLoggedIn(!!user));
    return () => unsub();
  }, []);

  const handleAccount = async () => {
    if (loggedIn) {
      router.push("/account");
    } else {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch {
        // user cancelled popup — no-op
      }
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-white border-t border-gray-200 flex items-center md:hidden z-40">

      {/* Main nav links */}
      {mainNav.map(({ label, href, Icon, badge, wishlistBadge }) => {
        const active = isActive(href);
        const color  = active ? BRAND_GREEN : LIGHT_COLOR;
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
          >
            <div className="relative">
              <Icon className="w-[22px] h-[22px]" style={{ color }} strokeWidth={active ? 2.2 : 1.8} />
              {badge && totalItems > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-brand_red text-white h-3.5 min-w-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
              {wishlistBadge && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-brand_red text-white h-3.5 min-w-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none" style={{ color }}>
              {label}
            </span>
          </Link>
        );
      })}

      {/* Account — button, not link, so we can handle auth */}
      <button
        onClick={handleAccount}
        className="flex-1 flex flex-col items-center justify-center gap-0.5"
        aria-label="Account"
      >
        {(() => {
          const active = pathname === "/account";
          const color  = active ? BRAND_GREEN : LIGHT_COLOR;
          return (
            <>
              <User className="w-[22px] h-[22px]" style={{ color }} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-none" style={{ color }}>
                Account
              </span>
            </>
          );
        })()}
      </button>

    </nav>
  );
}
