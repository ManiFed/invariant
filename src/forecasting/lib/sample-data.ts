/**
 * Sample forecasting questions and drill data for the app.
 * These are used for demos and the practice environment.
 */

import type { Forecast } from "./scoring";

export interface ForecastQuestion {
  id: string;
  question: string;
  description: string;
  category: string;
  resolutionDate: string;
  resolutionCriteria: string;
  crowdMedian?: number;
}

export const FORECAST_CATEGORIES = [
  "Economics",
  "Technology",
  "Geopolitics",
  "Science",
  "Policy",
  "Climate",
] as const;

export const SAMPLE_QUESTIONS: ForecastQuestion[] = [
  {
    id: "q1",
    question: "Will US CPI year-over-year exceed 3% in June 2026?",
    description:
      "Based on the Bureau of Labor Statistics Consumer Price Index report for June 2026. Resolves YES if the all-items CPI-U 12-month percentage change exceeds 3.0%.",
    category: "Economics",
    resolutionDate: "2026-07-15",
    resolutionCriteria: "BLS CPI-U 12-month change > 3.0%",
    crowdMedian: 0.32,
  },
  {
    id: "q2",
    question: "Will a major AI lab announce a model scoring >90% on ARC-AGI by end of 2026?",
    description:
      "Resolves YES if OpenAI, Anthropic, Google DeepMind, or Meta publicly announce a model achieving above 90% accuracy on ARC-AGI evaluation before December 31, 2026.",
    category: "Technology",
    resolutionDate: "2026-12-31",
    resolutionCriteria: "Public announcement with verified benchmark result",
    crowdMedian: 0.45,
  },
  {
    id: "q3",
    question: "Will the EU implement a carbon border tax by Q3 2026?",
    description:
      "Resolves YES if the EU Carbon Border Adjustment Mechanism begins collecting payments on imported goods by September 30, 2026.",
    category: "Policy",
    resolutionDate: "2026-09-30",
    resolutionCriteria: "Official EU implementation of CBAM payment collection",
    crowdMedian: 0.68,
  },
  {
    id: "q4",
    question: "Will global mean temperature anomaly for 2026 exceed +1.5°C above pre-industrial baseline?",
    description:
      "Based on NASA GISS or HadCRUT5 annual global mean temperature anomaly for calendar year 2026 relative to 1850-1900 baseline.",
    category: "Climate",
    resolutionDate: "2027-01-31",
    resolutionCriteria: "NASA GISS or HadCRUT5 annual mean > 1.5°C",
    crowdMedian: 0.55,
  },
  {
    id: "q5",
    question: "Will a new antibiotic class receive FDA approval in 2026?",
    description:
      "Resolves YES if the FDA approves a New Drug Application for an antibiotic belonging to a novel chemical class (not a derivative of existing classes) before December 31, 2026.",
    category: "Science",
    resolutionDate: "2026-12-31",
    resolutionCriteria: "FDA NDA approval for novel antibiotic class",
    crowdMedian: 0.12,
  },
  {
    id: "q6",
    question: "Will any country formally leave a major international organization in 2026?",
    description:
      "Resolves YES if any UN member state formally withdraws from the UN, NATO, EU, WTO, or WHO during calendar year 2026. Formal withdrawal means completed legal process, not merely announced intent.",
    category: "Geopolitics",
    resolutionDate: "2026-12-31",
    resolutionCriteria: "Completed formal withdrawal from specified organization",
    crowdMedian: 0.08,
  },
  {
    id: "q7",
    question: "Will the US Federal Reserve cut rates to below 4% by end of 2026?",
    description:
      "Resolves YES if the Federal Funds target rate upper bound is below 4.00% at any point before December 31, 2026.",
    category: "Economics",
    resolutionDate: "2026-12-31",
    resolutionCriteria: "FOMC rate decision sets upper bound < 4.00%",
    crowdMedian: 0.41,
  },
  {
    id: "q8",
    question: "Will a commercially available quantum computer solve an optimization problem faster than classical alternatives by end of 2026?",
    description:
      "Resolves YES if a peer-reviewed paper or credible industry benchmark demonstrates practical quantum advantage on a real-world optimization problem (not a contrived benchmark).",
    category: "Technology",
    resolutionDate: "2026-12-31",
    resolutionCriteria: "Peer-reviewed demonstration of practical quantum advantage",
    crowdMedian: 0.18,
  },
];

