"use client";

import React, { FC, useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight, Sparkles, LogOut, User } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { useOutsideClick } from "./hooks";
import Logo from "./Logo";

// ── Category list — mirrors CategoryNav ──────────────────────────────────────

interface CategoryItem {
  label: string;
  href: string;
  isSpecial?: boolean;
}

const CATEGORIES: CategoryItem[] = [
  { label: "Women",         href: "/shop?category=women" },
  { label: "Men",           href: "/shop?category=men" },
  { label: "Electronics",   href: "/shop?category=electronics" },
  { label: "Beauty",        href: "/shop?category=beauty" },
  { label: "Home & Living", href: "/shop?category=home-living" },
  { label: "Car Parts",     href: "/shop?category=car-parts" },
  { label: "Accessories",   href: "/shop?category=accessories" },
  { label: "Custom Order",  href: "/custom-order", isSpecial: true },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SideMenu: FC<SidebarProps> = ({ isOpen, onClose }) => {
  const sidebarRef = useOutsideClick<HTMLDivElement>(onClose);

  const [user, setUser]       = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // user cancelled — no-op
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className={`fixed inset-0 z-50 bg-black/40 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } hoverEffect`}
    >
      {/* Panel */}
      <div
        ref={sidebarRef}
        className="relative flex flex-col w-[300px] max-w-[85vw] h-full bg-white shadow-xl"
      >

        {/* ── Header: logo + close ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 hoverEffect"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Auth section ── */}
        <div className="px-5 py-4 border-b border-gray-100">
          {authLoading ? (
            <div className="h-9 w-32 rounded-md bg-gray-100 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <img
                src={user.photoURL || "https://ui-avatars.com/api/?name=User"}
                alt={user.displayName || "User"}
                onError={(e) => {
                  e.currentTarget.src =
                    "https://ui-avatars.com/api/?name=" +
                    encodeURIComponent(user.displayName || "User");
                }}
                className="w-9 h-9 rounded-full object-cover border-2 border-brand_green flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.displayName || "My Account"}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 text-sm font-semibold text-brand_green hover:text-brand_green_hover hoverEffect"
            >
              <User className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>

        {/* ── Category links ── */}
        <nav className="flex-1 overflow-y-auto py-2">
          {CATEGORIES.map(({ label, href, isSpecial }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center justify-between min-h-[52px] px-5 text-sm font-medium border-b border-gray-50 hoverEffect ${
                isSpecial
                  ? "text-brand_red hover:bg-red-50"
                  : "text-gray-800 hover:bg-gray-50 hover:text-brand_green"
              }`}
            >
              <span className="flex items-center gap-2">
                {isSpecial && <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />}
                {label}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </nav>

        {/* ── Sign Out (only when logged in) ── */}
        {user && (
          <div className="border-t border-gray-100 px-5 py-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-500 hoverEffect"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SideMenu;
