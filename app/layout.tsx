import "./globals.css";
import StoreShell from "@/components/StoreShell";
import { CartProvider } from "@/lib/cartContext";
import { WishlistProvider } from "@/lib/wishlistContext";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s - A2Zed Global Store",
    default: "A2Zed Global Store",
  },
  description: "A2Zed Global Store, your one-stop shop for everything!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-poppins antialiased">
        <CartProvider>
          <WishlistProvider>
            <StoreShell>{children}</StoreShell>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
