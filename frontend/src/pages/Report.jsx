import React, { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Flag, Send } from "lucide-react";
import { toast } from "sonner";

const CATS = [
  { value: "ai", label: "AI problem" },
  { value: "navigation", label: "Navigation problem" },
  { value: "voice", label: "Voice problem" },
  { value: "translation", label: "Translation problem" },
  { value: "other", label: "Other" },
];

export default function Report() {
  const [category, setCategory] = useState("ai");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!description.trim()) { toast.error("Please describe the problem"); return; }
    setBusy(true);
    try {
      await api.post("/reports", { category, description });
      setDescription("");
      toast.success("Report submitted. Thank you.");
    } catch { toast.error("Failed to submit"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen">
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold"><Flag className="h-3.5 w-3.5"/> Report</div>
        <h1 className="font-heading text-2xl font-medium">Report a problem</h1>
      </div>

      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 animate-fade-up">
          <div className="mb-4 text-sm text-white/60">Your feedback helps us fix issues fast.</div>
          <div className="mb-3">
            <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/60">Category</div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="report-category" className="w-full border-white/10 bg-black/60 text-white"><SelectValue/></SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                {CATS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-4">
            <div className="mb-2 text-xs uppercase tracking-[0.24em] text-white/60">Description</div>
            <Textarea data-testid="report-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? Any steps to reproduce?" className="min-h-[140px] border-white/10 bg-black/60 text-white placeholder:text-white/40"/>
          </div>
          <Button data-testid="report-submit" onClick={submit} disabled={busy} className="btn-gold gold-glow">
            <Send className="h-4 w-4"/> {busy ? "Sending…" : "Send report"}
          </Button>
        </div>
      </div>
    </div>
  );
}
