"use client";

import { Users2, BadgeCheck, KeyRound, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type Role = "admin" | "humas";

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department_name: string | null;
  created_at: string;
  status?: "Active" | "Inactive"; // Frontend mock status for UI purposes if needed
}

const roleLabel: Record<string, string> = {
  admin: "Admin",
  humas: "Staf Humas",
};

const roleColor: Record<string, string> = {
  admin: "bg-purple-50 text-purple-600",
  humas: "bg-blue-50 text-blue-600",
};

export default function PenggunaPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRole, setActiveRole] = useState<Role | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('access_token');
    fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat daftar pengguna');
        return res.json();
      })
      .then((data: UserItem[]) => {
        if (mounted) {
          const mapped = data.map((u) => ({ ...u, status: u.status || "Active" }));
          setUsers(mapped);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          const error = err as Error;
          setError(error.message);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingId(userId);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Gagal mengubah peran');
      
      setUsers((prev) => prev.map(u => u.id === userId ? { ...u, role: newRole as Role } : u));
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleStatus(id: string) {
    // Local mock for toggling status since backend doesn't have an active/inactive endpoint yet
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" }
          : u
      )
    );
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent"
          />
          <p className="text-sm text-slate-400 animate-pulse">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-10 font-medium text-red-500">{error}</div>;
  }

  const filtered = activeRole === "all" ? users : users.filter((u) => u.role === activeRole);

  const roleCounts = (["admin", "humas"] as Role[]).map((r) => ({
    role: r,
    count: users.filter((u) => u.role === r).length,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        {/* Left: Roles */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="glass-card h-fit sticky top-6 rounded-[28px] p-5"
        >
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 8, scale: 1.08 }} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Users2 className="h-5 w-5 text-slate-500" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Roles overview</h3>
              <p className="text-sm text-slate-500">Manage admins and staff members.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {([{ role: "all" as const, label: "Semua pengguna", count: users.length }, ...roleCounts.map(r => ({ role: r.role, label: roleLabel[r.role], count: r.count }))]).map((item, i) => (
              <motion.button
                key={item.role}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, type: "spring", damping: 24, stiffness: 320 }}
                whileHover={{ scale: 1.02, x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveRole(item.role)}
                className={`flex w-full items-center justify-between rounded-2xl p-4 text-sm font-semibold transition ${
                  activeRole === item.role ? "accent-gradient text-white shadow-md shadow-pink-100/60" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                }`}
              >
                <span>{item.label}</span>
                <motion.span
                  key={item.count}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className={`rounded-full px-2 py-0.5 text-xs ${activeRole === item.role ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}
                >
                  {item.count}
                </motion.span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* Right: User List */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280, delay: 0.1 }}
          className="glass-card rounded-[28px] p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">User list</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Access control</h3>
            </div>
            <BadgeCheck className="h-4 w-4 text-pink-500" />
          </div>

          <div className="mt-5 space-y-3">
            <AnimatePresence>
              {filtered.length === 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-8 text-center text-sm text-slate-400">
                  Tidak ada pengguna di role ini.
                </motion.p>
              )}
              {filtered.map((user, i) => (
                <motion.article
                  key={user.id}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ type: "spring", damping: 24, stiffness: 300, delay: i * 0.05 }}
                  whileHover={{ y: -2, boxShadow: "0 4px 24px 0 rgba(236,72,153,0.08)" }}
                  className="rounded-[24px] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 4 }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl accent-gradient text-sm font-bold text-white uppercase"
                      >
                        {user.full_name.slice(0, 1)}
                      </motion.div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{user.full_name}</p>
                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor[user.role] || 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel[user.role] || user.role}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {user.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 items-center flex-wrap">
                    <Select
                      disabled={updatingId === user.id}
                      value={user.role}
                      onValueChange={(val) => handleRoleChange(String(user.id), val || '')}
                    >
                      <SelectTrigger className="w-[140px] bg-slate-50 h-8 border-none rounded-full text-xs font-semibold">
                        <SelectValue placeholder="Ubah Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="humas">Staf Humas</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    {updatingId === user.id && <Loader2 className="animate-spin h-3.5 w-3.5 text-slate-400 shrink-0" />}

                    <div className="flex-1" />

                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                      onClick={() => toggleStatus(user.id)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {user.status === "Active" ? "Nonaktifkan" : "Aktifkan"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-1.5 rounded-full border border-red-100 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </motion.button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 rounded-[24px] bg-slate-50 p-4"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <KeyRound className="h-4 w-4" />
              <p className="text-sm font-semibold">Permission groups</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Pengaturan role saat ini terbagi menjadi <strong>Admin</strong> (akses penuh) dan <strong>Staf Humas</strong> (akses ulasan konten).
            </p>
          </motion.div>
        </motion.section>
    </div>
  );
}
