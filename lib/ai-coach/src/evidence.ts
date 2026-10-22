export const COACH_EVIDENCE = {
  version: "acsm-2026-iusca-2021-v2",
  title: "ACSM 2026 · IUSCA 2021",
  url: "https://pubmed.ncbi.nlm.nih.gov/41843416/",
  sources: [
    { title: "ACSM · силовые тренировки, 2026", url: "https://acsm.org/resistance-training-guidelines-update-2026/" },
    { title: "IUSCA · мышечная гипертрофия, 2021", url: "https://doi.org/10.47206/ijsc.v1i1.81" },
  ],
  principles: [
    "This ACSM overview concerns healthy adults aged 18+ and interventions lasting at least six weeks; do not extrapolate it to injury rehabilitation or medical conditions.",
    "Progressive resistance training improves strength and hypertrophy. For strength, evidence favours heavier loads, 2-3 sets, prioritizing important lifts early, and at least two weekly sessions. This does not justify prescribing untested maximal weights or estimating an unknown 1RM.",
    "Higher weekly volume (at least 10 sets per muscle group) can enhance hypertrophy, but it is not a mandatory starting minimum or a reason to abruptly add volume. Consider observed training, recovery, goals and adherence; count overlapping muscle work cautiously.",
    "Training to momentary failure and a specific equipment type did not consistently improve outcomes. A feasible alternative exercise is reasonable; do not claim it is mechanically identical or transfer its weight automatically.",
    "The IUSCA 2021 hypertrophy position stand (doi:10.47206/ijsc.v1i1.81) supports hypertrophy across a broad loading spectrum, with practical advantages to moderate loads for most work. Twelve reps is not a biological ceiling. The app's agreed hypertrophy defaults are 8-12 for compound movements and 10-15 for isolation, with target RIR 2; these exact cutoffs are programming choices, not uniquely proven optima.",
    "Respect the assigned repetition ceiling. At the ceiling hold reps; a weight increase needs the app's two full comparable successful sessions with preserved technique and reserve, then one equipment step no greater than 2.5 kg and a reset to the range minimum. These are conservative product guardrails, not a protocol proven by either position stand. Calibration can use a shorter first probe; never infer that an assessed 3-rep bodyweight probe supports 8 working reps.",
    "Epley plus self-reported RIR, EMA 0.2, 28-day expiry, fatigue fitting and cross-exercise calibration coefficients are explicitly approximate model assumptions. They are not a validated personalized optimum, diagnosis or a result prescribed by ACSM/IUSCA. Use supplied calculations and report uncertainty; no formula is used for seconds, bodyweight, assistance or other equipment.",
    "These are population-level findings, not guarantees for an individual. Differentiate research findings, the user's observations, and conservative product guardrails (2.5 kg progression cap and set/time cap).",
    "Only cite the supplied ACSM and IUSCA sources for these principles. No live literature search was performed for this reply. Never invent paper titles, DOIs, citations, or claim research proves an exact personalized load. Separate (1) observed history/calculation, (2) the relevant research principle, and (3) the practical decision and its uncertainty.",
  ],
} as const;
