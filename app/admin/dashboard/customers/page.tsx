"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Trash2, Eye, User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  orderCount: number;
  totalSpent: number;
  createdAt?: { seconds: number };
}

const PAGE_SIZE = 10;

// ── Customer detail modal ─────────────────────────────────────────────────────

function CustomerDetailModal({
  customer,
  open,
  onClose,
}: {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Avatar placeholder */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand_green/10 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-brand_green" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{customer.name || "—"}</p>
              <p className="text-xs text-gray-400">
                Joined{" "}
                {customer.createdAt
                  ? new Date(customer.createdAt.seconds * 1000).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {customer.email && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider w-20 shrink-0">Email</span>
                <span className="text-gray-700 text-right break-all">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider w-20 shrink-0">Phone</span>
                <span className="text-gray-700">{customer.phone}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider w-20 shrink-0">Address</span>
                <span className="text-gray-700 text-right">{customer.address}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3 mt-2">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{customer.orderCount}</p>
              <p className="text-xs text-gray-400">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-brand_green">K {customer.totalSpent.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Spent</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

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
          <DialogTitle>Delete customer?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          This will permanently remove <strong>&quot;{name}&quot;</strong> from your customer records. This action cannot be undone.
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);

  const [viewCustomer, setViewCustomer]   = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<Customer | null>(null);

  // ── Realtime listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs: Customer[] = snap.docs.map((d) => ({
        id:          d.id,
        name:        d.data().name        ?? "",
        email:       d.data().email       ?? "",
        phone:       d.data().phone       ?? "",
        address:     d.data().address     ?? "",
        orderCount:  d.data().orderCount  ?? 0,
        totalSpent:  d.data().totalSpent  ?? 0,
        createdAt:   d.data().createdAt   ?? undefined,
      }));
      setCustomers(docs);
      setLoading(false);
    }, (err) => {
      console.error("customers snapshot error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "customers", deleteTarget.id));
    setDeleteTarget(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-400 mt-0.5">View and manage your customer base</p>
        </header>

        {/* Search */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="max-w-xs"
          />
          {!loading && (
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
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
                {customers.length === 0 ? "No customers yet." : "No customers match your search."}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Joined</th>
                      <th className="px-4 py-3 text-center">Orders</th>
                      <th className="px-4 py-3 text-right">Total Spent</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50/60 transition-colors">

                        {/* Customer */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand_green/10 flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-brand_green" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{customer.name || "—"}</p>
                              {customer.email && (
                                <p className="text-xs text-gray-400">{customer.email}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3 text-gray-500">
                          {customer.phone || "—"}
                        </td>

                        {/* Joined */}
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {customer.createdAt
                            ? new Date(customer.createdAt.seconds * 1000).toLocaleDateString()
                            : "—"}
                        </td>

                        {/* Orders */}
                        <td className="px-4 py-3 text-center text-gray-700 font-medium">
                          {customer.orderCount}
                        </td>

                        {/* Total spent */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          K {customer.totalSpent.toLocaleString()}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label="View customer"
                              onClick={() => setViewCustomer(customer)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label="Delete customer"
                              className="text-red-500 hover:text-red-600 hover:border-red-300"
                              onClick={() => setDeleteTarget(customer)}
                            >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
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

      {/* Detail modal */}
      <CustomerDetailModal
        customer={viewCustomer}
        open={!!viewCustomer}
        onClose={() => setViewCustomer(null)}
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
