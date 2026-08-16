import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const session_id = params.get("session_id");
    if (!session_id) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        if (data.session_token) {
          localStorage.setItem("session_token", data.session_token);
        }
        setUser({ user_id: data.user_id, email: data.email, name: data.name, picture: data.picture });
        window.history.replaceState({}, "", "/chat");
        navigate("/chat", { replace: true, state: { user: data } });
      } catch (e) {
        console.error(e);
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="grid min-h-screen place-items-center bg-black text-white">
      <div className="flex items-center gap-3 text-white/70">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
        Signing you in…
      </div>
    </div>
  );
}
