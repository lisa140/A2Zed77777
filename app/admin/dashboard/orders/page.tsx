"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  increment,
  getDoc,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Trash2, Eye } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
}

interface DeliveryAddress {
  area:         string;
  street:       string;
  city:         string;
  instructions: string;
}

interface Order {
  id:              string;
  orderId?:        string;
  userId?:         string;
  customerName:    string;
  customerEmail:   string;
  customerPhone:   string;
  address?:        string; // legacy
  deliveryAddress?: DeliveryAddress;
  deliveryLocation?: "lusaka" | "outside";
  items:           OrderItem[];
  subtotal?:       number;
  deliveryFee?:    number;
  total:           number;
  paymentMethod?:  string;
  paymentStatus?:  "paid" | "pending" | "cod";
  status:          OrderStatus;
  flutterwaveRef?: string;
  createdAt?:      { seconds: number };
}

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending",    label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped",    label: "Shipped" },
  { value: "delivered",  label: "Delivered" },
  { value: "cancelled",  label: "Cancelled" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all",        label: "All Statuses" },
  ...STATUS_OPTIONS,
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  shipped:    "bg-purple-100 text-purple-700",
  delivered:  "bg-green-100 text-green-700",
  cancelled:  "bg-red-100 text-red-600",
};

const PAGE_SIZE = 10;

// ── Order detail modal ────────────────────────────────────────────────────────

function OrderDetailModal({
  order,
  open,
  onClose,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Order meta */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Order ID</p>
              <p className="font-mono text-gray-700 text-xs break-all">{order.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Date</p>
              <p className="text-gray-700">
                {order.createdAt
                  ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Status</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status]}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Total</p>
              <p className="font-bold text-gray-900">K {order.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Customer */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Customer</p>
            <div className="space-y-1">
              <p className="font-medium text-gray-900">{order.customerName || "—"}</p>
              {order.customerEmail && <p className="text-gray-500">{order.customerEmail}</p>}
              {order.customerPhone && <p className="text-gray-500">{order.customerPhone}</p>}
              {order.address        && <p className="text-gray-500">{order.address}</p>}
            </div>
          </div>

          {/* Delivery address (new schema) */}
          {order.deliveryAddress && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Delivery Address</p>
              <div className="space-y-0.5 text-sm text-gray-700">
                {order.deliveryAddress.street && <p>{order.deliveryAddress.street}</p>}
                {order.deliveryAddress.area   && <p>{order.deliveryAddress.area}</p>}
                {order.deliveryAddress.city   && <p>{order.deliveryAddress.city}</p>}
                {order.deliveryAddress.instructions && (
                  <p className="text-gray-400 italic text-xs">Note: {order.deliveryAddress.instructions}</p>
                )}
              </div>
            </div>
          )}

          {/* Payment info */}
          {(order.paymentMethod || order.paymentStatus) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Payment</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {order.paymentMethod && (
                  <div>
                    <p className="text-xs text-gray-400">Method</p>
                    <p className="font-medium text-gray-900 capitalize">{order.paymentMethod}</p>
                  </div>
                )}
                {order.paymentStatus && (
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <p className={`font-semibold capitalize ${
                      order.paymentStatus === "paid" ? "text-green-600" :
                      order.paymentStatus === "cod"  ? "text-yellow-600" : "text-gray-600"
                    }`}>
                      {order.paymentStatus === "cod" ? "Cash on Delivery" : order.paymentStatus}
                    </p>
                  </div>
                )}
                {order.flutterwaveRef && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Reference</p>
                    <p className="font-mono text-xs text-gray-600">{order.flutterwaveRef}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Items</p>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded border border-gray-200" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    {item.size && <p className="text-xs text-gray-400">Size: {item.size}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">×{item.quantity}</p>
                    <p className="font-medium text-gray-900">K {(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-gray-900">K {order.total.toLocaleString()}</span>
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
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete order?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          This will permanently delete the order. This action cannot be undone.
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

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage]       = useState(1);

  const [viewOrder, setViewOrder]     = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);

  // ── Realtime listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const docs: Order[] = snap.docs.map((d) => ({
        id:              d.id,
        orderId:         d.data().orderId         ?? undefined,
        userId:          d.data().userId           ?? undefined,
        customerName:    d.data().customerName     ?? "",
        customerEmail:   d.data().customerEmail    ?? "",
        customerPhone:   d.data().customerPhone    ?? "",
        address:         d.data().address          ?? "",
        deliveryAddress: d.data().deliveryAddress  ?? undefined,
        deliveryLocation:d.data().deliveryLocation ?? undefined,
        items:           d.data().items            ?? [],
        subtotal:        d.data().subtotal         ?? undefined,
        deliveryFee:     d.data().deliveryFee      ?? undefined,
        total:           d.data().total            ?? 0,
        paymentMethod:   d.data().paymentMethod    ?? undefined,
        paymentStatus:   d.data().paymentStatus    ?? undefined,
        status:          d.data().status           ?? "pending",
        flutterwaveRef:  d.data().flutterwaveRef   ?? undefined,
        createdAt:       d.data().createdAt        ?? undefined,
      }));
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error("orders snapshot error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q && !o.customerName.toLowerCase().includes(q) && !o.customerEmail.toLowerCase().includes(q) && !o.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, search, statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (order: Order, status: OrderStatus) => {
    await updateDoc(doc(db, "orders", order.id), { status });

    // When marking delivered: credit totalSpent to customer (enables COD eligibility)
    if (status === "delivered" && order.userId) {
      const custSnap = await getDoc(doc(db, "customers", order.userId));
      if (custSnap.exists()) {
        await updateDoc(doc(db, "customers", order.userId), {
          totalSpent: increment(order.total),
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "orders", deleteTarget.id));
    setDeleteTarget(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">View and manage customer orders</p>
        </header>

        {/* Filters */}
        <div className="bg-white border-b border-gray-100 px-8 py-3 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or ID…"
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
              {filtered.length} order{filtered.length !== 1 ? "s" : ""}
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
                {orders.length === 0 ? "No orders yet." : "No orders match your search."}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">

                        {/* Order ID */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-500">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{order.customerName || "—"}</p>
                          {order.customerEmail && (
                            <p className="text-xs text-gray-400">{order.customerEmail}</p>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {order.createdAt
                            ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                            : "—"}
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          K {order.total.toLocaleString()}
                        </td>

                        {/* Items count */}
                        <td className="px-4 py-3 text-center text-gray-500">
                          {order.items.reduce((sum, i) => sum + i.quantity, 0)}
                        </td>

                        {/* Status select */}
                        <td className="px-4 py-3 text-center">
                          <Select
                            value={order.status}
                            onValueChange={(v) => handleStatusChange(order, v as OrderStatus)}
                          >
                            <SelectTrigger
                              className={`h-7 text-xs font-semibold border-0 rounded-full px-2.5 w-auto mx-auto ${STATUS_STYLES[order.status]}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label="View order"
                              onClick={() => setViewOrder(order)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              aria-label="Delete order"
                              className="text-red-500 hover:text-red-600 hover:border-red-300"
                              onClick={() => setDeleteTarget(order)}
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
      <OrderDetailModal
        order={viewOrder}
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
      />

      {/* Delete confirmation */}
      <DeleteDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
