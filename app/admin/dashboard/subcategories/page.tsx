"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "women",
  "men",
  "electronics",
  "beauty",
  "home",
  "car-parts",
  "accessories",
] as const;

type CategorySlug = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  women:       "Women",
  men:         "Men",
  electronics: "Electronics",
  beauty:      "Beauty",
  home:        "Home",
  "car-parts": "Car Parts",
  accessories: "Accessories",
};

const DEFAULT_SUBCATEGORIES: { name: string; category: CategorySlug }[] = [
  // Women
  { name: "Dresses",      category: "women" },
  { name: "Tops & Blouses", category: "women" },
  { name: "Skirts",       category: "women" },
  // Men
  { name: "T-Shirts",     category: "men" },
  { name: "Shirts",       category: "men" },
  { name: "Trousers",     category: "men" },
  // Electronics
  { name: "Phones",       category: "electronics" },
  { name: "Earphones",    category: "electronics" },
  { name: "Chargers",     category: "electronics" },
  // Beauty
  { name: "Skincare",     category: "beauty" },
  { name: "Haircare",     category: "beauty" },
  { name: "Makeup",       category: "beauty" },
  // Home
  { name: "Kitchen",      category: "home" },
  { name: "Bedding",      category: "home" },
  { name: "Lighting",     category: "home" },
  // Car Parts
  { name: "Electronics",  category: "car-parts" },
  { name: "Accessories",  category: "car-parts" },
  { name: "Tyres",        category: "car-parts" },
  // Accessories
  { name: "Bags",         category: "accessories" },
  { name: "Sunglasses",   category: "accessories" },
  { name: "Caps",         category: "accessories" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubcategoryDoc {
  id:       string;
  name:     string;
  slug:     string;
  category: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubcategoriesPage() {
  const [subcats,     setSubcats]     = useState<SubcategoryDoc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<"all" | CategorySlug>("all");

  // Add form
  const [newName,     setNewName]     = useState("");
  const [newCategory, setNewCategory] = useState<CategorySlug>("women");
  const [addError,    setAddError]    = useState("");
  const [adding,      setAdding]      = useState(false);

  // Inline edit
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const seeded = useRef(false);

  // ── Seed defaults if collection is empty ─────────────────────────────────────
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const runSeed = async () => {
      try {
        const snap = await getDocs(collection(db, "subcategories"));
        if (!snap.empty) return;
        await Promise.all(
          DEFAULT_SUBCATEGORIES.map((s) =>
            addDoc(collection(db, "subcategories"), {
              name:      s.name,
              slug:      toSlug(s.name),
              category:  s.category,
              createdAt: serverTimestamp(),
            })
          )
        );
      } catch (err) {
        console.error("Subcategory seed error:", err);
      }
    };
    runSeed();
  }, []);

  // ── Real-time listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "subcategories"),
      (snap) => {
        const docs: SubcategoryDoc[] = snap.docs
          .map((d) => ({
            id:       d.id,
            name:     d.data().name     ?? "",
            slug:     d.data().slug     ?? "",
            category: d.data().category ?? "",
          }))
          .sort(
            (a, b) =>
              a.category.localeCompare(b.category) ||
              a.name.localeCompare(b.name)
          );
        setSubcats(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Subcategories listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError("Name is required.");
      return;
    }
    const isDupe = subcats.some(
      (s) =>
        s.name.toLowerCase() === trimmed.toLowerCase() &&
        s.category === newCategory
    );
    if (isDupe) {
      setAddError(
        `"${trimmed}" already exists in ${CATEGORY_LABELS[newCategory] ?? newCategory}.`
      );
      return;
    }
    setAddError("");
    setAdding(true);
    try {
      await addDoc(collection(db, "subcategories"), {
        name:      trimmed,
        slug:      toSlug(trimmed),
        category:  newCategory,
        createdAt: serverTimestamp(),
      });
      setNewName("");
    } catch (err) {
      console.error("Add subcategory error:", err);
      setAddError("Failed to add. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (sub: SubcategoryDoc) => {
    setEditId(sub.id);
    setEditName(sub.name);
    setDeleteId(null);
  };

  const saveEdit = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await updateDoc(doc(db, "subcategories", id), {
        name: trimmed,
        slug: toSlug(trimmed),
      });
    } catch (err) {
      console.error("Update subcategory error:", err);
    } finally {
      setEditId(null);
    }
  };

  const handleEditKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter")  saveEdit(id);
    if (e.key === "Escape") setEditId(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "subcategories", id));
    } catch (err) {
      console.error("Delete subcategory error:", err);
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  };

  // ── Filtered view ────────────────────────────────────────────────────────────

  const visible =
    activeTab === "all"
      ? subcats
      : subcats.filter((s) => s.category === activeTab);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">

          {/* ── Page header ── */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage subcategory filters for the shop page.
              </p>
            </div>
            <span className="text-sm text-gray-400 font-medium">
              {subcats.length} total
            </span>
          </div>

          {/* ── Category tabs ── */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-gray-200">
            {(["all", ...CATEGORIES] as const).map((tab) => {
              const label =
                tab === "all"
                  ? "All"
                  : CATEGORY_LABELS[tab as CategorySlug] ?? tab;
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={[
                    "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                    isActive
                      ? "border-brand_green text-brand_green"
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300",
                  ].join(" ")}
                >
                  {label}
                  {tab !== "all" && (
                    <span className="ml-1.5 text-[11px] text-gray-400">
                      ({subcats.filter((s) => s.category === tab).length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Add new form ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Add New Subcategory
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Name input */}
              <div className="flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="Subcategory name (e.g. Dresses)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_green/20 focus:border-brand_green"
                />
              </div>

              {/* Category select */}
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CategorySlug)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_green/20 focus:border-brand_green bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>

              {/* Add button */}
              <button
                onClick={handleAdd}
                disabled={adding}
                className="flex items-center gap-2 px-4 py-2 bg-brand_green text-white text-sm font-semibold rounded-lg hover:bg-brand_green_hover transition-colors disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                {adding ? "Adding…" : "Add"}
              </button>
            </div>

            {addError && (
              <p className="text-xs text-brand_red mt-2">{addError}</p>
            )}
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">
                Loading subcategories…
              </div>
            ) : visible.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-400">
                  No subcategories yet.{" "}
                  {activeTab !== "all" && "Add one using the form above."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((sub) => {
                    const isEditing  = editId   === sub.id;
                    const isDeleting = deleteId === sub.id;

                    // ── Delete confirm row ──────────────────────────────────
                    if (isDeleting) {
                      return (
                        <tr key={sub.id} className="bg-red-50">
                          <td colSpan={4} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm text-gray-700">
                                Delete{" "}
                                <strong className="text-gray-900">{sub.name}</strong>?
                                This cannot be undone.
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleDelete(sub.id)}
                                  disabled={deleting}
                                  className="px-3 py-1.5 bg-brand_red text-white text-xs font-semibold rounded-lg hover:bg-brand_red_hover transition-colors disabled:opacity-60"
                                >
                                  {deleting ? "Deleting…" : "Yes, Delete"}
                                </button>
                                <button
                                  onClick={() => setDeleteId(null)}
                                  className="px-3 py-1.5 bg-white text-gray-600 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ── Edit row ────────────────────────────────────────────
                    if (isEditing) {
                      return (
                        <tr key={sub.id} className="bg-brand_green_light">
                          <td className="px-4 py-2.5">
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => handleEditKey(e, sub.id)}
                              className="w-full px-2.5 py-1.5 text-sm border border-brand_green rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_green/20"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 capitalize">
                            {CATEGORY_LABELS[sub.category as CategorySlug] ?? sub.category}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">
                            {toSlug(editName || sub.name)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveEdit(sub.id)}
                                title="Save (Enter)"
                                className="p-1.5 rounded-lg bg-brand_green text-white hover:bg-brand_green_hover transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                title="Cancel (Esc)"
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ── Normal row ──────────────────────────────────────────
                    return (
                      <tr
                        key={sub.id}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <button
                            onClick={() => startEdit(sub)}
                            className="text-left hover:text-brand_green transition-colors flex items-center gap-1.5 group/name"
                          >
                            {sub.name}
                            <Pencil className="w-3 h-3 text-gray-300 group-hover/name:text-brand_green opacity-0 group-hover/name:opacity-100 transition-all" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 capitalize">
                            {CATEGORY_LABELS[sub.category as CategorySlug] ?? sub.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {sub.slug}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(sub)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand_green hover:bg-brand_green_light transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setDeleteId(sub.id); setEditId(null); }}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand_red hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Subcategory count per tab */}
          {!loading && visible.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 text-right">
              Showing {visible.length}{" "}
              {visible.length === 1 ? "subcategory" : "subcategories"}
              {activeTab !== "all" &&
                ` in ${CATEGORY_LABELS[activeTab as CategorySlug] ?? activeTab}`}
            </p>
          )}

        </div>
      </main>
    </div>
  );
}
