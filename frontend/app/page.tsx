import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, LayoutDashboard, Newspaper } from "lucide-react";

const highlights = [
  {
    title: "Kliping berita digital",
    description: "Input dari link atau upload PDF, lalu diproses menjadi insight yang siap dipakai.",
  },
  {
    title: "AI insight lengkap",
    description: "Summary, ulasan, sentiment analysis, klasifikasi topik, caption, dan draft berita website.",
  },
  {
    title: "Approval workflow",
    description: "Draft konten tetap aman sampai lolos review Humas sebelum dipublikasikan.",
  },
];

const metrics = [
  { label: "Artikel dipantau", value: "1.2k+" },
  { label: "Topik terklasifikasi", value: "48" },
  { label: "Draft AI siap review", value: "132" },
  { label: "Waktu hemat", value: "63%" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 soft-grid opacity-50" />
      <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-[#EECDA3]/30 blur-3xl" />
      <div className="absolute right-[-5rem] top-8 h-72 w-72 rounded-full bg-[#EF629F]/15 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 lg:px-8">
        <header className="glass-card flex items-center justify-between rounded-[28px] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">NewsMind</p>
            <p className="mt-1 text-sm text-slate-500">Sistem Cerdas Humas DPRD Berbasis AI</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
            >
              Login
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200/50 transition hover:-translate-y-0.5 accent-gradient"
            >
              Buka Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-pink-500 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Premium AI newsroom for DPRD
            </div>

            <div className="max-w-3xl space-y-6">
              <h1 className="text-5xl font-semibold tracking-tight text-slate-900 lg:text-7xl">
                Kliping berita lebih cepat, insight AI lebih rapi, approval tetap aman.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                NewsMind membantu tim Humas DPRD mengelola berita dari link atau PDF,
                lalu menghasilkan ringkasan, ulasan, analisis sentimen, topik, caption media sosial,
                dan draft berita website dalam satu alur kerja yang elegan.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-200/60 transition hover:-translate-y-0.5 accent-gradient"
              >
                Mulai dari Dashboard <LayoutDashboard className="h-4 w-4" />
              </Link>
              <Link
                href="/kliping"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:shadow-sm"
              >
                Lihat Kliping <Newspaper className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="glass-card rounded-[24px] p-5">
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="glass-card relative overflow-hidden rounded-[32px] p-6">
              <div className="absolute inset-x-0 top-0 h-1 accent-gradient" />
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">AI Preview</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">NewsMind Insight Board</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                    Ready for review
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[24px] bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Sentiment</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">68%</p>
                    <p className="mt-2 text-sm text-emerald-600">Positive coverage trend</p>
                  </div>
                  <div className="rounded-[24px] bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Top Topic</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-900">Pembangunan</p>
                    <p className="mt-2 text-sm text-slate-500">Most mentioned in this cycle</p>
                  </div>
                </div>

                <div className="rounded-[24px] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">AI Summary</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Beberapa media menyoroti agenda pembangunan dan pelayanan publik DPRD.
                    NewsMind merangkum isi berita, mengklasifikasikan topik, dan menyiapkan draft konten
                    untuk review staf Humas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-5 pb-12 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <article key={item.title} className="glass-card rounded-[28px] p-6">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient text-white shadow-lg shadow-pink-100/60">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-lg font-semibold text-slate-900">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                0{index + 1}
              </p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
