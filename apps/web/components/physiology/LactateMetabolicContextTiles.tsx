"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Bug,
  ChevronDown,
  Dna,
  Flame,
  HeartPulse,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import type { SupportedSport } from "@/lib/engines/vo2-estimator";

export type Vo2InputMode = "device" | "test";
export type RerInputMode = "auto" | "manual";
export type MicrobiotaSourceMode = "health_bio" | "preset" | "manual";
export type DysbiosisPreset = "eubiosi" | "lieve" | "moderata" | "severa" | "grave";

type OpenKey = "sport" | "vo2" | "rer" | "micro" | "dys" | "fatox" | null;

const SPORT_OPTS: { v: SupportedSport; labelKey: string }[] = [
  { v: "cycling", labelKey: "sportCycling" },
  { v: "running", labelKey: "sportRunning" },
  { v: "swimming", labelKey: "sportSwimming" },
  { v: "xc_ski", labelKey: "sportXcSki" },
];

export function LactateMetabolicContextTiles({
  lactateSport,
  setLactateSport,
  lactateVo2Mode,
  setLactateVo2Mode,
  lactateRerMode,
  setLactateRerMode,
  microbiotaSourceMode,
  setMicrobiotaSourceMode,
  dysbiosisPreset,
  setDysbiosisPreset,
  fatOxAdaptation,
  setFatOxAdaptation,
  hasHealthMicrobiotaProfile,
  lactateVo2Used,
  lactateVo2EstL,
  lactateVo2MlKg,
}: {
  lactateSport: SupportedSport;
  setLactateSport: (v: SupportedSport) => void;
  lactateVo2Mode: Vo2InputMode;
  setLactateVo2Mode: (v: Vo2InputMode) => void;
  lactateRerMode: RerInputMode;
  setLactateRerMode: (v: RerInputMode) => void;
  microbiotaSourceMode: MicrobiotaSourceMode;
  setMicrobiotaSourceMode: (v: MicrobiotaSourceMode) => void;
  dysbiosisPreset: DysbiosisPreset;
  setDysbiosisPreset: (v: DysbiosisPreset) => void;
  fatOxAdaptation: number;
  setFatOxAdaptation: (v: number) => void;
  hasHealthMicrobiotaProfile: boolean;
  lactateVo2Used: number;
  lactateVo2EstL: number;
  lactateVo2MlKg: number;
}) {
  const t = useTranslations("LactateMetabolicContextTiles");
  const [open, setOpen] = useState<OpenKey>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  function sportLabel(s: SupportedSport) {
    const opt = SPORT_OPTS.find((o) => o.v === s);
    return opt ? t(opt.labelKey) : s;
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(k: OpenKey) {
    setOpen((cur) => (cur === k ? null : k));
  }

  const vo2Label = lactateVo2Mode === "device" ? t("vo2FromDevice") : t("vo2FromTest");
  const rerLabel = lactateRerMode === "auto" ? t("rerAutoFtp") : t("rerManual");
  const microLabels: Record<MicrobiotaSourceMode, string> = {
    health_bio: t("microHealthBio"),
    preset: t("microPreset"),
    manual: t("microManual"),
  };
  const dysLabels: Record<DysbiosisPreset, string> = {
    eubiosi: t("dysEubiosi"),
    lieve: t("dysLieve"),
    moderata: t("dysModerata"),
    severa: t("dysSevera"),
    grave: t("dysGrave"),
  };

  return (
    <div className="physiology-pro2-ctx-shell" ref={shellRef}>
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-metabolism">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>{t("banner")}</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-ctx-grid">
        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--indigo${open === "sport" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("sport")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <Layers className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileSport")}</span>
          <span className="physiology-pro2-ctx-tile-v">{sportLabel(lactateSport)}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--cyan${open === "vo2" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("vo2")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <HeartPulse className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileVo2Source")}</span>
          <span className="physiology-pro2-ctx-tile-v">{vo2Label}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--violet${open === "rer" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("rer")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <Flame className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileRerSource")}</span>
          <span className="physiology-pro2-ctx-tile-v">{rerLabel}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--amber${open === "micro" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("micro")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <Bug className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileMicrobiota")}</span>
          <span className="physiology-pro2-ctx-tile-v">{microLabels[microbiotaSourceMode]}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--rose${open === "dys" ? " physiology-pro2-ctx-tile--open" : ""}${microbiotaSourceMode !== "preset" ? " physiology-pro2-ctx-tile--dim" : ""}`}
          onClick={() => microbiotaSourceMode === "preset" && toggle("dys")}
          disabled={microbiotaSourceMode !== "preset"}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <Dna className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileDysbiosis")}</span>
          <span className="physiology-pro2-ctx-tile-v">{dysLabels[dysbiosisPreset]}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--emerald${open === "fatox" ? " physiology-pro2-ctx-tile--open" : ""}${lactateRerMode !== "auto" ? " physiology-pro2-ctx-tile--dim" : ""}`}
          onClick={() => lactateRerMode === "auto" && toggle("fatox")}
          disabled={lactateRerMode !== "auto"}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <SlidersHorizontal className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">{t("tileFatOxAdapt")}</span>
          <span className="physiology-pro2-ctx-tile-v">{fatOxAdaptation.toFixed(2)}</span>
        </button>
      </div>

      {open === "sport" ? (
        <div className="physiology-pro2-ctx-options">
          {SPORT_OPTS.map((o) => (
            <button
              key={o.v}
              type="button"
              className={`physiology-pro2-ctx-opt${lactateSport === o.v ? " physiology-pro2-ctx-opt--on" : ""}`}
              onClick={() => {
                setLactateSport(o.v);
                setOpen(null);
              }}
            >
              {t(o.labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {open === "vo2" ? (
        <div className="physiology-pro2-ctx-options">
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${lactateVo2Mode === "device" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setLactateVo2Mode("device");
              setOpen(null);
            }}
          >
            {t("vo2OptDevice")}
          </button>
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${lactateVo2Mode === "test" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setLactateVo2Mode("test");
              setOpen(null);
            }}
          >
            {t("vo2OptTest")}
          </button>
        </div>
      ) : null}

      {open === "rer" ? (
        <div className="physiology-pro2-ctx-options">
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${lactateRerMode === "auto" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setLactateRerMode("auto");
              setOpen(null);
            }}
          >
            {t("rerOptAuto")}
          </button>
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${lactateRerMode === "manual" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setLactateRerMode("manual");
              setOpen(null);
            }}
          >
            {t("rerOptManual")}
          </button>
        </div>
      ) : null}

      {open === "micro" ? (
        <div className="physiology-pro2-ctx-options">
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${microbiotaSourceMode === "health_bio" ? " physiology-pro2-ctx-opt--on" : ""}`}
            disabled={!hasHealthMicrobiotaProfile}
            onClick={() => {
              if (!hasHealthMicrobiotaProfile) return;
              setMicrobiotaSourceMode("health_bio");
              setOpen(null);
            }}
          >
            {t("microOptHealthBioTest")} {hasHealthMicrobiotaProfile ? "" : t("microOptNotAvailable")}
          </button>
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${microbiotaSourceMode === "preset" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setMicrobiotaSourceMode("preset");
              setOpen(null);
            }}
          >
            {t("microOptPreset")}
          </button>
          <button
            type="button"
            className={`physiology-pro2-ctx-opt${microbiotaSourceMode === "manual" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setMicrobiotaSourceMode("manual");
              setOpen(null);
            }}
          >
            {t("microOptManual")}
          </button>
        </div>
      ) : null}

      {open === "dys" ? (
        <div className="physiology-pro2-ctx-options">
          {(Object.keys(dysLabels) as DysbiosisPreset[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`physiology-pro2-ctx-opt${dysbiosisPreset === k ? " physiology-pro2-ctx-opt--on" : ""}`}
              onClick={() => {
                setDysbiosisPreset(k);
                setOpen(null);
              }}
            >
              {dysLabels[k]}
            </button>
          ))}
        </div>
      ) : null}

      {open === "fatox" ? (
        <div className="physiology-pro2-ctx-fatox">
          <label className="physiology-pro2-ctx-fatox-lab" htmlFor="lac-fatox-range">
            {t("fatoxRangeLabel")}
          </label>
          <input
            id="lac-fatox-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={fatOxAdaptation}
            onChange={(e) => setFatOxAdaptation(Number(e.target.value))}
            className="physiology-pro2-ctx-fatox-range"
          />
          <div className="physiology-pro2-ctx-fatox-readout">{fatOxAdaptation.toFixed(2)}</div>
        </div>
      ) : null}

      <div className="physiology-pro2-ctx-vo2-card">
        <HeartPulse className="physiology-pro2-ctx-vo2-ico" aria-hidden />
        <div className="physiology-pro2-ctx-vo2-copy">
          <span className="physiology-pro2-ctx-vo2-k">{t("vo2UsedInModel")}</span>
          <span className="physiology-pro2-ctx-vo2-main">{lactateVo2Used.toFixed(2)} L/min</span>
          <span className="physiology-pro2-ctx-vo2-sub">
            {t("vo2EstimatedSub", { est: lactateVo2EstL.toFixed(2), mlkg: lactateVo2MlKg.toFixed(1) })}
          </span>
        </div>
      </div>
    </div>
  );
}
