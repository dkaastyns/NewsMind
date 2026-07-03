'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface DraftBerita {
  judul: string;
  paragraf: string[];
}

interface ArticleDetail {
  id: string;
  title: string;
  ai_summary: string;      // JSON string: ["poin1","poin2","poin3"]
  ai_review: string;
  ai_sentiment: 'Positif' | 'Netral' | 'Negatif';
  ai_topic: string;        // "Legislasi & Perda, Infrastruktur"
  ai_caption_social: string;
  ai_caption_web: string;  // JSON string: {judul, paragraf[]}
}

const SENTIMENT_COLOR: Record<string, string> = {
  Positif: 'bg-green-100 text-green-800',
  Netral:  'bg-gray-100 text-gray-800',
  Negatif: 'bg-red-100 text-red-800',
};

export function ArticleDetailTabs({ article }: { article: ArticleDetail }) {
  const ringkasan: string[] = (() => {
    try { return JSON.parse(article.ai_summary); } catch { return [article.ai_summary]; }
  })();

  const draftBerita: DraftBerita = (() => {
    try { return JSON.parse(article.ai_caption_web); }
    catch { return { judul: '', paragraf: [article.ai_caption_web] }; }
  })();

  const topik = article.ai_topic?.split(', ').filter(Boolean) ?? [];

  return (
    <Tabs defaultValue="ringkasan" className="w-full">
      <TabsList className="flex w-full flex-wrap gap-1.5 h-auto p-1.5 bg-white/40 border border-white/60 shadow-sm rounded-xl mb-6">
        <TabsTrigger 
          value="ringkasan" 
          className="flex-1 min-w-[100px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2"
        >
          Ringkasan
        </TabsTrigger>
        <TabsTrigger 
          value="ulasan"
          className="flex-1 min-w-[100px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2"
        >
          Ulasan
        </TabsTrigger>
        <TabsTrigger 
          value="caption"
          className="flex-1 min-w-[100px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2"
        >
          IG Caption
        </TabsTrigger>
        <TabsTrigger 
          value="draft"
          className="flex-1 min-w-[100px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2"
        >
          Draft Berita
        </TabsTrigger>
      </TabsList>

      <div className="bg-white/70 border border-white/60 shadow-sm rounded-2xl p-6">
        {/* Tab 1: Ringkasan 5W+1H */}
        <TabsContent value="ringkasan" className="mt-0 outline-none">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-blue-400 block" />
            Ringkasan 5W+1H
          </h3>
          <ol className="list-decimal list-inside space-y-3">
            {ringkasan.map((poin, i) => (
              <li key={i} className="text-sm leading-relaxed text-slate-700 font-medium pl-1">{poin}</li>
            ))}
          </ol>
        </TabsContent>

        {/* Tab 2: Ulasan & Sentimen */}
        <TabsContent value="ulasan" className="mt-0 outline-none">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-3">
            <span className="w-1.5 h-6 rounded-full bg-purple-400 block" />
            Ulasan Dampak Citra
            <Badge className={`ml-2 px-3 py-1 font-semibold ${SENTIMENT_COLOR[article.ai_sentiment] ?? ''}`}>
              {article.ai_sentiment}
            </Badge>
          </h3>
          <div className="space-y-6">
            <p className="text-sm leading-relaxed text-slate-700 font-medium bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              {article.ai_review}
            </p>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Topik Terkait</p>
              <div className="flex flex-wrap gap-2">
                {topik.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs px-3 py-1 bg-white shadow-sm border-slate-200 text-slate-600">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Caption Instagram */}
        <TabsContent value="caption" className="mt-0 outline-none">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-pink-400 block" />
            Caption Instagram
          </h3>
          <div className="relative group">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-slate-700
                            bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
              {article.ai_caption_social}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(article.ai_caption_social)}
              className="absolute top-3 right-3 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-medium shadow-md hover:bg-slate-800"
            >
              Salin Teks
            </button>
          </div>
        </TabsContent>

        {/* Tab 4: Draft Berita Website */}
        <TabsContent value="draft" className="mt-0 outline-none">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 rounded-full bg-emerald-400 block" />
            Draft Berita Website
          </h3>
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-5">
            <h4 className="font-bold text-slate-900 text-xl leading-snug border-b border-slate-100 pb-4">
              {draftBerita.judul}
            </h4>
            <div className="space-y-4">
              {draftBerita.paragraf.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-700 font-medium text-justify">{p}</p>
              ))}
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}