export interface BaseRateDrill {
  id: string;
  question: string;
  hint: string;
  actualRate: number;
  source: string;
}

export const BASE_RATE_DRILLS: BaseRateDrill[] = [
  {
    id: "br1",
    question: "What percentage of startups that receive Series A funding eventually reach a successful exit (IPO or acquisition >$100M)?",
    hint: "Think about the typical venture capital funnel.",
    actualRate: 0.15,
    source: "CB Insights venture capital analysis",
  },
  {
    id: "br2",
    question: "What percentage of Phase II clinical drug trials succeed and advance to Phase III?",
    hint: "Drug development is notoriously difficult. Most candidates fail.",
    actualRate: 0.30,
    source: "BIO Clinical Development Success Rates",
  },
  {
    id: "br3",
    question: "What percentage of UN General Assembly resolutions are adopted by consensus (without a vote)?",
    hint: "The UN often seeks consensus before bringing resolutions to vote.",
    actualRate: 0.75,
    source: "UN General Assembly records",
  },
  {
    id: "br4",
    question: "What percentage of technology predictions made by experts for 10+ years out prove accurate?",
    hint: "Consider how often expert predictions about technology timelines are correct.",
    actualRate: 0.20,
    source: "Tetlock, Expert Political Judgment (2005)",
  },
  {
    id: "br5",
    question: "What percentage of new restaurants survive past their first three years?",
    hint: "Restaurant failure rates are commonly discussed but often exaggerated.",
    actualRate: 0.40,
    source: "Bureau of Labor Statistics Business Employment Dynamics",
  },
  {
    id: "br6",
    question: "What percentage of economic recessions in the US since 1945 lasted less than 12 months?",
    hint: "Most post-war recessions have been relatively short.",
    actualRate: 0.73,
    source: "NBER Business Cycle Dating Committee",
  },
];

export interface UpdateDrill {
  id: string;
  scenario: string;
  initialContext: string;
  updates: { evidence: string; suggestedShift: string }[];
  baseRate: number;
}

export const UPDATE_DRILLS: UpdateDrill[] = [
  {
    id: "ud1",
    scenario: "Company X will be acquired within 12 months",
    initialContext:
      "Company X is a mid-cap SaaS company with $200M ARR, growing at 25% YoY. They recently hired a new CFO from an investment bank. The sector has seen 3 major acquisitions in the past year.",
    baseRate: 0.08,
    updates: [
      {
        evidence: "A major enterprise software company has been reported as exploring strategic acquisitions in this sector.",
        suggestedShift: "Moderate increase. A motivated buyer in the sector raises the probability, but many explorations don't lead to deals.",
      },
      {
        evidence: "Company X's CEO sold 40% of their personal stock holdings last quarter.",
        suggestedShift: "Slight increase. Insider selling can indicate preparation for a deal, but also has many benign explanations.",
      },
      {
        evidence: "Company X just announced a major new product launch and 3-year strategic roadmap.",
        suggestedShift: "Decrease. Companies preparing for acquisition typically don't invest heavily in long-term independent strategy.",
      },
    ],
  },
  {
    id: "ud2",
    scenario: "Country Y will experience a sovereign debt crisis within 2 years",
    initialContext:
      "Country Y has a debt-to-GDP ratio of 85%, a current account deficit of 4%, and recently experienced a 15% currency depreciation. Inflation is running at 8%. The central bank has raised rates three times this year.",
    baseRate: 0.12,
    updates: [
      {
        evidence: "The IMF has downgraded Country Y's growth forecast from 3% to 1.2%.",
        suggestedShift: "Significant increase. Lower growth makes debt servicing harder and IMF downgrades often precede crises.",
      },
      {
        evidence: "Country Y has secured a $10B bilateral swap line with a major economy.",
        suggestedShift: "Decrease. Swap lines provide foreign exchange buffers that can prevent liquidity crises from becoming solvency crises.",
      },
      {
        evidence: "The country's largest export commodity has dropped 30% in price over the past quarter.",
        suggestedShift: "Significant increase. Commodity-dependent economies are highly vulnerable to terms-of-trade shocks.",
      },
    ],
  },
];

