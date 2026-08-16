import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { LANGS, speechCodeFor } from "@/lib/langs";
import { getRecognition, speak, stopSpeaking } from "@/lib/speech";
import { Send, Plus, Mic, Volume2, VolumeX, RefreshCcw, Copy, Trash2, Loader2, MicOff } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const recRef = useRef(null);

  const loadChats = async () => {
    const { data } = await api.get("/chats");
    setChats(data);
    if (!activeId && data.length) setActiveId(data[0].chat_id);
    if (!data.length) setActiveId(null);
  };
  const loadMessages = async (id) => {
    if (!id) { setMessages([]); return; }
    const { data } = await api.get(`/chats/${id}/messages`);
    setMessages(data);
  };
  useEffect(() => { loadChats(); }, []);
  useEffect(() => { loadMessages(activeId); }, [activeId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [messages, sending]);

  const newChat = async () => {
    const { data } = await api.post("/chats", { title: "New Chat" });
    setChats((c) => [data, ...c]);
    setActiveId(data.chat_id);
    setMessages([]);
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    let cid = activeId;
    if (!cid) {
      const { data } = await api.post("/chats", { title: "New Chat" });
      setChats((c) => [data, ...c]);
      cid = data.chat_id;
      setActiveId(cid);
    }
    const text = input.trim();
    setInput("");
    setMessages((m) => [...m, { message_id: "tmp", role: "user", content: text }]);
    setSending(true);
    try {
      const { data } = await api.post(`/chats/${cid}/messages`, { content: text, language });
      setMessages((m) => [...m.filter((x) => x.message_id !== "tmp"), data.user_message, data.assistant_message]);
      if (voiceOn) speak(data.assistant_message.content, speechCodeFor(language === "auto" ? "en" : language));
      loadChats();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send");
      setMessages((m) => m.filter((x) => x.message_id !== "tmp"));
    } finally {
      setSending(false);
    }
  };

  const regenerate = async () => {
    if (!activeId || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chats/${activeId}/regenerate`);
      const trimmed = messages[messages.length - 1]?.role === "assistant" ? messages.slice(0, -1) : messages;
      setMessages([...trimmed, data]);
      if (voiceOn) speak(data.content, speechCodeFor(language === "auto" ? "en" : language));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSending(false);
    }
  };

  const deleteChat = async (id) => {
    await api.delete(`/chats/${id}`);
    if (activeId === id) setActiveId(null);
    loadChats();
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) { toast.error("Voice input not supported in this browser"); return; }
    rec.lang = speechCodeFor(language === "auto" ? "en" : language);
    rec.interimResults = true;
    rec.continuous = false;
    let final = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      setInput((final || text).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const copyMsg = (t) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-gold">Chat</div>
            <h1 className="font-heading text-2xl font-medium">Conversation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="chat-language-select" className="w-[180px] border-white/10 bg-black/50 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              data-testid="voice-toggle"
              onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(!voiceOn); }}
              variant="outline"
              className="border-white/10 bg-black/40 text-white hover:bg-white/10"
            >
              {voiceOn ? <><Volume2 className="h-4 w-4"/> Voice ON</> : <><VolumeX className="h-4 w-4"/> Voice OFF</>}
            </Button>
            <Button data-testid="new-chat-button" onClick={newChat} className="btn-gold gold-glow">
              <Plus className="h-4 w-4"/> New chat
            </Button>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr]">
        {/* Chat list */}
        <aside className="hidden overflow-y-auto scrollbar-thin border-r border-white/10 bg-black/30 p-3 lg:block" data-testid="chat-list">
          {chats.length === 0 && <div className="p-4 text-sm text-white/50">No chats yet. Start one below.</div>}
          {chats.map((c) => (
            <div
              key={c.chat_id}
              onClick={() => setActiveId(c.chat_id)}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${activeId === c.chat_id ? "bg-gold/10 text-gold" : "text-white/70 hover:bg-white/[0.04]"}`}
              data-testid={`chat-item-${c.chat_id}`}
            >
              <span className="truncate flex-1">{c.title || "New Chat"}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(c.chat_id); }} className="opacity-0 group-hover:opacity-100" data-testid={`delete-chat-${c.chat_id}`}>
                <Trash2 className="h-3.5 w-3.5 text-white/50 hover:text-red-400"/>
              </button>
            </div>
          ))}
        </aside>

        {/* Messages */}
        <div className="flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 md:px-10">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.length === 0 && !sending && (
                <div className="animate-fade-up rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
                  <div className="text-xs uppercase tracking-[0.28em] text-gold">Ready</div>
                  <h2 className="mt-2 font-heading text-3xl font-light">Ask anything. In any language.</h2>
                  <p className="mt-3 text-sm text-white/60">Try Tamil, Tanglish, Japanese, or Auto Detect. Voice input available.</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.message_id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}>
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${m.role === "user" ? "bubble-user text-white" : "bubble-ai text-white"}`} data-testid={`msg-${m.role}`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    {m.role === "assistant" && (
                      <div className="mt-3 flex gap-2 opacity-70">
                        <button onClick={() => copyMsg(m.content)} data-testid="copy-msg" className="flex items-center gap-1 text-xs text-white/60 hover:text-gold"><Copy className="h-3 w-3"/>Copy</button>
                        <button onClick={regenerate} data-testid="regenerate-msg" className="flex items-center gap-1 text-xs text-white/60 hover:text-gold"><RefreshCcw className="h-3 w-3"/>Regenerate</button>
                        <button onClick={() => speak(m.content, speechCodeFor(language === "auto" ? "en" : language))} className="flex items-center gap-1 text-xs text-white/60 hover:text-gold"><Volume2 className="h-3 w-3"/>Speak</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bubble-ai rounded-2xl px-5 py-3 text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin text-gold inline"/> Thinking…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-black/40 px-4 py-4 md:px-10">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Button
                data-testid="mic-button"
                onClick={toggleMic}
                variant="outline"
                className={`h-12 w-12 shrink-0 rounded-xl border-white/10 bg-black/60 ${listening ? "text-red-400 animate-pulse-gold" : "text-gold"}`}
              >
                {listening ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
              </Button>
              <Textarea
                data-testid="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
                className="min-h-[52px] flex-1 resize-none border-white/10 bg-black/60 text-white placeholder:text-white/40"
              />
              <Button data-testid="send-button" onClick={send} disabled={sending || !input.trim()} className="btn-gold h-12 rounded-xl px-5 gold-glow">
                <Send className="h-4 w-4"/> Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
