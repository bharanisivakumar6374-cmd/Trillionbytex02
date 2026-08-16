import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { MessageSquare, Compass, CalendarClock, Settings, LifeBuoy, Flag, LogOut, Menu, X, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/chat", label: "Chat", icon: MessageSquare, testid: "nav-chat" },
  { to: "/navigation", label: "Navigation", icon: Compass, testid: "nav-navigation", primary: true },
  { to: "/schedules", label: "Schedules", icon: CalendarClock, testid: "nav-schedules" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
  { to: "/help", label: "Help", icon: LifeBuoy, testid: "nav-help" },
  { to: "/report", label: "Report", icon: Flag, testid: "nav-report" },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState({ daily_used: 0, daily_limit: 10, free_remaining: 5 });

  const loadUsage = async () => {
    try {
      const { data } = await api.get("/navigation/usage");
      setUsage(data);
    } catch {}
  };
  useEffect(() => { loadUsage(); window.addEventListener("nav-usage-updated", loadUsage); return () => window.removeEventListener("nav-usage-updated", loadUsage); }, []);

  return (
    <div className="grid min-h-screen w-full bg-hero md:grid-cols-[280px_1fr]">
      {/* Mobile top bar */}
      <div className="glass sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md btn-gold grid place-items-center"><Sparkles className="h-4 w-4"/></div>
          <div className="font-heading text-lg">Zero Two <span className="text-gold">AI</span></div>
        </div>
        <button data-testid="mobile-menu-toggle" onClick={() => setOpen((o) => !o)} className="rounded-md border border-white/10 p-2">
          {open ? <X className="h-4 w-4"/> : <Menu className="h-4 w-4"/>}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`glass ${open ? "block" : "hidden"} md:block md:sticky md:top-0 md:h-screen md:border-r md:border-white/10`} data-testid="sidebar">
        <div className="flex h-full flex-col p-5">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg btn-gold grid place-items-center gold-glow"><Sparkles className="h-5 w-5"/></div>
            <div>
              <div className="font-heading text-xl leading-none">Zero Two <span className="text-gold">AI</span></div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/50">Command Center</div>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
                    item.primary
                      ? `border ${isActive ? "border-gold bg-gold/15 text-gold" : "border-gold/40 bg-gold/5 text-gold hover:bg-gold/10"} gold-glow`
                      : isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
                {item.primary && <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold">Main</span>}
              </NavLink>
            ))}
          </nav>

          {/* Usage counter */}
          <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4" data-testid="nav-usage-card">
            <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Navigation today</div>
            <div className="font-heading text-2xl text-gold" data-testid="nav-usage-count">{usage.daily_used} / {usage.daily_limit}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full bg-gold transition-all" style={{ width: `${Math.min(100, (usage.daily_used / usage.daily_limit) * 100)}%` }} />
            </div>
            <div className="mt-2 text-xs text-white/50">Free left: <span className="text-gold" data-testid="free-remaining">{usage.free_remaining}</span></div>
          </div>

          <div className="mt-auto pt-6">
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              {user?.picture ? (
                <img src={user.picture} alt="" className="h-8 w-8 rounded-full border border-gold/30 object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gold/20 grid place-items-center text-gold text-xs">{user?.name?.[0] || "?"}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-white" data-testid="user-name">{user?.name}</div>
                <div className="truncate text-[11px] text-white/50">{user?.email}</div>
              </div>
            </div>
            <Button variant="ghost" data-testid="logout-button" onClick={async () => { await logout(); navigate("/"); }} className="w-full justify-start text-white/70 hover:bg-white/[0.05] hover:text-white">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen">
        <Outlet context={{ reloadUsage: loadUsage }} />
      </main>
    </div>
  );
}
