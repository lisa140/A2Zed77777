"use client";

import { useEffect, useRef, useState } from "react";
import { auth, googleProvider, db } from "@/lib/firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, LogOut, ShoppingBag, User as UserIcon } from "lucide-react";

type FormView = "idle" | "signin" | "signup" | "phone-prompt";

const GoogleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function AuthButtons() {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [view, setView]               = useState<FormView>("idle");
  const wrapperRef                    = useRef<HTMLDivElement>(null);

  // Form fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [formError, setFormError]   = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Auth state listener + customer doc check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        const snap = await getDoc(doc(db, "customers", currentUser.uid));
        if (!snap.exists()) {
          // No customer doc yet — prompt for phone
          setView("phone-prompt");
          setDropdownOpen(true);
        } else {
          setView("idle");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const resetForm = () => {
    setEmail(""); setPassword(""); setName(""); setPhone("");
    setFormError(null); setFormLoading(false);
  };

  const closeAll = () => {
    setDropdownOpen(false);
    setView("idle");
    resetForm();
  };

  // ── Handlers ────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setFormError(null);
    setFormLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // customer doc check happens in onAuthStateChanged
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setFormError("Sign in failed. Please try again.");
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeAll();
    } catch (err: any) {
      const msgs: Record<string, string> = {
        "auth/user-not-found":   "No account with that email.",
        "auth/wrong-password":   "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/invalid-email":    "Invalid email address.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
      };
      setFormError(msgs[err.code] ?? "Sign in failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setFormLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "customers", cred.user.uid), {
        uid:        cred.user.uid,
        name,
        email:      cred.user.email,
        phone,
        createdAt:  serverTimestamp(),
        totalSpent: 0,
        orderCount: 0,
      });
      closeAll();
    } catch (err: any) {
      const msgs: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/invalid-email":        "Invalid email address.",
        "auth/weak-password":        "Password is too weak.",
      };
      setFormError(msgs[err.code] ?? "Sign up failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setFormLoading(true);
    try {
      await setDoc(doc(db, "customers", user.uid), {
        uid:        user.uid,
        name:       user.displayName ?? "",
        email:      user.email ?? "",
        phone,
        createdAt:  serverTimestamp(),
        totalSpent: 0,
        orderCount: 0,
      });
      closeAll();
    } catch {
      setFormError("Failed to save. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    try { await signOut(auth); } catch { /* silent */ }
  };

  // ── Shared input class ───────────────────────────────────────
  const inputCls = "w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-brand_green focus:ring-1 focus:ring-brand_green/20";

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />;
  }

  // ── LOGGED IN ────────────────────────────────────────────────
  if (user) {
    return (
      <div className="relative flex-shrink-0" ref={wrapperRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={dropdownOpen}
          className="flex items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=1B6B2F&color=fff`}
            alt={user.displayName || "User"}
            className="w-8 h-8 rounded-full object-cover border-2 border-brand_green hover:border-brand_green_hover hoverEffect"
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50">

            {/* Phone prompt for new Google users */}
            {view === "phone-prompt" ? (
              <div className="p-4 space-y-3">
                <p className="text-sm font-semibold text-darkColor">Complete your profile</p>
                <p className="text-xs text-gray-400">
                  Add your phone number to enable mobile money payments.
                </p>
                <form onSubmit={handleSavePhone} className="space-y-3">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+260 97X XXX XXX"
                    required
                    className={inputCls}
                  />
                  {formError && <p className="text-xs text-brand_red">{formError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={formLoading}
                      className="flex-1 h-9 rounded-lg bg-brand_green text-white text-sm font-semibold hover:bg-brand_green_hover transition-colors disabled:opacity-50"
                    >
                      {formLoading ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={closeAll}
                      className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-400 font-medium truncate">
                    {user.displayName || user.email || "User"}
                  </p>
                </div>
                <Link href="/account" onClick={closeAll}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-darkColor hover:bg-brand_green_light hoverEffect">
                  <UserIcon className="w-4 h-4 flex-shrink-0" /> My Account
                </Link>
                <Link href="/orders" onClick={closeAll}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-darkColor hover:bg-brand_green_light hoverEffect">
                  <ShoppingBag className="w-4 h-4 flex-shrink-0" /> My Orders
                </Link>
                <div className="border-t border-gray-100">
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-darkColor hover:bg-brand_green_light hoverEffect">
                    <LogOut className="w-4 h-4 flex-shrink-0" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── LOGGED OUT ───────────────────────────────────────────────
  return (
    <div className="relative flex-shrink-0" ref={wrapperRef}>
      <button
        onClick={() => {
          if (!dropdownOpen) { resetForm(); setView("signin"); }
          setDropdownOpen((v) => !v);
        }}
        aria-expanded={dropdownOpen}
        className={[
          "text-sm font-semibold hoverEffect whitespace-nowrap",
          "text-brand_green hover:text-brand_green_hover min-h-[44px] min-w-[44px] flex items-center justify-center",
          "lg:min-h-0 lg:min-w-0 lg:text-white lg:bg-brand_green lg:px-4 lg:py-2 lg:rounded-md lg:hover:bg-brand_green_hover",
        ].join(" ")}
      >
        Sign In
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-100 overflow-hidden z-50">

          {/* ── Sign In View ── */}
          {view === "signin" && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Sign in to your account
              </p>

              {/* Google */}
              <button
                onClick={handleGoogleLogin}
                disabled={formLoading}
                className="flex items-center gap-3 w-full h-10 px-4 rounded-lg border border-gray-200 text-sm font-semibold text-darkColor hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <GoogleIcon />
                Sign in with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Email / password */}
              <form onSubmit={handleEmailSignIn} className="space-y-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email" required className={inputCls} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" required className={inputCls} />
                {formError && <p className="text-xs text-brand_red">{formError}</p>}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-9 rounded-lg bg-brand_green text-white text-sm font-semibold hover:bg-brand_green_hover transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500">
                New customer?{" "}
                <button
                  onClick={() => { resetForm(); setView("signup"); }}
                  className="text-brand_green font-semibold hover:underline"
                >
                  Create account
                </button>
              </p>
            </div>
          )}

          {/* ── Sign Up View ── */}
          {view === "signup" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => { resetForm(); setView("signin"); }}
                  className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /></button>
                <p className="text-sm font-semibold text-darkColor">Create Account</p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-2">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name" required className={inputCls} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email" required className={inputCls} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 chars)" required minLength={8} className={inputCls} />
                <div>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+260 97X XXX XXX" className={inputCls} />
                  <p className="text-[11px] text-gray-400 mt-1">Used for mobile money payments</p>
                </div>
                {formError && <p className="text-xs text-brand_red">{formError}</p>}
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-9 rounded-lg bg-brand_red text-white text-sm font-semibold hover:bg-brand_red_hover transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Creating account…" : "Create Account"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
