"use client";

import { useState, type ReactNode } from "react";

import { ConnectionBanner } from "@/components/common/ConnectionBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { ScanStoreProvider, useStoreInit } from "@/store/ScanStore";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

function InitRunner() {
  useStoreInit();
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <ScanStoreProvider>
      <ToastProvider>
        <InitRunner />
        <div className="flex min-h-dvh">
          <aside className="hidden w-[248px] shrink-0 border-r border-line bg-surface/40 lg:block">
            <div className="sticky top-0 h-dvh">
              <Sidebar />
            </div>
          </aside>

          {drawer ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-black/60 animate-fade-in"
                onClick={() => setDrawer(false)}
                aria-hidden
              />
              <div className="absolute left-0 top-0 h-full w-[248px] border-r border-line bg-surface shadow-pop animate-slide-up">
                <Sidebar onNavigate={() => setDrawer(false)} />
              </div>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <Header onMenu={() => setDrawer(true)} />
            <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
              <ConnectionBanner />
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </ScanStoreProvider>
  );
}
