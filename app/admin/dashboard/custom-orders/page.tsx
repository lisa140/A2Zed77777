"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "new"
  | "searching"
  | "found"
  | "not_found"
  | "ordered"
  | "discarded";

interface CustomOrder {
  id:                string;
  userId:            string;
  customerName:      string;
  customerEmail:     string;
  customerPhone:     string;
  contactPreference: string;
  productName:       string;
  description:       string;
  referenceImage:    string | null;
  status:            OrderStatus;
  adminNotes:        string;
  quotedPrice:       number | null;
  quotedImages:      string[];
  quotedProductId:   string | null;
  customerNotified:  boolean;
  customerActioned:  boolean;
  createdAt?:        { seconds: number };
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  new:       "bg-blue-100 text-blue-700",
  searching: "bg-yellow-100 text-yellow-700",
  found:     "bg-green-100 text-green-700",
  not_found: "bg-red-100 text-red-600",
  ordered:   "bg-purple-100 text-purple-700",
  discarded: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new:       "New",
  searching: "Searching",
  found:     "Found",
  not_found: "Not Found",
  ordered:   "Ordered",
  discarded: "Discarded",
};

const ALL_STATUSES: OrderStatus[] = [
  "new", "searching", "found", "not_found", "ordered", "discarded",
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const PAGE_SIZE = 10;

// ── Image upload helper ───────────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const res  = await fetch("/api/upload", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ data: reader.result as string }),
        });
        const json = await res.json() as { url?: string; error?: string };
        if (!json.url) throw new Error(json.error ?? "Upload failed");
        resolve(json.url);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

// ── Image slot ────────────────────────────────────────────────────────────────

interface ImgSlotState {
  url:       string | null;
  preview:   string | null;
  uploading: boolean;
  tab:       "upload" | "url";
  urlInput:  string;
}

function emptySlot(): ImgSlotState {
  return { url: null, preview: null, uploading: false, tab: "upload", urlInput: "" };
}

