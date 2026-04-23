import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

const Logo = ({
  className,
  spanDesign,
}: {
  className?: string;
  spanDesign?: string;
}) => {
  return (
    <Link href={"/"} className="inline-flex">
      <h2
        className={cn(
          "text-2xl text-darkColor font-black tracking-wider uppercase hoverEffect group font-sans",
          className,
        )}
      >
        A2
        <span
          className={cn(
            "text-brand_red hoverEffect",
            spanDesign,
          )}
        >
          Z
        </span>
        ed.
      </h2>
    </Link>
  );
};
export default Logo;
