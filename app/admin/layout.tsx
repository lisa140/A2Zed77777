"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AuthState = "checking" | "authorized" | "unauthorized";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const [state, setState] = useState<AuthState>("checking");

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    // Login page needs no auth check
    if (isLoginPage) {
      setState("authorized");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      try {
        const q    = query(collection(db, "admins"), where("email", "==", user.email ?? ""));
        const snap = await getDocs(q);

        if (snap.empty) {
          await signOut(auth);
          router.replace("/admin/login");
          return;
        }

        setState("authorized");
      } catch (err) {
        console.error("Admin auth check failed:", err);
        await signOut(auth);
        router.replace("/admin/login");
      }
    });

    return () => unsubscribe();
  }, [isLoginPage, router]);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand_green border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Checking authentication…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
