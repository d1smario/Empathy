"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** Una o più clip. Con più clip diventa un montaggio unico (multi-sport). */
  clips: string[];
  poster: string;
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
 * reduced-motion → poster statico (nessun autoplay di movimento).
 */
export function HeroVideo({ clips, poster, className = "", rate = 0.72, fadeMs = 800 }: Props) {
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const refs = [refA, refB] as const;
  // quale clip sta caricata in ciascun buffer
  const bufClip = useRef<[number, number]>([0, clips.length > 1 ? 1 : 0]);
  const fading = useRef(false);
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const a = refA.current;
    const b = refB.current;
    if (!a || !b) return;
    a.playbackRate = rate;
    b.playbackRate = rate;
    b.pause();
    a.play().catch(() => {});
  }, [reduce, rate]);

  const onTime = (idx: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (idx !== active || fading.current || reduce) return;
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

    window.setTimeout(() => {
      const cv = refs[cur].current;
      if (cv) {
        cv.pause();
        cv.currentTime = 0;
        // pre-carica la prossima clip nel buffer appena liberato
        if (clips.length > 1) {
          const next = (bufClip.current[nxt] + 1) % clips.length;
          if (bufClip.current[cur] !== next) {
            bufClip.current[cur] = next;
            cv.src = clips[next]!;
            cv.load();
          }
        }
      }
      fading.current = false;
    }, fadeMs);
  };

  if (reduce) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt="" aria-hidden className={className} />;
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
          poster={poster}
          aria-hidden
          onLoadedData={(e) => {
            e.currentTarget.playbackRate = rate;
          }}
          onTimeUpdate={onTime(i)}
        >
          <source src={clips[bufClip.current[i]]} type="video/mp4" />
        </video>
      ))}
    </>
  );
}
