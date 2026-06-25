"use client";

import { useState } from "react";
import type { SupportedSport } from "@/lib/engines/vo2-estimator";
import type { SegmentAttachmentMeta } from "@/components/physiology/LactateAnalysisDataSourcesCard";
import { LACTATE_DEFAULT_INPUT, type RerInputMode, type Vo2InputMode } from "@/modules/physiology/lib/metabolic-lab-kit";

/**
 * Stato locale dell'analisi lattato, co-locato fuori da PhysiologyPageView
 * (decomposizione God-component, fetta 4 — step 1: stato in hook). Solo stato
 * esclusivo del lattato (input, sport, modalità VO2/RER, allegato segmento,
 * tick/timestamp di ricalcolo). Il calcolo resta per ora nella view e legge
 * questi valori invariati. Maxox/profile hanno il proprio stato separato.
 */
export function useLactateLabState() {
  const [lactateInput, setLactateInput] = useState({ ...LACTATE_DEFAULT_INPUT });
  const [lactateSport, setLactateSport] = useState<SupportedSport>("cycling");
  const [lactateVo2Mode, setLactateVo2Mode] = useState<Vo2InputMode>("device");
  const [lactateRerMode, setLactateRerMode] = useState<RerInputMode>("auto");
  const [lactateSegmentAttachment, setLactateSegmentAttachment] = useState<SegmentAttachmentMeta>(null);
  const [lactateCalcTick, setLactateCalcTick] = useState(0);
  const [lactateLastRecalcAt, setLactateLastRecalcAt] = useState<number | null>(null);

  return {
    lactateInput,
    setLactateInput,
    lactateSport,
    setLactateSport,
    lactateVo2Mode,
    setLactateVo2Mode,
    lactateRerMode,
    setLactateRerMode,
    lactateSegmentAttachment,
    setLactateSegmentAttachment,
    lactateCalcTick,
    setLactateCalcTick,
    lactateLastRecalcAt,
    setLactateLastRecalcAt,
  };
}
