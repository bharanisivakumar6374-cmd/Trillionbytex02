import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { startReminderScheduler, stopReminderScheduler } from "@/lib/reminders";

import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import AppShell from "@/components/layout/AppShell";
import Chat from "@/pages/Chat";
import Navigation from "@/pages/Navigation";
import Schedules from "@/pages/Schedules";
import Settings from "@/pages/Settings";
import Help from "@/pages/Help";
import Report from "@/pages/Report";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user, loading } = useAuth();
  React.useEffect(() => {
    if (user) startReminderScheduler();
    return () => stopReminderScheduler();
  }, [user]);
  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-black text-white/70">
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-gold"/> Loading…</div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/chat" element={<Chat />} />
        <Route path="/navigation" element={<Navigation />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/report" element={<Report />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
