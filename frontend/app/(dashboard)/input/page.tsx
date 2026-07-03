'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export default function InputPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // URL tab state
  const [urlTitle, setUrlTitle] = useState('');
  const [url, setUrl] = useState('');

  // Text tab state
  const [textTitle, setTextTitle] = useState('');
  const [text, setText] = useState('');

  async function handleSubmit(payload: object) {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Gagal memproses');
      }
      const data = await res.json();
      router.push(`/arsip?highlight=${data.id}`);
    } catch (e: unknown) {
      const error = e as Error;
      setError(error.message ?? 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Input Kliping Berita</h1>
        <p className="text-slate-500 mt-1">Tambahkan berita baru untuk dianalisis oleh AI.</p>
      </header>

      <Tabs defaultValue="url" className="w-full">
        <TabsList className="mb-6 p-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
          <TabsTrigger value="url" className="rounded-xl data-[state=active]:shadow-sm data-[state=active]:bg-white">Link Berita</TabsTrigger>
          <TabsTrigger value="text" className="rounded-xl data-[state=active]:shadow-sm data-[state=active]:bg-white">Paste Teks</TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <Card className="glass-card bg-white/40 border-white/60 shadow-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-slate-700">Input via URL</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Judul Berita (opsional)</label>
                <Input placeholder="Ketik judul berita..."
                       className="h-12 bg-white/60"
                       value={urlTitle} onChange={e => setUrlTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Tautan Berita URL</label>
                <Input placeholder="https://example.com/berita/..."
                       className="h-12 bg-white/60"
                       value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <Button
                onClick={() => handleSubmit({
                  title: urlTitle || url,
                  source_type: 'url',
                  source_url: url,
                })}
                disabled={loading || !url}
                className="w-full h-12 text-base font-semibold"
                variant="accent-gradient"
              >
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Memproses AI... (5-15 detik)</> : 'Proses dengan AI'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text">
          <Card className="glass-card bg-white/40 border-white/60 shadow-sm">
            <CardHeader className="pb-4"><CardTitle className="text-lg text-slate-700">Input Teks / PDF</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Judul Berita</label>
                <Input placeholder="Ketik judul berita..."
                       className="h-12 bg-white/60"
                       value={textTitle} onChange={e => setTextTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">Isi Berita</label>
                <Textarea placeholder="Paste teks berita di sini (hasil copy dari PDF/koran)..."
                          className="bg-white/60"
                          rows={12} value={text} onChange={e => setText(e.target.value)} />
              </div>
              <Button
                onClick={() => handleSubmit({
                  title: textTitle || 'Kliping tanpa judul',
                  source_type: 'text',
                  extracted_text: text,
                })}
                disabled={loading || !text}
                className="w-full h-12 text-base font-semibold"
                variant="accent-gradient"
              >
                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Memproses AI... (5-15 detik)</> : 'Proses dengan AI'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="mt-6 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
