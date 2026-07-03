'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Search } from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ArticleDetailTabs } from '@/components/articles/ArticleDetailTabs';

interface ArticleItem {
  id: string;
  title: string;
  status: string;
  ai_sentiment: 'Positif' | 'Netral' | 'Negatif';
  ai_topic: string;
  created_at: string;
}

const SENTIMENT_COLOR: Record<string, string> = {
  Positif: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Netral:  'bg-amber-50 text-amber-600 border-amber-100',
  Negatif: 'bg-red-100 text-red-600 border-red-200',
};

const listVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: 'spring' as const, damping: 24, stiffness: 300 } },
};

function ArsipContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get('highlight');

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(highlightId || null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedArticleData, setSelectedArticleData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('access_token');
    fetch('/api/articles?page=1&limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (mounted && Array.isArray(data)) setArticles(data); })
      .catch((err: unknown) => { if (mounted) setError((err as Error).message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedArticleId) return;
    let mounted = true;
    const token = localStorage.getItem('access_token');
    const timer = setTimeout(() => {
      if (mounted) setLoadingDetail(true);
    }, 0);
    fetch(`/api/articles/${selectedArticleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (mounted) setSelectedArticleData(data); })
      .catch(console.error)
      .finally(() => { if (mounted) setLoadingDetail(false); });
    return () => { mounted = false; clearTimeout(timer); };
  }, [selectedArticleId]);

  const filtered = articles.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    (a.ai_topic || '').toLowerCase().includes(query.toLowerCase())
  );

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent"
        />
        <p className="text-sm text-slate-400 animate-pulse">Memuat arsip berita...</p>
      </div>
    </div>
  );

  if (error) return <div className="p-10 text-red-500 font-medium">{error}</div>;

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto flex-col lg:flex-row h-full">
      {/* Left — Article List */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        className="flex-1 flex flex-col gap-4 h-[calc(100vh-12rem)] overflow-hidden"
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul atau topik..."
            className="w-full rounded-2xl border border-white/60 bg-white/70 backdrop-blur pl-10 pr-4 py-3 text-sm text-slate-900 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition"
          />
        </div>

        <div className="space-y-3 overflow-y-auto pr-1 pb-4 custom-scrollbar flex-1">
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-500 text-center py-14 glass-card bg-white/40 rounded-3xl border-white/60 flex flex-col items-center gap-3"
            >
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="text-sm">Tidak ada artikel ditemukan.</p>
            </motion.div>
          )}
          <motion.div variants={listVariants} initial="hidden" animate="show">
            {filtered.map((a) => (
              <motion.div key={a.id} variants={itemVariants}>
                <Card
                  className={`glass-card cursor-pointer transition-all duration-200 mb-3 ${
                    selectedArticleId === a.id || highlightId === a.id
                      ? 'border-pink-400 bg-pink-50/40 ring-1 ring-pink-400/50 shadow-md'
                      : 'border-white/60 bg-white/40 hover:bg-white/70 hover:shadow-sm'
                  }`}
                  onClick={() => setSelectedArticleId(a.id)}
                >
                  <CardContent className="p-5 flex flex-col gap-2.5">
                    <div className="font-semibold text-slate-900 leading-snug line-clamp-2">{a.title}</div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`font-medium border ${SENTIMENT_COLOR[a.ai_sentiment] ?? 'bg-slate-50 text-slate-500 border-slate-100'}`}
                      >
                        {a.ai_sentiment || 'Pending'}
                      </Badge>
                      {a.ai_topic && (
                        <span className="truncate max-w-[200px] text-xs font-medium bg-white/60 px-2.5 py-0.5 rounded-lg border border-slate-100">
                          {a.ai_topic}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right — Detail Panel */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280, delay: 0.1 }}
        className="flex-1 lg:max-w-xl h-[calc(100vh-12rem)] pb-10 shrink-0"
      >
        <AnimatePresence mode="wait">
          {loadingDetail ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center items-center h-full"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent"
              />
            </motion.div>
          ) : selectedArticleData ? (
            <motion.div
              key={selectedArticleData.id}
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="h-full overflow-y-auto border border-white/60 rounded-3xl glass-card bg-white/60 p-6 shadow-sm custom-scrollbar"
            >
              <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
                {selectedArticleData.title}
              </h2>
              <ArticleDetailTabs article={selectedArticleData} />
              <Button
                variant="outline"
                className="mt-8 w-full h-11 rounded-xl bg-white hover:bg-slate-50"
                onClick={() => { setSelectedArticleId(null); setSelectedArticleData(null); }}
              >
                Tutup Detail
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 h-full min-h-[300px] border border-dashed border-slate-200 bg-white/20 rounded-3xl text-slate-400"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                <FileText className="h-12 w-12 text-slate-300" />
              </motion.div>
              <p className="text-sm font-medium">Pilih kliping di kiri untuk melihat detail</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function ArsipPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-slate-300" />
      </div>
    }>
      <ArsipContent />
    </Suspense>
  );
}
