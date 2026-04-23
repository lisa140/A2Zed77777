"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  User as UserIcon,
  MapPin,
  LogOut,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  X,
  ClipboardList,
  Check,
  Truck,
  PackageCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type RequestStatus = "new" | "searching" | "found" | "not_found" | "ordered" | "discarded";

interface CustomRequest {
  id:              string;
  productName:     string;
  status:          RequestStatus;
  quotedPrice:     number | null;
  quotedImage:     string;
  quotedProductId: string;
  createdAt:       { seconds: number } | null;
}

const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new:       "Submitted",
  searching: "Searching",
  found:     "Quote Ready",
  not_found: "Not Found",
  ordered:   "Ordered",
  discarded: "Discarded",
};

const REQUEST_STATUS_STYLE: Record<RequestStatus, string> = {
  new:       "bg-blue-100 text-blue-700",
  searching: "bg-yellow-100 text-yellow-700",
  found:     "bg-green-100 text-green-700",
  not_found: "bg-red-100 text-red-600",
  ordered:   "bg-purple-100 text-purple-700",
  discarded: "bg-gray-100 text-gray-500",
};

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  productId: string;
  name:      string;
  price:     number;
  quantity:  number;
  image:     string;
  colorName: string | null;
  size:      string | null;
}

interface Order {
  id:              string;
  orderId:         string;
  customerName:    string;
  items:           OrderItem[];
  subtotal:        number;
  deliveryFee:     number;
  total:           number;
  deliveryAddress: { area: string; street: string; city: string; instructions?: string };
  paymentMethod:   string;
  paymentStatus:   string;
  flutterwaveRef:  string;
  orderStatus:     OrderStatus;
  createdAt:       { seconds: number } | null;
}

interface CustomerData {
  name:       string;
  email:      string;
  phone:      string;
  totalSpent: number;
  orderCount: number;
  addresses?: Address[];
}

