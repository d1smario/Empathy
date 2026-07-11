import { getTranslations } from "next-intl/server";
import { Reveal } from "./Reveal";
import { TrainingChart } from "./graphics/TrainingChart";
import { NutritionMacros } from "./graphics/NutritionMacros";
import { PhysiologyChart } from "./graphics/PhysiologyChart";
import { MiniTwin } from "./graphics/MiniTwin";

/**
 * "Cosa ottieni davvero" — sezione unica che fonde showcase + moduli: ogni modulo
 * (allenamento, nutrizione, fisiologia, twin) mostrato con il suo grafico reale.
 */
export async function VetrinaOutcomes() {
  const t = await getTranslations("Vetrina.how");

  const units = [
    {
      title: "moduleTrainingTitle",
      body: "moduleTrainingBody",
      accent: "text-pink-300",
      visual: <TrainingChart labels={{ trainingTitle: t("g.trainingTitle"), power: t("g.power"), hr: t("g.hr") }} />,
    },
    {
      title: "moduleNutritionTitle",
      body: "moduleNutritionBody",
      accent: "text-cyan-300",
      visual: (
        <NutritionMacros
          labels={{ nutritionTitle: t("g.nutritionTitle"), carbs: t("g.carbs"), protein: t("g.protein"), fat: t("g.fat"), calories: t("g.calories") }}
        />
      ),
    },
    {
      title: "modulePhysiologyTitle",
      body: "modulePhysiologyBody",
      accent: "text-violet-300",
      visual: <PhysiologyChart labels={{ physioTitle: t("g.physioTitle"), lactate: t("g.lactate"), threshold: t("g.threshold"), power: t("g.power") }} />,
    },
    {
      title: "moduleTwinTitle",
      body: "moduleTwinBody",
      accent: "text-amber-300",
      visual: <MiniTwin labels={{ twinTitle: t("g.twinTitle"), readiness: t("g.readiness"), load: t("g.load"), recovery: t("g.recovery") }} />,
    },
  ];

  return (
    <section className="mt-28">
      <Reveal className="text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("showcaseTitle")}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">{t("showcaseSub")}</p>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-5xl gap-x-8 gap-y-14 md:grid-cols-2">
        {units.map((u, i) => (
          <Reveal key={u.title} delay={(i % 2) * 90}>
            <div>
              <h3 className={`text-lg font-black tracking-tight ${u.accent}`}>{t(u.title)}</h3>
              <p className="mt-1.5 mb-5 max-w-md text-sm leading-relaxed text-gray-400">{t(u.body)}</p>
              {u.visual}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
