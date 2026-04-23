"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, User } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";
import { Upload, X, CheckCircle, Loader2, ClipboardList, Search, MessageCircle, Mail, Folder, Link2 } from "lucide-react";

type ContactPref = "whatsapp" | "email";

export default function CustomOrderPage() {
  const [user,         setUser]         = useState<User | null | undefined>(undefined);
  const [userPhone,    setUserPhone]    = useState("");

  // Form fields
  const [guestName,    setGuestName]    = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [productName,  setProductName]  = useState("");
  const [description,  setDescription]  = useState("");
  const [contactPref,  setContactPref]  = useState<ContactPref>("whatsapp");
  const [refImageUrl,  setRefImageUrl]  = useState<string | null>(null);
  const [refPreview,   setRefPreview]   = useState<string | null>(null);
  const [imageTab,     setImageTab]     = useState<"upload" | "url">("upload");
  const [urlInput,     setUrlInput]     = useState("");

  // UI state
  const [uploading,       setUploading]       = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [submittedProduct,setSubmittedProduct] = useState("");
  const [error,           setError]           = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "customers", u.uid));
          if (snap.exists()) setUserPhone(snap.data().phone ?? "");
        } catch { /* ignore */ }
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch { /* cancelled */ }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setRefPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res  = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: reader.result as string }),
        });
        const json = await res.json() as { url?: string; error?: string };
        if (!json.url) throw new Error(json.error ?? "Upload failed");
        setRefImageUrl(json.url);
      } catch {
        setRefPreview(null);
        setError("Image upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => { setRefPreview(null); setError("Could not read file."); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setRefImageUrl(null); setRefPreview(null); setUrlInput("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUrlApply = () => {
    const url = urlInput.trim();
    if (!url) return;
    setRefImageUrl(url);
    setRefPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, "customOrders"), {
        userId:            user?.uid ?? null,
        customerName:      user ? (user.displayName ?? "") : guestName.trim(),
        customerEmail:     user?.email ?? guestContact.trim(),
        contactPreference: contactPref,
        customerPhone:     user ? userPhone : guestContact.trim(),
        productName:       productName.trim(),
        description:       description.trim(),
        referenceImage:    refImageUrl ?? null,
        status:            "new",
        adminNotes:        "",
        quotedPrice:       null,
        quotedImage:       null,
        quotedProductId:   null,
        customerNotified:  false,
        customerActioned:  false,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });
      setSubmittedProduct(productName.trim());
      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setProductName(""); setDescription(""); setContactPref("whatsapp");
    setRefImageUrl(null); setRefPreview(null); setUrlInput("");
    setGuestName(""); setGuestContact(""); setSubmitted(false); setError(null);
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center gap-5 pb-20 md:pb-0">
        <div className="w-20 h-20 rounded-full bg-brand_green flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-darkColor mb-2 flex items-center justify-center gap-2">Request Submitted! <CheckCircle className="w-6 h-6 text-brand_green" /></h1>
          <p className="text-sm text-gray-400 max-w-xs">
            We&apos;ll search for{" "}
            <strong className="text-darkColor">{submittedProduct}</strong>{" "}
            and get back to you within 24 hours.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {user && (
            <Link
              href="/account"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-brand_green text-white font-semibold text-sm hover:bg-brand_green_hover transition-colors"
            >
              View My Requests
            </Link>
          )}
          <button
            onClick={resetForm}
            className="inline-flex items-center justify-center h-10 px-6 rounded-lg border border-gray-200 text-sm font-medium text-darkColor hover:border-gray-300 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
        {!user && (
          <p className="text-xs text-gray-400 mt-2">
            <button onClick={handleGoogleSignIn} className="font-semibold text-brand_green hover:underline">
              Create an account
            </button>{" "}
            to track your request and get notified faster
          </p>
        )}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────────

  const contactDisplay =
    contactPref === "whatsapp"
      ? user ? (userPhone || "Add phone number in Account settings") : ""
      : user ? (user.email ?? "") : "";

  return (
    <div className="bg-gray-50 min-h-screen pb-24 md:pb-12">

      {/* Hero */}
      <div className="bg-brand_green text-white py-10 px-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Can&apos;t Find It? We&apos;ll Source It For You
        </h1>
        <p className="text-white/80 text-sm max-w-md mx-auto mb-8">
          Tell us what you&apos;re looking for — we&apos;ll search China and get back to you with a price
        </p>
        <div className="flex items-center justify-center gap-8 max-w-sm mx-auto">
          {[
            { icon: <ClipboardList  className="w-6 h-6 text-white/80" />, label: "Submit Request" },
            { icon: <Search         className="w-6 h-6 text-white/80" />, label: "We Search For You" },
            { icon: <MessageCircle  className="w-6 h-6 text-white/80" />, label: "We Notify You" },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              {step.icon}
              <span className="text-[11px] font-semibold text-white/80 text-center leading-tight">
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form card */}
      <div className="max-w-lg mx-auto px-4 pt-8">
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

            {/* Product name */}
            <div>
              <label className="block text-sm font-semibold text-darkColor mb-1.5">
                What are you looking for? <span className="text-brand_red">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                placeholder="e.g. iPhone 15 case, Nike Air Force 1, LED ring light"
                className="w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-darkColor mb-1.5">
                Any details?{" "}
                <span className="text-gray-400 font-normal">(colour, size, brand, model…)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="The more detail you give, the better we can match it"
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green resize-none transition-colors"
              />
            </div>

            {/* Reference image */}
            <div>
              <label className="block text-sm font-semibold text-darkColor mb-0.5">
                Got a photo? Add it here
              </label>
              <p className="text-xs text-gray-400 mb-2">A photo helps us find exactly what you want</p>

              <div className="flex gap-1 mb-3">
                {(["upload", "url"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setImageTab(tab)}
                    className={`px-3 h-7 text-xs font-semibold rounded-full transition-colors ${
                      imageTab === tab
                        ? "bg-brand_green text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {tab === "upload"
                      ? <><Folder className="inline w-3.5 h-3.5 mr-1" />Upload</>
                      : <><Link2  className="inline w-3.5 h-3.5 mr-1" />URL</>
                    }
                  </button>
                ))}
              </div>

              {refPreview ? (
                <div className="relative inline-block">
                  <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200">
                    <Image
                      src={refPreview}
                      alt="Reference"
                      fill
                      sizes="112px"
                      className="object-cover"
                      unoptimized
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-brand_red transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : imageTab === "upload" ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-lightColor hover:border-brand_green hover:text-brand_green transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-medium">Upload a photo or screenshot</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green"
                  />
                  <button
                    type="button"
                    onClick={handleUrlApply}
                    className="h-10 px-4 text-sm font-semibold bg-brand_green text-white rounded-xl hover:bg-brand_green_hover transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Contact preference */}
            <div>
              <label className="block text-sm font-semibold text-darkColor mb-2">
                How should we reach you?
              </label>
              <div className="flex gap-2 mb-3">
                {(["whatsapp", "email"] as ContactPref[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setContactPref(opt)}
                    className={`flex-1 h-10 rounded-xl text-sm font-semibold border-2 transition-colors flex items-center justify-center gap-1.5 ${
                      contactPref === opt
                        ? "bg-brand_green border-brand_green text-white"
                        : "border-gray-200 text-lightColor hover:border-gray-300 bg-white"
                    }`}
                  >
                    {opt === "whatsapp"
                      ? <><MessageCircle className="w-4 h-4" /><span>WhatsApp</span></>
                      : <><Mail          className="w-4 h-4" /><span>Email</span></>
                    }
                  </button>
                ))}
              </div>

              {user ? (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500">
                  We&apos;ll contact you on:{" "}
                  <span className="font-semibold text-darkColor">{contactDisplay}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green"
                  />
                  <input
                    type="text"
                    value={guestContact}
                    onChange={(e) => setGuestContact(e.target.value)}
                    placeholder={
                      contactPref === "whatsapp" ? "+260 97X XXX XXX" : "your@email.com"
                    }
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green"
                  />
                </div>
              )}
            </div>

            {/* Sign-in nudge for guests */}
            {!user && (
              <div className="bg-brand_green/5 rounded-xl p-4 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Sign in</span> to track your request and get
                  notified in-app
                </p>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="text-xs font-bold text-brand_green hover:underline shrink-0"
                >
                  Sign In
                </button>
              </div>
            )}

            {error && <p className="text-sm text-brand_red text-center">{error}</p>}

            <button
              type="submit"
              disabled={!productName.trim() || uploading || submitting}
              className="w-full h-12 rounded-2xl bg-brand_red text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
