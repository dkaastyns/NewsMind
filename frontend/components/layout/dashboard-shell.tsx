"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import {
  Bell,
  ChevronRight,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Sparkles,
} from "lucide-react";
import { ChatWidget } from "@/components/ui/chat-widget";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kliping", label: "Kliping", icon: FileText },
  { href: "/generate-konten", label: "Generate Konten", icon: Sparkles },
  { href: "/workflow", label: "Workflow", icon: ShieldCheck },
  { href: "/arsip", label: "Arsip", icon: Search },
  { href: "/pengguna", label: "Pengguna", icon: Users },
  { href: "/profil", label: "Profil", icon: Settings2 },
];

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen px-4 py-4 lg:px-6">
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[270px_1fr]">
        <aside className="glass-card flex flex-col rounded-[28px] p-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              NewsMind
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Humas DPRD</h1>
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = title === item.label;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "accent-gradient text-white shadow-lg shadow-pink-100/70"
                      : "text-slate-600 hover:bg-white hover:text-slate-900",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </nav>

          <div className="rounded-[24px] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              AI Assistant
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Siap membantu ringkasan berita, ulasan, dan draft konten.
            </p>
            <button 
              onClick={() => setIsChatOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full accent-gradient px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <MessageSquareText className="h-4 w-4" />
              Quick Ask
            </button>
          </div>
        </aside>

        <main className="flex flex-col gap-4">
          <header className="glass-card sticky top-4 z-20 flex items-center justify-between rounded-[28px] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {subtitle}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-500 shadow-sm md:flex">
                <Search className="h-4 w-4" />
                Search news, topics, or sources
              </div>
              <button className="rounded-full bg-white p-3 text-slate-600 shadow-sm transition hover:text-slate-900">
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full accent-gradient text-sm font-semibold text-white">
                  HM
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold text-slate-900">Humas DPRD</p>
                  <p className="text-xs text-slate-500">Senior editor</p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </main>
      </div>

      {/* Floating AI Chatbot Widget */}
      <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
