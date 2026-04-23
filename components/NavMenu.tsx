"use client";
import Link from "next/link";
import React from "react";
import { navData } from "./constants/data";
import { usePathname } from "next/navigation";

const NavMenu = () => {
  const pathname = usePathname();

  return (
    <div className="hidden lg:flex flex-1 items-center justify-center gap-4 xl:gap-7 text-sm capitalize font-semibold text-lightColor flex-nowrap overflow-hidden">
      {navData?.map((item) => (
        <Link
          key={item?.title}
          href={item?.href}
          className={`hover:text-brand_green hoverEffect relative group whitespace-nowrap ${
            pathname === item?.href && "text-brand_green"
          }`}
        >
          {item?.title}
          <span
            className={`absolute -bottom-0.5 left-1/2 w-0 h-0.5 bg-brand_green group-hover:w-1/2 hoverEffect group-hover:left-0 ${
              pathname === item?.href && "w-1/2"
            }`}
          />
          <span
            className={`absolute -bottom-0.5 right-1/2 w-0 h-0.5 bg-brand_green group-hover:w-1/2 hoverEffect group-hover:right-0 ${
              pathname === item?.href && "w-1/2"
            }`}
          />
        </Link>
      ))}
    </div>
  );
};

export default NavMenu;
