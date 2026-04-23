"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ButtonLinkType = "category" | "featured" | "sale" | "manual";

interface HeroSlide {
  id: string;
  heading: string;
  subheading: string;
  imageUrl: string;
  buttonLabel: string;
  buttonLink: string;
  buttonLinkType: ButtonLinkType;
  order: number;
  active: boolean;
}

const EMPTY_FORM: Omit<HeroSlide, "id"> = {
  heading: "",
  subheading: "",
  imageUrl: "",
  buttonLabel: "Shop Now",
  buttonLink: "/shop",
  buttonLinkType: "manual",
  order: 1,
  active: true,
};

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({
  open,
  heading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  heading: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete slide?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          This will permanently delete <strong>&quot;{heading}&quot;</strong>. This action
          cannot be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add / Edit modal ──────────────────────────────────────────────────────────

type ImageTab = "upload" | "url";

function SlideFormModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Omit<HeroSlide, "id"> & { id?: string };
  onClose: () => void;
  onSave: (data: Omit<HeroSlide, "id">, id?: string) => Promise<void>;
}) {
  const [form, setForm]           = useState(initial);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [imageTab, setImageTab]   = useState<ImageTab>("upload");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Sync form when modal re-opens with different slide
  useEffect(() => {
    setForm(initial);
    setError("");
    setUploadFile(null);
    setPreviewSrc("");
    setUploadError("");
    // If editing an existing slide, default to URL tab so the existing URL is visible
    setImageTab(initial.imageUrl ? "url" : "upload");
  }, [initial, open]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.heading.trim()) { setError("Heading is required."); return; }

    // If on upload tab and a file is selected, upload it first
    if (imageTab === "upload" && uploadFile) {
      if (!previewSrc) { setError("Image is still loading, please wait."); return; }
      setError("");
      setUploadError("");
      setUploading(true);
      setSaving(true);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: previewSrc }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Upload failed");
        const { id, ...data } = { ...form, imageUrl: json.url } as typeof form & { id?: string };
        await onSave(data, id);
        onClose();
      } catch (err) {
        console.error("Upload error:", err);
        setUploadError("Image upload failed. Please try again.");
      } finally {
        setUploading(false);
        setSaving(false);
      }
      return;
    }

    // URL tab (or upload tab with no new file — keep existing imageUrl)
    if (!form.imageUrl.trim()) { setError("Image URL is required."); return; }
    setError("");
    setSaving(true);
    try {
      const { id, ...data } = form as typeof form & { id?: string };
      await onSave(data, id);
      onClose();
    } catch (err) {
      console.error("Save slide error:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!(form as { id?: string }).id;
  const isBusy = saving || uploading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Slide" : "Add New Slide"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Heading */}
          <div className="space-y-1.5">
            <Label>Heading <span className="text-red-500">*</span></Label>
            <Input
              value={form.heading}
              onChange={(e) => set("heading", e.target.value)}
              placeholder="Fashion for Everyone"
            />
          </div>

          {/* Subheading */}
          <div className="space-y-1.5">
            <Label>Subheading</Label>
            <Input
              value={form.subheading}
              onChange={(e) => set("subheading", e.target.value)}
              placeholder="Short description shown under the heading"
            />
          </div>

          {/* Image section with tab toggle */}
          <div className="space-y-2">
            <Label>Image <span className="text-red-500">*</span></Label>

            {/* Tab toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setImageTab("upload")}
                className={`flex-1 py-1.5 transition-colors ${
                  imageTab === "upload"
                    ? "bg-brand_red text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Upload Image
              </button>
              <button
                type="button"
                onClick={() => setImageTab("url")}
                className={`flex-1 py-1.5 transition-colors ${
                  imageTab === "url"
                    ? "bg-brand_red text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Paste URL
              </button>
            </div>

            {/* Upload tab */}
            {imageTab === "upload" && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <span className="px-4 py-2 rounded-md text-sm font-medium text-white bg-brand_red hover:bg-brand_red_hover transition-colors">
                    Choose File
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  {uploadFile && (
                    <span className="text-xs text-gray-500 truncate max-w-[180px]">
                      {uploadFile.name}
                    </span>
                  )}
                </label>

                {previewSrc && (
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {!uploadFile && isEditing && form.imageUrl && (
                  <p className="text-xs text-gray-400">
                    Current image will be kept unless you choose a new file.
                  </p>
                )}

                {uploadError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {uploadError}
                  </p>
                )}
              </div>
            )}

            {/* URL tab */}
            {imageTab === "url" && (
              <div className="space-y-2">
                <Input
                  value={form.imageUrl}
                  onChange={(e) => set("imageUrl", e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                />
                {form.imageUrl.trim() && (
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Button label + link */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Button Label</Label>
              <Input
                value={form.buttonLabel}
                onChange={(e) => set("buttonLabel", e.target.value)}
                placeholder="Shop Now"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Button Link</Label>
              <Input
                value={form.buttonLink}
                onChange={(e) => set("buttonLink", e.target.value)}
                placeholder="/shop"
              />
            </div>
          </div>

          {/* Link type + order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Link Type</Label>
              <Select
                value={form.buttonLinkType}
                onValueChange={(v: string) => set("buttonLinkType", v as ButtonLinkType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => set("order", Number(e.target.value))}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="active-toggle"
              checked={form.active}
              onCheckedChange={(v: boolean) => set("active", v)}
            />
            <Label htmlFor="active-toggle" className="cursor-pointer">
              Active (visible on storefront)
            </Label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isBusy}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isBusy}
            className="bg-brand_red hover:bg-brand_red_hover text-white min-w-[110px]"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading…
              </span>
            ) : saving ? "Saving…" : "Save Slide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SlidesPage() {
  const [slides, setSlides]             = useState<HeroSlide[]>([]);
  const [loading, setLoading]           = useState(true);

  // Modal state
  const [modalOpen, setModalOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<(Omit<HeroSlide, "id"> & { id?: string }) | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<HeroSlide | null>(null);

  // ── Realtime listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "heroSlides"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs: HeroSlide[] = snap.docs.map((d) => ({
        id:             d.id,
        heading:        d.data().heading        ?? "",
        subheading:     d.data().subheading     ?? "",
        imageUrl:       d.data().imageUrl       ?? "",
        buttonLabel:    d.data().buttonLabel    ?? "Shop Now",
        buttonLink:     d.data().buttonLink     ?? "/shop",
        buttonLinkType: d.data().buttonLinkType ?? "manual",
        order:          d.data().order          ?? 0,
        active:         d.data().active         ?? true,
      }));
      setSlides(docs);
      setLoading(false);
    }, (err) => {
      console.error("heroSlides snapshot error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleActive = async (slide: HeroSlide) => {
    await updateDoc(doc(db, "heroSlides", slide.id), { active: !slide.active });
  };

  const handleSave = async (data: Omit<HeroSlide, "id">, id?: string) => {
    if (id) {
      await updateDoc(doc(db, "heroSlides", id), { ...data });
    } else {
      await addDoc(collection(db, "heroSlides"), { ...data });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "heroSlides", deleteTarget.id));
    setDeleteTarget(null);
  };

  const openAdd = () => {
    setEditTarget({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (slide: HeroSlide) => {
    const { id, ...rest } = slide;
    setEditTarget({ ...rest, id });
    setModalOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hero Slides</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Manage the banner carousel on the home page
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="bg-brand_red hover:bg-brand_red_hover text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Slide
          </Button>
        </header>

        {/* Content */}
        <main className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : slides.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-lg font-medium">No slides yet</p>
              <p className="text-sm mt-1">Click &quot;Add New Slide&quot; to create the first one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {slides.map((slide) => (
                <div
                  key={slide.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-5"
                >
                  {/* Image preview */}
                  <div className="w-[160px] h-[90px] rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                    {slide.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.imageUrl}
                        alt={slide.heading}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        #{slide.order}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          slide.active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {slide.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
                      {slide.heading}
                    </h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {slide.subheading}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      <span className="font-medium">{slide.buttonLabel}</span>
                      {" → "}
                      <span className="text-brand_green">{slide.buttonLink}</span>
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Active toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slide.active}
                        onCheckedChange={() => handleToggleActive(slide)}
                        aria-label="Toggle active"
                      />
                    </div>

                    {/* Edit */}
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => openEdit(slide)}
                      aria-label="Edit slide"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete */}
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setDeleteTarget(slide)}
                      aria-label="Delete slide"
                      className="text-red-500 hover:text-red-600 hover:border-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit modal */}
      {editTarget && (
        <SlideFormModal
          open={modalOpen}
          initial={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        heading={deleteTarget?.heading ?? ""}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
