"use client";

/**
 * Wraps all store pages with AnnouncementBar + Navbar + Footer.
 * Detects /admin routes and renders children bare so the admin
 * layout can own its own full-screen shell without the store chrome.
 */
import { usePathname } from "next/navigation";
import AnnouncementBar from "./AnnouncementBar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";

export default function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    // Admin routes: no announcement bar, no store navbar, no footer
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pb-[60px] md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
