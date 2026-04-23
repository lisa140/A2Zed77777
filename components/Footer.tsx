import Link from "next/link";
import { MapPin, Mail, Phone, Clock, Lock } from "lucide-react";
import SocialMedia from "./SocialMedia";

const shopLinks = [
  { label: "Women's Fashion", href: "/shop?category=women" },
  { label: "Men's Fashion",   href: "/shop?category=men" },
  { label: "Electronics",     href: "/shop?category=electronics" },
  { label: "Beauty & Care",   href: "/shop?category=beauty" },
  { label: "Home & Living",   href: "/shop?category=home-living" },
  { label: "Car Parts",       href: "/shop?category=car-parts" },
  { label: "Accessories",     href: "/shop?category=accessories" },
];

const helpLinks = [
  { label: "Custom Order",   href: "/custom-order" },
  { label: "Track My Order", href: "/account" },
  { label: "Returns Policy", href: "/contact" },
  { label: "Contact Us",     href: "/contact" },
  { label: "About Us",       href: "/about" },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold text-brand_gold uppercase tracking-widest mb-4">
      {children}
    </h3>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-gray-400 hover:text-white transition-colors">
        {children}
      </Link>
    </li>
  );
}

const Footer = () => {
  return (
    <footer style={{ backgroundColor: "#1A1A1A" }} className="text-white">

      {/* Main grid */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Col 1 — Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-0.5">
            <span className="text-2xl font-black text-white tracking-tight">A2ZED</span>
            <span className="text-2xl font-black text-brand_red">.</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Quality products from China, delivered direct to Zambia.
          </p>
          <SocialMedia
            iconClassName="border-white/20 text-white/60 hover:border-brand_gold hover:text-brand_gold"
          />
        </div>

        {/* Col 2 — Shop */}
        <div>
          <FooterHeading>Shop</FooterHeading>
          <ul className="space-y-2.5">
            {shopLinks.map((l) => <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>)}
          </ul>
        </div>

        {/* Col 3 — Help */}
        <div>
          <FooterHeading>Help</FooterHeading>
          <ul className="space-y-2.5">
            {helpLinks.map((l) => <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>)}
          </ul>
        </div>

        {/* Col 4 — Contact */}
        <div>
          <FooterHeading>Contact</FooterHeading>
          <ul className="space-y-3 text-sm text-gray-400">
            {[
              { icon: <MapPin className="w-4 h-4 text-brand_gold shrink-0 mt-0.5" />, text: "Lusaka, Zambia" },
              { icon: <Mail   className="w-4 h-4 text-brand_gold shrink-0 mt-0.5" />, text: "contact@a2zedstore.com" },
              { icon: <Phone  className="w-4 h-4 text-brand_gold shrink-0 mt-0.5" />, text: "+260 XXX XXX XXX" },
              { icon: <Clock  className="w-4 h-4 text-brand_gold shrink-0 mt-0.5" />, text: "Mon–Fri: 8AM – 6PM" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-2.5">
                {item.icon}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Bottom bar */}
      <div
        className="border-t max-w-screen-xl mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <p className="text-gray-500">
          © {new Date().getFullYear()} A2Zed Global Store. All rights reserved.
        </p>
        <p className="text-gray-600">
          Powered by Flutterwave <Lock className="inline w-3 h-3 text-gray-500 ml-0.5" />
        </p>
      </div>

    </footer>
  );
};

export default Footer;