export interface CalibrationQuestion {
  id: string;
  question: string;
  answer: string;
  answerValue?: number;
  type: "true-false" | "numeric-range";
}

export const CALIBRATION_QUESTIONS: CalibrationQuestion[] = [
  { id: "cq1", question: "The Great Wall of China is visible from space with the naked eye.", answer: "False", type: "true-false" },
  { id: "cq2", question: "There are more trees on Earth than stars in the Milky Way.", answer: "True", type: "true-false" },
  { id: "cq3", question: "The Amazon River is the longest river in the world.", answer: "False", type: "true-false" },
  { id: "cq4", question: "Sound travels faster through water than through air.", answer: "True", type: "true-false" },
  { id: "cq5", question: "Napoleon Bonaparte was shorter than the average Frenchman of his time.", answer: "False", type: "true-false" },
  { id: "cq6", question: "The human body contains more bacterial cells than human cells.", answer: "True", type: "true-false" },
  { id: "cq7", question: "Lightning never strikes the same place twice.", answer: "False", type: "true-false" },
  { id: "cq8", question: "Goldfish have a memory span of only about 3 seconds.", answer: "False", type: "true-false" },
  { id: "cq9", question: "The Sahara Desert is the largest desert on Earth.", answer: "False", type: "true-false" },
  { id: "cq10", question: "Humans and bananas share approximately 60% of their DNA.", answer: "True", type: "true-false" },
  { id: "cq11", question: "Octopuses have three hearts.", answer: "True", type: "true-false" },
  { id: "cq12", question: "Mount Everest is the tallest mountain measured from base to peak.", answer: "False", type: "true-false" },
  { id: "cq13", question: "There are more possible chess games than atoms in the observable universe.", answer: "True", type: "true-false" },
  { id: "cq14", question: "Diamonds are made of compressed coal.", answer: "False", type: "true-false" },
  { id: "cq15", question: "Venus rotates in the opposite direction to most other planets.", answer: "True", type: "true-false" },
  { id: "cq16", question: "A group of flamingos is called a 'flamboyance'.", answer: "True", type: "true-false" },
  { id: "cq17", question: "The speed of light is approximately 300,000 km per second.", answer: "True", type: "true-false" },
  { id: "cq18", question: "Antibiotics are effective against viruses.", answer: "False", type: "true-false" },
  { id: "cq19", question: "The Atlantic Ocean is wider than the Pacific Ocean.", answer: "False", type: "true-false" },
  { id: "cq20", question: "Honey never spoils.", answer: "True", type: "true-false" },
];

export interface DecompositionExercise {
  id: string;
  mainQuestion: string;
  description: string;
  subQuestions: { question: string; hint: string }[];
}

export const DECOMPOSITION_EXERCISES: DecompositionExercise[] = [
  {
    id: "de1",
    mainQuestion: "Will autonomous vehicles reach Level 5 deployment in a major US city by 2030?",
    description:
      "Break this complex question into component probabilities. Consider the technical, regulatory, and commercial factors that must all align.",
    subQuestions: [
      { question: "Will the core self-driving technology achieve Level 5 capability by 2030?", hint: "Consider current state of perception, planning, and edge case handling." },
      { question: "Will federal and state regulations permit fully autonomous deployment?", hint: "Consider the pace of regulatory change and political dynamics." },
      { question: "Will at least one company have the commercial incentive and capital to deploy?", hint: "Consider business model viability and investment trends." },
      { question: "Will public acceptance and insurance frameworks support deployment?", hint: "Consider liability questions and public perception of safety." },
    ],
  },
  {
    id: "de2",
    mainQuestion: "Will nuclear fusion deliver net energy to a commercial power grid by 2035?",
    description:
      "Decompose this into the scientific, engineering, economic, and political components that must succeed.",
    subQuestions: [
      { question: "Will sustained Q>10 plasma be achieved in a reactor-relevant configuration?", hint: "Consider progress at ITER, NIF, and private fusion companies." },
      { question: "Will engineering challenges (materials, tritium breeding, heat extraction) be solved?", hint: "The jump from scientific demonstration to engineering viability is enormous." },
      { question: "Will the economics be competitive with renewables + storage?", hint: "Consider the rapidly declining costs of solar and battery storage." },
      { question: "Will regulatory frameworks for commercial fusion exist?", hint: "Fusion regulation is still largely undefined in most countries." },
    ],
  },
];

