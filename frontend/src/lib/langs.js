export const LANGS = [
  { code: "auto", label: "Auto Detect", speech: "en-US" },
  { code: "en", label: "English", speech: "en-US" },
  { code: "ta", label: "Tamil (தமிழ்)", speech: "ta-IN" },
  { code: "tanglish", label: "Tanglish", speech: "en-IN" },
  { code: "hi", label: "Hindi (हिन्दी)", speech: "hi-IN" },
  { code: "ja", label: "Japanese (日本語)", speech: "ja-JP" },
  { code: "ko", label: "Korean (한국어)", speech: "ko-KR" },
  { code: "th", label: "Thai (ไทย)", speech: "th-TH" },
  { code: "ml", label: "Malayalam (മലയാളം)", speech: "ml-IN" },
  { code: "te", label: "Telugu (తెలుగు)", speech: "te-IN" },
  { code: "kn", label: "Kannada (ಕನ್ನಡ)", speech: "kn-IN" },
  { code: "bn", label: "Bengali (বাংলা)", speech: "bn-IN" },
  { code: "zh", label: "Chinese (中文)", speech: "zh-CN" },
  { code: "ar", label: "Arabic (العربية)", speech: "ar-SA" },
  { code: "es", label: "Spanish (Español)", speech: "es-ES" },
  { code: "fr", label: "French (Français)", speech: "fr-FR" },
];

export const speechCodeFor = (langCode) => {
  const l = LANGS.find((x) => x.code === langCode);
  return l ? l.speech : "en-US";
};
