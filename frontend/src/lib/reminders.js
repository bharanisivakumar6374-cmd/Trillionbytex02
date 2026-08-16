// Lightweight client-side reminder scheduler for Zero Two AI schedules.
// - Requests browser Notification permission (once).
// - Ticks every 30s; fires enabled schedules whose target time is reached.
// - Advances repeat=daily|weekly|monthly to the next occurrence via localStorage.
// - Uses toast as a fallback if notifications are denied/hidden.
// - Optional TTS uses browser Web Speech.

import { api } from "@/lib/api";
import { speak } from "@/lib/speech";
import { toast } from "sonner";

const LS_KEY = "z2_reminder_next"; // { [schedule_id]: nextFireISO }

const getMap = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
};
const setMap = (m) => localStorage.setItem(LS_KEY, JSON.stringify(m));

const nextOccurrence = (fromDate, repeat) => {
  const d = new Date(fromDate.getTime());
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
};

const scheduleDateTime = (sch) => {
  // sch.date "YYYY-MM-DD", sch.time "HH:MM"
  if (!sch.date || !sch.time) return null;
  const iso = `${sch.date}T${sch.time}:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const notify = (sch) => {
  const title = `⏰ ${sch.task_name || "Reminder"}`;
  const body = sch.message || "Your scheduled task is due.";
  let shown = false;
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: `z2-${sch.schedule_id}` });
      shown = true;
    }
  } catch {}
  toast(title, { description: body, duration: 8000 });
  try { speak(`${sch.task_name}. ${sch.message || ""}`, "en-US"); } catch {}
  return shown;
};

let intervalId = null;

const tick = async () => {
  try {
    const { data: schedules } = await api.get("/schedules");
    const map = getMap();
    const now = new Date();
    let mutated = false;

    for (const s of schedules) {
      if (!s.enabled) continue;
      const base = scheduleDateTime(s);
      if (!base) continue;

      // Determine target
      let target;
      if (map[s.schedule_id]) {
        target = new Date(map[s.schedule_id]);
      } else {
        // First time seeing this schedule; if the original time already passed
        // for a repeat schedule, roll forward until >= now.
        target = base;
        if ((s.repeat && s.repeat !== "none") && target < now) {
          while (target < now) {
            const nxt = nextOccurrence(target, s.repeat);
            if (!nxt) break;
            target = nxt;
          }
        }
        map[s.schedule_id] = target.toISOString();
        mutated = true;
      }

      if (target <= now) {
        notify(s);
        if (s.repeat && s.repeat !== "none") {
          const nxt = nextOccurrence(target, s.repeat);
          map[s.schedule_id] = nxt ? nxt.toISOString() : new Date(now.getTime() + 3.15e10).toISOString();
        } else {
          // One-shot: push far future so it won't fire again
          map[s.schedule_id] = new Date(now.getTime() + 3.15e10).toISOString();
        }
        mutated = true;
      }
    }

    // Clean orphan keys (schedule deleted)
    const validIds = new Set(schedules.map((s) => s.schedule_id));
    for (const k of Object.keys(map)) {
      if (!validIds.has(k)) { delete map[k]; mutated = true; }
    }

    if (mutated) setMap(map);
  } catch {}
};

export const startReminderScheduler = () => {
  if (intervalId) return;
  // Ask for permission opportunistically
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  tick();
  intervalId = setInterval(tick, 30_000);
};

export const stopReminderScheduler = () => {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
};
