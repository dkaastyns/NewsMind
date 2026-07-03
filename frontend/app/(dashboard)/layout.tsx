'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, FileText, LayoutDashboard, MessageSquareText, 
  Search, Settings2, Users, Sparkles 
} from 'lucide-react';
import { ChatWidget } from '@/components/ui/chat-widget';

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/kliping", label: "Kliping", icon: FileText, adminOnly: false },
  { href: "/generate-konten", label: "Generate Konten", icon: Sparkles, adminOnly: false },
  { href: "/arsip", label: "Arsip", icon: Search, adminOnly: false },
  { href: "/pengguna", label: "Pengguna", icon: Users, adminOnly: true },
  { href: "/profil", label: "Profil", icon: Settings2, adminOnly: false },
];

const routeMeta: Record<string, { title: string, subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview Statistik' },
  '/kliping': { title: 'Kliping', subtitle: 'News intake and processing' },
  '/generate-konten': { title: 'Generate Konten', subtitle: 'AI Content Creation' },
  '/workflow': { title: 'Workflow', subtitle: 'Persetujuan dan Publikasi' },
  '/arsip': { title: 'Arsip Kliping', subtitle: 'Cari dan kelola arsip' },
  '/pengguna': { title: 'Pengguna', subtitle: 'User Access and Roles' },
  '/profil': { title: 'Profil', subtitle: 'Pengaturan Akun' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [user, setUser] = useState<{full_name: string, role: string} | null>(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
    } else {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
          localStorage.removeItem('access_token');
          router.push('/login');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.full_name) setUser(data);
      })
      .catch(err => {
        console.error("Failed to fetch user", err);
      });
    }
  }, [router]);

  if (!mounted) return null;

  const currentMeta = routeMeta[pathname] || { title: 'NewsMind', subtitle: 'Humas DPRD' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#EECDA3]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[#EF629F]/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 px-4 py-4 lg:px-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[270px_1fr]">
          
          {/* SIDEBAR */}
          <aside className="glass-card flex flex-col rounded-[28px] p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                NewsMind
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">Humas DPRD</h1>
            </div>

            <nav className="mt-8 flex flex-1 flex-col gap-1.5">
              {navigation.map((item, i) => {
                if (item.adminOnly && user?.role !== 'admin') return null;

                const Icon = item.icon;
                const active = pathname.startsWith(item.href);

                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, type: 'spring', damping: 24, stiffness: 320 }}
                  >
                    <Link
                      href={item.href}
                      className={[
                        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        active
                          ? "accent-gradient text-white shadow-lg shadow-pink-100/70"
                          : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <ChevronRight className={`h-4 w-4 opacity-60 transition-transform duration-200 ${active ? 'translate-x-0' : 'group-hover:translate-x-1'}`} />
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="rounded-[24px] bg-white p-4 shadow-sm mt-4 shrink-0">
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

          {/* MAIN CONTENT */}
          <main className="flex flex-col gap-4 overflow-hidden h-[calc(100vh-2rem)]">
            
            {/* HEADER */}
            <header className="glass-card flex items-center justify-between rounded-[28px] px-5 py-4 shrink-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {currentMeta.subtitle}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">{currentMeta.title}</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-500 shadow-sm md:flex">
                  <Search className="h-4 w-4" />
                  Search news, topics, or sources
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex h-10 items-center gap-3 rounded-full bg-white pl-1 pr-4 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-xs font-bold text-pink-600 uppercase">
                      {user?.full_name?.slice(0, 2) || '...'}
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">{user?.full_name || 'Memuat...'}</p>
                      <p className="text-xs text-slate-500 capitalize">{user?.role || 'User'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* PAGE CONTENT */}
            <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 300, duration: 0.25 }}
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* Floating AI Chatbot Widget */}
        <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    </div>
  );
}
