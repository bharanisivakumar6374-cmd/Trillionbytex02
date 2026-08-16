import React from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LifeBuoy } from "lucide-react";

const FAQ = [
  { q: "What is Navigation?", a: "Navigation Mode lets you share your screen (or a screenshot), point at anything visible, and ask Zero Two AI what it is. The AI reads the visible content and explains in your chosen language." },
  { q: "How to enable Navigation?", a: "Open the Navigation page from the sidebar, click 'Share Screen', and allow browser permissions. Frame what you want explained, click 'Capture frame', then type or speak your question." },
  { q: "How to select screen content?", a: "Your browser shows a screen share picker — choose a tab, window, or entire screen. Then click 'Capture frame' when you're on the content you want explained. You can capture as many frames as you like." },
  { q: "How to enable/disable voice?", a: "Use the 'Voice ON/OFF' button in the top bar of Chat or Navigation. You can also change voice and language in Settings → Voice." },
  { q: "How to use Navigation more than 5 times?", a: "You get 5 free Navigation uses after your first login. After that you still have up to 10 uses per day. The counter refreshes daily." },
  { q: "Daily Navigation limit", a: "Maximum 10 Navigation uses per day. The counter is enforced server-side, so refreshing the page does not reset it. The sidebar shows your usage: e.g. 3 / 10 used today." },
  { q: "How to create schedules", a: "Open Schedules → 'New'. Fill task name, message, date, time and choose Repeat. You can have up to 5 active schedules. Disable or delete any to add more." },
  { q: "Supported languages", a: "Tamil, English, Tanglish, Hindi, Japanese, Korean, Thai, Malayalam, Telugu, Kannada, Bengali, Chinese, Arabic, Spanish, French — plus Auto Detect (handles mixed language input like 'Computer science na enna?')." },
];

export default function Help() {
  return (
    <div className="min-h-screen">
      <div className="glass sticky top-0 z-20 border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold"><LifeBuoy className="h-3.5 w-3.5"/> Help</div>
        <h1 className="font-heading text-2xl font-medium">How Zero Two AI works</h1>
      </div>
      <div className="mx-auto max-w-3xl p-6">
        <Accordion type="single" collapsible className="rounded-2xl border border-white/10 bg-black/40 p-2" data-testid="help-accordion">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-white/5">
              <AccordionTrigger className="px-4 text-left text-white hover:text-gold" data-testid={`help-q-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="px-4 text-white/70">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
