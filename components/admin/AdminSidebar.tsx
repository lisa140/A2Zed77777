"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ImagePlay,
  Box,
  Tag,
  Receipt,
  Users,
  Star,
  LogOut,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const navLinks = [
  { label: "Dashboard",     href: "/admin/dashboard",               icon: LayoutDashboard },
  { label: "Hero Slides",   href: "/admin/dashboard/slides",        icon: ImagePlay },
  { label: "Products",      href: "/admin/dashboard/products",      icon: Box },
  { label: "Subcategories", href: "/admin/dashboard/subcategories", icon: Tag },
  { label: "Orders",        href: "/admin/dashboard/orders",        icon: Receipt },
  { label: "Customers",     href: "/admin/dashboard/customers",     icon: Users },
  { label: "Custom Orders", href: "/admin/dashboard/custom-orders", icon: Star },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/admin/login");
  };

  return (
    <aside className="flex flex-col w-60 shrink-0 min-h-screen bg-brand_green text-white">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <span className="text-2xl font-black tracking-tight">A2Zed.</span>
        <p className="text-xs text-white/50 mt-0.5">Admin Panel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-white/10 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
