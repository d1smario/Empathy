"use client";

import { useEffect, useRef, useState } from "react";
import { useHeroSport } from "./HeroSportContext";

type Props = {
  /** Una o più clip (orizzontali/desktop). Con più clip diventa un montaggio unico (multi-sport). */
  clips: string[];
  poster: string;
  /** Varianti verticali 9:16 per mobile: STESSE scene, inquadratura verticale. Fallback a `clips`. */
  mobileClips?: string[];
  mobilePoster?: string;
  className?: string;
  /** Slow-mo cinematografico (1 = normale). */
  rate?: number;
  /** Durata del crossfade in ms. */
  fadeMs?: number;
};

/**
 * Video hero con crossfade-loop a doppio buffer: due <video> sovrapposti che si
 * alternano in dissolvenza, così il loop non "scatta" mai e più clip si concatenano
 * in un montaggio continuo (multi-sport). Slow-mo via playbackRate.
 * Su mobile usa le varianti verticali 9:16 (stesse scene, cornice verticale → niente zoom).
 * reduced-motion / Data Saver → poster statico (nessun autoplay di movimento).
 */
export function HeroVideo({ clips, poster, mobileClips, mobilePoster, className = "", rate = 0.72, fadeMs = 800 }: Props) {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const refs = [refA, refB] as const;
  // quale clip sta caricata in ciascun buffer
  const bufClip = useRef<[number, number]>([0, clips.length > 1 ? 1 : 0]);
  const fading = useRef(false);
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  // "poster" = immagine statica (default SSR, reduced-motion o Data Saver) → nessun download video;
  // "video" = montaggio completo, desktop E mobile, quando il movimento è consentito.
  const [mode, setMode] = useState<"poster" | "video">("poster");
  const { setSport } = useHeroSport();

  const useMobile = isMobile && (mobileClips?.length ?? 0) > 0;
  const activeClips = useMobile ? mobileClips! : clips;
  const activePoster = useMobile && mobilePoster ? mobilePoster : poster;

  useEffect(() => {
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Rispetta il Data Saver del device: se attivo resta sul poster (niente download video su rete a consumo).
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const saveData = nav.connection?.saveData === true;
    setIsMobile(!!window.matchMedia?.("(max-width: 1023px)").matches);
    setMode(!reduce && !saveData ? "video" : "poster");
  }, []);

  useEffect(() => {
    if (mode !== "video") return;
    const a = refA.current;
    const b = refB.current;
    if (!a || !b) return;
    a.playbackRate = rate;
    b.playbackRate = rate;
    b.pause();
    a.play().catch(() => {});
    setSport(bufClip.current[0]);
  }, [mode, rate, setSport]);

  const onTime = (idx: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (idx !== active || fading.current || mode !== "video") return;
    const v = e.currentTarget;
    if (!v.duration || v.currentTime < v.duration - fadeMs / 1000 - 0.1) return;

    fading.current = true;
    const cur = active;
    const nxt = cur ^ 1;
    const nv = refs[nxt].current;
    if (!nv) {
      fading.current = false;
      return;
    }
    nv.currentTime = 0;
    nv.playbackRate = rate;
    nv.play().catch(() => {});
    setActive(nxt);
    setSport(bufClip.current[nxt]);

    window.setTimeout(() => {
      const cv = refs[cur].current;
      if (cv) {
        cv.pause();
        cv.currentTime = 0;
        // pre-carica la prossima clip nel buffer appena liberato
        if (activeClips.length > 1) {
          const next = (bufClip.current[nxt] + 1) % activeClips.length;
          if (bufClip.current[cur] !== next) {
            bufClip.current[cur] = next;
            cv.src = activeClips[next]!;
            cv.load();
          }
        }
      }
      fading.current = false;
    }, fadeMs);
  };

  if (mode !== "video") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={activePoster} alt="" aria-hidden className={className} />;
  }

  return (
    <>
      {[0, 1].map((i) => (
        <video
          key={i}
          ref={refs[i]}
          className={`${className} ${active === i ? "opacity-100" : "opacity-0"}`}
          style={{ transitionProperty: "opacity", transitionDuration: `${fadeMs}ms`, transitionTimingFunction: "linear" }}
          muted
          playsInline
          preload="auto"
          poster={activePoster}
          aria-hidden
          onLoadedData={(e) => {
            e.currentTarget.playbackRate = rate;
          }}
          onTimeUpdate={onTime(i)}
        >
          <source src={activeClips[bufClip.current[i]]} type="video/mp4" />
        </video>
      ))}
    </>
  );
}
