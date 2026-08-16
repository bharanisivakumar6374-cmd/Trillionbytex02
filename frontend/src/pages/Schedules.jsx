import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

const REPEATS = ["none", "daily", "weekly", "monthly"];

const emptyForm = { task_name: "", message: "", date: "", time: "", repeat: "none", enabled: true };

export default function Schedules() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = async () => { const { data } = await api.get("/schedules"); setItems(data); };
  useEffect(() => { load(); }, []);

  const activeCount = items.filter((i) => i.enabled).length;

  const save = async () => {
    if (!form.task_name || !form.date || !form.time) { toast.error("Task name, date, time are required"); return; }
    try {
      if (editingId) {
        await api.put(`/schedules/${editingId}`, form);
        toast.success("Schedule updated");
      } else {
        await api.post("/schedules", form);
        toast.success("Schedule created");
      }
      setShowForm(false); setForm(emptyForm); setEditingId(null); load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const edit = (it) => { setForm({ task_name: it.task_name, message: it.message, date: it.date, time: it.time, repeat: it.repeat, enabled: it.enabled }); setEditingId(it.schedule_id); setShowForm(true); };
  const remove = async (id) => { await api.delete(`/schedules/${id}`); toast.success("Deleted"); load(); };
  const toggle = async (it) => {
    try {
      await api.put(`/schedules/${it.schedule_id}`, { ...it, enabled: !it.enabled });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold"><CalendarClock className="h-3.5 w-3.5"/> Schedules</div>
            <h1 className="font-heading text-2xl font-medium">Your tasks</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/60">Active: <span className="text-gold" data-testid="schedule-count">{activeCount} / 5</span></div>
            <Button data-testid="new-schedule-button" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }} className="btn-gold gold-glow"><Plus className="h-4 w-4"/> New</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-4 p-6">
        {showForm && (
          <div className="animate-fade-up rounded-2xl border border-gold/30 bg-black/50 p-6" data-testid="schedule-form">
            <div className="mb-4 font-heading text-lg">{editingId ? "Edit schedule" : "New schedule"}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input data-testid="schedule-task-name" placeholder="Task name" value={form.task_name} onChange={(e) => setForm({ ...form, task_name: e.target.value })} className="border-white/10 bg-black/60 text-white"/>
              <Input data-testid="schedule-message" placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="border-white/10 bg-black/60 text-white"/>
              <Input data-testid="schedule-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-white/10 bg-black/60 text-white"/>
              <Input data-testid="schedule-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="border-white/10 bg-black/60 text-white"/>
              <Select value={form.repeat} onValueChange={(v) => setForm({ ...form, repeat: v })}>
                <SelectTrigger data-testid="schedule-repeat" className="border-white/10 bg-black/60 text-white"><SelectValue/></SelectTrigger>
                <SelectContent className="border-white/10 bg-black/90 text-white">
                  {REPEATS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/60 px-3 py-2 text-white">
                <span className="text-sm">Enabled</span>
                <Switch data-testid="schedule-enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })}/>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button data-testid="schedule-save" onClick={save} className="btn-gold"><Save className="h-4 w-4"/> Save</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="border-white/10 bg-black/40 text-white hover:bg-white/10"><X className="h-4 w-4"/> Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {items.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-white/60">No schedules yet.</div>}
          {items.map((it) => (
            <div key={it.schedule_id} data-testid={`schedule-item-${it.schedule_id}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 animate-fade-up">
              <div className="flex-1 min-w-[220px]">
                <div className="font-heading text-lg text-white">{it.task_name}</div>
                <div className="text-sm text-white/60">{it.message}</div>
                <div className="mt-1 text-xs text-white/50">{it.date} · {it.time} · {it.repeat}</div>
              </div>
              <Switch checked={it.enabled} onCheckedChange={() => toggle(it)} data-testid={`toggle-${it.schedule_id}`}/>
              <Button variant="outline" onClick={() => edit(it)} className="border-white/10 bg-black/40 text-white hover:bg-white/10"><Pencil className="h-4 w-4"/></Button>
              <Button variant="outline" onClick={() => remove(it.schedule_id)} className="border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 className="h-4 w-4"/></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
