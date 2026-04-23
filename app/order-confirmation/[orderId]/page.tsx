"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { PartyPopper } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: string;
  name:      string;
  price:     number;
  quantity:  number;
  image?:    string;
  colorName?: string;
  size?:     string;
}

interface DeliveryAddress {
  area:         string;
  street:       string;
  city:         string;
  instructions: string;
}

interface Order {
  orderId:         string;
  customerName:    string;
  customerEmail:   string;
  customerPhone:   string;
  items:           OrderItem[];
  subtotal:        number;
  deliveryFee:     number;
  total:           number;
  deliveryLocation: "lusaka" | "outside";
  deliveryAddress: DeliveryAddress;
  paymentMethod:   string;
  paymentStatus:   "paid" | "pending" | "cod";
  orderStatus:     string;
  createdAt?:      { seconds: number };
  flutterwaveRef:  string;
}

// ── Checkmark animation ───────────────────────────────────────────────────────

function CheckmarkCircle() {
  return (
    <>
      <style>{`
        @keyframes checkScale {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0%   { stroke-dashoffset: 50; }
          100% { stroke-dashoffset: 0; }
        }
        .check-circle { animation: checkScale 0.5s ease-out forwards; }
        .check-path   { animation: checkDraw 0.4s ease-out 0.3s forwards; stroke-dasharray: 50; stroke-dashoffset: 50; }
      `}</style>
      <div className="check-circle w-20 h-20 rounded-full bg-brand_green flex items-center justify-center mx-auto">
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
          <path className="check-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </>
  );
}

// ── Payment method label ──────────────────────────────────────────────────────

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    airtel: "Airtel Money",
    mtn:    "MTN Mobile Money",
    zamtel: "Zamtel Kwacha",
    card:   "Credit / Debit Card",
    cod:    "Cash on Delivery",
  };
  return map[method] ?? method;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const run = async () => {
      try {
        const snap = await getDoc(doc(db, "orders", orderId));
        if (!snap.exists()) { setError(true); return; }
        setOrder(snap.data() as Order);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl font-bold text-darkColor">Order not found</p>
        <Link href="/shop" className="text-brand_green underline underline-offset-2 text-sm">
          Continue Shopping
        </Link>
      </div>
    );
  }

  const orderDate = order.createdAt
    ? new Date(order.createdAt.seconds * 1000).toLocaleDateString("en-ZM", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* ── Hero confirmation block ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
          <CheckmarkCircle />
          <h1 className="text-2xl font-bold text-darkColor flex items-center justify-center gap-2">
            Order Confirmed! <PartyPopper className="w-6 h-6 text-brand_gold" />
          </h1>
          <p className="text-sm text-gray-500">
            Thank you, {order.customerName.split(" ")[0]}! Your order has been placed successfully.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Order ID</span>
              <span className="font-mono font-semibold text-darkColor">{order.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="text-darkColor">{orderDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span className="text-darkColor">{paymentLabel(order.paymentMethod)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-brand_green capitalize">{order.paymentStatus === "cod" ? "Cash on Delivery" : "Paid"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estimated Delivery</span>
              <span className="text-darkColor">3–7 business days</span>
            </div>
          </div>
        </div>

        {/* ── Items ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-darkColor mb-4">Items Ordered</h2>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-darkColor line-clamp-1">{item.name}</p>
                  {(item.colorName || item.size) && (
                    <p className="text-xs text-gray-400">
                      {[item.colorName, item.size ? `Size: ${item.size}` : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-darkColor shrink-0">
                  K {(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>K {order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery</span><span>K {order.deliveryFee}</span>
            </div>
            <div className="flex justify-between font-bold text-darkColor text-base pt-1 border-t border-gray-100">
              <span>Total Paid</span><span>K {order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Delivery address ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-darkColor mb-3">Delivery Address</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>{order.deliveryAddress.street}</p>
            <p>{order.deliveryAddress.area}</p>
            <p>{order.deliveryAddress.city || (order.deliveryLocation === "lusaka" ? "Lusaka" : "")}</p>
            {order.deliveryAddress.instructions && (
              <p className="text-gray-400 italic">Note: {order.deliveryAddress.instructions}</p>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/shop"
            className="flex-1 inline-flex items-center justify-center h-12 rounded-xl border-2 border-brand_green text-brand_green font-semibold text-sm hover:bg-brand_green/5 transition-colors"
          >
            Continue Shopping
          </Link>
          <Link
            href="/orders"
            className="flex-1 inline-flex items-center justify-center h-12 rounded-xl bg-brand_red text-white font-semibold text-sm hover:bg-brand_red_hover transition-colors"
          >
            View My Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
