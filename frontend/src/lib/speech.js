// Browser Speech APIs (STT + TTS)

export const getRecognition = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  return new SR();
};

export const speak = (text, langCode = "en-US", voiceName = "") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = langCode;
  const voices = window.speechSynthesis.getVoices();
  if (voiceName) {
    const v = voices.find((x) => x.name === voiceName);
    if (v) utter.voice = v;
  } else {
    const v = voices.find((x) => x.lang === langCode);
    if (v) utter.voice = v;
  }
  window.speechSynthesis.speak(utter);
};

export const stopSpeaking = () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
};

export const listVoices = () => {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
};