/** Generate sample resolved forecasts for demo skill profile. */
export function generateSampleForecasts(): Forecast[] {
  const now = new Date().toISOString();
  const makeDate = (daysAgo: number) =>
    new Date(Date.now() - daysAgo * 86400000).toISOString();

  return [
    { id: "sf1", question: "Will BTC exceed $100k in Q4 2025?", description: "", category: "Economics", probability: 0.65, resolutionDate: "2025-12-31", resolved: true, outcome: true, createdAt: makeDate(120), updatedAt: makeDate(5), revisions: [{ probability: 0.45, timestamp: makeDate(120) }, { probability: 0.55, timestamp: makeDate(80) }, { probability: 0.65, timestamp: makeDate(30) }] },
    { id: "sf2", question: "Will GPT-5 be released before July 2025?", description: "", category: "Technology", probability: 0.70, resolutionDate: "2025-07-01", resolved: true, outcome: false, createdAt: makeDate(200), updatedAt: makeDate(60), revisions: [{ probability: 0.80, timestamp: makeDate(200) }, { probability: 0.70, timestamp: makeDate(100) }] },
    { id: "sf3", question: "Will US unemployment stay below 4.5% through Q1 2026?", description: "", category: "Economics", probability: 0.60, resolutionDate: "2026-03-31", resolved: true, outcome: true, createdAt: makeDate(180), updatedAt: makeDate(10), revisions: [{ probability: 0.55, timestamp: makeDate(180) }, { probability: 0.60, timestamp: makeDate(90) }] },
    { id: "sf4", question: "Will EU pass comprehensive AI regulation by end 2025?", description: "", category: "Policy", probability: 0.85, resolutionDate: "2025-12-31", resolved: true, outcome: true, createdAt: makeDate(300), updatedAt: makeDate(30), revisions: [{ probability: 0.60, timestamp: makeDate(300) }, { probability: 0.75, timestamp: makeDate(200) }, { probability: 0.85, timestamp: makeDate(60) }] },
    { id: "sf5", question: "Will a Category 5 hurricane hit the US East Coast in 2025?", description: "", category: "Climate", probability: 0.15, resolutionDate: "2025-11-30", resolved: true, outcome: false, createdAt: makeDate(250), updatedAt: makeDate(50), revisions: [{ probability: 0.15, timestamp: makeDate(250) }] },
    { id: "sf6", question: "Will there be a new OPEC production cut in H1 2025?", description: "", category: "Economics", probability: 0.40, resolutionDate: "2025-06-30", resolved: true, outcome: true, createdAt: makeDate(280), updatedAt: makeDate(90), revisions: [{ probability: 0.30, timestamp: makeDate(280) }, { probability: 0.40, timestamp: makeDate(140) }] },
    { id: "sf7", question: "Will lab-grown meat receive USDA approval for retail sale in 2025?", description: "", category: "Science", probability: 0.25, resolutionDate: "2025-12-31", resolved: true, outcome: false, createdAt: makeDate(350), updatedAt: makeDate(40), revisions: [{ probability: 0.35, timestamp: makeDate(350) }, { probability: 0.25, timestamp: makeDate(150) }] },
    { id: "sf8", question: "Will India's GDP growth exceed 7% in fiscal year 2025-26?", description: "", category: "Economics", probability: 0.45, resolutionDate: "2026-03-31", resolved: true, outcome: false, createdAt: makeDate(200), updatedAt: makeDate(20), revisions: [{ probability: 0.50, timestamp: makeDate(200) }, { probability: 0.45, timestamp: makeDate(100) }] },
  ];
}