function ImageSlot({
  slot,
  onChange,
  onRemove,
}: {
  slot:     ImgSlotState;
  onChange: (patch: Partial<ImgSlotState>) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ preview: URL.createObjectURL(file), uploading: true, url: null });
    try {
      const url = await uploadToCloudinary(file);
      onChange({ url, uploading: false });
    } catch {
      onChange({ preview: null, uploading: false });
    }
  };

  const applyUrl = () => {
    const u = slot.urlInput.trim();
    if (u) onChange({ url: u, preview: u });
  };

  if (slot.preview) {
    return (
      <div className="relative w-20 h-20">
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
          <Image src={slot.preview} alt="Product" fill sizes="80px" className="object-cover" unoptimized />
          {slot.uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>
        {!slot.uploading && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-400 hover:text-brand_red"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-20 space-y-1">
      <div className="flex gap-0.5">
        {(["upload", "url"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ tab: t })}
            className={`flex-1 h-5 text-[9px] font-semibold rounded transition-colors ${
              slot.tab === t ? "bg-brand_green text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {t === "upload" ? "File" : "URL"}
          </button>
        ))}
      </div>
      {slot.tab === "upload" ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-20 h-14 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-0.5 text-gray-300 hover:border-brand_green hover:text-brand_green transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="text-[9px]">Add</span>
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <input
            type="url"
            value={slot.urlInput}
            onChange={(e) => onChange({ urlInput: e.target.value })}
            placeholder="https://..."
            className="w-20 h-7 px-1.5 text-[10px] border border-gray-200 rounded focus:outline-none focus:border-brand_green"
          />
          <button
            type="button"
            onClick={applyUrl}
            className="w-20 h-5 text-[9px] font-semibold bg-brand_green text-white rounded hover:bg-brand_green_hover"
          >
            Add
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

// ── View Modal ────────────────────────────────────────────────────────────────

function ViewModal({
  order,
  open,
  onClose,
  onMakePublic,
  onDiscardProduct,
}: {
  order:            CustomOrder | null;
  open:             boolean;
  onClose:          () => void;
  onMakePublic:     (productId: string) => Promise<void>;
  onDiscardProduct: (productId: string) => Promise<void>;
}) {
  const [actioning,       setActioning]       = useState(false);
  const [discardConfirm,  setDiscardConfirm]  = useState(false);

  if (!order) return null;

  const alreadyResponded = order.status === "found" || order.status === "not_found";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Order Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
            <span className="text-xs text-gray-400">
              {order.createdAt
                ? new Date(order.createdAt.seconds * 1000).toLocaleDateString("en-ZM", {
                    day: "numeric", month: "short", year: "numeric",
                  })
                : "—"}
            </span>
          </div>

          {/* Customer */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-0.5">
            <p className="font-semibold text-gray-900">{order.customerName || "—"}</p>
            {order.customerEmail && <p className="text-xs text-gray-500">{order.customerEmail}</p>}
            {order.customerPhone && <p className="text-xs text-gray-500">{order.customerPhone}</p>}
            <p className="text-xs text-gray-400 capitalize">Contact via: {order.contactPreference || "—"}</p>
          </div>

          {/* Product */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Product Requested</p>
            <p className="font-bold text-lg text-darkColor leading-snug">{order.productName || "—"}</p>
            {order.description && (
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed bg-gray-50 rounded-lg p-3">
                {order.description}
              </p>
            )}
          </div>

          {/* Reference image */}
          {order.referenceImage && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Reference Image</p>
              <a href={order.referenceImage} target="_blank" rel="noreferrer" className="inline-block">
                <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity">
                  <Image src={order.referenceImage} alt="Reference" fill sizes="160px" className="object-cover" unoptimized />
                </div>
              </a>
            </div>
          )}

          {/* Response summary if already responded */}
          {alreadyResponded && order.status === "found" && (
            <div className="border border-green-200 rounded-xl p-3 bg-green-50/40 space-y-2">
              <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">Quote Sent</p>
              {order.quotedPrice != null && (
                <p className="text-xl font-bold text-green-700">K {order.quotedPrice.toLocaleString()}</p>
              )}
              {order.quotedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {order.quotedImages.map((img, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                      <Image src={img} alt={`Product ${i + 1}`} fill sizes="56px" className="object-cover" unoptimized />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-0.5">Notified: {order.customerNotified ? <><Check className="w-3 h-3 text-brand_green" /> Yes</> : "No"}</span>
                <span className="flex items-center gap-0.5">Actioned: {order.customerActioned ? <><Check className="w-3 h-3 text-brand_green" /> Yes</> : "No"}</span>
              </div>

              {/* Product actions */}
              {order.quotedProductId && (
                <div className="pt-2 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!order.quotedProductId) return;
                      setActioning(true);
                      await onMakePublic(order.quotedProductId);
                      setActioning(false);
                    }}
                    disabled={actioning}
                    className="bg-brand_green hover:bg-brand_green_hover text-white text-xs h-7"
                  >
                    Make Public in Shop
                  </Button>
                  {discardConfirm ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600">Remove product?</span>
                      <button
                        className="text-xs font-bold text-red-600 hover:underline"
                        onClick={async () => {
                          if (!order.quotedProductId) return;
                          setActioning(true);
                          await onDiscardProduct(order.quotedProductId);
                          setDiscardConfirm(false);
                          setActioning(false);
                        }}
                      >Yes</button>
                      <button className="text-xs text-gray-400 hover:underline" onClick={() => setDiscardConfirm(false)}>No</button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDiscardConfirm(true)}
                      disabled={actioning}
                      className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                    >
                      Discard Product
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {alreadyResponded && order.status === "not_found" && (
            <div className="border border-red-200 rounded-xl p-3 bg-red-50/30">
              <p className="text-xs font-semibold text-red-600">Customer was notified — item not found.</p>
            </div>
          )}

          {/* Admin notes */}
          {order.adminNotes && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Admin Notes</p>
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">{order.adminNotes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Found / Quote Modal ───────────────────────────────────────────────────────

function FoundModal({
  order,
  open,
  onClose,
  onSend,
}: {
  order:   CustomOrder | null;
  open:    boolean;
  onClose: () => void;
  onSend:  (
    orderId:       string,
    price:         number,
    images:        string[],
    saveAsProduct: boolean,
  ) => Promise<void>;
}) {
  const [price,         setPrice]         = useState("");
  const [slots,         setSlots]         = useState<ImgSlotState[]>([emptySlot(), emptySlot(), emptySlot()]);
  const [saveAsProduct, setSaveAsProduct] = useState(false);
  const [sending,       setSending]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPrice("");
      setSlots([emptySlot(), emptySlot(), emptySlot()]);
      setSaveAsProduct(false);
      setError(null);
    }
  }, [open]);

  if (!order) return null;

  const patchSlot = (i: number, patch: Partial<ImgSlotState>) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const removeSlot = (i: number) => {
    setSlots((prev) => prev.map((s, idx) => idx === i ? emptySlot() : s));
  };

  const handleSend = async () => {
    const p = parseFloat(price);
    if (!p || p <= 0) { setError("Please enter a valid price."); return; }
    if (slots.some((s) => s.uploading)) { setError("Please wait for images to finish uploading."); return; }
    setSending(true);
    setError(null);
    try {
      const images = slots.map((s) => s.url).filter(Boolean) as string[];
      await onSend(order.id, p, images, saveAsProduct);
      onClose();
    } catch { setError("Failed to send. Please try again."); }
    finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Quote to Customer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Product name */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Product</p>
            <p className="font-semibold text-gray-800">{order.productName}</p>
            <p className="text-xs text-gray-500">{order.customerName}</p>
          </div>

          {/* Price */}
          <div>
            <label htmlFor="quoted-price" className="block text-xs font-semibold text-gray-500 mb-1">
              Quoted Price (K) <span className="text-brand_red">*</span>
            </label>
            <Input
              id="quoted-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1500"
              min={1}
              style={{ MozAppearance: "textfield" } as React.CSSProperties}
              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          {/* Image slots */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Additional Photos <span className="text-gray-400 font-normal">(up to 3, optional)</span>
            </p>
            <div className="flex gap-3 flex-wrap">
              {slots.map((slot, i) => (
                <ImageSlot
                  key={i}
                  slot={slot}
                  onChange={(patch) => patchSlot(i, patch)}
                  onRemove={() => removeSlot(i)}
                />
              ))}
            </div>
          </div>

          {/* Save as product toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setSaveAsProduct((p) => !p)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                saveAsProduct ? "bg-brand_green" : "bg-gray-300"
              }`}
            >
              <span
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ left: saveAsProduct ? "22px" : "2px" }}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-darkColor leading-none">Save as permanent product</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Add this to the shop for other customers too</p>
            </div>
          </label>

          {error && <p className="text-xs text-brand_red">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={sending || !price || parseFloat(price) <= 0 || slots.some((s) => s.uploading)}
            className="bg-brand_green hover:bg-brand_green_hover text-white gap-1"
          >
            {sending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : "Send Quote to Customer →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Simple toast ──────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] bg-brand_green text-white px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2">
      <Check className="w-4 h-4 shrink-0" /> {message}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CustomOrdersPage() {
  const [orders,        setOrders]        = useState<CustomOrder[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [page,          setPage]          = useState(1);

  const [viewOrder,     setViewOrder]     = useState<CustomOrder | null>(null);
  const [foundOrder,    setFoundOrder]    = useState<CustomOrder | null>(null);

  // Not-Found inline confirmation — keyed by order ID
  const [nfConfirm,     setNfConfirm]     = useState<string | null>(null);
  const [nfSending,     setNfSending]     = useState(false);

  // Toast
  const [toast,         setToast]         = useState<string | null>(null);

  const showToast = (msg: string) => setToast(msg);

  // Realtime listener
  useEffect(() => {
    const q = query(collection(db, "customOrders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: CustomOrder[] = snap.docs.map((d) => ({
          id:                d.id,
          userId:            d.data().userId            ?? "",
          customerName:      d.data().customerName      ?? "",
          customerEmail:     d.data().customerEmail     ?? "",
          customerPhone:     d.data().customerPhone     ?? "",
          contactPreference: d.data().contactPreference ?? "",
          productName:       d.data().productName       ?? "",
          description:       d.data().description       ?? "",
          referenceImage:    d.data().referenceImage    ?? null,
          status:            d.data().status            ?? "new",
          adminNotes:        d.data().adminNotes        ?? "",
          quotedPrice:       d.data().quotedPrice       ?? null,
          quotedImages:      d.data().quotedImages      ?? (d.data().quotedImage ? [d.data().quotedImage] : []),
          quotedProductId:   d.data().quotedProductId   ?? null,
          customerNotified:  d.data().customerNotified  ?? false,
          customerActioned:  d.data().customerActioned  ?? false,
          createdAt:         d.data().createdAt         ?? undefined,
        }));
        setOrders(docs);
        setLoading(false);
      },
      (err) => {
        console.error("customOrders snapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Filtering + pagination
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (
        q &&
        !o.customerName.toLowerCase().includes(q) &&
        !o.customerEmail.toLowerCase().includes(q) &&
        !o.productName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSendFound = async (
    orderId:       string,
    price:         number,
    images:        string[],
    saveAsProduct: boolean,
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    let savedProductId: string | null = null;

    if (saveAsProduct && images.length > 0) {
      const prodRef = await addDoc(collection(db, "products"), {
        name:                 order.productName,
        description:          order.description,
        price,
        images,
        category:             "accessories",
        active:               false,
        featured:             false,
        stock:                1,
        isCustomOrderProduct: true,
        customOrderId:        orderId,
        createdAt:            serverTimestamp(),
      });
      savedProductId = prodRef.id;
    }

    if (order.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:          order.userId,
        type:            "custom_order_found",
        customOrderId:   orderId,
        productName:     order.productName,
        quotedPrice:     price,
        quotedImage:     images[0] ?? null,
        quotedProductId: savedProductId,
        message:         `Great news! We found ${order.productName} for K${price.toLocaleString()}`,
        read:            false,
        createdAt:       serverTimestamp(),
      });
    }

    await updateDoc(doc(db, "customOrders", orderId), {
      status:           "found",
      quotedPrice:      price,
      quotedImages:     images,
      quotedProductId:  savedProductId,
      customerNotified: true,
      updatedAt:        serverTimestamp(),
    });

    showToast("Quote sent");
  };

  const handleNotifyNotFound = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    setNfSending(true);
    try {
      if (order.userId) {
        await addDoc(collection(db, "notifications"), {
          userId:          order.userId,
          type:            "custom_order_not_found",
          customOrderId:   orderId,
          productName:     order.productName,
          quotedPrice:     null,
          quotedImage:     null,
          quotedProductId: null,
          message:         `Sorry, we couldn't find ${order.productName} at this time`,
          read:            false,
          createdAt:       serverTimestamp(),
        });
      }
      await updateDoc(doc(db, "customOrders", orderId), {
        status:           "not_found",
        customerNotified: true,
        updatedAt:        serverTimestamp(),
      });
      setNfConfirm(null);
      showToast("Customer notified");
    } finally {
      setNfSending(false);
    }
  };

  const handleMakePublic = async (productId: string) => {
    await updateDoc(doc(db, "products", productId), { active: true });
    showToast("Product is now public");
  };

  const handleDiscardProduct = async (productId: string) => {
    await deleteDoc(doc(db, "products", productId));
    const order = viewOrder;
    if (order) {
      await updateDoc(doc(db, "customOrders", order.id), { quotedProductId: null });
    }
    showToast("Product removed");
  };

  const alreadyResponded = (o: CustomOrder) =>
    o.status === "found" || o.status === "not_found";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Custom Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage custom order requests from customers</p>
        </header>

        {/* Filters */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-3 flex-wrap">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or product…"
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && (
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} request{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Content */}
        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-lg font-medium">
                {orders.length === 0 ? "No custom order requests yet." : "No requests match your search."}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Ref</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((order) => {
                      const responded = alreadyResponded(order);
                      const isNfConfirm = nfConfirm === order.id;

                      return (
                        <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">

                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{order.customerName || "—"}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[130px]">{order.customerEmail}</p>
                          </td>

                          <td className="px-4 py-3 max-w-[180px]">
                            <p className="font-medium text-gray-900 truncate">{order.productName || "—"}</p>
                            <p className="text-xs text-gray-400 line-clamp-1">{order.description}</p>
                          </td>

                          <td className="px-4 py-3">
                            {order.referenceImage ? (
                              <a href={order.referenceImage} target="_blank" rel="noreferrer">
                                <div className="relative w-[52px] h-[52px] rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity">
                                  <Image src={order.referenceImage} alt="ref" fill sizes="52px" className="object-cover" unoptimized />
                                </div>
                              </a>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>

                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {order.createdAt
                              ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                              : "—"}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[order.status]}`}>
                              {STATUS_LABELS[order.status]}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {isNfConfirm ? (
                              /* Inline not-found confirmation */
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-gray-600 whitespace-nowrap">Notify customer?</span>
                                <button
                                  onClick={() => handleNotifyNotFound(order.id)}
                                  disabled={nfSending}
                                  className="h-6 px-2.5 rounded-full bg-brand_red text-white font-semibold hover:opacity-90 disabled:opacity-50"
                                >
                                  {nfSending ? "…" : "Yes"}
                                </button>
                                <button
                                  onClick={() => setNfConfirm(null)}
                                  className="h-6 px-2.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                {/* View */}
                                <button
                                  onClick={() => setViewOrder(order)}
                                  title="View details"
                                  className="h-7 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                                >
                                  <Eye className="w-3 h-3" /> View
                                </button>

                                {/* Found */}
                                <button
                                  onClick={() => !responded && setFoundOrder(order)}
                                  disabled={responded}
                                  title={responded ? "Already responded" : "Mark as found and send quote"}
                                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                                    responded
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-brand_green text-white hover:bg-brand_green_hover"
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" /> Found
                                </button>

                                {/* Not Found */}
                                <button
                                  onClick={() => !responded && setNfConfirm(order.id)}
                                  disabled={responded}
                                  title={responded ? "Already responded" : "Mark as not found"}
                                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                                    responded
                                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      : "bg-brand_red text-white hover:opacity-90"
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Not Found
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="gap-1">
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="gap-1">
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      <ViewModal
        order={viewOrder}
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        onMakePublic={handleMakePublic}
        onDiscardProduct={handleDiscardProduct}
      />
      <FoundModal
        order={foundOrder}
        open={!!foundOrder}
        onClose={() => setFoundOrder(null)}
        onSend={handleSendFound}
      />

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
