"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCart } from "@/lib/cartContext";
import { Bell, Check, Frown, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface AppNotification {
  id:              string;
  userId:          string;
  type:            string;
  customOrderId:   string;
  productName:     string;
  quotedPrice:     number | null;
  quotedImage:     string | null;
  quotedProductId: string | null;
  message:         string;
  read:            boolean;
  createdAt:       { seconds: number } | null;
}

export default function NotificationBell() {
  const [userId,        setUserId]        = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open,          setOpen]          = useState(false);
  const [addedIds,      setAddedIds]      = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUserId(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) { setNotifications([]); return; }
    const q = query(collection(db, "notifications"), where("userId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const docs: AppNotification[] = snap.docs.map((d) => ({
        id:              d.id,
        userId:          d.data().userId          ?? "",
        type:            d.data().type            ?? "",
        customOrderId:   d.data().customOrderId   ?? "",
        productName:     d.data().productName     ?? "",
        quotedPrice:     d.data().quotedPrice      ?? null,
        quotedImage:     d.data().quotedImage      ?? null,
        quotedProductId: d.data().quotedProductId  ?? null,
        message:         d.data().message          ?? "",
        read:            d.data().read             ?? false,
        createdAt:       d.data().createdAt        ?? null,
      }));
      docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setNotifications(docs);
    });
    return () => unsub();
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const handleOpen = () => {
    setOpen((prev) => {
      if (!prev) markAllRead();
      return !prev;
    });
  };

  const handleDismiss = async (notifId: string) => {
    try { await updateDoc(doc(db, "notifications", notifId), { read: true }); } catch { /* ignore */ }
  };

  const handleAddToCart = async (notif: AppNotification) => {
    if (!notif.quotedPrice) return;

    addToCart({
      id:            `custom-${notif.customOrderId}`,
      productId:     notif.quotedProductId ?? `custom-${notif.customOrderId}`,
      name:          notif.productName,
      price:         notif.quotedPrice,
      image:         notif.quotedImage ?? "",
      quantity:      1,
      maxStock:      1,
      isCustomOrder: true,
      customOrderId: notif.customOrderId,
    });

    setAddedIds((prev) => new Set(prev).add(notif.id));

    try {
      await updateDoc(doc(db, "notifications", notif.id), {
        read:             true,
        customerActioned: true,
      });
    } catch { /* ignore */ }

    try {
      await updateDoc(doc(db, "customOrders", notif.customOrderId), {
        customerActioned: true,
        status:           "ordered",
        updatedAt:        serverTimestamp(),
      });
    } catch { /* ignore */ }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="flex flex-col items-center gap-0.5 hover:text-darkColor hoverEffect group"
        aria-label="Notifications"
      >
        <div className="relative">
          <Bell className="w-[22px] h-[22px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-brand_red text-white h-4 min-w-[16px] px-0.5 rounded-full text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium text-lightColor group-hover:text-darkColor hoverEffect">
          Updates
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-[80] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-darkColor">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand_green hover:underline font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isFound    = notif.type === "custom_order_found";
                const isNotFound = notif.type === "custom_order_not_found";
                const wasAdded   = addedIds.has(notif.id);

                return (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 ${
                      isFound    ? "bg-green-50/70" :
                      isNotFound ? "bg-gray-50"     :
                      !notif.read ? "bg-brand_green/5" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      {notif.quotedImage ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          <Image
                            src={notif.quotedImage}
                            alt={notif.productName}
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isFound    ? "bg-green-100" :
                          isNotFound ? "bg-gray-100"  : "bg-brand_green/10"
                        }`}>
                          {isFound
                            ? <Check className="w-5 h-5 text-brand_green" />
                            : isNotFound
                            ? <Frown className="w-5 h-5 text-gray-400" />
                            : <Bell  className="w-5 h-5 text-brand_green" />
                          }
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-semibold text-darkColor leading-snug flex items-center gap-1">
                            {isFound && <Check className="w-3.5 h-3.5 text-brand_green shrink-0" />}
                            {isFound
                              ? `We found ${notif.productName}!`
                              : isNotFound
                              ? `Sorry, we couldn't find ${notif.productName}`
                              : notif.productName || "Custom Order Update"}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {isNotFound && (
                              <button
                                onClick={() => handleDismiss(notif.id)}
                                aria-label="Dismiss"
                                className="text-gray-300 hover:text-gray-500 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!notif.read && !isNotFound && (
                              <span className="w-2 h-2 rounded-full bg-brand_green mt-0.5" />
                            )}
                          </div>
                        </div>

                        {isFound && notif.quotedPrice != null && (
                          <p className="text-sm font-bold text-brand_green mt-0.5">
                            K {notif.quotedPrice.toLocaleString()}
                          </p>
                        )}

                        {!isFound && !isNotFound && notif.message && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {isFound && (
                            wasAdded ? (
                              <span className="text-xs font-bold text-brand_green">
                                Added to cart!
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddToCart(notif)}
                                className="h-7 px-3 rounded-full bg-brand_red text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
                              >
                                ADD TO CART
                              </button>
                            )
                          )}
                          {isNotFound && (
                            <Link
                              href="/custom-order"
                              onClick={() => setOpen(false)}
                              className="text-[11px] font-semibold text-brand_green hover:underline"
                            >
                              Submit another request
                            </Link>
                          )}
                          {isFound && notif.quotedProductId && (
                            <Link
                              href={`/product/${notif.quotedProductId}`}
                              onClick={() => setOpen(false)}
                              className="text-[11px] text-gray-400 hover:underline"
                            >
                              View product
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-brand_green hover:underline"
            >
              View all requests →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
