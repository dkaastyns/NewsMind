"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, Bot, User, Loader2 } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
};

const initialMessages: Message[] = [
  {
    id: "1",
    role: "ai",
    content: "Halo! Saya AI Assistant NewsMind. Ada yang bisa saya bantu hari ini terkait ringkasan berita, drafting konten, atau pencarian arsip?",
  },
];

export function ChatWidget({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const currentInput = input.trim();
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Build Gemini-compatible history (exclude system greeting)
    const history = messages
      .filter((m) => m.id !== "1") // skip initial greeting
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        content: m.content,
      }));

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ message: currentInput, history }),
      });

      if (!res.ok) throw new Error("Chat API error");
      const data = await res.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.reply || "Tidak ada respons dari AI.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: "Maaf, tidak bisa terhubung ke AI Service saat ini. Pastikan AI Service sudah berjalan di localhost:8000.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/80 shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-white/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full accent-gradient text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
            <p className="text-xs text-slate-500">NewsMind Copilot</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
                msg.role === "user" ? "bg-slate-900 text-white" : "bg-white text-pink-500"
              }`}
            >
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-slate-900 text-white rounded-tr-none"
                  : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-pink-500 shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="max-w-[75%] rounded-2xl rounded-tl-none border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-slate-100 bg-white p-4">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-4 pr-1.5 py-1.5 focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-100"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan sesuatu..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
