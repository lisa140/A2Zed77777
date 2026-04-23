"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  User,
} from "firebase/auth";
import { googleProvider } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useCart } from "@/lib/cartContext";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";
import Image from "next/image";
import Link from "next/link";
import { MapPin, ChevronLeft, ChevronRight, Check, Package, CreditCard, Banknote } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type DeliveryLocation = "lusaka" | "outside";
type PaymentMethod    = "airtel" | "mtn" | "zamtel" | "card" | "cod";

interface CustomerData {
  name:       string;
  email:      string;
  phone:      string;
  totalSpent: number;
  orderCount: number;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-full bg-brand_green text-white text-xs font-bold flex items-center justify-center shrink-0">
        {number}
      </span>
      <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-darkColor">{title}</h2>
    </div>
  );
}

// ── Payment method card ───────────────────────────────────────────────────────

function PaymentCard({
  id, icon, name, description, selected, onClick, children,
}: {
  id:          PaymentMethod;
  icon:        React.ReactNode;
  name:        string;
  description: string;
  selected:    boolean;
  onClick:     () => void;
  children?:   React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
        selected
          ? "border-brand_green bg-brand_green/5"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Radio */}
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? "border-brand_green" : "border-gray-300"
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-brand_green" />}
        </div>
        {/* Icon */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
          {icon}
        </div>
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-darkColor">{name}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {selected && children && (
        <div className="mt-3 pt-3 border-t border-brand_green/20">{children}</div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router    = useRouter();
  const { items, totalPrice, clearCart } = useCart();

  // Auth
  const [user,         setUser]         = useState<User | null>(null);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [guestMode,    setGuestMode]    = useState(false);

  // Sign-in form state (shown on checkout when not logged in)
  const [signInView,    setSignInView]    = useState<"options" | "email" | "signup">("options");
  const [siEmail,       setSiEmail]       = useState("");
  const [siPassword,    setSiPassword]    = useState("");
  const [siName,        setSiName]        = useState("");
  const [siPhone,       setSiPhone]       = useState("");
  const [siError,       setSiError]       = useState<string | null>(null);
  const [siLoading,     setSiLoading]     = useState(false);

  // Contact
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Delivery
  const [area,         setArea]         = useState("");
  const [street,       setStreet]       = useState("");
  const [city,         setCity]         = useState("");
  const [instructions, setInstructions] = useState("");
  const [gpsStatus,    setGpsStatus]    = useState<"idle" | "loading" | "success" | "error" | "denied">("idle");
  const [coords,       setCoords]       = useState<{ lat: number; lon: number } | null>(null);

  const isLusaka   = city.trim() === "" || city.trim().toLowerCase().includes("lusaka");
  const deliveryFee = isLusaka ? 60 : 150;

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [mobilePhone,   setMobilePhone]   = useState("");

  // Process state
  const [placing,   setPlacing]   = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // Stable tx_ref for this checkout session (refreshed before each payment attempt)
  const txRef = useRef(`A2ZED-${Date.now()}`);

  const orderTotal = totalPrice + deliveryFee;

  // ── Flutterwave config (all payment methods via inline modal) ──
  const flwConfig = {
    public_key:      process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "",
    tx_ref:          txRef.current,
    amount:          orderTotal,
    currency:        "ZMW",
    payment_options: "mobilemoneyzambia,card",
    customer: {
      email:        user?.email ?? "",
      phone_number: mobilePhone || customerPhone || "",
      name:         customerName,
    },
    customizations: {
      title:       "A2Zed Global Store",
      description: `Order of ${items.length} item${items.length !== 1 ? "s" : ""}`,
      logo:        "/logo.png",
    },
    meta: {
      delivery_area:   area,
      delivery_street: street,
      delivery_city:   city,
    },
  };

  const handleFlutterPayment = useFlutterwave(flwConfig);

  // ── Auth listener ────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        const snap = await getDoc(doc(db, "customers", u.uid));
        if (snap.exists()) {
          const d = snap.data() as CustomerData;
          setCustomerData(d);
          setCustomerName(d.name || u.displayName || "");
          setCustomerPhone(d.phone || "");
          setMobilePhone(d.phone || "");
        } else {
          setCustomerName(u.displayName || "");
        }
      }
    });
    return () => unsub();
  }, []);

  // ── Guard: redirect if cart empty ───────────────────────────
  useEffect(() => {
    if (!authLoading && items.length === 0) router.replace("/cart");
  }, [authLoading, items.length, router]);

  // ── GPS Geolocation ──────────────────────────────────────────
  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "A2ZedStore/1.0" } }
          );
          const data = await res.json() as {
            address?: {
              suburb?: string;
              neighbourhood?: string;
              quarter?: string;
              residential?: string;
              hamlet?: string;
              house_number?: string;
              road?: string;
              pedestrian?: string;
              path?: string;
              city?: string;
              town?: string;
              village?: string;
              county?: string;
            };
          };
          const addr = data.address ?? {};

          const detectedArea =
            addr.suburb || addr.neighbourhood || addr.quarter ||
            addr.residential || addr.hamlet || "";

          const detectedStreet =
            [addr.house_number, addr.road].filter(Boolean).join(" ") ||
            addr.pedestrian || addr.path || "";

          const detectedCity =
            addr.city || addr.town || addr.village || addr.county || "";

          setArea(detectedArea);
          setStreet(detectedStreet);
          setCity(detectedCity);
          setCoords({ lat, lon });
          setGpsStatus("success");
        } catch {
          setGpsStatus("error");
        }
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      }
    );
  }, []);

  // ── Create order in Firestore ────────────────────────────────
  const createOrder = useCallback(
    async (flwResponse: {
      transaction_id?: number;
      payment_type?:   string;
      flw_ref?:        string;
    } | null) => {
      if (!user && !guestMode) return;
      const isCOD   = paymentMethod === "cod";
      const orderId = txRef.current;

      const orderData = {
        orderId,
        userId:          user?.uid ?? null,
        customerName,
        customerEmail:   user?.email ?? "",
        customerPhone,
        items:           items.map((i) => ({
          productId: i.productId,
          name:      i.name,
          price:     i.price,
          quantity:  i.quantity,
          image:     i.image,
          colorName: i.colorName ?? null,
          size:      i.size      ?? null,
        })),
        subtotal:         totalPrice,
        deliveryFee,
        total:            orderTotal,
        deliveryLocation: (isLusaka ? "lusaka" : "outside") as DeliveryLocation,
        deliveryAddress: {
          area,
          street,
          city,
          instructions,
          coordinates: coords ?? null,
        },
        paymentMethod:  isCOD ? "cod" : (flwResponse?.payment_type ?? "unknown"),
        paymentStatus:  isCOD ? "cod"  : "paid",
        flutterwaveRef: flwResponse?.flw_ref        ?? "COD",
        transactionId:  flwResponse?.transaction_id ?? null,
        orderStatus:    "pending",
        createdAt:      serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "orders"), orderData);

      // Update customer stats only for signed-in users
      if (user) {
        const custRef  = doc(db, "customers", user.uid);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          await updateDoc(custRef, {
            orderCount: increment(1),
            totalSpent: increment(orderTotal),
          });
        }
      }

      clearCart();
      router.push(`/order-confirmation/${ref.id}`);
    },
    [
      user, guestMode, customerName, customerPhone, items, totalPrice, deliveryFee,
      orderTotal, isLusaka, city, area, street, instructions, coords,
      paymentMethod, clearCart, router,
    ]
  );

  // ── Place order handler ──────────────────────────────────────
  const handlePlaceOrder = useCallback(() => {
    setPageError(null);
    if (!paymentMethod) return;

    // COD: create order directly without Flutterwave
    if (paymentMethod === "cod") {
      setPlacing(true);
      createOrder(null).finally(() => setPlacing(false));
      return;
    }

    // All other methods: open Flutterwave inline modal
    txRef.current = `A2ZED-${Date.now()}`;
    setPlacing(true);

    handleFlutterPayment({
      callback: async (response) => {
        console.log("Payment response:", response);
        closePaymentModal();
        const flwResp = response as typeof response & { payment_type?: string };

        if (response.status === "successful" || response.status === "completed") {
          try {
            const vRes  = await fetch("/api/payment/verify", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ transaction_id: response.transaction_id }),
            });
            const vData = await vRes.json() as { status: string };

            if (vData.status === "success") {
              await createOrder({
                transaction_id: response.transaction_id,
                payment_type:   flwResp.payment_type,
                flw_ref:        response.flw_ref,
              });
            } else {
              setPageError("Payment verification failed. Please contact support.");
              setPlacing(false);
            }
          } catch {
            setPageError("Network error during verification. Please contact support.");
            setPlacing(false);
          }
        } else {
          setPageError("Payment was not completed. Please try again.");
          setPlacing(false);
        }
      },
      onClose: () => setPlacing(false),
    });
  }, [paymentMethod, createOrder, handleFlutterPayment]);

  // ── Validation ───────────────────────────────────────────────
  const canSubmit =
    !placing &&
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    area.trim() !== "" &&
    street.trim() !== "" &&
    paymentMethod !== null;

  // ── Loading / guards ─────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Sign-in handlers (inline on checkout) ───────────────────
  const handleGoogleSignIn = async () => {
    setSiError(null);
    setSiLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged fires and sets user → guard disappears automatically
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/popup-closed-by-user") setSiError("Sign in failed. Please try again.");
    } finally {
      setSiLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiError(null);
    setSiLoading(true);
    try {
      await signInWithEmailAndPassword(auth, siEmail, siPassword);
    } catch (err: unknown) {
      const msgs: Record<string, string> = {
        "auth/user-not-found":     "No account with that email.",
        "auth/wrong-password":     "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/invalid-email":      "Invalid email address.",
        "auth/too-many-requests":  "Too many attempts. Try again later.",
      };
      setSiError(msgs[(err as { code?: string })?.code ?? ""] ?? "Sign in failed.");
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (siPassword.length < 8) { setSiError("Password must be at least 8 characters."); return; }
    setSiError(null);
    setSiLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, siEmail, siPassword);
      await updateProfile(cred.user, { displayName: siName });
      await setDoc(doc(db, "customers", cred.user.uid), {
        uid: cred.user.uid, name: siName, email: cred.user.email,
        phone: siPhone, createdAt: serverTimestamp(), totalSpent: 0, orderCount: 0,
      });
    } catch (err: unknown) {
      const msgs: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/invalid-email":        "Invalid email address.",
        "auth/weak-password":        "Password is too weak.",
      };
      setSiError(msgs[(err as { code?: string })?.code ?? ""] ?? "Sign up failed.");
    } finally {
      setSiLoading(false);
    }
  };

  if (!user && !guestMode) {
    const inputCls = "w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green";

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 pb-20 md:pb-0">
        <div className="w-full max-w-sm">

          {/* Icon + heading */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-lightColor" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-darkColor mb-1">Sign in to Checkout</h1>
            <p className="text-sm text-gray-400">
              You need to be signed in to complete your purchase
            </p>
          </div>

          {/* ── Options view ── */}
          {signInView === "options" && (
            <div className="space-y-3">
              {/* Google */}
              <button
                onClick={handleGoogleSignIn}
                disabled={siLoading}
                className="flex items-center justify-center gap-3 w-full h-12 rounded-xl bg-brand_green text-white font-semibold text-sm hover:bg-brand_green_hover transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#fff" opacity=".9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#fff" opacity=".9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fff" opacity=".9" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#fff" opacity=".9" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {siLoading ? "Signing in…" : "Sign In with Google"}
              </button>

              {/* Email */}
              <button
                onClick={() => { setSiError(null); setSignInView("email"); }}
                className="flex items-center justify-center w-full h-12 rounded-xl border-2 border-brand_green text-brand_green font-semibold text-sm hover:bg-brand_green/5 transition-colors"
              >
                Sign In with Email
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Guest */}
              <button
                onClick={() => { setGuestMode(true); }}
                className="w-full text-sm font-medium text-lightColor hover:text-darkColor transition-colors py-2"
              >
                Continue as Guest <ChevronRight className="inline w-4 h-4" />
              </button>

              {siError && <p className="text-xs text-brand_red text-center">{siError}</p>}

              <div className="pt-2 text-center">
                <Link href="/cart" className="text-xs text-gray-400 hover:text-darkColor flex items-center justify-center gap-0.5">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back to Cart
                </Link>
              </div>
            </div>
          )}

          {/* ── Email sign-in form ── */}
          {signInView === "email" && (
            <div className="space-y-3">
              <button
                onClick={() => { setSiError(null); setSignInView("options"); }}
                className="text-sm text-gray-400 hover:text-darkColor flex items-center gap-1 mb-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="Email address" required className={inputCls} />
                <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="Password" required className={inputCls} />
                {siError && <p className="text-xs text-brand_red">{siError}</p>}
                <button type="submit" disabled={siLoading}
                  className="w-full h-11 rounded-xl bg-brand_green text-white font-semibold text-sm hover:bg-brand_green_hover transition-colors disabled:opacity-50">
                  {siLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 pt-1">
                New customer?{" "}
                <button onClick={() => { setSiError(null); setSignInView("signup"); }}
                  className="text-brand_green font-semibold hover:underline">
                  Create account
                </button>
              </p>
            </div>
          )}

          {/* ── Sign up form ── */}
          {signInView === "signup" && (
            <div className="space-y-3">
              <button
                onClick={() => { setSiError(null); setSignInView("email"); }}
                className="text-sm text-gray-400 hover:text-darkColor flex items-center gap-1 mb-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <p className="text-sm font-bold text-darkColor">Create Account</p>

              <form onSubmit={handleSignUp} className="space-y-3">
                <input type="text" value={siName} onChange={(e) => setSiName(e.target.value)}
                  placeholder="Full Name" required className={inputCls} />
                <input type="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="Email address" required className={inputCls} />
                <input type="password" value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="Password (min 8 chars)" required minLength={8} className={inputCls} />
                <input type="tel" value={siPhone} onChange={(e) => setSiPhone(e.target.value)}
                  placeholder="+260 97X XXX XXX (for mobile money)" className={inputCls} />
                {siError && <p className="text-xs text-brand_red">{siError}</p>}
                <button type="submit" disabled={siLoading}
                  className="w-full h-11 rounded-xl bg-brand_red text-white font-semibold text-sm hover:bg-brand_red_hover transition-colors disabled:opacity-50">
                  {siLoading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Order summary sub-component ──────────────────────────────
  const orderSummary = (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-darkColor">Order Summary</h2>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-darkColor line-clamp-1">{item.name}</p>
              {item.colorName && (
                <p className="text-[11px] text-gray-400">{item.colorName}{item.size ? ` · ${item.size}` : ""}</p>
              )}
              <p className="text-[11px] text-gray-400">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-bold text-darkColor shrink-0">
              K {(item.price * item.quantity).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal</span>
          <span className="font-medium text-darkColor">K {totalPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Delivery ({isLusaka ? "Lusaka" : "Outside Lusaka"})</span>
          <span className="font-medium text-darkColor">K {deliveryFee}</span>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-2">
          <span className="font-bold text-darkColor">Total</span>
          <span className="text-lg font-bold text-darkColor">K {orderTotal.toLocaleString()}</span>
        </div>
        <p className="text-[11px] text-gray-400 text-right">Prices in Zambian Kwacha (ZMW)</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">

        {/* Page title */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
          <Link href="/cart" className="hover:text-brand_green transition-colors">Cart</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-darkColor">Checkout</span>
        </div>

        <div className="grid md:grid-cols-[60%_40%] gap-6 items-start">

          {/* ── LEFT: Form ───────────────────────────────────── */}
          <div className="space-y-5">

            {/* ── SECTION 1: Contact ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <SectionHeading number={1} title="Contact Information" />
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                  {user ? (
                    <input
                      type="email"
                      value={user.email ?? ""}
                      readOnly
                      className="w-full h-10 px-3 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                  ) : (
                    <input
                      type="email"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                    />
                  )}
                </div>
                {guestMode && (
                  <p className="text-xs text-gray-400 bg-amber-50 rounded-lg px-3 py-2">
                    Checking out as guest.{" "}
                    <button
                      type="button"
                      onClick={() => setGuestMode(false)}
                      className="text-brand_green font-semibold hover:underline"
                    >
                      Sign in instead
                    </button>
                  </p>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+260 97X XXX XXX"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 2: Delivery ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <SectionHeading number={2} title="Delivery" />

              {/* GPS button */}
              <button
                onClick={handleGPS}
                disabled={gpsStatus === "loading"}
                className="flex items-center gap-2 h-9 px-4 rounded-lg border-2 border-brand_green text-brand_green text-sm font-semibold hover:bg-brand_green/5 transition-colors mb-4 disabled:opacity-50"
              >
                <MapPin className="w-4 h-4" />
                {gpsStatus === "loading" ? "Detecting location…" : "Use My Current Location"}
              </button>
              {gpsStatus === "success" && (
                <p className="text-sm text-brand_green font-semibold mb-3 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Location detected — please verify your address
                </p>
              )}
              {gpsStatus === "error" && (
                <p className="text-xs text-brand_red mb-3">Could not detect location.</p>
              )}
              {gpsStatus === "denied" && (
                <p className="text-xs text-brand_red mb-3">
                  Please enable location access in your browser settings.
                </p>
              )}

              {/* Address fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    Area / Neighbourhood
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Kabulonga, Woodlands, Chelstone"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    Street Address / Landmark
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. House 23, Cairo Road, near Shoprite"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Lusaka, Kitwe, Ndola"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-brand_green" /> Delivery fee:{" "}
                    <span className="font-semibold text-darkColor">K{deliveryFee}</span>
                    {city.trim() === "" ? (
                      <span className="text-gray-400"> (Enter city to calculate)</span>
                    ) : !isLusaka ? (
                      <span className="text-gray-400"> — Outside Lusaka delivery</span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    Special Instructions <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Gate colour, nearby landmark…"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green resize-none"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION 3: Payment ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <SectionHeading number={3} title="Payment Method" />

              <div className="space-y-3">

                {/* Airtel Money */}
                <PaymentCard
                  id="airtel" selected={paymentMethod === "airtel"}
                  onClick={() => setPaymentMethod("airtel")}
                  icon={<div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold">airtel</div>}
                  name="Airtel Money"
                  description="Pay with your Airtel mobile money account"
                >
                  <input type="tel" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)}
                    placeholder="+260 97X XXX XXX"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green" />
                </PaymentCard>

                {/* MTN */}
                <PaymentCard
                  id="mtn" selected={paymentMethod === "mtn"}
                  onClick={() => setPaymentMethod("mtn")}
                  icon={<div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 text-[10px] font-bold">MTN</div>}
                  name="MTN Mobile Money"
                  description="Pay with your MTN mobile money account"
                >
                  <input type="tel" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)}
                    placeholder="+260 97X XXX XXX"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green" />
                </PaymentCard>

                {/* Zamtel */}
                <PaymentCard
                  id="zamtel" selected={paymentMethod === "zamtel"}
                  onClick={() => setPaymentMethod("zamtel")}
                  icon={<div className="w-10 h-10 rounded-full bg-brand_green flex items-center justify-center text-white text-[9px] font-bold">Zamtel</div>}
                  name="Zamtel Kwacha"
                  description="Pay with your Zamtel mobile money account"
                >
                  <input type="tel" value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)}
                    placeholder="+260 97X XXX XXX"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green" />
                </PaymentCard>

                {/* Card */}
                <PaymentCard
                  id="card" selected={paymentMethod === "card"}
                  onClick={() => setPaymentMethod("card")}
                  icon={<CreditCard className="w-8 h-8 text-gray-500" />}
                  name="Credit / Debit Card"
                  description="Visa, Mastercard — secure card payment"
                />

                {/* COD — only for customers with totalSpent >= 1000 */}
                {(customerData?.totalSpent ?? 0) >= 1000 && (
                  <PaymentCard
                    id="cod" selected={paymentMethod === "cod"}
                    onClick={() => setPaymentMethod("cod")}
                    icon={<Banknote className="w-8 h-8 text-gray-500" />}
                    name="Cash on Delivery"
                    description="Pay when your order arrives"
                  >
                    <p className="text-xs text-brand_gold font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Available for trusted customers only
                    </p>
                  </PaymentCard>
                )}
              </div>

              {/* Error */}
              {pageError && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-brand_red">{pageError}</p>
                </div>
              )}

              {/* Place order button */}
              <button
                onClick={handlePlaceOrder}
                disabled={!canSubmit}
                className={`mt-5 w-full h-14 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors ${
                  canSubmit
                    ? "bg-brand_red text-white hover:bg-brand_red_hover"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {placing
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing…
                    </span>
                  : paymentMethod === "cod"
                  ? `PLACE ORDER — K ${orderTotal.toLocaleString()}`
                  : `PAY K ${orderTotal.toLocaleString()} NOW`}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Order Summary (sticky on desktop) ──────── */}
          <div className="hidden md:block sticky top-4">
            {orderSummary}
          </div>
        </div>

        {/* Mobile: show summary above form */}
        <div className="md:hidden mt-4">
          {orderSummary}
        </div>
      </div>
    </div>
  );
}
