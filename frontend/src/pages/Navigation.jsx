import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { LANGS, speechCodeFor } from "@/lib/langs";
import { getRecognition, speak, stopSpeaking } from "@/lib/speech";
import { Compass, MonitorPlay, MonitorX, Camera, Mic, MicOff, Send, Loader2, Volume2, VolumeX, Sparkles, Ear, EarOff } from "lucide-react";
import { toast } from "sonner";

export default function Navigation() {
  const [sharing, setSharing] = useState(false);
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("auto");
  const [voiceOn, setVoiceOn] = useState(true);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState({ daily_used: 0, daily_limit: 10, free_remaining: 5 });
  const [listening, setListening] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [wakeOn, setWakeOn] = useState(false);
  const [wakeStatus, setWakeStatus] = useState("Standby"); // "Standby" | "Heard wake word — listening…" | "Processing…"
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const wakeRef = useRef(null);
  const wakeOnRef = useRef(false);
  const commandUntilRef = useRef(0);
  const askAIRef = useRef(null);
  const languageRef = useRef("auto");
  const voiceOnRef = useRef(true);
  const busyRef = useRef(false);

  const loadUsage = async () => {
    try { const { data } = await api.get("/navigation/usage"); setUsage(data); } catch {}
  };
  useEffect(() => { loadUsage(); return () => stopShare(); }, []);

  const startShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].onended = () => stopShare();
      setSharing(true);
      toast.success("Screen shared. Frame something and ask.");
    } catch (e) {
      toast.error("Screen share cancelled or denied");
    }
  };
  const stopShare = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setSharing(false);
  };

  const capture = () => {
    if (!videoRef.current || !streamRef.current) { toast.error("Share your screen first"); return null; }
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    // cap size for payload sanity
    const maxW = 1280;
    const scale = Math.min(1, maxW / v.videoWidth);
    canvas.width = Math.floor(v.videoWidth * scale);
    canvas.height = Math.floor(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setCaptured(dataUrl);
    return dataUrl;
  };

  const askAI = async (overrideQuestion) => {
    const q = (overrideQuestion ?? question).trim();
    if (!q) { toast.error("Type or speak a question"); return; }
    let img = captured;
    if (!img) img = capture();
    if (!img) return;

    setLoading(true);
    busyRef.current = true;
    setAnswer("");
    try {
      const { data } = await api.post("/navigation/analyze", { image_base64: img, question: q, language });
      setAnswer(data.answer);
      setUsage(data.usage);
      window.dispatchEvent(new Event("nav-usage-updated"));
      if (voiceOn) speak(data.answer, speechCodeFor(language === "auto" ? "en" : language));
    } catch (e) {
      const msg = e?.response?.data?.detail || "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
      busyRef.current = false;
      if (wakeOnRef.current) setWakeStatus("Say “Zero Two…”");
    }
  };

  // Keep refs synced with latest state for use inside wake-word callbacks
  useEffect(() => { askAIRef.current = askAI; }); // no deps: refresh on every render
  useEffect(() => { languageRef.current = language; voiceOnRef.current = voiceOn; }, [language, voiceOn]);
  useEffect(() => { wakeOnRef.current = wakeOn; }, [wakeOn]);

  // Wake-word: continuous background listener that triggers on "zero two" / "hey zero two"
  const startWake = () => {
    const rec = getRecognition();
    if (!rec) { toast.error("Voice input not supported in this browser"); return false; }
    rec.lang = "en-US"; // wake word is English regardless of AI response language
    rec.interimResults = true;
    rec.continuous = true;
    let lastFinalIdx = 0;

    const processFinal = (finalChunk) => {
      const lower = finalChunk.toLowerCase();
      const m = lower.match(/(?:hey\s+)?zero\s*two[,.!?\s]*(.*)$/i);
      if (m) {
        const trailing = (m[1] || "").trim();
        if (trailing.split(/\s+/).filter(Boolean).length >= 2) {
          // We already have the command in the same utterance
          commandUntilRef.current = 0;
          setWakeStatus("Processing…");
          if (!busyRef.current) askAIRef.current?.(trailing);
        } else {
          // Just the wake word — listen for the command in the next 8s of finals
          commandUntilRef.current = Date.now() + 8000;
          setWakeStatus("Heard wake word — listening…");
          try { speak("Yes?", "en-US"); } catch {}
        }
      } else if (Date.now() < commandUntilRef.current) {
        // We are in command window; treat this final chunk as the command
        commandUntilRef.current = 0;
        setWakeStatus("Processing…");
        if (!busyRef.current) askAIRef.current?.(finalChunk.trim());
      }
    };

    rec.onresult = (e) => {
      for (let i = lastFinalIdx; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          processFinal(e.results[i][0].transcript);
          lastFinalIdx = i + 1;
        }
      }
    };
    rec.onend = () => {
      // Chrome auto-stops; restart if still on
      if (wakeOnRef.current) {
        try { rec.start(); } catch { setTimeout(() => { try { rec.start(); } catch {} }, 400); }
      } else {
        setWakeStatus("Standby");
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        setWakeOn(false); wakeOnRef.current = false;
        toast.error("Microphone permission denied");
      }
    };

    try { rec.start(); } catch {}
    wakeRef.current = rec;
    return true;
  };

  const stopWake = () => {
    wakeOnRef.current = false;
    try { wakeRef.current?.stop(); } catch {}
    wakeRef.current = null;
    setWakeStatus("Standby");
  };

  const toggleWake = () => {
    if (wakeOn) {
      setWakeOn(false);
      stopWake();
      toast("Wake word off");
    } else {
      // Pause manual listening if any
      try { recRef.current?.stop(); } catch {}
      wakeOnRef.current = true;
      if (startWake()) {
        setWakeOn(true);
        setWakeStatus("Say “Zero Two…”");
        toast('Say "Zero Two" or "Hey Zero Two" to start');
      }
    }
  };

  useEffect(() => () => stopWake(), []);

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    // Pause wake-word while manual mic runs (browsers allow only one SR at a time)
    const wakeWasOn = wakeOn;
    if (wakeWasOn) { try { wakeRef.current?.stop(); } catch {} }
    const rec = getRecognition();
    if (!rec) { toast.error("Voice input not supported"); return; }
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
      setQuestion((final || text).trim());
    };
    rec.onend = () => {
      setListening(false);
      if (wakeWasOn && wakeOnRef.current) {
        setTimeout(() => { try { wakeRef.current && wakeRef.current.start(); } catch { startWake(); } }, 300);
      }
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };

  const pct = Math.min(100, (usage.daily_used / usage.daily_limit) * 100);

  return (
    <div className="min-h-screen bg-hero">
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold">
              <Compass className="h-3.5 w-3.5"/> Navigation Mode
            </div>
            <h1 className="font-heading text-2xl font-medium">Point. Ask. Understand.</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="nav-language-select" className="w-[180px] border-white/10 bg-black/50 text-white"><SelectValue/></SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button data-testid="nav-voice-toggle" variant="outline" onClick={() => { if (voiceOn) stopSpeaking(); setVoiceOn(!voiceOn); }} className="border-white/10 bg-black/40 text-white hover:bg-white/10">
              {voiceOn ? <><Volume2 className="h-4 w-4"/> Voice ON</> : <><VolumeX className="h-4 w-4"/> Voice OFF</>}
            </Button>
            <Button
              data-testid="wake-toggle"
              variant="outline"
              onClick={toggleWake}
              className={`border-white/10 bg-black/40 text-white hover:bg-white/10 ${wakeOn ? "border-gold/60 text-gold gold-glow" : ""}`}
            >
              {wakeOn ? <><Ear className="h-4 w-4"/> Wake ON</> : <><EarOff className="h-4 w-4"/> Wake OFF</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_400px]">
        {/* Screen preview */}
        <div className="animate-fade-up rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-white/60">Shared screen</div>
            <div className="flex gap-2">
              {!sharing ? (
                <Button data-testid="start-share-button" onClick={startShare} className="btn-gold gold-glow">
                  <MonitorPlay className="h-4 w-4"/> Share Screen
                </Button>
              ) : (
                <>
                  <Button data-testid="capture-button" onClick={capture} variant="outline" className="border-gold/40 bg-gold/10 text-gold hover:bg-gold/20">
                    <Camera className="h-4 w-4"/> Capture frame
                  </Button>
                  <Button data-testid="stop-share-button" onClick={stopShare} variant="outline" className="border-white/10 bg-black/40 text-white hover:bg-white/10">
                    <MonitorX className="h-4 w-4"/> Stop
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
            {!sharing && !captured && (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold animate-pulse-gold"><Compass className="h-6 w-6"/></div>
                  <div className="font-heading text-lg">Share a screen to start</div>
                  <div className="mt-1 text-sm text-white/50">The browser will ask your permission.</div>
                </div>
              </div>
            )}
            <video ref={videoRef} className={`h-full w-full object-contain ${sharing ? "block" : "hidden"}`} muted playsInline data-testid="screen-video"/>
            {!sharing && captured && (
              <img src={captured} alt="captured" className="h-full w-full object-contain" data-testid="captured-frame"/>
            )}
          </div>
        </div>

        {/* Q & A panel */}
        <div className="animate-fade-up rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-white/60">Ask about the screen</div>
            <div className="text-xs text-white/50" data-testid="nav-usage-inline">
              <span className="text-gold">{usage.daily_used}</span> / {usage.daily_limit} today
            </div>
          </div>
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
          </div>

          {wakeOn && (
            <div data-testid="wake-status" className="mb-3 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs text-gold">
              <span className="inline-block h-2 w-2 rounded-full bg-gold animate-pulse-gold"/> {wakeStatus}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Button data-testid="nav-mic-button" onClick={toggleMic} variant="outline" className={`h-11 w-11 shrink-0 rounded-xl border-white/10 bg-black/60 ${listening ? "text-red-400 animate-pulse-gold" : "text-gold"}`}>
              {listening ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
            </Button>
            <Textarea data-testid="nav-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder='e.g. "What is Computer Science?"' className="min-h-[44px] flex-1 resize-none border-white/10 bg-black/60 text-white placeholder:text-white/40"/>
          </div>
          <Button data-testid="nav-ask-button" onClick={askAI} disabled={loading} className="btn-gold mt-3 h-11 w-full rounded-xl gold-glow">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin"/> Analyzing…</> : <><Sparkles className="h-4 w-4"/> Ask AI</>}
          </Button>

          <div className="mt-5 min-h-[140px] rounded-xl border border-gold/20 bg-gold/[0.03] p-4">
            <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-gold">Answer</div>
            {answer ? (
              <div className="whitespace-pre-wrap leading-relaxed text-white" data-testid="nav-answer">{answer}</div>
            ) : (
              <div className="text-sm text-white/50">Share your screen, capture a frame, then ask a question — in any of 15 supported languages.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
