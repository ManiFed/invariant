// Course content for the guided Teaching Lab

export type StepType = "lesson" | "quiz";

export interface LessonStep {
  type: "lesson";
  title: string;
  content: string[];
  visual?: "pool-intro" | "reserves-diagram" | "curve-preview" | "trade-animation" | "il-diagram" | "arb-diagram" | "fees-diagram";
}

export interface QuizStep {
  type: "quiz";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type CourseStep = LessonStep | QuizStep;

export interface CourseModule {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  steps: CourseStep[];
  reveals: string[]; // dashboard sections revealed after completing this module
}

export const COURSE_MODULES: CourseModule[] = [
  {
    id: "intro",
    title: "What is an AMM?",
    subtitle: "The basics of automated market making",
    emoji: "🌊",
    reveals: [],
    steps: [
      {
        type: "lesson",
        title: "Welcome to the AMM Teaching Lab",
        content: [
          "This interactive course will teach you how Automated Market Makers (AMMs) work — from scratch.",
          "An AMM is a smart contract that holds two tokens and lets anyone trade between them. There's no order book, no matching engine, no human market maker.",
          "Instead, a mathematical formula determines the price. The formula uses the amounts of each token in the pool (called \"reserves\") to calculate how much of one token you get for the other.",
        ],
        visual: "pool-intro",
      },
      {
        type: "quiz",
        question: "What determines the price in an AMM?",
        options: ["A human market maker", "A mathematical formula using token reserves", "The last trade price on a centralized exchange"],
        correctIndex: 1,
        explanation: "AMMs use a mathematical formula based on the current reserves of each token to determine prices automatically — no humans or order books needed.",
      },
      {
        type: "lesson",
        title: "Why do AMMs exist?",
        content: [
          "Traditional exchanges use order books: buyers and sellers post limit orders, and a matching engine pairs them up.",
          "This works well — but it requires active market makers with lots of capital and sophisticated strategies.",
          "AMMs replace all of that with a simple formula. Anyone can deposit tokens to provide liquidity, and anyone can trade against the pool. It's fully permissionless and automatic.",
        ],
      },
      {
        type: "quiz",
        question: "What does an AMM replace?",
        options: ["The blockchain itself", "Order books and human market makers", "Token smart contracts"],
        correctIndex: 1,
        explanation: "AMMs replace the traditional order book model. Instead of matching buyers with sellers, a formula automatically provides liquidity and determines prices.",
      },
    ],
  },
  {
    id: "reserves",
    title: "Understanding Reserves",
    subtitle: "The tokens inside the pool",
    emoji: "🏦",
    reveals: ["reserves"],
    steps: [
      {
        type: "lesson",
        title: "What are Reserves?",
        content: [
          "A liquidity pool holds two tokens. The amount of each token in the pool is called its \"reserve\".",
          "For example, a pool might hold 1,000 ETH (Reserve X) and 1,000,000 USDC (Reserve Y).",
          "When someone trades, they add one token and remove the other. This changes the reserves — and therefore changes the price.",
        ],
        visual: "reserves-diagram",
      },
      {
        type: "quiz",
        question: "If a trader buys ETH from the pool, what happens to the reserves?",
        options: ["Both increase", "ETH reserve decreases, USDC reserve increases", "Nothing changes"],
        correctIndex: 1,
        explanation: "The trader takes ETH out (decreasing its reserve) and puts USDC in (increasing its reserve). Reserves always move in opposite directions during a trade.",
      },
      {
        type: "lesson",
        title: "The Constant Product",
        content: [
          "The most common AMM formula is: x × y = k",
          "x is the reserve of token X, y is the reserve of token Y, and k is a constant that never changes.",
          "This means: when one reserve goes down, the other must go up to keep the product the same. This is what creates the pricing mechanism.",
        ],
      },
      {
        type: "quiz",
        question: "If a pool has x=1000, y=1000, what is k?",
        options: ["2,000", "1,000,000", "1,000"],
        correctIndex: 1,
        explanation: "k = x × y = 1,000 × 1,000 = 1,000,000. This product must remain constant through all trades (before fees).",
      },
      {
        type: "quiz",
        question: "If x drops to 500, what must y become to maintain k = 1,000,000?",
        options: ["500", "1,500", "2,000"],
        correctIndex: 2,
        explanation: "If x = 500, then y = k/x = 1,000,000/500 = 2,000. The reserves shifted dramatically — the pool now holds much more Y.",
      },
    ],
  },
  {
    id: "price",
    title: "How Price Works",
    subtitle: "Reading the constant product curve",
    emoji: "📈",
    reveals: ["curve"],
    steps: [
      {
        type: "lesson",
        title: "Price on the Curve",
        content: [
          "The price of X in terms of Y is simply: Price = y / x",
          "When a pool has 1,000 X and 1,000 Y, the price is 1,000/1,000 = 1.0 — one X equals one Y.",
          "The constant product formula creates a curve. The current position on this curve tells you the current price. Moving along the curve IS what trading is.",
        ],
        visual: "curve-preview",
      },
      {
        type: "quiz",
        question: "A pool has 2,000 X and 500 Y. What is the price of X in terms of Y?",
        options: ["4.0", "0.25", "2,500"],
        correctIndex: 1,
        explanation: "Price = Y/X = 500/2,000 = 0.25. There's a lot of X and little Y, so X is cheap relative to Y.",
      },
      {
        type: "lesson",
        title: "The Curve Shape",
        content: [
          "Look at the curve on the right — it's a hyperbola. Notice how it gets steeper at the edges.",
          "Near the center, the curve is relatively flat. Small trades here have minimal price impact.",
          "At the extremes, the curve is very steep. Trades here move the price dramatically. This steepness is the visual representation of slippage.",
        ],
      },
      {
        type: "quiz",
        question: "Where on the curve do trades have the least price impact?",
        options: ["At the edges where it's steep", "In the middle where it's flatter", "The impact is the same everywhere"],
        correctIndex: 1,
        explanation: "The flatter section of the curve means small reserve changes produce small price changes. At the steep edges, even small trades cause large price moves.",
      },
    ],
  },
  {
    id: "trading",
    title: "Making Trades & Slippage",
    subtitle: "Why bigger trades cost more",
    emoji: "🔄",
    reveals: ["controls"],
    steps: [
      {
        type: "lesson",
        title: "Executing a Trade",
        content: [
          "When you trade, you're moving along the constant product curve. You add one token and remove the other.",
          "The key insight: as you trade more, you move further along the curve — and the curve gets steeper.",
          "This means each additional unit costs more than the previous one. This difference between the expected price and the actual average price is called slippage.",
        ],
        visual: "trade-animation",
      },
      {
        type: "quiz",
        question: "You want to buy Y. You expect a price of 1.0, but the actual average price is 1.05. What's your slippage?",
        options: ["0%", "5%", "1.05%"],
        correctIndex: 1,
        explanation: "Slippage = (1.05 - 1.0) / 1.0 = 5%. You paid 5% more than the ideal price because your trade moved the price as it executed.",
      },
      {
        type: "lesson",
        title: "Slippage is Nonlinear",
        content: [
          "Here's the crucial insight: if you double your trade size, slippage more than doubles.",
          "A trade using 1% of the pool might have 1% slippage. But a trade using 10% of the pool might have 11% slippage — not just 10%.",
          "This is because the curve gets steeper as you move further along it. Each additional unit pushes you into increasingly expensive territory.",
        ],
      },
      {
        type: "quiz",
        question: "If doubling trade size from 50→100 causes slippage to go from 2%→5%, what happens at 200?",
        options: ["10% (doubles again)", "More than 10% (accelerates)", "Exactly 8%"],
        correctIndex: 1,
        explanation: "Slippage accelerates nonlinearly. The curve gets steeper and steeper, so each additional unit of trade size adds more slippage than the last.",
      },
      {
        type: "quiz",
        question: "How can you reduce slippage for a given trade?",
        options: ["Trade against a larger pool", "Trade faster", "Use a different blockchain"],
        correctIndex: 0,
        explanation: "Larger pools absorb trades more easily. A $100 trade in a $1M pool barely moves the price. The same trade in a $10K pool causes major slippage.",
      },
    ],
  },
  {
    id: "il",
    title: "Impermanent Loss",
    subtitle: "The hidden cost of providing liquidity",
    emoji: "📉",
    reveals: ["metrics", "price-chart"],
    steps: [
      {
        type: "lesson",
        title: "What is Impermanent Loss?",
        content: [
          "Liquidity providers (LPs) deposit tokens into the pool. But as the price changes, the pool automatically rebalances — selling the token that's going up and buying the one going down.",
          "This means LPs always end up with more of the cheaper token and less of the expensive one. Compared to simply holding, LPs lose value.",
          "This difference between LP value and HODL value is called Impermanent Loss (IL).",
        ],
        visual: "il-diagram",
      },
      {
        type: "quiz",
        question: "If token X doubles in price, what does the pool automatically do?",
        options: ["Buy more X", "Sell X and accumulate Y", "Nothing — the pool is static"],
        correctIndex: 1,
        explanation: "The constant product formula forces the pool to sell the appreciating token (X) as its price rises. Arbitrageurs execute these trades. LPs end up with less X and more Y.",
      },
      {
        type: "lesson",
        title: "The IL Formula",
        content: [
          "IL depends only on the price ratio change, not the direction.",
          "If price doubles (2x), IL ≈ 5.7%. If price quadruples (4x), IL ≈ 20%. If price 10x's, IL ≈ 42%.",
          "Notice: a 2x price drop (to 0.5x) gives the same IL as a 2x increase. IL is symmetric.",
        ],
      },
      {
        type: "quiz",
        question: "Token X drops 50% in price. Token Y stays the same. Approximate IL?",
        options: ["~50%", "~5.7%", "~25%"],
        correctIndex: 1,
        explanation: "A 50% drop means price ratio = 0.5x, which is the inverse of 2x. IL ≈ 5.7% — the same as a 2x increase. IL only depends on the magnitude of the ratio change.",
      },
      {
        type: "quiz",
        question: "Why is it called 'impermanent'?",
        options: ["Because LPs can withdraw anytime", "Because the loss reverses if prices return to the entry ratio", "Because it's very small"],
        correctIndex: 1,
        explanation: "If the price returns to exactly where it was when you deposited, the loss disappears entirely. It only becomes permanent (\"realized\") if you withdraw while prices have diverged.",
      },
    ],
  },
  {
    id: "arbitrage",
    title: "Arbitrage Mechanics",
    subtitle: "How prices stay accurate",
    emoji: "⚡",
    reveals: ["arb-toggle"],
    steps: [
      {
        type: "lesson",
        title: "The Price Alignment Problem",
        content: [
          "AMM prices only change when someone trades. But the real market price changes continuously on centralized exchanges.",
          "Without arbitrageurs, the pool price would become stale and incorrect.",
          "Arbitrageurs are traders who profit by correcting these mispricings — buying cheap tokens from the pool and selling them at the higher market price.",
        ],
        visual: "arb-diagram",
      },
      {
        type: "quiz",
        question: "The pool thinks ETH is $1,900 but the real price is $2,000. What does an arbitrageur do?",
        options: ["Sell ETH to the pool", "Buy ETH from the pool (it's cheap!) and sell on the open market", "Wait for the price to correct itself"],
        correctIndex: 1,
        explanation: "The arbitrageur buys cheap ETH from the pool and sells at $2,000 on a centralized exchange. This removes ETH from the pool, pushing the pool price up toward $2,000.",
      },
      {
        type: "lesson",
        title: "Arbitrage and LPs",
        content: [
          "Here's the uncomfortable truth: arbitrage is the mechanism that causes impermanent loss.",
          "Every arbitrage trade extracts value from the pool — buying cheap assets from LPs.",
          "But arbitrage is also essential: without it, the pool price would be meaningless. It's the cost of having an accurate, trustworthy market.",
        ],
      },
      {
        type: "quiz",
        question: "If you disable arbitrage, what happens to the pool?",
        options: ["It becomes more profitable for LPs", "The pool price drifts away from the real market price", "Nothing changes"],
        correctIndex: 1,
        explanation: "Without arbitrage, the pool price only changes from direct trades. As the market moves, the pool becomes increasingly mispriced and unreliable.",
      },
    ],
  },
  {
    id: "fees",
    title: "Fees & Putting It Together",
    subtitle: "How LPs earn revenue and the final picture",
    emoji: "💰",
    reveals: ["fees", "learning"],
    steps: [
      {
        type: "lesson",
        title: "Fee Revenue",
        content: [
          "Every trade in an AMM pays a small fee (typically 0.3%). This fee goes to the liquidity providers.",
          "Fees accumulate over time as more trades happen. More trading volume = more fee revenue.",
          "The key question for LPs: do the fees earned exceed the impermanent loss suffered?",
        ],
        visual: "fees-diagram",
      },
      {
        type: "quiz",
        question: "A pool charges 0.3% fees and does $1M in daily volume. How much do LPs earn per day?",
        options: ["$3,000", "$30,000", "$300"],
        correctIndex: 0,
        explanation: "$1,000,000 × 0.003 = $3,000 per day in fees, distributed proportionally to all LPs based on their share of the pool.",
      },
      {
        type: "lesson",
        title: "The LP Tradeoff",
        content: [
          "Being an LP is a balancing act. Volatility is both your friend and enemy.",
          "High volatility → more arbitrage trades → more fee revenue. But also: more price movement → more impermanent loss.",
          "The fee tier matters hugely. Too low and you can't cover IL. Too high and traders go elsewhere, reducing volume.",
        ],
      },
      {
        type: "quiz",
        question: "High volatility with high fees is best described as:",
        options: ["Always profitable for LPs", "High risk, high reward", "Always unprofitable for LPs"],
        correctIndex: 1,
        explanation: "High volatility drives both fee revenue AND impermanent loss. Whether the LP profits depends on the balance between the two — it's genuinely a risk/reward tradeoff.",
      },
      {
        type: "lesson",
        title: "🎓 You've Completed the Course!",
        content: [
          "You now understand the core mechanics of AMMs: reserves, pricing, slippage, impermanent loss, arbitrage, and fees.",
          "The full dashboard is now unlocked. You can freely experiment with all controls, switch between lesson tabs, run simulations, and test your knowledge with quizzes.",
          "Try increasing trade size to see nonlinear slippage. Run the auto-simulator to watch IL accumulate. Toggle arbitrage on and off. The best way to learn is to experiment.",
        ],
      },
    ],
  },
];

export function getRevealedSections(completedModules: number): Set<string> {
  const revealed = new Set<string>();
  for (let i = 0; i < completedModules && i < COURSE_MODULES.length; i++) {
    for (const r of COURSE_MODULES[i].reveals) {
      revealed.add(r);
    }
  }
  return revealed;
}
