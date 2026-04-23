"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import banner_1 from "@/images/banner/banner_1.png";
import banner_2 from "@/images/banner/banner_2.png";

type ButtonLinkType = "category" | "featured" | "sale" | "manual";

interface Slide {
  id: number;
  image: StaticImageData | string; // StaticImageData locally, string URL from Firestore
  heading: string;
  subheading: string;
  buttonLabel: string;
  buttonLink: string;
  buttonLinkType: ButtonLinkType;
}

const HARDCODED_SLIDES: Slide[] = [
  {
    id: 1,
    image: banner_1,
    heading: "Fashion for Everyone",
    subheading:
      "Men's & women's clothing, shoes, and accessories — fresh styles shipped direct to Zambia.",
    buttonLabel: "Shop Fashion",
    buttonLink: "/shop?category=fashion",
    buttonLinkType: "category",
  },
  {
    id: 2,
    image: banner_2,
    heading: "Electronics & Gadgets",
    subheading:
      "Phones, tablets, car accessories, and more — top brands at prices that make sense.",
    buttonLabel: "Browse Electronics",
    buttonLink: "/shop?category=electronics",
    buttonLinkType: "category",
  },
];

const AUTOPLAY_DELAY = 5000;

const HomeBanner = () => {
  const [slides, setSlides] = useState<Slide[]>(HARDCODED_SLIDES);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  // ── Firestore fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSlides = async () => {
      console.log("Fetching slides from Firestore...");
      try {
        const q = query(collection(db, "heroSlides"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        console.log("Raw Firestore snapshot:", snapshot);
        console.log("Snapshot empty?", snapshot.empty, "| Doc count:", snapshot.size);

        if (snapshot.empty) {
          console.log("Falling back to hardcoded slides");
          return;
        }

        const firestoreSlides: Slide[] = snapshot.docs.map((doc, i) => {
          const data = doc.data();
          console.log(`Slide doc [${i}] id=${doc.id}`, data);
          return {
            id: data.order ?? i + 1,
            image: data.imageUrl ?? data.image ?? "",
            heading: data.heading ?? "",
            subheading: data.subheading ?? "",
            buttonLabel: data.buttonLabel ?? "Shop Now",
            buttonLink: data.buttonLink ?? "/shop",
            buttonLinkType: (data.buttonLinkType as ButtonLinkType) ?? "manual",
          };
        });

        setSlides(firestoreSlides);
      } catch (err) {
        console.error("Error fetching heroSlides from Firestore:", err);
        console.log("Falling back to hardcoded slides");
      }
    };

    fetchSlides();
  }, []);
  const isHovering = useRef(false);
  const autoplayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoplay = useCallback(() => {
    if (autoplayTimer.current) {
      clearInterval(autoplayTimer.current);
      autoplayTimer.current = null;
    }
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    autoplayTimer.current = setInterval(() => {
      if (!isHovering.current) emblaApi?.scrollNext();
    }, AUTOPLAY_DELAY);
  }, [emblaApi, stopAutoplay]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    startAutoplay();
    return () => stopAutoplay();
  }, [startAutoplay, stopAutoplay]);

  return (
    <div
      className="w-full max-w-full overflow-hidden"
      onMouseEnter={() => { isHovering.current = true; }}
      onMouseLeave={() => { isHovering.current = false; }}
    >
      {/* Slider track — rounded corners, clips the image and overlays */}
      <div className="relative w-full rounded-xl overflow-hidden">

        {/* Embla viewport — w-full prevents the flex track from leaking out */}
        <div ref={emblaRef} className="w-full overflow-hidden">
          <div className="flex">
            {slides.filter((slide) => slide.image && (typeof slide.image === "string" ? slide.image.trim() !== "" : true)).map((slide) => (
              <div
                key={slide.id}
                className="relative flex-[0_0_100%] h-[55vh] lg:h-[70vh]"
              >
                {/* Full-bleed background image */}
                <Image
                  src={slide.image || banner_1}
                  alt={slide.heading}
                  fill
                  className="object-cover object-center"
                  priority={slide.id === 1}
                />

                {/* Bottom-up gradient — transparent at top, dark at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Text overlay — pinned to bottom of slide */}
                <div className="absolute inset-x-0 bottom-0 px-4 sm:px-8 pb-6 sm:pb-8">
                  <h2 className="text-white text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black leading-tight line-clamp-2">
                    {slide.heading}
                  </h2>
                  <p className="text-white/80 text-xs sm:text-sm md:text-base mt-1 sm:mt-2 line-clamp-1 sm:line-clamp-2">
                    {slide.subheading}
                  </p>
                  {/* CTA — compact pill, white bg + dark green text */}
                  <Link
                    href={slide.buttonLink}
                    className="inline-block mt-3 sm:mt-4 bg-brand_red text-white border border-brand_red px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm font-semibold hover:bg-brand_red_hover hover:border-brand_red_hover hoverEffect"
                  >
                    {slide.buttonLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prev arrow — hidden below sm, visible as circle buttons on desktop */}
        <button
          onClick={scrollPrev}
          aria-label="Previous slide"
          className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm items-center justify-center text-white hoverEffect"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next arrow — hidden below sm, visible as circle buttons on desktop */}
        <button
          onClick={scrollNext}
          aria-label="Next slide"
          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm items-center justify-center text-white hoverEffect"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dot indicators — OUTSIDE the image, centered below the slider */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`rounded-full hoverEffect ${
              index === selectedIndex
                ? "w-4 h-2.5 bg-brand_gold"
                : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HomeBanner;
