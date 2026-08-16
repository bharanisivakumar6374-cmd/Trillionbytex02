import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Compass, Languages, ShieldCheck } from "lucide-react";

const BG = "https://images.unsplash.com/photo-1698191373970-228c25ee6fd0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjBsdXh1cnklMjBnb2xkJTIwM2QlMjB0ZXh0dXJlfGVufDB8fHx8MTc4Njg3MDkwMXww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/chat";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden" data-testid="login-page">
      <div className="absolute inset-0 -z-10">
        <img src={BG} alt="" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/90" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-between px-8 py-12 md:px-16">
        <div className="hidden max-w-md md:block animate-fade-up">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.24em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Premium AI
          </div>
          <h1 className="font-heading text-5xl font-light leading-[1.05] text-white lg:text-6xl">
            Zero Two <span className="text-gold">AI</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            A multilingual command center for chat, voice, and on-screen navigation. Ask in Tamil, Tanglish, Japanese, or 12 more languages — get precise answers in the language you love.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4">
            <Feature icon={<Compass className="h-4 w-4" />} title="Navigation Mode" desc="Share a screen, point, ask — get instant contextual answers." />
            <Feature icon={<Languages className="h-4 w-4" />} title="15 Languages + Auto" desc="Understands Tanglish and mixed input naturally." />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Private by design" desc="Server-side keys. Nothing captured without your permission." />
          </div>
        </div>

        <div className="glass w-full max-w-sm rounded-2xl p-8 md:p-10">
          <div className="mb-2 text-xs uppercase tracking-[0.28em] text-gold">Sign in</div>
          <h2 className="font-heading text-3xl font-medium text-white">Enter the Command Center</h2>
          <p className="mt-3 text-sm text-white/60">
            Continue with Google to unlock chat, voice, and Navigation Mode.
          </p>

          <Button
            data-testid="google-login-button"
            onClick={handleLogin}
            className="btn-gold mt-8 h-12 w-full rounded-xl text-base font-semibold gold-glow transition-transform duration-200 hover:-translate-y-[2px]"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="mt-6 text-center text-[11px] uppercase tracking-[0.22em] text-white/40">
            5 free Navigation uses · 10 / day max
          </div>
        </div>
      </div>
    </div>
  );
}

const Feature = ({ icon, title, desc }) => (
  <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
    <div className="mt-1 grid h-8 w-8 place-items-center rounded-lg border border-gold/40 bg-gold/10 text-gold">
      {icon}
    </div>
    <div>
      <div className="font-medium text-white">{title}</div>
      <div className="text-sm text-white/60">{desc}</div>
    </div>
  </div>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.5 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1C29.1 35.5 26.6 36 24 36c-5.4 0-9.9-3.5-11.5-8.2l-6.5 5C9.5 39.4 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.1C41.3 35 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
);
