import { Heart } from "lucide-react";
import Link from "next/link";
import React from "react";

const Favourites = () => {
  return (
    <Link href={"/cart"} className="group relative">
      <Heart className="w-5 h-5 md:h-5 md:w-5 hover:text-brand_green hoverEffect" />
      <span className="absolute -top-1 -right-1 bg-brand_red text-white h-3.5 w-3.5 rounded-full text-xs font-semibold flex items-center justify-center">
        0
      </span>
    </Link>
  );
};

export default Favourites;
