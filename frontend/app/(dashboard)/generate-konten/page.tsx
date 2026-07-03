"use client";

import {
  Sparkles, ClipboardCopy, Save, Newspaper,
  CheckCircle2, Share2, AlignLeft, Wand2,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

const actions = [
  { key: "article", label: "Generate artikel website",     icon: Newspaper, desc: "Draft berita formal siap terbit" },
  { key: "caption", label: "Generate caption media sosial", icon: Share2,    desc: "Caption Instagram yang engaging" },
  { key: "refine",  label: "Refine editorial tone",         icon: AlignLeft, desc: "Sempurnakan gaya bahasa redaksional" },
];

const containerVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0,  transition: { type: 'spring' as const, damping: 24, stiffness: 320 } },
};

export default function GenerateKontenPage() {
  const [selectedAction, setSelectedAction] = useState<string>("article");
  const [inputText, setInputText] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setGenerated(null);
    setCopied(false);
    setSaved(false);

    const promptMap: Record<string, string> = {
      article:
        `Buatkan kerangka atau draft berita website resmi (formal, informatif) terkait kegiatan terbaru DPRD berdasarkan tren atau best practice kehumasan. Pastikan mencakup lead yang kuat dan penutup yang berkesan.${inputText ? `\n\nBahan berita yang disediakan:\n${inputText}` : ""}`,
      caption:
        `Buatkan draft caption Instagram yang sangat engaging, informatif, dan natural untuk akun resmi Humas DPRD, lengkap dengan 5-7 hashtag yang relevan dan trending.${inputText ? `\n\nBahan berita yang disediakan:\n${inputText}` : ""}`,
      refine:
        `Sempurnakan gaya bahasa redaksional (refine editorial tone) agar lebih netral, formal, dan sesuai standar komunikasi publik lembaga legislatif.${inputText ? `\n\nTeks yang ingin disempurnakan:\n${inputText}` : ""}`,
    };

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: promptMap[selectedAction], history: [] }),
      });

      if (!res.ok) throw new Error("Gagal generate konten");
      const data = await res.json();
      setGenerated(data.reply);
    } catch (err) {
      console.error(err);
      setGenerated("Maaf, terjadi kesalahan saat menghubungi AI. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const selectedMeta = actions.find((a) => a.key === selectedAction);

  return (
    <div className="grid h-[calc(100vh-8rem)] min-h-[600px] gap-5 lg:grid-cols-[1fr_1.1fr]">
      {/* Left: Actions */}
      <motion.section
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        className="glass-card rounded-[28px] p-6 flex flex-col"
      >
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="h-4 w-4 text-pink-500" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">AI Actions</p>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-5">Pilih jenis output</h3>

        <motion.div
          className="space-y-3 flex-1"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {actions.map((item) => {
            const Icon = item.icon;
            const isActive = selectedAction === item.key;
            return (
              <motion.button
                key={item.key}
                variants={itemVariants}
                whileHover={{ scale: 1.02, x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSelectedAction(item.key); setGenerated(null); }}
                className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left text-sm font-medium transition-all ${
                  isActive
                    ? "accent-gradient text-white shadow-lg shadow-pink-100/60"
                    : "bg-white text-slate-700 shadow-sm hover:shadow-md"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  isActive ? "bg-white/20" : "bg-slate-50"
                }`}>
                  <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                </div>
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className={`text-xs mt-0.5 ${isActive ? "text-white/70" : "text-slate-400"}`}>{item.desc}</p>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto h-2 w-2 rounded-full bg-white/80"
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        <div className="mt-5 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Bahan Berita / Teks Input (Opsional)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tuliskan poin penting, draft kasar, atau teks berita di sini agar AI dapat memprosesnya secara spesifik..."
            className="w-full h-32 rounded-2xl border border-slate-200 p-4 text-sm bg-white/50 focus:bg-white focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none resize-none transition-all custom-scrollbar"
          />
        </div>

        <motion.button
          onClick={handleGenerate}
          disabled={loading}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white accent-gradient disabled:opacity-60 shadow-lg shadow-pink-200/50"
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
          {loading ? "AI sedang menulis..." : "Generate dengan AI"}
        </motion.button>
      </motion.section>

      {/* Right: Preview */}
      <motion.section
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280, delay: 0.1 }}
        className="glass-card rounded-[28px] p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Preview</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Draft content</h3>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={generated ? "ready" : "pending"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                generated
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}
            >
              {generated ? "✓ Siap direview" : "Menunggu generate"}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex-1 min-h-[200px] rounded-[24px] bg-white p-5 shadow-sm overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 h-full min-h-[160px]"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent"
                />
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-sm text-slate-400"
                >
                  AI sedang menyusun konten terbaik...
                </motion.p>
              </motion.div>
            ) : generated ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", damping: 24, stiffness: 300 }}
              >
                <p className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-3">
                  {selectedMeta?.label}
                </p>
                <p className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{generated}</p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 h-full min-h-[160px] text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                >
                  <Sparkles className="h-10 w-10 text-slate-200" />
                </motion.div>
                <p className="text-sm text-slate-400">
                  Pilih jenis output di kiri lalu klik <strong>Generate</strong>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div
          className="mt-4 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {[
            { label: "Copy", activeLabel: "Copied!", icon: ClipboardCopy, activeIcon: CheckCircle2, handler: handleCopy, active: copied, color: "text-emerald-500" },
            { label: "Save Draft", activeLabel: "Saved!", icon: Save, activeIcon: CheckCircle2, handler: handleSave, active: saved, color: "text-emerald-500" },
          ].map((btn) => {
            const Icon = btn.active ? btn.activeIcon : btn.icon;
            return (
              <motion.button
                key={btn.label}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={btn.handler}
                disabled={!generated}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <Icon className={`h-4 w-4 ${btn.active ? btn.color : ""}`} />
                {btn.active ? btn.activeLabel : btn.label}
              </motion.button>
            );
          })}
        </motion.div>
      </motion.section>
    </div>
  );
}