export const LESSON_MODULES = [
  {
    id: "m1",
    title: "What Probabilities Mean",
    description: "Learn what different probability levels represent in real-world terms.",
    lessons: [
      "A 10% probability means roughly 1 in 10. If you assign 10% to many events, about 1 in 10 should actually happen.",
      "A 50% probability isn't 'I don't know.' It's a precise claim: this is as likely to happen as not.",
      "90% still means 1 in 10 times you're wrong. If you say 90% to 100 things and are never wrong, you were underconfident.",
      "Distinguishing 60% from 70% from 80% is a core skill. Each represents a meaningfully different level of confidence.",
    ],
  },
  {
    id: "m2",
    title: "Base Rates and Reference Classes",
    description: "How to anchor your predictions in historical data before adjusting.",
    lessons: [
      "Before considering any unique details, ask: how often does this type of thing happen? That's your base rate.",
      "The 'inside view' focuses on the specifics of a case. The 'outside view' asks how similar cases turned out historically.",
      "Most people neglect base rates. They focus on narratives and specifics while ignoring statistical regularity.",
      "A good forecaster starts with the base rate and adjusts. They don't start from scratch each time.",
    ],
  },
  {
    id: "m3",
    title: "Updating with Evidence",
    description: "How to revise probabilities when new information arrives.",
    lessons: [
      "When new evidence appears, you should update your probability. The direction and magnitude depend on how diagnostic the evidence is.",
      "Diagnostic evidence is evidence that is much more likely under one hypothesis than another. A positive test result from a 99%-accurate test is highly diagnostic.",
      "Many people either don't update enough (anchoring) or overreact to single data points. Both are calibration failures.",
      "Bayes' theorem provides the mathematically optimal way to update. But even rough intuitive updating beats not updating at all.",
    ],
  },
  {
    id: "m4",
    title: "Decomposition",
    description: "Break complex questions into simpler, estimable components.",
    lessons: [
      "Complex events often require multiple things to go right. Estimating each component separately improves accuracy.",
      "If an event requires A AND B AND C, and each has probability 0.7, the joint probability is 0.7³ ≈ 0.34—much lower than any individual component.",
      "Fermi estimation is decomposition applied to quantities. Break 'how many piano tuners in Chicago?' into population × piano ownership rate × tuning frequency ÷ tuners' capacity.",
      "Decomposition also reveals your uncertainty. If you can't estimate a sub-component, that's valuable information about what you don't know.",
    ],
  },
  {
    id: "m5",
    title: "Cognitive Biases in Forecasting",
    description: "Common mental traps and how to recognize them.",
    lessons: [
      "Anchoring: your first estimate disproportionately influences your final answer, even when it's arbitrary.",
      "Availability bias: events that are easy to recall (recent, vivid, emotional) seem more probable than they are.",
      "Confirmation bias: you seek and overweight evidence that confirms what you already believe.",
      "Narrative bias: coherent stories feel more probable than they should. A detailed scenario always has lower probability than a general one.",
    ],
  },
  {
    id: "m6",
    title: "Calibration and Scoring",
    description: "Understanding how forecasting accuracy is measured.",
    lessons: [
      "Calibration means your probabilities match reality. Of all the things you say are 70% likely, about 70% should happen.",
      "The Brier score measures accuracy: (forecast - outcome)². A score of 0 is perfect. 0.25 is the score of always guessing 50%.",
      "The log score penalizes confident wrong predictions more heavily. Saying 99% and being wrong is much worse than saying 60% and being wrong.",
      "Track your scores over time. Improvement in forecasting is real and measurable, but only with consistent feedback.",
    ],
  },
];
