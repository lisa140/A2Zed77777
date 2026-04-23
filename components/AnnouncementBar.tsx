"use client";

import { useEffect, useState } from "react";
import { Truck, Package, Sparkles } from "lucide-react";

const messages: { icon: React.ReactNode; text: string }[] = [
  { icon: <Truck    className="inline w-4 h-4 mr-1.5 text-white/80" />, text: "Free delivery on orders over K500 in Lusaka" },
  { icon: <Package  className="inline w-4 h-4 mr-1.5 text-white/80" />, text: "China to Zambia — Quality products, direct to your door" },
  { icon: <Sparkles className="inline w-4 h-4 mr-1.5 text-brand_gold" />, text: "Can't find it? Use Custom Order and we'll source it for you" },
];

export default function AnnouncementBar() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out → swap text → fade in
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-brand_green text-white text-xs sm:text-sm py-2 text-center select-none">
      <p
        className={`font-medium px-4 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {messages[idx].icon}{messages[idx].text}
      </p>
    </div>
  );
}
