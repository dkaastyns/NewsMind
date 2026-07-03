'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Login failed');
      }

      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      router.push('/dashboard');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message ?? 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#F8FAFC]">
      {/* Animated abstract background elements */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#EECDA3]/30 blur-3xl"
      />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#EF629F]/20 blur-3xl"
      />

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 w-full max-w-md px-4"
      >
        <Card className="w-full glass-card border-white/40 p-2">
          <CardHeader className="pb-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <CardTitle className="text-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                NewsMind
              </CardTitle>
              <p className="text-center text-sm text-muted-foreground mt-2 font-medium">
                Sistem cerdas AI untuk kliping & konten
              </p>
            </motion.div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 p-3 rounded-xl text-sm text-center font-medium"
                >
                  {error}
                </motion.div>
              )}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Input
                    type="email"
                    placeholder="Alamat Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 bg-white/60 focus:bg-white/90 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 bg-white/60 focus:bg-white/90 transition-colors"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full h-12 text-base font-semibold mt-2"
                variant="accent-gradient"
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Masuk Dashboard'}
              </Button>

              <div className="text-center text-sm mt-4 text-slate-500 font-medium">
                Belum punya akun?{' '}
                <Link href="/register" className="text-slate-900 hover:underline font-semibold">
                  Buat akun baru
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