interface Address {
  id:        string;
  label:     string;
  area:      string;
  street:    string;
  city:      string;
  isDefault: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDERS_PAGE_SIZE = 5;

const STATUS_STEPS: OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

function statusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    pending:    "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    shipped:    "bg-purple-100 text-purple-700",
    delivered:  "bg-green-100 text-green-700",
    cancelled:  "bg-red-100 text-red-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function formatDate(ts: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-ZM", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// ── Sign-in prompt ────────────────────────────────────────────────────────────

function SignInPrompt({ onGoogle }: { onGoogle: () => void }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center gap-6 pb-20 md:pb-0">
      <div className="w-16 h-16 rounded-full bg-brand_green/10 flex items-center justify-center">
        <UserIcon className="w-8 h-8 text-brand_green" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-darkColor mb-1">Sign in to your account</h1>
        <p className="text-sm text-gray-400">Track orders, manage details, and save addresses.</p>
      </div>
      <button
        onClick={onGoogle}
        className="flex items-center gap-3 h-12 px-6 rounded-xl border-2 border-gray-200 bg-white text-darkColor font-semibold text-sm hover:border-gray-300 transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
}

// ── Order Status Stepper ──────────────────────────────────────────────────────

function OrderStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <p className="text-xs font-medium text-brand_red bg-red-50 px-3 py-1.5 rounded-lg inline-block">
        Order Cancelled
      </p>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status);

  const icons = [
    <ShoppingBag key="p" className="w-3 h-3" />,
    <ClipboardList key="pr" className="w-3 h-3" />,
    <Truck key="s" className="w-3 h-3" />,
    <PackageCheck key="d" className="w-3 h-3" />,
  ];

  const labels = ["Placed", "Processing", "Shipped", "Delivered"];

  return (
    <div className="flex items-center gap-0 mt-3">
      {STATUS_STEPS.map((step, idx) => {
        const done   = idx < currentIdx;
        const active = idx === currentIdx;
        const last   = idx === STATUS_STEPS.length - 1;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                  done   ? "bg-brand_green text-white" :
                  active ? "bg-brand_green text-white ring-2 ring-brand_green ring-offset-1" :
                           "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : icons[idx]}
              </div>
              <span className={`text-[9px] font-medium leading-none ${
                active ? "text-brand_green" : done ? "text-gray-500" : "text-gray-300"
              }`}>
                {labels[idx]}
              </span>
            </div>
            {!last && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 rounded-full ${
                done ? "bg-brand_green" : "bg-gray-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Account Page ─────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter();

  const [user,         setUser]         = useState<User | null | undefined>(undefined);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [signingIn,    setSigningIn]    = useState(false);

  // Orders state
  const [allOrders,    setAllOrders]    = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE_SIZE);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  // Custom requests state
  const [customRequests,       setCustomRequests]       = useState<CustomRequest[]>([]);
  const [customRequestsLoaded, setCustomRequestsLoaded] = useState(false);

  // Profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName,    setProfileName]    = useState("");
  const [profilePhone,   setProfilePhone]   = useState("");
  const [savingProfile,  setSavingProfile]  = useState(false);

  // Address state
  const [addresses,    setAddresses]    = useState<Address[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editAddrId,   setEditAddrId]   = useState<string | null>(null);
  const [addrLabel,    setAddrLabel]    = useState("Home");
  const [addrArea,     setAddrArea]     = useState("");
  const [addrStreet,   setAddrStreet]   = useState("");
  const [addrCity,     setAddrCity]     = useState("");
  const [addrDefault,  setAddrDefault]  = useState(false);
  const [savingAddr,   setSavingAddr]   = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "customers", u.uid));
        if (snap.exists()) {
          const data = snap.data() as CustomerData;
          setCustomerData(data);
          setAddresses((data.addresses as Address[]) ?? []);
          setProfileName(data.name ?? u.displayName ?? "");
          setProfilePhone(data.phone ?? "");
        } else {
          setProfileName(u.displayName ?? "");
        }

        // Fetch all orders, sort client-side (avoids composite index requirement)
        const q    = query(collection(db, "orders"), where("userId", "==", u.uid));
        const snap2 = await getDocs(q);
        const mapped: Order[] = snap2.docs.map((d) => {
          const data = d.data();
          return {
            id:              d.id,
            orderId:         data.orderId         ?? d.id,
            customerName:    data.customerName    ?? "",
            items:           data.items           ?? [],
            subtotal:        data.subtotal        ?? 0,
            deliveryFee:     data.deliveryFee     ?? 0,
            total:           data.total           ?? 0,
            deliveryAddress: data.deliveryAddress ?? {},
            paymentMethod:   data.paymentMethod   ?? "",
            paymentStatus:   data.paymentStatus   ?? "",
            flutterwaveRef:  data.flutterwaveRef  ?? "",
            orderStatus:     data.orderStatus     ?? "pending",
            createdAt:       data.createdAt       ?? null,
          };
        });
        mapped.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setAllOrders(mapped);
        setOrdersLoaded(true);

        // Fetch custom requests
        const crSnap = await getDocs(query(collection(db, "customOrders"), where("userId", "==", u.uid)));
        const crMapped: CustomRequest[] = crSnap.docs.map((d) => ({
          id:              d.id,
          productName:     d.data().productName     ?? "",
          status:          d.data().status          ?? "new",
          quotedPrice:     d.data().quotedPrice      ?? null,
          quotedImage:     d.data().quotedImage      ?? "",
          quotedProductId: d.data().quotedProductId  ?? "",
          createdAt:       d.data().createdAt        ?? null,
        }));
        crMapped.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setCustomRequests(crMapped);
        setCustomRequestsLoaded(true);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try { await signInWithPopup(auth, googleProvider); }
    catch { /* user cancelled */ }
    finally { setSigningIn(false); }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const handleMarkOrdered = async (requestId: string) => {
    await updateDoc(doc(db, "customOrders", requestId), {
      status:           "ordered",
      customerActioned: true,
      updatedAt:        serverTimestamp(),
    });
    setCustomRequests((prev) =>
      prev.map((r) => r.id === requestId ? { ...r, status: "ordered" as RequestStatus } : r)
    );
  };

  // ── Profile save ─────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "customers", user.uid), { name: profileName, phone: profilePhone });
      setCustomerData((prev) => prev ? { ...prev, name: profileName, phone: profilePhone } : prev);
      setEditingProfile(false);
    } catch { /* stay open */ }
    finally { setSavingProfile(false); }
  };

  // ── Address helpers ───────────────────────────────────────────────────────────

  const resetAddrForm = () => {
    setAddrLabel("Home"); setAddrArea(""); setAddrStreet(""); setAddrCity("");
    setAddrDefault(false); setEditAddrId(null); setShowAddrForm(false);
  };

  const openEditAddr = (addr: Address) => {
    setAddrLabel(addr.label); setAddrArea(addr.area);
    setAddrStreet(addr.street); setAddrCity(addr.city);
    setAddrDefault(addr.isDefault); setEditAddrId(addr.id);
    setShowAddrForm(true);
  };

  const handleSaveAddr = async () => {
    if (!user || !addrArea.trim() || !addrStreet.trim()) return;
    setSavingAddr(true);

    const newAddr: Address = {
      id:        editAddrId ?? `addr-${Date.now()}`,
      label:     addrLabel || "Home",
      area:      addrArea,
      street:    addrStreet,
      city:      addrCity,
      isDefault: addrDefault,
    };

    let updated: Address[];
    if (editAddrId) {
      updated = addresses.map((a) => a.id === editAddrId ? newAddr : a);
    } else {
      if (addresses.length >= 3) { setSavingAddr(false); return; }
      updated = [...addresses, newAddr];
    }
    if (addrDefault) {
      updated = updated.map((a) => ({ ...a, isDefault: a.id === newAddr.id }));
    }

    try {
      await updateDoc(doc(db, "customers", user.uid), { addresses: updated });
      setAddresses(updated);
      resetAddrForm();
    } catch { /* stay open */ }
    finally { setSavingAddr(false); }
  };

  const handleDeleteAddr = async (addrId: string) => {
    if (!user) return;
    const updated = addresses.filter((a) => a.id !== addrId);
    await updateDoc(doc(db, "customers", user.uid), { addresses: updated });
    setAddresses(updated);
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <SignInPrompt onGoogle={handleGoogleSignIn} />;
  }

  const displayName  = customerData?.name || user.displayName || "Account";
  const memberSince  = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-ZM", { month: "long", year: "numeric" })
    : null;
  const deliveredCount = allOrders.filter((o) => o.orderStatus === "delivered").length;
  const defaultAddr    = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const visibleOrders  = allOrders.slice(0, visibleCount);

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-12">
      <div className="max-w-xl mx-auto px-4 pt-6 space-y-4">

        {/* ── Section 1: Profile Header ──────────────────────────────────────── */}
        <div className="bg-brand_green rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={displayName}
                width={64} height={64}
                className="rounded-full shrink-0 ring-2 ring-white/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shrink-0 ring-2 ring-white/30">
                <span className="text-white font-bold text-xl">{initials(displayName)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight truncate">{displayName}</p>
              <p className="text-white/70 text-sm truncate">{user.email}</p>
              {memberSince && (
                <p className="text-white/50 text-xs mt-0.5">Member since {memberSince}</p>
              )}
            </div>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
                aria-label="Edit profile"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Inline edit form */}
          {editingProfile && (
            <div className="space-y-2 mt-2">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Full Name"
                className="w-full h-10 px-3 text-sm rounded-lg bg-white/20 placeholder:text-white/50 text-white border border-white/30 focus:outline-none focus:border-white"
              />
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="+260 97X XXX XXX"
                className="w-full h-10 px-3 text-sm rounded-lg bg-white/20 placeholder:text-white/50 text-white border border-white/30 focus:outline-none focus:border-white"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 h-9 rounded-lg bg-white text-brand_green font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
                >
                  {savingProfile ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setProfileName(customerData?.name ?? user.displayName ?? "");
                    setProfilePhone(customerData?.phone ?? "");
                    setEditingProfile(false);
                  }}
                  className="flex-1 h-9 rounded-lg bg-white/20 text-white font-medium text-sm hover:bg-white/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Quick Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Orders",   value: customerData?.orderCount ?? 0 },
            { label: "Total Spent",    value: `K ${(customerData?.totalSpent ?? 0).toLocaleString()}` },
            { label: "Delivered",      value: deliveredCount },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-brand_green leading-none mb-1">{stat.value}</p>
              <p className="text-[10px] text-lightColor leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Section 3: My Requests ─────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand_green" />
              <h2 className="text-sm font-bold text-darkColor uppercase tracking-wider">My Requests</h2>
            </div>
            <Link
              href="/custom-order"
              className="text-xs font-semibold text-brand_green hover:underline"
            >
              + New Request
            </Link>
          </div>

          {!customRequestsLoaded && (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {customRequestsLoaded && customRequests.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">No custom order requests yet.</p>
              <Link
                href="/custom-order"
                className="inline-flex items-center h-9 px-4 rounded-lg bg-brand_green text-white text-xs font-semibold hover:bg-brand_green_hover transition-colors"
              >
                Submit a Request
              </Link>
            </div>
          )}

          {customRequestsLoaded && customRequests.length > 0 && (
            <div className="space-y-3">
              {customRequests.map((req) => (
                <div key={req.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-darkColor truncate">{req.productName || "Custom Request"}</p>
                      <p className="text-[11px] text-lightColor mt-0.5">
                        {req.createdAt ? formatDate(req.createdAt) : "—"}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${REQUEST_STATUS_STYLE[req.status]}`}>
                      {REQUEST_STATUS_LABEL[req.status]}
                    </span>
                  </div>

                  {/* Quote details when status is found */}
                  {req.status === "found" && req.quotedPrice && (
                    <div className="bg-green-50 rounded-lg p-2.5 mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {req.quotedImage && (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            <Image src={req.quotedImage} alt={req.productName} fill sizes="40px" className="object-cover" unoptimized />
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-green-600 font-semibold uppercase">Quote Ready</p>
                          <p className="text-sm font-bold text-green-700">K {req.quotedPrice.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {req.quotedProductId && (
                          <Link
                            href={`/product/${req.quotedProductId}`}
                            className="h-7 px-3 rounded-full border border-green-200 text-green-700 text-[10px] font-semibold flex items-center hover:bg-green-100 transition-colors"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 4: Delivery Address ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand_green" />
              <h2 className="text-sm font-bold text-darkColor uppercase tracking-wider">Delivery Address</h2>
            </div>
            {!showAddrForm && addresses.length < 3 && (
              <button
                onClick={() => setShowAddrForm(true)}
                className="text-xs font-semibold text-brand_green hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            )}
          </div>

          {/* Address cards */}
          {addresses.length === 0 && !showAddrForm && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">No saved addresses yet.</p>
              <button
                onClick={() => setShowAddrForm(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-lightColor hover:border-brand_green hover:text-brand_green transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Address
              </button>
            </div>
          )}

          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className="flex items-start justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-darkColor">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold bg-brand_green/10 text-brand_green px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {[addr.area, addr.street, addr.city].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => openEditAddr(addr)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lightColor hover:bg-white hover:shadow-sm transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteAddr(addr.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lightColor hover:bg-red-50 hover:text-brand_red transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Address form */}
          {showAddrForm && (
            <div className="mt-3 border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-darkColor">
                  {editAddrId ? "Edit Address" : "New Address"}
                </span>
                <button onClick={resetAddrForm} className="text-lightColor hover:text-darkColor">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((l) => (
                  <button
                    key={l}
                    onClick={() => setAddrLabel(l)}
                    className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                      addrLabel === l
                        ? "bg-brand_green border-brand_green text-white"
                        : "border-gray-200 text-lightColor hover:border-gray-300"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <input
                type="text" value={addrArea} onChange={(e) => setAddrArea(e.target.value)}
                placeholder="Area / Neighbourhood"
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
              />
              <input
                type="text" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)}
                placeholder="Street Address / Landmark"
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
              />
              <input
                type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)}
                placeholder="City"
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
              />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addrDefault}
                  onChange={(e) => setAddrDefault(e.target.checked)}
                  className="w-4 h-4 accent-brand_green"
                />
                <span className="text-sm text-darkColor">Set as default address</span>
              </label>

              <button
                onClick={handleSaveAddr}
                disabled={savingAddr || !addrArea.trim() || !addrStreet.trim()}
                className="w-full h-10 rounded-lg bg-brand_green text-white text-sm font-semibold hover:bg-brand_green_hover transition-colors disabled:opacity-50"
              >
                {savingAddr ? "Saving…" : editAddrId ? "Update Address" : "Save Address"}
              </button>
            </div>
          )}

          {addresses.length >= 3 && !showAddrForm && (
            <p className="text-xs text-center text-gray-400 mt-2">Maximum 3 addresses saved.</p>
          )}
        </div>

        {/* ── Section 5: My Orders ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-4 h-4 text-brand_green" />
            <h2 className="text-sm font-bold text-darkColor uppercase tracking-wider">My Orders</h2>
            {allOrders.length > 0 && (
              <span className="ml-auto text-xs text-lightColor">{allOrders.length} order{allOrders.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Skeleton */}
          {!ordersLoaded && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-4 animate-pulse">
                  <div className="flex justify-between mb-3">
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                    <div className="h-5 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="flex gap-2 mb-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="w-10 h-10 bg-gray-200 rounded-lg" />
                    ))}
                  </div>
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {ordersLoaded && allOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <ShoppingBag className="w-10 h-10 text-lightColor" strokeWidth={1.5} />
              <div>
                <p className="font-semibold text-darkColor mb-1">No orders yet</p>
                <p className="text-sm text-gray-400">Your order history will appear here.</p>
              </div>
              <Link
                href="/shop"
                className="inline-flex items-center h-9 px-5 rounded-lg bg-brand_red text-white font-semibold text-sm hover:bg-brand_red_hover transition-colors"
              >
                Start Shopping
              </Link>
            </div>
          )}

          {/* Order cards */}
          {ordersLoaded && allOrders.length > 0 && (
            <div className="space-y-3">
              {visibleOrders.map((order) => {
                const expanded = expandedId === order.id;
                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-gray-100 overflow-hidden"
                  >
                    {/* Card header */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-mono text-sm font-semibold text-darkColor leading-none mb-1">
                            {order.orderId}
                          </p>
                          <p className="text-xs text-lightColor">{formatDate(order.createdAt)}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize shrink-0 ${statusBadge(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {order.items.slice(0, 3).map((item, i) => (
                            <div
                              key={i}
                              className="relative w-9 h-9 rounded-lg overflow-hidden bg-gray-100 border border-white shadow-sm shrink-0"
                              style={{ marginLeft: i > 0 ? "-8px" : 0, zIndex: 3 - i }}
                            >
                              {item.image ? (
                                <Image src={item.image} alt={item.name} fill sizes="36px" className="object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200" />
                              )}
                            </div>
                          ))}
                          <span className="text-xs text-lightColor ml-2">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-brand_green">
                            K {order.total.toLocaleString()}
                          </span>
                          {expanded
                            ? <ChevronUp className="w-4 h-4 text-lightColor" />
                            : <ChevronDown className="w-4 h-4 text-lightColor" />
                          }
                        </div>
                      </div>

                      {/* Status stepper */}
                      <OrderStepper status={order.orderStatus} />
                    </button>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="border-t border-gray-100 p-4 space-y-4 text-sm bg-gray-50/50">
                        {/* Items list */}
                        <div className="space-y-2">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                {item.image ? (
                                  <Image src={item.image} alt={item.name} fill sizes="44px" className="object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gray-200" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-darkColor text-xs truncate">{item.name}</p>
                                <p className="text-[11px] text-lightColor">
                                  {[item.colorName, item.size].filter(Boolean).join(" · ")}
                                  {" "}× {item.quantity}
                                </p>
                              </div>
                              <p className="font-semibold text-darkColor text-xs shrink-0">
                                K {(item.price * item.quantity).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Delivery + payment */}
                        <div className="grid grid-cols-2 gap-3 text-xs bg-white rounded-lg p-3 border border-gray-100">
                          <div>
                            <p className="font-semibold text-lightColor uppercase tracking-wider mb-1 text-[10px]">Delivery</p>
                            <p className="text-darkColor leading-relaxed">
                              {[order.deliveryAddress.area, order.deliveryAddress.street, order.deliveryAddress.city]
                                .filter(Boolean).join(", ")}
                            </p>
                            {order.deliveryAddress.instructions && (
                              <p className="text-gray-400 mt-0.5">{order.deliveryAddress.instructions}</p>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-lightColor uppercase tracking-wider mb-1 text-[10px]">Payment</p>
                            <p className="text-darkColor capitalize">
                              {order.paymentMethod.replace("mobilemoneyzambia", "Mobile Money")}
                            </p>
                            {order.flutterwaveRef && order.flutterwaveRef !== "COD" && (
                              <p className="text-gray-400 font-mono mt-0.5 text-[10px] break-all">{order.flutterwaveRef}</p>
                            )}
                          </div>
                        </div>

                        {/* Totals */}
                        <div className="space-y-1 text-xs text-gray-500 pt-1 border-t border-gray-100">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="text-darkColor font-medium">K {order.subtotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery</span>
                            <span className="text-darkColor font-medium">K {order.deliveryFee}</span>
                          </div>
                          <div className="flex justify-between font-bold text-sm text-darkColor pt-1">
                            <span>Total</span>
                            <span className="text-brand_green">K {order.total.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more */}
              {visibleCount < allOrders.length && (
                <button
                  onClick={() => setVisibleCount((n) => n + ORDERS_PAGE_SIZE)}
                  className="w-full h-10 rounded-xl border border-gray-200 text-sm font-medium text-lightColor hover:border-gray-300 hover:text-darkColor transition-colors"
                >
                  Load more orders
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Section 6: Sign Out ────────────────────────────────────────────── */}
        <button
          onClick={handleSignOut}
          className="w-full h-12 rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-2 text-sm font-semibold text-brand_red hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

      </div>
    </div>
  );
}
