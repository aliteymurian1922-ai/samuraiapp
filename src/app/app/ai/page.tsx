"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SamuraiMark } from "@/components/brand/logo";
import { Sparkles, Send, Plus, Loader2, Check, X, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionProposal } from "@/ai/types";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; proposal?: ActionProposal };
type Conversation = { id: string; title: string | null; updatedAt: string };

const SUGGESTIONS = [
  "این هفته تیم چه وضعیتی دارد؟",
  "کدام پروژه‌ها عقب هستند؟",
  "چه کارهایی باید امروز انجام بدهم؟",
  "گزارش مدیریتی این هفته را بساز.",
];

export default function SamuraiAiPage() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localIdPrefix = useId();
  const messageSequence = useRef(0);

  const { data: conversations } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => api.get<{ conversations: Conversation[] }>("/api/ai/conversations"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadConversation(id: string) {
    setConversationId(id);
    const res = await api.get<{ messages: { id: string; role: string; content: string; toolCalls: ActionProposal[] }[] }>(`/api/ai/conversations/${id}`);
    setMessages(
      res.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.toolCalls?.[0] ? "" : m.content,
          proposal: m.toolCalls?.[0] as ActionProposal | undefined,
        })),
    );
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    setNotConfigured(false);
    const sequence = ++messageSequence.current;
    const userMsg: ChatMessage = { id: `${localIdPrefix}-${sequence}-u`, role: "user", content };
    const assistantMsg: ChatMessage = { id: `${localIdPrefix}-${sequence}-a`, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: content }),
      });

      if (!res.body) throw new Error("no-body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "conversation") {
            setConversationId(event.conversationId);
          } else if (event.type === "text-delta") {
            setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + event.delta } : m)));
          } else if (event.type === "proposal") {
            setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, proposal: event.proposal } : m)));
          } else if (event.type === "error") {
            setNotConfigured(true);
            setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: event.message } : m)));
          }
        }
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: "ارتباط با Samurai AI برقرار نشد." } : m)));
    } finally {
      setStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    }
  }

  async function confirmProposal(msgId: string, proposal: ActionProposal) {
    try {
      await api.post("/api/ai/actions/execute", { type: proposal.type, payload: proposal.payload });
      toast.success("عملیات با موفقیت انجام شد.");
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, proposal: undefined, content: `✅ انجام شد: ${proposal.summary}` } : m)));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch {
      toast.error("اجرای عملیات ناموفق بود.");
    }
  }

  function cancelProposal(msgId: string) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, proposal: undefined, content: "عملیات لغو شد." } : m)));
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6.5rem)] max-w-6xl gap-4 sm:h-[calc(100vh-7rem)]">
      <aside className="hidden w-60 shrink-0 flex-col gap-2 lg:flex">
        <Button variant="secondary" className="justify-start" onClick={newConversation}><Plus className="size-4" /> گفتگوی جدید</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {(conversations?.conversations ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={cn("flex w-full items-center gap-2 truncate rounded-xl px-3 py-2.5 text-right text-[13px]", conversationId === c.id ? "bg-(--color-primary-soft) text-(--color-primary)" : "text-(--color-muted) hover:bg-slate-100")}
            >
              <MessagesSquare className="size-3.5 shrink-0" />
              <span className="truncate">{c.title || "گفتگوی جدید"}</span>
            </button>
          ))}
        </div>
      </aside>

      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-(--color-border) px-4 py-3">
          <SamuraiMark size={26} />
          <div>
            <p className="text-sm font-bold">سامورایی AI</p>
            <p className="text-[11px] text-(--color-muted)">دستیار هوشمند مدیریت پروژه و تیم</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-(--color-primary-soft) text-(--color-primary)"><Sparkles className="size-7" /></div>
              <p className="max-w-xs text-sm text-(--color-muted)">از سامورایی AI درباره وضعیت پروژه‌ها، وظایف و تیم خود سؤال بپرسید.</p>
              <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-(--color-border) bg-white px-3 py-2.5 text-right text-xs text-(--color-text) hover:bg-slate-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-7 whitespace-pre-wrap", m.role === "user" ? "mr-auto bg-(--color-primary) text-white" : "bg-slate-100 text-(--color-text)")}>
                {m.content || (streaming && m.role === "assistant" ? <Loader2 className="size-4 animate-spin" /> : "")}
                {m.proposal && (
                  <div className="mt-3 rounded-xl border border-(--color-border) bg-white p-3 text-(--color-text)">
                    <p className="text-xs font-semibold">پیش‌نمایش عملیات</p>
                    <p className="mt-1 text-[13px]">{m.proposal.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => confirmProposal(m.id, m.proposal!)}><Check className="size-3.5" /> تأیید</Button>
                      <Button size="sm" variant="secondary" onClick={() => cancelProposal(m.id)}><X className="size-3.5" /> لغو</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {notConfigured && (
          <div className="mx-4 mb-2 rounded-xl bg-(--color-warning-soft) px-3 py-2 text-xs text-(--color-warning)">
            برای فعال‌سازی کامل Samurai AI، متغیر OPENAI_API_KEY را در محیط سرور تنظیم کنید.
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-(--color-border) p-3">
          <Input
            placeholder="سؤال خود را بپرسید..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={streaming}
          />
          <Button size="icon" onClick={() => send()} loading={streaming} aria-label="ارسال">
            <Send className="size-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
