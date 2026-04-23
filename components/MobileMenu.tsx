"use client";
import { AlignLeft } from "lucide-react";
import React, { useState } from "react";
import SideMenu from "./SideMenu";

const MobileMenu = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Open menu"
        className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-darkColor hoverEffect"
      >
        <AlignLeft className="w-5 h-5" />
      </button>
      <div className="lg:hidden">
        <SideMenu
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>
    </>
  );
};
export default MobileMenu;
