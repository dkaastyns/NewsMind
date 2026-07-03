"use client";

import {
  UserCircle2,
  Mail,
  Phone,
  Settings2,
  Lock,
  Palette,
  CheckCircle2,
  Pencil,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function ProfilPage() {
  const [editField, setEditField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    name: "Memuat...",
    role: "User",
    email: "memuat...",
    phone: "-",
    department: "-",
  });
  const [draft, setDraft] = useState({ ...profile });
  const [saved, setSaved] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (mounted && data && data.full_name) {
            const p = {
              name: data.full_name,
              role: data.role || "User",
              email: data.email || "-",
              phone: "-",
              department: data.department_name || "-",
            };
            setProfile(p);
            setDraft(p);
          }
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setTimeout(() => {
        if (mounted) setLoading(false);
      }, 0);
    }
    return () => { mounted = false; };
  }, []);

  function startEdit(field: string) {
    setDraft({ ...profile });
    setEditField(field);
  }

  function saveEdit() {
    setProfile({ ...draft });
    setSaved(editField);
    setEditField(null);
    setTimeout(() => setSaved(null), 2000);
  }

  function cancelEdit() {
    setDraft({ ...profile });
    setEditField(null);
  }

  const menuItems = [
    { key: "password", label: "Change password", icon: Lock, desc: "Ubah password akun Anda" },
    { key: "ui", label: "UI preferences", icon: Palette, desc: "Tema, bahasa, dan tampilan" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="glass-card rounded-[28px] p-5 h-fit sticky top-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] accent-gradient text-xl font-bold text-white shadow-lg shadow-pink-200/60 uppercase">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-white/50" /> : profile.name.slice(0, 2)}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{profile.name}</h3>
              <p className="text-sm text-slate-500">{profile.role}</p>
              <p className="text-xs text-slate-400">{profile.department}</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePanel === item.key;
              return (
                <div key={item.key}>
                  <button
                    onClick={() => setActivePanel(isActive ? null : item.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left transition ${
                      isActive ? "accent-gradient text-white" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.label}</p>
                      {!isActive && <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>}
                    </div>
                    <Settings2 className={`h-4 w-4 shrink-0 transition ${isActive ? "rotate-45 text-white/70" : "text-slate-300"}`} />
                  </button>
                  {isActive && (
                    <div className="mt-2 rounded-2xl bg-white p-4 shadow-sm">
                      {item.key === "password" && (
                        <div className="space-y-2">
                          <input type="password" placeholder="Password lama" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-pink-300" />
                          <input type="password" placeholder="Password baru" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-pink-300" />
                          <input type="password" placeholder="Konfirmasi password baru" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-pink-300" />
                          <button className="mt-1 w-full rounded-full bg-slate-900 py-2 text-sm font-semibold text-white">Simpan Password</button>
                        </div>
                      )}
                      {item.key === "ui" && (
                        <div className="space-y-3">
                          <label className="block text-sm text-slate-600">
                            Bahasa
                            <select className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
                              <option>Bahasa Indonesia</option>
                              <option>English</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-card rounded-[28px] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Account details</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Profile settings</h3>
            </div>
            <Settings2 className="h-4 w-4 text-pink-500" />
          </div>

          <div className="mt-5 space-y-3">
            {[
              { key: "name", label: "Nama lengkap", icon: UserCircle2, value: profile.name },
              { key: "email", label: "Email", icon: Mail, value: profile.email },
              { key: "phone", label: "Phone", icon: Phone, value: profile.phone },
              { key: "department", label: "Departemen", icon: Settings2, value: profile.department },
            ].map((field) => {
              const Icon = field.icon;
              const isEditing = editField === field.key;
              return (
                <div key={field.key} className="rounded-[24px] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-pink-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-400">{field.label}</p>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={draft[field.key as keyof typeof draft]}
                            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                            className="mt-1 w-full rounded-xl border border-pink-300 px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none ring-2 ring-pink-100"
                          />
                        ) : (
                          <p className="truncate font-semibold text-slate-900">{field.value}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {saved === field.key && !isEditing && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="rounded-full bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(field.key)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[24px] bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Settings2 className="h-4 w-4" />
                <p className="text-sm font-semibold">Role saat ini</p>
              </div>
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
                {profile.role}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Perubahan role hanya dapat dilakukan oleh Admin. Hubungi tim IT untuk mengubah hak akses.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
