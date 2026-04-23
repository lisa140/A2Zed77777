"use client";

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MapPin, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";

type Subject =
  | "General Inquiry"
  | "Order Issue"
  | "Custom Order"
  | "Returns"
  | "Other";

export default function ContactPage() {
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [subject,   setSubject]   = useState<Subject>("General Inquiry");
  const [message,   setMessage]   = useState("");
  const [submitting,setSubmitting]= useState(false);
  const [success,   setSuccess]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, "contactMessages"), {
        name:      name.trim(),
        email:     email.trim(),
        subject,
        message:   message.trim(),
        createdAt: serverTimestamp(),
        status:    "unread",
      });
      setSuccess(true);
      setName(""); setEmail(""); setSubject("General Inquiry"); setMessage("");
    } catch {
      setError("Failed to send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full h-11 px-4 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green transition-colors bg-white";

  return (
    <div className="bg-light_bg min-h-screen py-12 px-4 pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto">

        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-darkColor mb-2">Contact Us</h1>
          <p className="text-gray-500 text-sm">We&apos;d love to hear from you. Send us a message and we&apos;ll respond within 24 hours.</p>
        </div>

        <div className="grid md:grid-cols-[38%_62%] gap-6 items-start">

          {/* ── LEFT: Contact Info ──────────────────────────────────────── */}
          <div className="bg-brand_green rounded-2xl p-8 text-white space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-1">Get in Touch</h2>
              <p className="text-white/70 text-sm">Reach out any time — we&apos;re here to help.</p>
            </div>

            <ul className="space-y-4">
              {[
                { icon: <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-white/70" />, label: "Lusaka, Zambia" },
                { icon: <Phone  className="w-4 h-4 shrink-0 mt-0.5 text-white/70" />, label: "+260 XXX XXX XXX" },
                { icon: <Mail   className="w-4 h-4 shrink-0 mt-0.5 text-white/70" />, label: "contact@a2zedstore.com" },
                { icon: <Clock  className="w-4 h-4 shrink-0 mt-0.5 text-white/70" />, label: "Mon–Fri: 8AM – 6PM CAT" },
              ].map((item) => (
                <li key={item.label} className="flex items-start gap-3 text-sm">
                  {item.icon}
                  <span className="text-white/90">{item.label}</span>
                </li>
              ))}
            </ul>

            {/* Social icons */}
            <div>
              <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-3">Find Us On</p>
              <div className="flex items-center gap-3">
                {[
                  { label: "WhatsApp", href: "https://wa.me/260000000000", icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  )},
                  { label: "Facebook", href: "#", icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )},
                  { label: "Instagram", href: "#", icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                  )},
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <Link
                href="/custom-order"
                className="text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2"
              >
                Or submit a Custom Order request →
              </Link>
            </div>
          </div>

          {/* ── RIGHT: Contact Form ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-darkColor mb-5">Send us a Message</h2>

            {success ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand_green/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-brand_green" />
                </div>
                <div>
                  <p className="font-bold text-darkColor">Message sent!</p>
                  <p className="text-sm text-gray-400 mt-1">
                    We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-sm text-brand_green hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form id="contact-form" name="contact" onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-gray-500 mb-1">
                    Full Name <span className="text-brand_red">*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold text-gray-500 mb-1">
                    Email <span className="text-brand_red">*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-semibold text-gray-500 mb-1">
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as Subject)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {(["General Inquiry", "Order Issue", "Custom Order", "Returns", "Other"] as Subject[]).map(
                      (s) => <option key={s} value={s}>{s}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-gray-500 mb-1">
                    Message <span className="text-brand_red">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="How can we help you?"
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand_green transition-colors resize-none"
                  />
                </div>

                {error && <p className="text-xs text-brand_red">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-brand_red text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : "Send Message"}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
