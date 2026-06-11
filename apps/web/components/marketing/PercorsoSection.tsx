"use client";

import { Activity, Dumbbell, Gauge, HeartPulse, Moon, UtensilsCrossed } from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// COPY (Italian) — edit the text below to change what the section says.
// ---------------------------------------------------------------------------
const COPY = {
  eyebrow: "Il metodo",
  title: "Il percorso, guidato dai dati",
  intro:
    "Empathy non si limita a misurare: traduce i tuoi numeri in un piano concreto. Ti dice COSA mangiare e QUALI esercizi fare, giorno per giorno, mantenendo allenamento e alimentazione perfettamente sincronizzati.",
  demoNote: "Dati dimostrativi — illustrazione del metodo, non valori reali.",
  cards: {
    load: {
      title: "Carico & forma",
      body:
        "Empathy bilancia fatica e recupero settimana dopo settimana: vedi crescere la forma mentre il carico resta sotto controllo, senza sovrallenamento.",
    },
    nutrition: {
      title: "Alimentazione",
      body:
        "Ogni giorno Empathy ti dice cosa mangiare: i macro (carboidrati, proteine, grassi) si adattano al carico dell'allenamento, di più nei giorni intensi.",
    },
    exercises: {
      title: "Esercizi",
      body:
        "Empathy pianifica quali esercizi fare e con quale intensità: sessioni distribuite nella settimana, dosate sul tuo livello e sugli obiettivi.",
    },
    lactate: {
      title: "Soglia & lattato",
      body:
        "Dai test e dagli allenamenti Empathy stima soglie e curva del lattato: sai a che intensità allenarti per ogni obiettivo.",
    },
    sleep: {
      title: "Sonno & recupero",
      body:
        "Sonno e segnali fisiologici diventano un punteggio di recupero: Empathy adatta i carichi per farti arrivare pronto, non stanco.",
    },
    profile: {
      title: "Profilo fisiologico",
      body:
        "Un quadro completo delle tue qualità — VO2max, soglia, resistenza, forza — per capire dove sei forte e su cosa lavorare.",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// DEMO DATA
// ---------------------------------------------------------------------------
const loadData = [
  { week: "S1", forma: 42, carico: 55 },
  { week: "S2", forma: 48, carico: 68 },
  { week: "S3", forma: 55, carico: 74 },
  { week: "S4", forma: 58, carico: 50 },
  { week: "S5", forma: 64, carico: 78 },
  { week: "S6", forma: 71, carico: 82 },
  { week: "S7", forma: 76, carico: 60 },
  { week: "S8", forma: 82, carico: 70 },
];

const nutritionData = [
  { giorno: "Lun", carbo: 320, proteine: 150, grassi: 70 },
  { giorno: "Mar", carbo: 420, proteine: 160, grassi: 75 },
  { giorno: "Mer", carbo: 280, proteine: 145, grassi: 68 },
  { giorno: "Gio", carbo: 480, proteine: 165, grassi: 78 },
  { giorno: "Ven", carbo: 300, proteine: 150, grassi: 70 },
  { giorno: "Sab", carbo: 520, proteine: 170, grassi: 80 },
  { giorno: "Dom", carbo: 240, proteine: 140, grassi: 65 },
];

const exercisesData = [
  { giorno: "Lun", intensita: 65 },
  { giorno: "Mar", intensita: 82 },
  { giorno: "Mer", intensita: 40 },
  { giorno: "Gio", intensita: 90 },
  { giorno: "Ven", intensita: 55 },
  { giorno: "Sab", intensita: 95 },
  { giorno: "Dom", intensita: 25 },
];

const lactateData = [
  { i: "60%", lattato: 1.2 },
  { i: "70%", lattato: 1.8 },
  { i: "80%", lattato: 2.6 },
  { i: "85%", lattato: 3.4 },
  { i: "90%", lattato: 5.0 },
  { i: "95%", lattato: 7.4 },
  { i: "100%", lattato: 11.2 },
];

const sleepData = [
  { giorno: "Lun", recupero: 72 },
  { giorno: "Mar", recupero: 64 },
  { giorno: "Mer", recupero: 81 },
  { giorno: "Gio", recupero: 58 },
  { giorno: "Ven", recupero: 77 },
  { giorno: "Sab", recupero: 88 },
  { giorno: "Dom", recupero: 91 },
];

const profileData = [
  { k: "VO2max", v: 88 },
  { k: "Soglia", v: 82 },
  { k: "Resistenza", v: 91 },
  { k: "Forza", v: 74 },
  { k: "Recupero", v: 79 },
  { k: "Efficienza", v: 85 },
];

// Brand palette
const PURPLE = "#a855f7";
const PINK = "#ec4899";
const ORANGE = "#f97316";

const tooltipStyle = {
  backgroundColor: "rgba(0, 0, 0, 0.9)",
  border: "1px solid rgba(168, 85, 247, 0.3)",
  borderRadius: 12,
  fontSize: 12,
} as const;

const tooltipItemStyle = { color: "#e5e7eb" } as const;
const tooltipLabelStyle = { color: "#9ca3af" } as const;

const axisProps = {
  stroke: "#6b7280",
  tick: { fill: "#9ca3af", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

const CHART_HEIGHT = 200;

interface PercorsoCardProps {
  icon: typeof Activity;
  iconGradient: string;
  title: string;
  body: string;
  delay: number;
  children: React.ReactNode;
}

function PercorsoCard({
  icon: Icon,
  iconGradient,
  title,
  body,
  delay,
  children,
}: PercorsoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay }}
      className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-colors hover:border-purple-500/40 sm:p-8"
    >
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${iconGradient} shadow-lg`}
        >
          <Icon className="h-5 w-5 text-white" aria-hidden />
        </div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>

      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-gray-400">{body}</p>
    </motion.div>
  );
}

export function PercorsoSection() {
  return (
    <section
      id="percorso"
      className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-3xl text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
          {COPY.eyebrow}
        </span>

        <h2 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
          {COPY.title}
        </h2>

        <p className="mt-5 text-base leading-relaxed text-gray-300 sm:text-lg">
          {COPY.intro}
        </p>

        <p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">
          {COPY.demoNote}
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* CARD 1 — Carico & forma */}
        <PercorsoCard
          icon={Activity}
          iconGradient="from-purple-500 to-pink-500"
          title={COPY.cards.load.title}
          body={COPY.cards.load.body}
          delay={0.05}
        >
          <AreaChart
            data={loadData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="percorsoForma" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PURPLE} stopOpacity={0.7} />
                <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="percorsoCarico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ORANGE} stopOpacity={0.5} />
                <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis {...axisProps} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ stroke: "rgba(168,85,247,0.25)" }}
            />
            <Area
              type="monotone"
              dataKey="carico"
              name="Carico"
              stroke={ORANGE}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#percorsoCarico)"
            />
            <Area
              type="monotone"
              dataKey="forma"
              name="Forma"
              stroke={PURPLE}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#percorsoForma)"
            />
          </AreaChart>
        </PercorsoCard>

        {/* CARD 2 — Alimentazione */}
        <PercorsoCard
          icon={UtensilsCrossed}
          iconGradient="from-pink-500 to-orange-500"
          title={COPY.cards.nutrition.title}
          body={COPY.cards.nutrition.body}
          delay={0.12}
        >
          <BarChart
            data={nutritionData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="giorno" {...axisProps} />
            <YAxis {...axisProps} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ fill: "rgba(168,85,247,0.08)" }}
            />
            <Bar
              dataKey="carbo"
              name="Carboidrati"
              stackId="macro"
              fill={PURPLE}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="proteine"
              name="Proteine"
              stackId="macro"
              fill={PINK}
            />
            <Bar
              dataKey="grassi"
              name="Grassi"
              stackId="macro"
              fill={ORANGE}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </PercorsoCard>

        {/* CARD 3 — Esercizi */}
        <PercorsoCard
          icon={Dumbbell}
          iconGradient="from-orange-500 to-purple-500"
          title={COPY.cards.exercises.title}
          body={COPY.cards.exercises.body}
          delay={0.19}
        >
          <BarChart
            data={exercisesData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="percorsoIntensita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.95} />
                <stop offset="100%" stopColor={PINK} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="giorno" {...axisProps} />
            <YAxis {...axisProps} width={28} domain={[0, 100]} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ fill: "rgba(168,85,247,0.08)" }}
            />
            <Bar
              dataKey="intensita"
              name="Intensità sessione"
              radius={[6, 6, 0, 0]}
            >
              {exercisesData.map((entry) => (
                <Cell
                  key={entry.giorno}
                  fill={
                    entry.intensita >= 80
                      ? "url(#percorsoIntensita)"
                      : entry.intensita >= 50
                        ? PINK
                        : PURPLE
                  }
                  fillOpacity={entry.intensita >= 50 ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </PercorsoCard>

        {/* CARD 4 — Soglia & lattato */}
        <PercorsoCard
          icon={HeartPulse}
          iconGradient="from-pink-500 to-purple-500"
          title={COPY.cards.lactate.title}
          body={COPY.cards.lactate.body}
          delay={0.26}
        >
          <AreaChart
            data={lactateData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="percorsoLattato" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PINK} stopOpacity={0.7} />
                <stop offset="95%" stopColor={PINK} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="i" {...axisProps} />
            <YAxis {...axisProps} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ stroke: "rgba(168,85,247,0.25)" }}
            />
            <Area
              type="monotone"
              dataKey="lattato"
              name="Lattato (mmol/L)"
              stroke={PINK}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#percorsoLattato)"
            />
          </AreaChart>
        </PercorsoCard>

        {/* CARD 5 — Sonno & recupero */}
        <PercorsoCard
          icon={Moon}
          iconGradient="from-purple-500 to-pink-500"
          title={COPY.cards.sleep.title}
          body={COPY.cards.sleep.body}
          delay={0.33}
        >
          <LineChart
            data={sleepData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="giorno" {...axisProps} />
            <YAxis {...axisProps} width={28} domain={[0, 100]} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ stroke: "rgba(168,85,247,0.25)" }}
            />
            <Line
              type="monotone"
              dataKey="recupero"
              name="Recupero %"
              stroke={PURPLE}
              strokeWidth={2.5}
              dot={{ r: 3, fill: PINK, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </PercorsoCard>

        {/* CARD 6 — Profilo fisiologico */}
        <PercorsoCard
          icon={Gauge}
          iconGradient="from-orange-500 to-pink-500"
          title={COPY.cards.profile.title}
          body={COPY.cards.profile.body}
          delay={0.4}
        >
          <RadarChart
            data={profileData}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            outerRadius="72%"
          >
            <PolarGrid stroke="#ffffff18" />
            <PolarAngleAxis dataKey="k" tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Profilo"
              dataKey="v"
              stroke={PINK}
              fill={PINK}
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
          </RadarChart>
        </PercorsoCard>
      </div>
    </section>
  );
}
