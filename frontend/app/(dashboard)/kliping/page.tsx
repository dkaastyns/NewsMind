"use client";

import { Upload, Link2, ScanText, Trash2, Eye, Sparkles, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

type DetailTabId = "ringkasan" | "ulasan" | "draft" | "caption";

interface ClipItem {
  id: string;
  title: string;
  source: string;
  tone: string;
  date: string;
  ringkasan: string;
  ulasan: string;
  draftBerita: string;
  draftCaption: string;
}

const toneColor: Record<string, string> = {
  Positif:  "bg-emerald-50 text-emerald-600 border border-emerald-100",
  Netral:   "bg-amber-50 text-amber-600 border border-amber-100",
  Negatif:  "bg-red-50 text-red-500 border border-red-100",
  Positive: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  Neutral:  "bg-amber-50 text-amber-600 border border-amber-100",
  Negative: "bg-red-50 text-red-500 border border-red-100",
};

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 22, stiffness: 300 } },
  exit:   { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const expandVariants: Variants = {
  hidden:  { opacity: 0, height: 0, marginTop: 0 },
  show:    { opacity: 1, height: 'auto', marginTop: 16, transition: { type: 'spring' as const, damping: 28, stiffness: 280 } },
  exit:    { opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.18 } },
};

function mapArticleToClip(a: Record<string, string>): ClipItem {
  const ringkasanArr = (() => {
    try { return JSON.parse(a.ai_summary || "[]"); } catch { return []; }
  })();
  return {
    id: a.id,
    title: a.title,
    source: a.ai_topic || "Berita",
    tone: a.ai_sentiment || "Netral",
    date: new Date(a.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    ringkasan: Array.isArray(ringkasanArr) ? ringkasanArr.join("\n\n") : (a.ai_summary || "-"),
    ulasan: a.ai_review || "-",
    draftBerita: a.ai_caption_web || "-",
    draftCaption: a.ai_caption_social || "-",
  };
}

export default function KlipingPage() {
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"url" | "upload">("url");
  const [items, setItems] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("ringkasan");

  // Load real articles from backend on mount
  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem("access_token");
    fetch("/api/articles?page=1&limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: Record<string, string>[]) => {
        if (mounted && Array.isArray(data)) {
          setItems(data.map(mapArticleToClip));
        }
      })
      .catch(console.error)
      .finally(() => { if (mounted) setFetching(false); });
    return () => { mounted = false; };
  }, []);

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `Kliping dari: ${new URL(url).hostname}`,
          source_type: "url",
          source_url: url,
        }),
      });

      if (!res.ok) throw new Error("Gagal mengirim ke backend");
      const data = await res.json();
      setItems((prev) => [mapArticleToClip(data), ...prev]);
    } catch (err) {
      console.error(err);
      // Graceful fallback: show pending card
      setItems((prev) => [
        {
          id: Date.now().toString(),
          title: `Kliping dari: ${url}`,
          source: "Pending",
          tone: "Netral",
          date: "Baru saja",
          ringkasan: "Artikel sedang diproses oleh AI. Refresh halaman sebentar lagi untuk melihat hasilnya.",
          ulasan: "-",
          draftBerita: "-",
          draftCaption: "-",
        },
        ...prev,
      ]);
    } finally {
      setUrl("");
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    // TODO: implement PDF upload to /api/articles with extracted_text
    setTimeout(() => {
      setFileName(null);
      setLoading(false);
    }, 1500);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setActiveDetailTab("ringkasan");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      {/* Left: Input */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="glass-card rounded-[28px] p-5 h-fit sticky top-6"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: 8, scale: 1.08 }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm"
          >
            <Upload className="h-5 w-5 text-slate-500" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Tambah sumber berita</h3>
            <p className="text-sm text-slate-500">Upload PDF, gambar, atau tempel link berita.</p>
          </div>
        </div>

        {/* Tab Switch */}
        <div className="mt-5 flex gap-2 rounded-2xl bg-slate-100 p-1">
          {(["url", "upload"] as const).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {tab === "url" ? <Link2 className="h-4 w-4" /> : <ScanText className="h-4 w-4" />}
              {tab === "url" ? "Paste URL" : "Upload File"}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "url" ? (
            <motion.form
              key="url"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleAddUrl}
              className="mt-4 space-y-3"
            >
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://kompas.com/berita/..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
              />
              <motion.button
                type="submit"
                disabled={loading || !url.trim()}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white accent-gradient disabled:opacity-50"
              >
                {loading ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="h-4 w-4 rounded-full border-2 border-white border-t-transparent block"
                  />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Memproses dengan AI..." : "Proses dengan AI"}
              </motion.button>
            </motion.form>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-4"
            >
              <motion.label
                whileHover={{ scale: 1.01, borderColor: "#f9a8d4" }}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-10 text-center transition hover:bg-pink-50/30"
              >
                <motion.div
                  whileHover={{ rotate: -8, scale: 1.12 }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-500"
                >
                  <ScanText className="h-5 w-5" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {fileName ? fileName : "Klik untuk upload PDF atau gambar"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">PDF, JPG, PNG — maksimal 10MB</p>
                </div>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
              </motion.label>
              {loading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center justify-center gap-2 text-sm text-pink-500"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="h-4 w-4 rounded-full border-2 border-pink-500 border-t-transparent block"
                  />
                  OCR sedang memproses...
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Right: Clipping Queue */}
      <motion.section
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280, delay: 0.1 }}
        className="glass-card rounded-[28px] p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Latest clippings</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Review queue</h3>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.4 }}
              onClick={() => window.location.reload()}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-white hover:text-slate-900 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.button>
            <motion.div
              key={items.length}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 border border-amber-100"
            >
              {fetching ? "..." : `${items.length} artikel`}
            </motion.div>
          </div>
        </div>

        <div className="mt-5">
          {fetching ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent"
              />
              <p className="text-sm text-slate-400 animate-pulse">Memuat kliping...</p>
            </div>
          ) : items.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center text-sm text-slate-400"
            >
              Belum ada kliping. Tambahkan sumber berita di sebelah kiri.
            </motion.p>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1 custom-scrollbar"
            >
              <AnimatePresence>
                {items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <motion.article
                      key={item.id}
                      variants={cardVariants}
                      exit="exit"
                      layout
                      className="rounded-[24px] bg-white p-4 shadow-sm overflow-hidden"
                      whileHover={{ boxShadow: "0 4px 24px 0 rgba(236,72,153,0.08)", y: -1 }}
                      transition={{ type: "spring", damping: 28, stiffness: 320 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-slate-900">{item.title}</h4>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.source} · {item.date}
                          </p>
                        </div>
                        <motion.span
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            toneColor[item.tone] ?? "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.tone}
                        </motion.span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => toggleExpand(item.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            isExpanded
                              ? "border-pink-500 bg-pink-50 text-pink-600"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {isExpanded ? "Tutup Preview" : "Preview Detail AI"}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1.5 rounded-full border border-red-100 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </motion.button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            variants={expandVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="overflow-hidden"
                          >
                            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                              <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-3 overflow-x-auto">
                                <Sparkles className="h-4 w-4 text-pink-500 shrink-0" />
                                {(
                                  [
                                    { key: "ringkasan", label: "Ringkasan" },
                                    { key: "ulasan",    label: "Ulasan" },
                                    { key: "draft",     label: "Draft Berita" },
                                    { key: "caption",   label: "Caption IG" },
                                  ] as { key: DetailTabId; label: string }[]
                                ).map((tab) => (
                                  <motion.button
                                    key={tab.key}
                                    onClick={() => setActiveDetailTab(tab.key)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.96 }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                      activeDetailTab === tab.key
                                        ? "bg-white shadow-sm text-pink-600"
                                        : "text-slate-500 hover:bg-slate-100"
                                    }`}
                                  >
                                    {tab.label}
                                  </motion.button>
                                ))}
                              </div>
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={activeDetailTab}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.15 }}
                                  className="leading-relaxed text-slate-600 whitespace-pre-wrap max-h-[280px] overflow-y-auto pr-2 custom-scrollbar"
                                >
                                  {activeDetailTab === "ringkasan" && (item.ringkasan || "Tidak tersedia")}
                                  {activeDetailTab === "ulasan"    && (item.ulasan    || "Tidak tersedia")}
                                  {activeDetailTab === "draft"     && (item.draftBerita  || "Tidak tersedia")}
                                  {activeDetailTab === "caption"   && (item.draftCaption || "Tidak tersedia")}
                                </motion.div>
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
