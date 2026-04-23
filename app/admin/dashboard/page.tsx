"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { ShoppingBag, DollarSign, Box, Users } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminDashboardPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [stats, setStats] = useState({
    orders:    0,
    revenue:   0,
    products:  0,
    customers: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminEmail(user?.email ?? "");
    });
    return () => unsubscribe();
  }, []);

  // Live stat listeners
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"), (snap) => {
      const total = snap.docs.reduce((sum, d) => sum + (d.data().total ?? 0), 0);
      setStats((s) => ({ ...s, orders: snap.size, revenue: total }));
    });
    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setStats((s) => ({ ...s, products: snap.size }));
    });
    const unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
      setStats((s) => ({ ...s, customers: snap.size }));
    });
    return () => {
      unsubOrders();
      unsubProducts();
      unsubCustomers();
    };
  }, []);

  const statCards = [
    { label: "Total Orders",    value: stats.orders.toString(),                      icon: ShoppingBag, accent: "#CC0000" },
    { label: "Total Revenue",   value: `K ${stats.revenue.toLocaleString()}`,        icon: DollarSign,  accent: "#F5A623" },
    { label: "Total Products",  value: stats.products.toString(),                    icon: Box,         accent: "#CC0000" },
    { label: "Total Customers", value: stats.customers.toString(),                   icon: Users,       accent: "#F5A623" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-8 py-4">
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back
            {adminEmail && (
              <span className="text-brand_green">, {adminEmail}</span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Here's what's happening in your store</p>
        </header>

        {/* Stats */}
        <main className="flex-1 p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {statCards.map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accent}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Placeholder content area */}
          <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            <p className="text-sm">More dashboard widgets coming soon.</p>
          </div>
        </main>

      </div>
    </div>
  );
}
