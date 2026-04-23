"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getPaletteSync } from "colorthief";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ImagePlus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SizeEntry {
  label: string;
  stock: number;
}

/** Color entry as it lives in Firestore */
interface ColorSavedEntry {
  name: string;
  hex: string;
  images: string[];       // up to 4 image URLs; first is the main colour image
  variants: SizeEntry[];
}

/** Color entry while the form is open (images may still be local Files) */
interface ColorFormEntry {
  name: string;
  hex: string;
  imageSlots: [SlotSource, SlotSource, SlotSource, SlotSource];
  variants:   SizeEntry[];
  sameQty:    boolean;
  globalQty:  number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  stock: number;
  featured: boolean;
  active: boolean;
  // Dynamic variant fields
  hasColors?: boolean;
  hasVariants?: boolean;
  variantType?: "size" | "custom" | null;
  sizingType?: "US" | "UK-numeric" | "UK-alpha";
  variantLabel?: string;
  variants?: SizeEntry[];
  colors?: ColorSavedEntry[];
}

type SlotSource =
  | { kind: "url"; url: string }
  | { kind: "file"; file: File; preview: string }
  | null;

interface ProductForm {
  name: string;
  description: string;
  price: string;
  category: string;
  subcategory: string;
  stock: string;
  featured: boolean;
  active: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  description: "",
  price: "",
  category: "",
  subcategory: "",
  stock: "",
  featured: false,
  active: true,
};

const EMPTY_SLOTS = (): [SlotSource, SlotSource, SlotSource, SlotSource] =>
  [null, null, null, null];

// ── Category rules ─────────────────────────────────────────────────────────────

const SIZING_CATEGORIES  = ["Women", "Men", "Accessories"];
const VARIANT_CATEGORIES = ["Electronics", "Beauty", "Home & Living", "Car Parts"];

const US_SIZES         = ["XS", "S", "M", "L", "XL", "XXL"];
const UK_NUMERIC_SIZES = ["32", "34", "36", "38", "40", "42"];
const UK_ALPHA_SIZES   = ["6",  "8", "10", "12", "14", "16", "18"];

const FILTER_CATEGORIES = [
  "All",
  "Women",
  "Men",
  "Electronics",
  "Beauty",
  "Home & Living",
  "Car Parts",
  "Accessories",
];

const MODAL_CATEGORIES = [
  "Women",
  "Men",
  "Electronics",
  "Beauty",
  "Home & Living",
  "Car Parts",
  "Accessories",
];

const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function uploadToCloudinary(dataUri: string): Promise<string> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: dataUri }),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
  return json.url as string;
}

