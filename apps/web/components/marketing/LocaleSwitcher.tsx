"use client";

import { useEffect, useRef, useState } from "react";

/** Nome nativo della lingua (mostrato accanto alla bandierina). */
const NATIVE_NAME: Record<string, string> = {
  it: "Italiano",
  en: "English",
  tr: "Türkçe",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  nl: "Nederlands",
  no: "Norsk",
  sv: "Svenska",
  pt: "Português",
  ru: "Русский",
  zh: "中文",
  ja: "日本語",
  ar: "العربية",
};

/** Bandierine SVG inline (affidabili su ogni OS, a differenza delle emoji). Fallback: codice. */
function Flag({ code }: { code: string }) {
  const cls = "block h-full w-full";
  if (code === "it")
    return (
      <svg viewBox="0 0 3 2" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="1" height="2" fill="#009246" />
        <rect x="1" width="1" height="2" fill="#fff" />
        <rect x="2" width="1" height="2" fill="#ce2b37" />
      </svg>
    );
  if (code === "en")
    return (
      <svg viewBox="0 0 60 30" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 60 30 M60 0 0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0 60 30 M60 0 0 30" stroke="#c8102e" strokeWidth="3.5" />
        <path d="M30 0V30 M0 15H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0V30 M0 15H60" stroke="#c8102e" strokeWidth="6" />
      </svg>
    );
  if (code === "tr")
    return (
      <svg viewBox="0 0 60 40" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="60" height="40" fill="#e30a17" />
        <circle cx="24" cy="20" r="9" fill="#fff" />
        <circle cx="27.5" cy="20" r="7.2" fill="#e30a17" />
        <path d="M37.5 13.6l1.7 4.4 4.7.3-3.6 3 1.2 4.6-4-2.6-4 2.6 1.2-4.6-3.6-3 4.7-.3z" fill="#fff" />
      </svg>
    );
  if (code === "fr")
    return (
      <svg viewBox="0 0 3 2" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="1" height="2" fill="#0055a4" />
        <rect x="1" width="1" height="2" fill="#fff" />
        <rect x="2" width="1" height="2" fill="#ef4135" />
      </svg>
    );
  if (code === "de")
    return (
      <svg viewBox="0 0 3 3" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="3" height="1" y="0" fill="#000" />
        <rect width="3" height="1" y="1" fill="#dd0000" />
        <rect width="3" height="1" y="2" fill="#ffce00" />
      </svg>
    );
  if (code === "es")
    return (
      <svg viewBox="0 0 3 2" className={cls} preserveAspectRatio="none" aria-hidden>
        <rect width="3" height="2" fill="#c60b1e" />
        <rect width="3" height="1" y="0.5" fill="#ffc400" />
      </svg>
    );
  return (
    <span className="flex h-full w-full items-center justify-center bg-white/10 text-[8px] font-bold uppercase tracking-wide text-gray-200">
      {code}
    </span>
  );
}

/**
 * Selettore lingua per la vetrina pubblica: bandierina + nome lingua, dropdown con le
 * lingue ABILITATE (da DB, passate dal server). Al clic imposta il cookie EMPATHY_LOCALE
 * e ricarica → il resolver server-side prende la scelta (funziona anche da sloggati).
 */
export function LocaleSwitcher({ enabled, current }: { enabled: string[]; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = enabled.length > 0 ? enabled : ["it", "en"];
  if (options.length < 2) return null; // una sola lingua → niente selettore

  const choose = (code: string) => {
    if (code !== current) {
      document.cookie = `EMPATHY_LOCALE=${code}; path=/; max-age=31536000; samesite=lax`;
      window.location.reload();
      return;
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-gray-200 backdrop-blur-xl transition-colors hover:border-purple-500/40 hover:text-white"
      >
        <span className="h-3.5 w-5 overflow-hidden rounded-[3px] ring-1 ring-white/20">
          <Flag code={current} />
        </span>
        <span className="hidden font-medium sm:inline">{NATIVE_NAME[current] ?? current.toUpperCase()}</span>
        <span aria-hidden className={`text-[0.6rem] text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/10 bg-black/80 py-1 shadow-2xl backdrop-blur-xl"
        >
          {options.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === current}
                onClick={() => choose(code)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                  code === current ? "text-white" : "text-gray-300"
                }`}
              >
                <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-white/20">
                  <Flag code={code} />
                </span>
                <span className="flex-1 font-medium">{NATIVE_NAME[code] ?? code.toUpperCase()}</span>
                {code === current ? <span className="text-xs text-pink-300">●</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
