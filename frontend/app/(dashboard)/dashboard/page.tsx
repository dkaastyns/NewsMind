'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, TrendingUp, Newspaper, Activity, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import Link from 'next/link';

interface DashboardStats {
  total_clippings: number;
  sentiment_distribution: { sentiment: string; count: number }[];
  top_topics: { topic: string; count: number }[];
}

const SENTIMENT_COLORS = {
  Positif: '#10b981', // emerald-500
  Netral: '#94a3b8',  // slate-400
  Negatif: '#f43f5e', // rose-500
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [user, setUser] = useState<{full_name: string, role: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) throw new Error('Unauthorized');

        // Fetch User
        const userRes = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }

        // Fetch Stats
        const statsRes = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } });
        if (!statsRes.ok) throw new Error('Gagal memuat statistik');
        const statsData = await statsRes.json();
        setStats(statsData);
      } catch (err: unknown) {
        const error = err as Error;
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
        <div className="h-full min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin h-8 w-8 text-pink-500" />
            <p className="text-sm font-medium text-slate-500 animate-pulse">Memuat data analitik...</p>
          </div>
        </div>
    );
  }
  
  if (error) {
    return (
        <div className="p-10 flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            <Activity className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Gagal Memuat Data</h3>
          <p className="text-slate-500">{error}</p>
        </div>
    );
  }
  
  if (!stats) return null;

  // --- USER DASHBOARD (HUMAS / VIEWER) ---
  if (user?.role !== 'admin') {
    return (
      <div className="space-y-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative overflow-hidden rounded-[32px] bg-slate-900 px-8 py-10 shadow-xl sm:px-12"
        >
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-blue-500/40 to-cyan-400/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-3">
              Selamat datang kembali, {user?.full_name?.split(' ')[0] || 'Tim Humas'}! 👋
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Anda memiliki akses untuk meninjau kliping berita, menganalisis sentimen, dan membuat draf konten. Silakan pilih menu di bawah untuk memulai pekerjaan Anda.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { href: '/kliping', label: 'Lihat Kliping Berita', desc: 'Tinjau semua berita terbaru, ulasan sentimen, dan draf caption sosial media yang sudah dihasilkan oleh sistem.', icon: FileText, color: 'blue', delay: 0.1 },
            { href: '/generate-konten', label: 'Generate Konten AI', desc: 'Gunakan asisten AI untuk memproses naskah kasar Anda menjadi artikel siap terbit dengan nada yang sesuai.', icon: Sparkles, color: 'pink', delay: 0.2 },
          ].map((item) => {
            const Icon = item.icon;
            const isBlue = item.color === 'blue';
            return (
              <Link key={item.href} href={item.href} className="group block">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: item.delay, type: 'spring', damping: 22, stiffness: 280 }}
                  whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12)' }}
                  className="glass-card border-white/60 shadow-sm bg-gradient-to-br from-white/80 to-white/40 overflow-hidden relative h-full rounded-2xl p-8 flex flex-col gap-4"
                >
                  <div className={`h-14 w-14 rounded-2xl ${isBlue ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'} flex items-center justify-center shadow-inner`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{item.label}</h3>
                    <p className="text-slate-500">{item.desc}</p>
                  </div>
                  <div className={`mt-auto pt-4 flex items-center gap-2 text-sm font-bold ${isBlue ? 'text-blue-600' : 'text-pink-600'} group-hover:gap-3 transition-all`}>
                    Mulai sekarang <ArrowRight className="h-4 w-4" />
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // --- ADMIN DASHBOARD ---
  return (
      <div className="space-y-8 pb-10">
        
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[32px] bg-slate-900 px-8 py-10 shadow-xl sm:px-12">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gradient-to-br from-pink-500/40 to-orange-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-500/30 to-purple-500/10 blur-3xl" />
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 mb-6 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              <span>Analitik AI aktif</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-3">
              Pantau opini publik secara *real-time*
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed">
              Dashboard ini merangkum semua artikel berita yang telah diproses oleh AI, menyajikan tren sentimen dan topik utama.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Kliping */}
          <Card className="glass-card border-white/60 shadow-sm bg-gradient-to-br from-white/80 to-white/40 overflow-hidden relative group">
            <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Artikel</p>
                  <h3 className="text-5xl font-black text-slate-900 tracking-tight">{stats.total_clippings}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                  <Newspaper className="h-6 w-6" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full self-start">
                <TrendingUp className="h-4 w-4" />
                <span>+12% minggu ini</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Sentimen */}
          <Card className="glass-card border-white/60 shadow-sm bg-gradient-to-br from-white/80 to-white/40 md:col-span-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg font-bold text-slate-900">Distribusi Sentimen Berita</CardTitle>
              <CardDescription>Analisis AI terhadap nada artikel</CardDescription>
            </CardHeader>
            <CardContent className="h-[240px] w-full flex items-center pt-0">
              {stats.sentiment_distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" />
                      </filter>
                    </defs>
                    <Pie
                      data={stats.sentiment_distribution}
                      dataKey="count"
                      nameKey="sentiment"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      stroke="none"
                    >
                      {stats.sentiment_distribution.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={SENTIMENT_COLORS[entry.sentiment as keyof typeof SENTIMENT_COLORS] || '#cbd5e1'} 
                          filter="url(#shadow)"
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend 
                      verticalAlign="middle" 
                      align="right" 
                      layout="vertical"
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full text-center text-slate-400 font-medium">Belum ada data sentimen.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Topics */}
        <Card className="glass-card border-white/60 shadow-sm bg-gradient-to-br from-white/80 to-white/40">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Topik Pemberitaan Teratas</CardTitle>
            <CardDescription>Isu yang paling sering dibahas di media</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.top_topics.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.top_topics} layout="vertical" margin={{ left: 50, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="topic" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#0f172a', fontWeight: 600, fontSize: 13 }} 
                    />
                    <RechartsTooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={24}>
                      {stats.top_topics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ec4899' : index === 1 ? '#8b5cf6' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 font-medium">Belum ada data topik.</div>
            )}
          </CardContent>
        </Card>

      </div>
  );
}