// Removes number-input spinner arrows cross-browser
const noSpinStyle: React.CSSProperties = { MozAppearance: "textfield" } as React.CSSProperties;
const NO_SPIN = "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]";

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({
  open,
  name,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete product?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          This will permanently delete <strong>"{name}"</strong>. This action
          cannot be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Image slot grid ───────────────────────────────────────────────────────────

function ImageGrid({
  slots,
  onChange,
}: {
  slots: [SlotSource, SlotSource, SlotSource, SlotSource];
  onChange: (next: [SlotSource, SlotSource, SlotSource, SlotSource]) => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [slotMode, setSlotMode]   = useState<"upload" | "url">("upload");
  const [urlDraft, setUrlDraft]   = useState("");
  const fileInputRef              = useRef<HTMLInputElement>(null);

  const updateSlot = (idx: number, val: SlotSource) => {
    const next = [...slots] as [SlotSource, SlotSource, SlotSource, SlotSource];
    next[idx] = val;
    onChange(next);
  };

  const openSlot    = (idx: number) => { setActiveIdx(idx); setSlotMode("upload"); setUrlDraft(""); };
  const closePanel  = () => { setActiveIdx(null); setUrlDraft(""); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeIdx === null) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateSlot(activeIdx, { kind: "file", file, preview: ev.target?.result as string });
      closePanel();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddUrl = () => {
    if (!urlDraft.trim() || activeIdx === null) return;
    updateSlot(activeIdx, { kind: "url", url: urlDraft.trim() });
    closePanel();
  };

  const removeSlot = (idx: number) => {
    updateSlot(idx, null);
    if (activeIdx === idx) closePanel();
  };

  const getSrc = (slot: SlotSource) =>
    !slot ? null : slot.kind === "url" ? slot.url : slot.preview;

  return (
    <div className="space-y-3">
      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {slots.map((slot, idx) => {
          const src     = getSrc(slot);
          const isFirst = idx === 0;
          return (
            <div key={idx} className="space-y-1">
              {isFirst && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Main Image
                </span>
              )}
              <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50">
                {src ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Product image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openSlot(idx)}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-brand_green transition-colors"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs font-medium">Add Image</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

      {/* Inline slot panel */}
      {activeIdx !== null && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Image {activeIdx + 1}</span>
            <button type="button" onClick={closePanel} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
            <button type="button" onClick={() => setSlotMode("upload")} className={`flex-1 py-1.5 transition-colors ${slotMode === "upload" ? "bg-brand_red text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Upload from device
            </button>
            <button type="button" onClick={() => setSlotMode("url")} className={`flex-1 py-1.5 transition-colors ${slotMode === "url" ? "bg-brand_red text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              Paste URL
            </button>
          </div>
          {slotMode === "upload" ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-brand_red hover:bg-brand_red_hover transition-colors">
              Choose File
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="https://res.cloudinary.com/..." className="text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddUrl()} />
                <Button type="button" size="sm" onClick={handleAddUrl} className="bg-brand_red hover:bg-brand_red_hover text-white shrink-0">Add</Button>
              </div>
              {urlDraft.trim() && (
                <div className="rounded overflow-hidden border border-gray-200 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlDraft} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Colour image slot picker (thumbnail strip, no empty boxes) ────────────────

function ColourImageSlots({
  slots,
  onChange,
}: {
  slots: [SlotSource, SlotSource, SlotSource, SlotSource];
  onChange: (next: [SlotSource, SlotSource, SlotSource, SlotSource]) => void;
}) {
  const [addMode, setAddMode]   = useState<"upload" | "url">("upload");
  const [urlDraft, setUrlDraft] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filledCount = slots.filter((s) => s !== null).length;
  const nextIdx     = slots.findIndex((s) => s === null);

  const removeSlot = (idx: number) => {
    // Remove and compact left
    const arr = [...slots] as (SlotSource)[];
    arr.splice(idx, 1);
    arr.push(null);
    onChange(arr as [SlotSource, SlotSource, SlotSource, SlotSource]);
  };

  const addSlot = (val: SlotSource) => {
    if (nextIdx === -1) return;
    const next = [...slots] as [SlotSource, SlotSource, SlotSource, SlotSource];
    next[nextIdx] = val;
    onChange(next);
    setShowPanel(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addSlot({ kind: "file", file, preview: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddUrl = () => {
    if (!urlDraft.trim()) return;
    addSlot({ kind: "url", url: urlDraft.trim() });
    setUrlDraft("");
  };

  const getSrc = (slot: SlotSource) =>
    !slot ? null : slot.kind === "url" ? slot.url : slot.preview;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        {slots.map((slot, idx) => {
          const src = getSrc(slot);
          if (!src) return null;
          return (
            <div key={idx} className="flex flex-col items-center gap-0.5">
              <div className="relative w-20 h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Colour image ${idx + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-200"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {idx === 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand_green">Main</span>
              )}
            </div>
          );
        })}

        {filledCount < 4 && (
          <button
            type="button"
            onClick={() => { setShowPanel((v) => !v); setAddMode("upload"); setUrlDraft(""); }}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-brand_green text-brand_green flex flex-col items-center justify-center gap-1 hover:bg-brand_green/5 transition-colors text-xs font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Add Photo</span>
          </button>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

      {showPanel && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Add Photo</span>
            <button type="button" onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
            <button type="button" onClick={() => setAddMode("upload")} className={`flex-1 py-1.5 transition-colors ${addMode === "upload" ? "bg-brand_red text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Upload from device</button>
            <button type="button" onClick={() => setAddMode("url")} className={`flex-1 py-1.5 transition-colors ${addMode === "url" ? "bg-brand_red text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>Paste URL</button>
          </div>
          {addMode === "upload" ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-brand_red hover:bg-brand_red_hover transition-colors">
              Choose File
            </button>
          ) : (
            <div className="flex gap-2">
              <Input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="https://…" className="text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddUrl()} />
              <Button type="button" size="sm" onClick={handleAddUrl} className="bg-brand_red hover:bg-brand_red_hover text-white shrink-0">Add</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Size grid ─────────────────────────────────────────────────────────────────
// Reusable — used both for standalone sizing and per-colour sizing.

function SizeGrid({
  sizes,
  selected,
  onChange,
  sameQty  = false,
  globalQty = 0,
}: {
  sizes: string[];
  selected: SizeEntry[];
  onChange: (next: SizeEntry[]) => void;
  sameQty?:   boolean;
  globalQty?:  number;
}) {
  const isActive = (label: string) => selected.some((s) => s.label === label);
  const getStock = (label: string) => selected.find((s) => s.label === label)?.stock ?? 0;

  const toggle = (label: string) => {
    if (isActive(label)) {
      onChange(selected.filter((s) => s.label !== label));
    } else {
      // When sameQty is ON, newly added sizes inherit globalQty automatically
      onChange([...selected, { label, stock: sameQty ? globalQty : 0 }]);
    }
  };

  const setStock = (label: string, stock: number) => {
    onChange(selected.map((s) => s.label === label ? { ...s, stock } : s));
  };

  return (
    <div className="flex flex-wrap gap-3">
      {sizes.map((label) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => toggle(label)}
            className={`w-14 h-10 rounded border text-sm font-medium transition-colors ${
              isActive(label)
                ? "bg-brand_green text-white border-brand_green"
                : "bg-white text-gray-700 border-gray-300 hover:border-brand_green"
            }`}
          >
            {label}
          </button>
          {isActive(label) && (
            <input
              type="number"
              min={0}
              value={sameQty
                ? (globalQty === 0 ? "" : globalQty)
                : (getStock(label) === 0 ? "" : getStock(label))}
              readOnly={sameQty}
              onChange={(e) => {
                if (sameQty) return;
                const v = e.target.value;
                const parsed = v === "" ? 0 : parseInt(v, 10);
                if (!isNaN(parsed)) setStock(label, parsed);
              }}
              onFocus={(e) => e.target.select()}
              style={noSpinStyle}
              className={`w-14 h-8 text-center text-xs border rounded focus:outline-none ${NO_SPIN} ${
                sameQty
                  ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                  : "border-gray-300 focus:border-brand_green"
              }`}
              placeholder="0"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Add / Edit product modal ──────────────────────────────────────────────────

function ProductFormModal({
  open,
  editProduct,
  onClose,
  onSaved,
}: {
  open: boolean;
  editProduct: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // ── Core form ──────────────────────────────────────────────────────────────
  const [form, setForm]     = useState<ProductForm>(EMPTY_FORM);
  const [slots, setSlots]   = useState<[SlotSource, SlotSource, SlotSource, SlotSource]>(EMPTY_SLOTS());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!editProduct;

  // ── Sizing state ───────────────────────────────────────────────────────────
  const [sizingType, setSizingType]       = useState<"US" | "UK-numeric" | "UK-alpha">("US");
  const [selectedSizes, setSelectedSizes] = useState<SizeEntry[]>([]);
  const [sameQty, setSameQty]             = useState(false);
  const [globalQty, setGlobalQty]         = useState(0);

  // ── Colours state ──────────────────────────────────────────────────────────
  const [hasColors, setHasColors]           = useState(false);
  const [colors, setColors]                 = useState<ColorFormEntry[]>([]);
  const [activeColorTab, setActiveColorTab] = useState(0);
  const [showColorAdd, setShowColorAdd]     = useState(false);

  // Colour draft (fields for the inline "Add Colour" panel)
  const [cdName, setCdName]           = useState("");
  const [cdHex, setCdHex]             = useState("#000000");
  const [cdSlots, setCdSlots]         = useState<[SlotSource, SlotSource, SlotSource, SlotSource]>([null, null, null, null]);
  const [cdSuggested, setCdSuggested] = useState<string[]>([]);
  const [cdAdding, setCdAdding]       = useState(false);
  const colorCanvasRef                = useRef<HTMLCanvasElement>(null);
  const colorImgRef                   = useRef<HTMLImageElement>(null);
  const colorInputRef                 = useRef<HTMLInputElement>(null);
  const editColorInputRef             = useRef<HTMLInputElement>(null);

  // Colour draft — per-colour sizing in add panel
  const [cdVariants, setCdVariants]   = useState<SizeEntry[]>([]);
  const [cdSameQty, setCdSameQty]     = useState(false);
  const [cdGlobalQty, setCdGlobalQty] = useState(0);

  // ── Variants state ─────────────────────────────────────────────────────────
  const [hasVariants, setHasVariants]   = useState(false);
  const [variantLabel, setVariantLabel] = useState("");
  const [variants, setVariants]         = useState<SizeEntry[]>([]);
  const [variantInput, setVariantInput] = useState("");

  // ── Derived ────────────────────────────────────────────────────────────────
  const showSizing        = SIZING_CATEGORIES.includes(form.category);
  const showVariantSection = VARIANT_CATEGORIES.includes(form.category);
  const currentSizes      = sizingType === "US"         ? US_SIZES
    : sizingType === "UK-numeric" ? UK_NUMERIC_SIZES
    : UK_ALPHA_SIZES;

  // Derived: first colour-draft image slot → eyedropper + ColorThief source
  const cdSrc = cdSlots[0]
    ? (cdSlots[0].kind === "url" ? cdSlots[0].url : cdSlots[0].preview)
    : null;

  const totalStock = useMemo(() => {
    if (showSizing && hasColors && colors.length > 0) {
      return colors.reduce((sum, c) => sum + c.variants.reduce((s, v) => s + v.stock, 0), 0);
    }
    if (showSizing) {
      return selectedSizes.reduce((sum, s) => sum + s.stock, 0);
    }
    if (showVariantSection && hasVariants) {
      return variants.reduce((sum, v) => sum + v.stock, 0);
    }
    return Number(form.stock) || 0;
  }, [showSizing, showVariantSection, hasColors, colors, selectedSizes, hasVariants, variants, form.stock]);

  // ── Initialise form when modal opens ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (editProduct) {
      setForm({
        name:        editProduct.name,
        description: editProduct.description,
        price:       editProduct.price.toString(),
        category:    editProduct.category,
        subcategory: editProduct.subcategory,
        stock:       editProduct.stock.toString(),
        featured:    editProduct.featured,
        active:      editProduct.active,
      });
      const imageSlots = EMPTY_SLOTS();
      editProduct.images.slice(0, 4).forEach((url, i) => {
        imageSlots[i] = { kind: "url", url };
      });
      setSlots(imageSlots);

      // Restore dynamic fields
      setSizingType(editProduct.sizingType ?? "US");
      setHasColors(editProduct.hasColors   ?? false);
      setHasVariants(editProduct.hasVariants ?? false);
      setVariantLabel(editProduct.variantLabel ?? "");

      if (editProduct.variantType === "size") {
        if (editProduct.colors && editProduct.colors.length > 0) {
          setColors(editProduct.colors.map((c) => {
            const imgs = c.images ?? [];
            return {
              name: c.name,
              hex:  c.hex,
              imageSlots: [
                imgs[0] ? { kind: "url" as const, url: imgs[0] } : null,
                imgs[1] ? { kind: "url" as const, url: imgs[1] } : null,
                imgs[2] ? { kind: "url" as const, url: imgs[2] } : null,
                imgs[3] ? { kind: "url" as const, url: imgs[3] } : null,
              ] as [SlotSource, SlotSource, SlotSource, SlotSource],
              variants:  c.variants ?? [],
              sameQty:   false,
              globalQty: 0,
            };
          }));
          setSelectedSizes([]);
        } else {
          setSelectedSizes(editProduct.variants ?? []);
          setColors([]);
        }
        setVariants([]);
      } else if (editProduct.variantType === "custom") {
        setVariants(editProduct.variants ?? []);
        setSelectedSizes([]);
        setColors([]);
      } else {
        setSelectedSizes([]);
        setColors(editProduct.colors?.map((c) => {
          const imgs = c.images ?? [];
          return {
            name: c.name,
            hex:  c.hex,
            imageSlots: [
              imgs[0] ? { kind: "url" as const, url: imgs[0] } : null,
              imgs[1] ? { kind: "url" as const, url: imgs[1] } : null,
              imgs[2] ? { kind: "url" as const, url: imgs[2] } : null,
              imgs[3] ? { kind: "url" as const, url: imgs[3] } : null,
            ] as [SlotSource, SlotSource, SlotSource, SlotSource],
            variants:  [],
            sameQty:   false,
            globalQty: 0,
          };
        }) ?? []);
        setVariants([]);
      }
    } else {
      setForm(EMPTY_FORM);
      setSlots(EMPTY_SLOTS());
      setSizingType("US");
      setSelectedSizes([]);
      setHasColors(false);
      setColors([]);
      setHasVariants(false);
      setVariantLabel("");
      setVariants([]);
    }

    setActiveColorTab(0);
    setShowColorAdd(false);
    setCdName(""); setCdHex("#000000"); setCdSlots([null, null, null, null]); setCdSuggested([]);
    setCdVariants([]); setCdSameQty(false); setCdGlobalQty(0);
    setVariantInput("");
    setSameQty(false); setGlobalQty(0);
    setErrors({});
    setSaving(false);
  }, [open, editProduct]);

  // ── ColorThief: re-run whenever the first colour image slot changes ──────────
  useEffect(() => {
    if (!cdSrc) { setCdSuggested([]); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const palette = getPaletteSync(img, { colorCount: 5 });
        setCdSuggested(palette ? palette.map((c) => c.hex()) : []);
      } catch {
        setCdSuggested([]);
      }
    };
    img.onerror = () => setCdSuggested([]);
    img.src = cdSrc;
  }, [cdSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas eyedropper helpers ───────────────────────────────────────────────
  /** Draw the visible img element onto the hidden canvas for pixel sampling */
  const drawToCanvas = () => {
    const canvas = colorCanvasRef.current;
    const img    = colorImgRef.current;
    if (!canvas || !img) return;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0);
  };

  /** Read the pixel colour under the click position and set cdHex */
  const handleEyedropperClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const x      = (e.clientX - rect.left) * scaleX;
    const y      = (e.clientY - rect.top)  * scaleY;
    const pixel  = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex    = "#" + [pixel[0], pixel[1], pixel[2]]
      .map((v) => v.toString(16).padStart(2, "0")).join("");
    setCdHex(hex);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Category change — wires up console logs + clears stale dynamic state */
  const handleCategoryChange = (v: string) => {
    set("category", v);
    const newShowSizing  = SIZING_CATEGORIES.includes(v);
    const newShowVariants = VARIANT_CATEGORIES.includes(v);

    console.log("Category changed to:", v);
    console.log("showSizing:",  newShowSizing);
    console.log("showVariants:", newShowVariants);
    console.log("showColors:",  true); // colours section is always visible

    if (!newShowSizing) setSelectedSizes([]);
    if (!newShowVariants) {
      setHasVariants(false);
      setVariants([]);
      setVariantLabel("");
      setVariantInput("");
    }
  };

  /** Switch sizing type and wipe all size selections (labels changed) */
  const applySizingType = (type: "US" | "UK-numeric" | "UK-alpha") => {
    setSizingType(type);
    setSelectedSizes([]);
    setSameQty(false); setGlobalQty(0);
    setColors((prev) => prev.map((c) => ({ ...c, variants: [], sameQty: false, globalQty: 0 })));
  };

  /** Apply a global quantity to all currently active standalone sizes */
  const applyGlobalQty = (qty: number) => {
    setSelectedSizes((prev) => prev.map((s) => ({ ...s, stock: qty })));
  };

  /** Commit the colour draft to the colours list */
  const addColorEntry = async () => {
    setCdAdding(true);
    const resolvedSlots: [SlotSource, SlotSource, SlotSource, SlotSource] = [null, null, null, null];
    try {
      for (let i = 0; i < 4; i++) {
        const slot = cdSlots[i];
        if (!slot) continue;
        const url = slot.kind === "file"
          ? await uploadToCloudinary(slot.preview)
          : slot.url;
        resolvedSlots[i] = { kind: "url", url };
      }
    } catch {
      // proceed with what uploaded successfully
    } finally {
      setCdAdding(false);
    }
    const newColor: ColorFormEntry = {
      name:       cdName.trim() || `Colour ${cdHex}`,
      hex:        cdHex,
      imageSlots: resolvedSlots,
      variants:   cdVariants,
      sameQty:    cdSameQty,
      globalQty:  cdGlobalQty,
    };
    setColors((prev) => {
      const next = [...prev, newColor];
      setActiveColorTab(next.length - 1);
      return next;
    });
    // Reset draft
    setCdName(""); setCdHex("#000000"); setCdSlots([null, null, null, null]); setCdSuggested([]);
    setCdVariants([]); setCdSameQty(false); setCdGlobalQty(0);
    setShowColorAdd(false);
  };

  const removeColor = (idx: number) => {
    setColors((prev) => prev.filter((_, i) => i !== idx));
    setActiveColorTab((t) => Math.min(Math.max(0, t >= idx ? t - 1 : t), colors.length - 2));
  };

  const updateColorVariants = (colorIdx: number, next: SizeEntry[]) =>
    setColors((prev) => prev.map((c, i) => i === colorIdx ? { ...c, variants: next } : c));

  // Variant helpers
  const addVariantEntry = () => {
    const label = variantInput.trim();
    if (!label) return;
    if (variants.some((v) => v.label.toLowerCase() === label.toLowerCase())) return;
    setVariants((prev) => [...prev, { label, stock: 0 }]);
    setVariantInput("");
  };
  const removeVariant  = (label: string) => setVariants((prev) => prev.filter((v) => v.label !== label));
  const setVariantStock = (label: string, stock: number) =>
    setVariants((prev) => prev.map((v) => v.label === label ? { ...v, stock } : v));

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim())   e.name     = "Product name is required.";
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) <= 0)
                             e.price    = "A valid price is required.";
    if (!form.category)      e.category = "Please select a category.";

    if (hasColors) {
      const hasImgInColor = colors.some((c) => c.imageSlots.some((s) => s !== null));
      if (!hasImgInColor)
        e.images = "At least one colour must have at least one image.";
      if (showSizing && !colors.some((c) => c.variants.length > 0))
        e.sizes = "Please select sizes for at least one colour.";
    } else {
      if (!slots.some((s) => s !== null))
        e.images = "At least one image is required.";
      if (showSizing && selectedSizes.length === 0)
        e.sizes = "Please select at least one size.";
      if (!showSizing && !(showVariantSection && hasVariants)) {
        if (!form.stock.trim() || isNaN(Number(form.stock)) || Number(form.stock) < 0)
          e.stock = "A valid stock quantity is required.";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Upload product images (main slots, or derive from first colour when hasColors)
      const imageUrls: string[] = [];
      if (hasColors && colors.length > 0) {
        // Use first colour's first image as the main product image for display
        const firstSlot = colors[0].imageSlots.find((s) => s !== null);
        if (firstSlot) {
          imageUrls.push(
            firstSlot.kind === "url" ? firstSlot.url : await uploadToCloudinary(firstSlot.preview)
          );
        }
      } else {
        for (const slot of slots) {
          if (!slot) continue;
          imageUrls.push(
            slot.kind === "url" ? slot.url : await uploadToCloudinary(slot.preview)
          );
        }
      }

      // Resolve colour image slots (upload any remaining files edited in the tab)
      const resolvedColors = await Promise.all(colors.map(async (c) => {
        const images: string[] = [];
        for (const s of c.imageSlots) {
          if (!s) continue;
          images.push(s.kind === "url" ? s.url : await uploadToCloudinary(s.preview));
        }
        return { name: c.name, hex: c.hex, images, variants: c.variants };
      }));

      const payload: Record<string, unknown> = {
        name:        form.name.trim(),
        description: form.description.trim(),
        price:       Number(form.price),
        category:    form.category,
        subcategory: form.subcategory.trim(),
        featured:    form.featured,
        active:      form.active,
        images:      imageUrls,
        stock:       totalStock,
        hasColors,
        hasVariants,
      };

      if (showSizing) {
        payload.variantType = "size";
        payload.sizingType  = sizingType;
        if (hasColors && resolvedColors.length > 0) {
          payload.colors   = resolvedColors;
          payload.variants = null;
        } else {
          payload.variants = selectedSizes;
          payload.colors   = hasColors ? resolvedColors : null;
        }
      } else if (showVariantSection && hasVariants) {
        payload.variantType  = "custom";
        payload.variantLabel = variantLabel;
        payload.variants     = variants;
        payload.colors       = hasColors && resolvedColors.length > 0 ? resolvedColors : null;
      } else {
        payload.variantType = null;
        payload.variants    = null;
        payload.colors      = hasColors && resolvedColors.length > 0 ? resolvedColors : null;
      }

      if (isEditing && editProduct) {
        await updateDoc(doc(db, "products", editProduct.id), payload);
      } else {
        await addDoc(collection(db, "products"), { ...payload, createdAt: serverTimestamp() });
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save product error:", err);
      setErrors((e) => ({ ...e, general: "Failed to save. Please try again." }));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── 1. Product Name ── */}
          <div className="space-y-1.5">
            <Label>Product Name <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Women's Floral Dress" />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            <p className="text-xs text-gray-400 italic">Enter the full product name as it will appear on the store</p>
          </div>

          {/* ── 2. Description ── */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the product…" className="min-h-20 resize-none" />
            <p className="text-xs text-gray-400 italic">Describe the product — material, fit, features. More detail = more sales</p>
          </div>

          {/* ── 3. Price ── */}
          <div className="space-y-1.5 max-w-[200px]">
            <Label>Price (ZMW) <span className="text-red-500">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">K</span>
              <Input
                type="number" min={0} step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
                className={`pl-7 ${NO_SPIN}`}
                style={noSpinStyle}
              />
            </div>
            {errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
            <p className="text-xs text-gray-400 italic">Price in Zambian Kwacha (ZMW)</p>
          </div>

          {/* ── 4. Category + Subcategory ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MODAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
              <p className="text-xs text-gray-400 italic">Choose the category that best fits this product</p>
            </div>
            <div className="space-y-1.5">
              <Label>Subcategory <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="e.g. dresses, phones" />
              <p className="text-xs text-gray-400 italic">Subcategory helps customers find the product when filtering</p>
            </div>
          </div>

          {/* ── 5. SIZING ── */}
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showSizing ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Sizing</p>

              {/* US / UK toggle */}
              <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5 w-fit">
                <button type="button" onClick={() => applySizingType("US")} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${sizingType === "US" ? "bg-brand_green text-white" : "text-gray-600 hover:bg-gray-100"}`}>US Sizing</button>
                <button type="button" onClick={() => applySizingType("UK-numeric")} className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${sizingType.startsWith("UK") ? "bg-brand_green text-white" : "text-gray-600 hover:bg-gray-100"}`}>UK Sizing</button>
              </div>

              {/* UK sub-toggle */}
              {sizingType.startsWith("UK") && (
                <div className="flex rounded-md border border-gray-200 overflow-hidden w-fit">
                  <button type="button" onClick={() => applySizingType("UK-numeric")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sizingType === "UK-numeric" ? "bg-brand_green/15 text-brand_green" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Numeric 32–42</button>
                  <button type="button" onClick={() => applySizingType("UK-alpha")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${sizingType === "UK-alpha" ? "bg-brand_green/15 text-brand_green" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Alpha 6–18</button>
                </div>
              )}

              <p className="text-xs text-gray-400 italic">Select which sizes are available for this product</p>

              {/* Same-qty toggle — standalone only, hidden when colours are on */}
              {!hasColors && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Set same quantity for all sizes</span>
                  <Switch
                    checked={sameQty}
                    onCheckedChange={(val) => { setSameQty(val); if (val && globalQty > 0) applyGlobalQty(globalQty); }}
                  />
                  {sameQty && (
                    <input
                      type="number" min={0}
                      value={globalQty === 0 ? "" : globalQty}
                      onChange={(e) => { const v = e.target.value; const parsed = v === "" ? 0 : parseInt(v, 10); if (!isNaN(parsed)) { setGlobalQty(parsed); applyGlobalQty(parsed); } }}
                      onFocus={(e) => e.target.select()}
                      className={`w-20 h-8 text-center text-sm border border-brand_green rounded focus:border-brand_green focus:outline-none ${NO_SPIN}`}
                      style={noSpinStyle}
                      placeholder="0"
                    />
                  )}
                </div>
              )}

              {/* Standalone size grid */}
              {!hasColors && (
                <div className="space-y-2">
                  <SizeGrid sizes={currentSizes} selected={selectedSizes} onChange={setSelectedSizes} sameQty={sameQty} globalQty={globalQty} />
                  <p className="text-xs text-gray-400 italic">Click a size to mark it as available. Enter the quantity in stock for each.</p>
                  {selectedSizes.length === 0 && (
                    <div className="flex items-center gap-1 text-amber-600 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Please select at least one available size before saving</span>
                    </div>
                  )}
                </div>
              )}

              {hasColors && colors.length === 0 && <p className="text-xs text-gray-400 italic">Add a colour in the Colours section below to configure sizes per colour.</p>}
              {hasColors && colors.length > 0  && <p className="text-xs text-gray-400 italic">Sizes are configured per colour in the Colours section below.</p>}
            </div>
          </div>

          {/* ── 6. COLOURS ── */}
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Product Colours</p>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Switch
                checked={hasColors}
                onCheckedChange={(v) => { setHasColors(v); if (!v) { setColors([]); setShowColorAdd(false); } }}
              />
              <span className="text-sm text-gray-700">This product comes in multiple colours</span>
            </label>
            <p className="text-xs text-gray-400 italic">
              {hasColors
                ? "Add each colour variation. Each colour has its own images and stock."
                : "Add each colour variation. Each colour has its own images and stock. When colours are enabled, images are managed per colour."}
            </p>

            {hasColors && (
              <div className="space-y-3 mt-1">

                {/* Tab bar */}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {colors.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setActiveColorTab(i); setShowColorAdd(false); }}
                      className={`flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-medium border transition-colors ${
                        !showColorAdd && activeColorTab === i
                          ? "border-brand_green bg-brand_green/10 text-brand_green"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: c.hex }} />
                      <span>{c.name}</span>
                      <span role="button" onClick={(e) => { e.stopPropagation(); removeColor(i); }} className="ml-0.5 text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded-full" aria-label={`Remove ${c.name}`}>
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                  {!showColorAdd && (
                    <button type="button" onClick={() => setShowColorAdd(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-brand_green text-brand_green text-xs font-semibold hover:bg-brand_green/5 transition-colors">
                      <Plus className="w-3 h-3" />
                      {colors.length === 0 ? "Add First Colour" : "Add Colour"}
                    </button>
                  )}
                </div>
                {colors.length === 0 && !showColorAdd && (
                  <p className="text-xs text-gray-400 italic">Add all available colour options before saving</p>
                )}

                {/* Active tab — edit existing colour */}
                {!showColorAdd && colors.length > 0 && colors[activeColorTab] && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    {/* Hex picker */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer shadow hover:scale-105 transition-transform shrink-0"
                        style={{ backgroundColor: colors[activeColorTab].hex }}
                        onClick={() => editColorInputRef.current?.click()}
                        title="Click to change colour"
                      />
                      <input
                        ref={editColorInputRef}
                        type="color"
                        value={colors[activeColorTab].hex}
                        onChange={(e) => setColors((prev) => prev.map((c, i) => i === activeColorTab ? { ...c, hex: e.target.value } : c))}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                      />
                      <span className="text-sm font-mono text-gray-700">{colors[activeColorTab].hex}</span>
                      <span className="text-xs text-gray-400">Click circle to change colour</span>
                    </div>

                    {/* Colour images */}
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Colour Images (up to 4)</p>
                      <p className="text-[11px] text-gray-400">First image will be the main image for this colour</p>
                      <ColourImageSlots
                        slots={colors[activeColorTab].imageSlots}
                        onChange={(next) => setColors((prev) => prev.map((c, i) => i === activeColorTab ? { ...c, imageSlots: next } : c))}
                      />
                    </div>

                    {/* Per-colour sizes */}
                    {showSizing && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Sizes & Stock</p>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">Same quantity for all sizes</span>
                          <Switch
                            checked={colors[activeColorTab].sameQty}
                            onCheckedChange={(val) => {
                              setColors((prev) => prev.map((c, i) => {
                                if (i !== activeColorTab) return c;
                                const updated = { ...c, sameQty: val };
                                if (val && c.globalQty > 0) updated.variants = c.variants.map((v) => ({ ...v, stock: c.globalQty }));
                                return updated;
                              }));
                            }}
                          />
                          {colors[activeColorTab].sameQty && (
                            <input
                              type="number" min={0}
                              value={colors[activeColorTab].globalQty === 0 ? "" : colors[activeColorTab].globalQty}
                              onChange={(e) => {
                                const v = e.target.value;
                                const qty = v === "" ? 0 : parseInt(v, 10);
                                if (!isNaN(qty)) setColors((prev) => prev.map((c, i) =>
                                  i === activeColorTab ? { ...c, globalQty: qty, variants: c.variants.map((vv) => ({ ...vv, stock: qty })) } : c
                                ));
                              }}
                              onFocus={(e) => e.target.select()}
                              className={`w-20 h-8 text-center text-sm border border-brand_green rounded focus:border-brand_green focus:outline-none ${NO_SPIN}`}
                              style={noSpinStyle}
                              placeholder="0"
                            />
                          )}
                        </div>
                        <SizeGrid
                          sizes={currentSizes}
                          selected={colors[activeColorTab].variants}
                          onChange={(next) => updateColorVariants(activeColorTab, next)}
                          sameQty={colors[activeColorTab].sameQty}
                          globalQty={colors[activeColorTab].globalQty}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Add colour panel */}
                {showColorAdd && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-600">New Colour</p>

                    {/* 1. Colour picker */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer shadow hover:scale-105 transition-transform shrink-0"
                        style={{ backgroundColor: cdHex }}
                        onClick={() => colorInputRef.current?.click()}
                        title="Click to pick colour"
                      />
                      <input ref={colorInputRef} type="color" value={cdHex} onChange={(e) => setCdHex(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
                      <span className="text-sm font-mono text-gray-700">{cdHex}</span>
                      <span className="text-xs text-gray-400">Click circle to pick colour</span>
                    </div>

                    {/* 2. Colour Name */}
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Colour Name <span className="text-gray-400">(optional — auto-generated from hex if blank)</span></label>
                      <Input value={cdName} onChange={(e) => setCdName(e.target.value)} placeholder="e.g. Midnight Black" className="text-sm" />
                    </div>

                    {/* 3. Colour images */}
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Colour Images (up to 4)</p>
                      <p className="text-[11px] text-gray-400">First image will be the main image for this colour</p>
                      <ColourImageSlots slots={cdSlots} onChange={setCdSlots} />
                    </div>

                    {/* 4. Eyedropper */}
                    {cdSrc && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">Click anywhere on the image to pick a colour:</p>
                        <div className="rounded overflow-hidden border border-gray-200 max-w-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            ref={colorImgRef}
                            src={cdSrc}
                            alt="Eyedropper source"
                            className="w-full object-cover"
                            style={{ cursor: "crosshair", maxHeight: "160px", objectFit: "cover" }}
                            onLoad={() => { drawToCanvas(); }}
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                            onClick={handleEyedropperClick}
                          />
                        </div>
                        <canvas ref={colorCanvasRef} style={{ display: "none" }} />
                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                          <div className="w-8 h-8 rounded-full border-2 border-gray-200 shadow shrink-0" style={{ backgroundColor: cdHex }} />
                          <span className="text-sm font-mono">{cdHex}</span>
                          <span className="text-xs text-gray-400">Selected colour</span>
                        </div>
                        {cdSuggested.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Tap a suggestion or click image to pick:</p>
                            <div className="flex gap-2 flex-wrap">
                              {cdSuggested.map((hex, i) => (
                                <div
                                  key={i}
                                  onClick={() => setCdHex(hex)}
                                  className={`w-7 h-7 rounded-full cursor-pointer border-2 shadow hover:scale-110 transition-transform ${cdHex === hex ? "border-brand_green scale-110" : "border-white"}`}
                                  style={{ backgroundColor: hex }}
                                  title={hex}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 5. Sizes */}
                    {showSizing && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Sizes & Stock</p>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">Same quantity for all sizes</span>
                          <Switch
                            checked={cdSameQty}
                            onCheckedChange={(val) => { setCdSameQty(val); if (val && cdGlobalQty > 0) setCdVariants((prev) => prev.map((v) => ({ ...v, stock: cdGlobalQty }))); }}
                          />
                          {cdSameQty && (
                            <input
                              type="number" min={0}
                              value={cdGlobalQty === 0 ? "" : cdGlobalQty}
                              onChange={(e) => { const v = e.target.value; const qty = v === "" ? 0 : parseInt(v, 10); if (!isNaN(qty)) { setCdGlobalQty(qty); setCdVariants((prev) => prev.map((vv) => ({ ...vv, stock: qty }))); } }}
                              onFocus={(e) => e.target.select()}
                              className={`w-20 h-8 text-center text-sm border border-brand_green rounded focus:border-brand_green focus:outline-none ${NO_SPIN}`}
                              style={noSpinStyle}
                              placeholder="0"
                            />
                          )}
                        </div>
                        <SizeGrid sizes={currentSizes} selected={cdVariants} onChange={setCdVariants} sameQty={cdSameQty} globalQty={cdGlobalQty} />
                      </div>
                    )}

                    {/* 6. Commit / Cancel */}
                    <div className="flex items-center gap-3 pt-1">
                      <Button type="button" size="sm" onClick={addColorEntry} disabled={!cdHex || cdAdding} className="bg-brand_green hover:bg-brand_green_hover text-white">
                        {cdAdding ? "Uploading…" : "Add This Colour"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setShowColorAdd(false); setCdName(""); setCdHex("#000000"); setCdSlots([null, null, null, null]); setCdSuggested([]); setCdVariants([]); setCdSameQty(false); setCdGlobalQty(0); }}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 7. IMAGES — only when no colours ── */}
          {!hasColors && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <Label>Images <span className="text-red-500">*</span></Label>
              <p className="text-xs text-gray-400">Up to 4 images. First image is the main product image.</p>
              <ImageGrid slots={slots} onChange={setSlots} />
              {errors.images && <p className="text-xs text-red-500">{errors.images}</p>}
            </div>
          )}

          {/* ── 8. VARIANTS — only when no colours AND variant category ── */}
          {!hasColors && (
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showVariantSection ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Variants</p>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <Switch checked={hasVariants} onCheckedChange={(v) => { setHasVariants(v); if (!v) { setVariants([]); setVariantLabel(""); setVariantInput(""); } }} />
                  <span className="text-sm text-gray-700">Does this product have variants?</span>
                </label>
                {hasVariants && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Variant Type</label>
                      <Input value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} placeholder="e.g. Storage, Wattage, Pack Size, Shade" className="max-w-xs text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Add Values</label>
                      <div className="flex gap-2">
                        <Input value={variantInput} onChange={(e) => setVariantInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addVariantEntry()} placeholder="e.g. 128GB" className="max-w-[200px] text-sm" />
                        <Button type="button" size="sm" onClick={addVariantEntry} disabled={!variantInput.trim()} className="bg-brand_green hover:bg-brand_green_hover text-white">Add</Button>
                      </div>
                      {variants.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {variants.map((v) => (
                            <div key={v.label} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-gray-200 bg-white text-xs">
                              <span className="font-semibold text-gray-800">{v.label}:</span>
                              <input
                                type="number" min={0}
                                value={v.stock === 0 ? "" : v.stock}
                                onChange={(e) => { const raw = e.target.value; const parsed = raw === "" ? 0 : parseInt(raw, 10); if (!isNaN(parsed)) setVariantStock(v.label, parsed); }}
                                onFocus={(e) => e.target.select()}
                                className={`w-10 text-center border-0 outline-none text-gray-700 bg-transparent ${NO_SPIN}`}
                                style={noSpinStyle}
                              />
                              <button type="button" onClick={() => removeVariant(v.label)} className="text-gray-300 hover:text-red-500 transition-colors ml-0.5" aria-label={`Remove ${v.label}`}>
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 9. STOCK ── */}
          <div className="border-t border-gray-200 pt-4">
            {showSizing || (showVariantSection && hasVariants) ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Total Stock:</span>
                <span className="text-base font-bold text-brand_green">{totalStock} units</span>
                <span className="text-xs text-gray-400">(calculated from selections above)</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-w-[160px]">
                <Label>Stock Quantity <span className="text-red-500">*</span></Label>
                <Input
                  type="number" min={0}
                  value={form.stock}
                  onChange={(e) => { const v = e.target.value; const parsed = v === "" ? 0 : parseInt(v, 10); if (!isNaN(parsed)) set("stock", String(parsed)); }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className={NO_SPIN}
                  style={noSpinStyle}
                />
                {errors.stock && <p className="text-xs text-red-500">{errors.stock}</p>}
              </div>
            )}
          </div>

          {/* ── 10. Featured + Active ── */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox id="featured" checked={form.featured} onCheckedChange={(v) => set("featured", !!v)} />
              <span className="text-sm font-medium text-gray-700">Featured</span>
              <span className="text-xs text-gray-400">(shown on homepage)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox id="active" checked={form.active} onCheckedChange={(v) => set("active", !!v)} />
              <span className="text-sm font-medium text-gray-700">Active</span>
              <span className="text-xs text-gray-400">(visible on storefront)</span>
            </label>
          </div>

          {/* ── Errors ── */}
          {errors.general && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errors.general}
            </p>
          )}
          {(errors.images || errors.sizes) && (
            <div className="space-y-1">
              {errors.images && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{errors.images}</p>}
              {errors.sizes  && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{errors.sizes}</p>}
            </div>
          )}
        </div>

        {/* ── 11. Sticky footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4 mt-4">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand_red hover:bg-brand_red_hover text-white min-w-[120px]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : isEditing ? "Save Changes" : "Save Product"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategory] = useState("All");
  const [page, setPage]               = useState(1);

  // Modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // ── Realtime listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs: Product[] = snap.docs.map((d) => ({
        id:             d.id,
        name:           d.data().name           ?? "",
        category:       d.data().category       ?? "",
        subcategory:    d.data().subcategory    ?? "",
        description:    d.data().description    ?? "",
        price:          d.data().price          ?? 0,
        compareAtPrice: d.data().compareAtPrice ?? undefined,
        images:         d.data().images         ?? [],
        stock:          d.data().stock          ?? 0,
        featured:       d.data().featured       ?? false,
        active:         d.data().active         ?? true,
        // Dynamic variant fields
        hasColors:    d.data().hasColors    ?? false,
        hasVariants:  d.data().hasVariants  ?? false,
        variantType:  d.data().variantType  ?? null,
        sizingType:   d.data().sizingType   ?? undefined,
        variantLabel: d.data().variantLabel ?? undefined,
        variants:     d.data().variants     ?? undefined,
        colors:       d.data().colors       ?? undefined,
      }));
      setProducts(docs);
      setLoading(false);
    }, (err) => {
      console.error("products snapshot error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtered + paginated list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch   = !q || p.name.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleFeatured = (p: Product) =>
    updateDoc(doc(db, "products", p.id), { featured: !p.featured });

  const toggleActive = (p: Product) =>
    updateDoc(doc(db, "products", p.id), { active: !p.active });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "products", deleteTarget.id));
    setDeleteTarget(null);
  };

  const openAdd  = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (product: Product) => { setEditTarget(product); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your store catalogue</p>
          </div>
          <Button onClick={openAdd} className="bg-brand_red hover:bg-brand_red_hover text-white gap-2">
            <Plus className="w-4 h-4" />
            Add New Product
          </Button>
        </header>

        {/* Filters */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="max-w-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategory}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTER_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
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
                {products.length === 0 ? "No products yet." : "No products match your search."}
              </p>
              {products.length === 0 && (
                <p className="text-sm mt-1">Add your first product using the button above.</p>
              )}
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left w-16">Image</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-center">Featured</th>
                      <th className="px-4 py-3 text-center">Active</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50/60 transition-colors">

                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                            {product.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">No img</div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900 line-clamp-1">{product.name}</span>
                        </td>

                        <td className="px-4 py-3 text-gray-500">
                          {product.category}
                          {product.subcategory && (
                            <span className="text-gray-400 text-xs ml-1">/ {product.subcategory}</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          K {product.price.toLocaleString()}
                          {product.compareAtPrice && product.compareAtPrice > product.price && (
                            <span className="block text-xs text-gray-400 line-through font-normal">
                              K {product.compareAtPrice.toLocaleString()}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className={
                            product.stock === 0  ? "text-red-500 font-medium"
                            : product.stock <= 5 ? "text-amber-500 font-medium"
                            : "text-gray-700"
                          }>
                            {product.stock}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Switch checked={product.featured} onCheckedChange={() => toggleFeatured(product)} aria-label="Toggle featured" />
                        </td>

                        <td className="px-4 py-3 text-center">
                          <Switch checked={product.active} onCheckedChange={() => toggleActive(product)} aria-label="Toggle active" />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="icon-sm" variant="outline" aria-label="Edit product" onClick={() => openEdit(product)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon-sm" variant="outline" aria-label="Delete product" className="text-red-500 hover:text-red-600 hover:border-red-300" onClick={() => setDeleteTarget(product)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="gap-1">
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="gap-1">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Add / Edit modal */}
      <ProductFormModal
        open={modalOpen}
        editProduct={editTarget}
        onClose={closeModal}
        onSaved={() => {}}
      />

      {/* Delete confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
