import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { LANGS } from "@/lib/langs";
import { listVoices } from "@/lib/speech";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState({ ui_language: "en", ai_language: "auto", voice_enabled: true, voice_name: "", theme: "dark", privacy_analytics: true });
  const [voices, setVoices] = useState([]);
  const [usage, setUsage] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/settings");
      setS({ ...s, ...data });
    } catch {}
    try { const { data } = await api.get("/navigation/usage"); setUsage(data); } catch {}
  };
  useEffect(() => {
    load();
    const upd = () => setVoices(listVoices());
    upd();
    if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = upd;
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    try { await api.put("/settings", s); toast.success("Settings saved"); }
    catch { toast.error("Failed"); }
  };

  const Row = ({ label, hint, children }) => (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 py-4 last:border-b-0">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {hint && <div className="text-xs text-white/50">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold"><SettingsIcon className="h-3.5 w-3.5"/> Settings</div>
            <h1 className="font-heading text-2xl font-medium">Preferences</h1>
          </div>
          <Button data-testid="save-settings" onClick={save} className="btn-gold gold-glow"><Save className="h-4 w-4"/> Save</Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Section title="Account">
          <Row label="Name">{user?.name}</Row>
          <Row label="Email">{user?.email}</Row>
        </Section>

        <Section title="Language">
          <Row label="Interface language">
            <Select value={s.ui_language} onValueChange={(v) => setS({ ...s, ui_language: v })}>
              <SelectTrigger data-testid="settings-ui-language" className="w-[220px] border-white/10 bg-black/60 text-white"><SelectValue/></SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                {LANGS.filter((l) => l.code !== "auto").map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="AI response language" hint="Default language for AI answers">
            <Select value={s.ai_language} onValueChange={(v) => setS({ ...s, ai_language: v })}>
              <SelectTrigger data-testid="settings-ai-language" className="w-[220px] border-white/10 bg-black/60 text-white"><SelectValue/></SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section title="Voice">
          <Row label="Voice ON/OFF">
            <Switch data-testid="settings-voice-enabled" checked={s.voice_enabled} onCheckedChange={(v) => setS({ ...s, voice_enabled: v })}/>
          </Row>
          <Row label="Preferred voice" hint="Uses your browser's Text-to-Speech voices">
            <Select value={s.voice_name || "default"} onValueChange={(v) => setS({ ...s, voice_name: v === "default" ? "" : v })}>
              <SelectTrigger data-testid="settings-voice-name" className="w-[260px] border-white/10 bg-black/60 text-white"><SelectValue placeholder="System default"/></SelectTrigger>
              <SelectContent className="max-h-[300px] border-white/10 bg-black/90 text-white">
                <SelectItem value="default">System default</SelectItem>
                {voices.map((v) => <SelectItem key={v.name} value={v.name}>{v.name} · {v.lang}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section title="Navigation">
          <Row label="Daily usage">{usage ? `${usage.daily_used} / ${usage.daily_limit}` : "…"}</Row>
          <Row label="Free uses remaining">{usage ? usage.free_remaining : "…"}</Row>
        </Section>

        <Section title="Appearance">
          <Row label="Theme" hint="Zero Two AI is optimized for the dark command center">
            <Select value={s.theme} onValueChange={(v) => setS({ ...s, theme: v })}>
              <SelectTrigger data-testid="settings-theme" className="w-[180px] border-white/10 bg-black/60 text-white"><SelectValue/></SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section title="Privacy">
          <Row label="Anonymous analytics" hint="Helps improve the product; nothing personal is shared">
            <Switch data-testid="settings-privacy" checked={s.privacy_analytics} onCheckedChange={(v) => setS({ ...s, privacy_analytics: v })}/>
          </Row>
        </Section>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div className="animate-fade-up rounded-2xl border border-white/10 bg-black/40 p-6">
    <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-gold">{title}</div>
    {children}
  </div>
);
