"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, type AuthUser } from "@/stores/authStore";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden md:flex w-56 min-h-screen bg-white border-r border-gray-200 flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-gray-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
              <div className="h-2 w-16 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-2 py-3 space-y-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-gray-100 animate-pulse mx-1" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-white border-b border-gray-200" />
        <div className="flex-1 p-6 space-y-4">
          <div className="h-5 w-44 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((json: { success: boolean; data?: AuthUser }) => {
          if (json.success && json.data) {
            useAuthStore.getState().setUser(json.data);
          } else {
            router.push("/login");
          }
        })
        .catch(() => router.push("/login"));
    }
  }, [user, router]);

  if (!user) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
