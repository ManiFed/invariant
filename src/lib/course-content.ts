// Course content for the guided Teaching Lab

export type StepType = "lesson" | "quiz";

export interface LessonStep {
  type: "lesson";
  title: string;
  content: string[];
  visual?: string;
  interactive?: string;
}

export interface FollowUpQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  wrongExplanation: string;
}

export interface QuizStep {
  type: "quiz";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  wrongExplanation: string;
  followUpQuiz?: FollowUpQuiz;
  calculatorNeeded?: boolean;
}

export type CourseStep = LessonStep | QuizStep;

export interface CourseModule {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  steps: CourseStep[];
  reveals: string[];
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
        wrongExplanation: "Think simpler: AMMs are automatic. There's no person involved. The pool itself figures out the price using math based on how many tokens it holds.",
        followUpQuiz: {
          question: "What two inputs does the AMM formula need to calculate a price?",
          options: ["Trading volume and time", "The amounts of each token in the pool", "External market data and user preferences"],
          correctIndex: 1,
          explanation: "The formula only needs the reserves — how much of Token X and Token Y are in the pool. Nothing else.",
          wrongExplanation: "The AMM is self-contained. It doesn't look outside itself. It only knows how many tokens it's holding right now.",
        },
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
        wrongExplanation: "Think about what's different: in a normal exchange, people place buy/sell orders and wait. In an AMM, there's a pool of tokens and a formula. No waiting, no order matching.",
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
        wrongExplanation: "Picture a pool with two buckets. When someone takes from one bucket, they must pour into the other. ETH leaves → USDC comes in.",
      },
      {
        type: "lesson",
        title: "The Constant Product",
        content: [
          "The most common AMM formula is: x × y = k",
          "x is the reserve of token X, y is the reserve of token Y, and k is a constant that never changes.",
          "This means: when one reserve goes down, the other must go up to keep the product the same. This is what creates the pricing mechanism.",
        ],
        visual: "constant-product",
      },
      {
        type: "quiz",
        question: "If a pool has x=1000, y=1000, what is k?",
        options: ["2,000", "1,000,000", "1,000"],
        correctIndex: 1,
        explanation: "k = x × y = 1,000 × 1,000 = 1,000,000. This product must remain constant through all trades (before fees).",
        wrongExplanation: "It's multiplication, not addition! x TIMES y. So 1,000 × 1,000 = 1,000,000. The formula is x × y = k.",
        calculatorNeeded: true,
      },
      {
        type: "quiz",
        question: "If x drops to 500, what must y become to maintain k = 1,000,000?",
        options: ["500", "1,500", "2,000"],
        correctIndex: 2,
        explanation: "If x = 500, then y = k/x = 1,000,000/500 = 2,000. The reserves shifted dramatically — the pool now holds much more Y.",
        wrongExplanation: "Use the formula: x × y = k. If x = 500 and k = 1,000,000, then y = 1,000,000 ÷ 500. Try the calculator!",
        calculatorNeeded: true,
        followUpQuiz: {
          question: "In that same scenario (x went from 1000→500, y went from 1000→2000), how many Y tokens did the trader put IN?",
          options: ["500", "1,000", "2,000"],
          correctIndex: 1,
          explanation: "Y went from 1,000 to 2,000, so the trader added 1,000 Y tokens. They also took out 500 X tokens (1000→500).",
          wrongExplanation: "Look at how Y changed: it was 1,000, now it's 2,000. The difference (2,000 - 1,000 = 1,000) is what the trader put in.",
        },
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
        wrongExplanation: "Price = Y ÷ X. There's lots of X (2,000) but little Y (500). When something is abundant, it's cheap. 500 ÷ 2,000 = 0.25.",
        calculatorNeeded: true,
      },
      {
        type: "lesson",
        title: "The Curve Shape",
        content: [
          "Look at the curve in the center panel — it's a hyperbola. Notice how it gets steeper at the edges.",
          "Near the center, the curve is relatively flat. Small trades here have minimal price impact.",
          "At the extremes, the curve is very steep. Trades here move the price dramatically. This steepness is the visual representation of slippage.",
        ],
        visual: "curve-steepness",
      },
      {
        type: "quiz",
        question: "Where on the curve do trades have the least price impact?",
        options: ["At the edges where it's steep", "In the middle where it's flatter", "The impact is the same everywhere"],
        correctIndex: 1,
        explanation: "The flatter section of the curve means small reserve changes produce small price changes. At the steep edges, even small trades cause large price moves.",
        wrongExplanation: "Think of a hill: walking on flat ground barely changes your height. Walking on a steep slope changes it a lot. The curve works the same way — flat = small impact, steep = big impact.",
        followUpQuiz: {
          question: "If the pool has very unequal reserves (e.g., 10,000 X and 100 Y), where are you on the curve?",
          options: ["In the flat middle section", "On a steep edge", "It doesn't matter"],
          correctIndex: 1,
          explanation: "Unequal reserves mean you're on the steep part of the curve. Trading Y here costs a lot because Y is scarce. The pool is 'stretched' to one side.",
          wrongExplanation: "When one token is much more abundant than the other, you've moved far from the balanced center. That puts you on the steep part of the curve.",
        },
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
        type: "lesson",
        title: "WHY Does Slippage Happen?",
        content: [
          "Here's the intuition: imagine the pool has 1,000 apples and 1,000 oranges. You want oranges.",
          "Your first orange costs about 1 apple — fair enough. But each orange you take makes oranges scarcer in the pool. Meanwhile, you're adding more apples, making them more abundant.",
          "Scarcer things are more expensive. So your 10th orange costs more than your 1st, your 100th costs WAY more than your 10th. The pool is protecting itself from being drained of one token.",
          "This is WHY the constant product formula (x × y = k) exists — it ensures the pool never runs out of either token, but the price gets exponentially worse as you try to take more.",
        ],
        visual: "slippage-why",
      },
      {
        type: "quiz",
        question: "You want to buy Y. You expect a price of 1.0, but the actual average price is 1.05. What's your slippage?",
        options: ["0%", "5%", "1.05%"],
        correctIndex: 1,
        explanation: "Slippage = (1.05 - 1.0) / 1.0 = 5%. You paid 5% more than the ideal price because your trade moved the price as it executed.",
        wrongExplanation: "Slippage is just the percentage difference. You expected to pay 1.0, you actually paid 1.05. The extra 0.05 out of 1.0 = 5% more than expected.",
        calculatorNeeded: true,
      },
      {
        type: "lesson",
        title: "Slippage is Nonlinear — Here's Why",
        content: [
          "If you double your trade size, slippage MORE than doubles. Why?",
          "Think of it step by step: your first chunk of the trade moves you along the flat part of the curve. The second chunk starts where the first left off — but now you're on a steeper part.",
          "It's like climbing a mountain: the first 100 meters of elevation are easy trails. The next 100 meters are steeper switchbacks. The next 100 are near-vertical cliffs.",
          "Try it yourself! Use the controls on the left to set trade size to 50, then 100, then 200. Watch how slippage accelerates.",
        ],
        visual: "slippage-nonlinear",
      },
      {
        type: "quiz",
        question: "If doubling trade size from 50→100 causes slippage to go from 2%→5%, what happens at 200?",
        options: ["10% (doubles again)", "More than 10% (accelerates)", "Exactly 8%"],
        correctIndex: 1,
        explanation: "Slippage accelerates nonlinearly. The curve gets steeper and steeper, so each additional unit of trade size adds more slippage than the last.",
        wrongExplanation: "Notice the pattern: 50→100 (2x size) went from 2%→5% (more than 2x slippage). It's accelerating, not just growing proportionally. So 200 would cause MORE than double the slippage of 100.",
        followUpQuiz: {
          question: "A whale wants to buy 40% of the pool's Y tokens. Approximate slippage?",
          options: ["~5%", "~40%", "~67%"],
          correctIndex: 2,
          explanation: "Buying 40% of a pool's reserves causes enormous slippage — around 67%. The curve becomes extremely steep when you're taking that much from one side.",
          wrongExplanation: "Taking 40% of the pool is massive. The curve gets incredibly steep. Slippage isn't proportional to trade size — it's much worse for large trades.",
        },
      },
      {
        type: "quiz",
        question: "How can you reduce slippage for a given trade?",
        options: ["Trade against a larger pool", "Trade faster", "Use a different blockchain"],
        correctIndex: 0,
        explanation: "Larger pools absorb trades more easily. A $100 trade in a $1M pool barely moves the price. The same trade in a $10K pool causes major slippage.",
        wrongExplanation: "Think about proportions: a small fish in a big ocean barely makes waves. The same fish in a bathtub causes a splash. Bigger pool = less impact per trade.",
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
        title: "What Does HODL Mean?",
        content: [
          "Before we dive into impermanent loss, you need to understand one odd term: HODL.",
          "HODL stands for \"Hold On for Dear Life\" — it's crypto slang that simply means holding your tokens in your wallet without doing anything with them.",
          "Your HODL value is just what those tokens are worth at any given time. We use HODL value as a benchmark: would you have been better off just holding, or was providing liquidity worth it?",
        ],
        visual: "hodl-explain",
      },
      {
        type: "quiz",
        question: "What does 'HODL value' represent?",
        options: ["The value of tokens locked in a pool", "What your tokens would be worth if you just held them", "The profit from trading"],
        correctIndex: 1,
        explanation: "HODL value = what your tokens would be worth if you never deposited them anywhere — just held them in your wallet and watched the prices change.",
        wrongExplanation: "HODL = Hold. It's the simplest thing you can do with tokens: absolutely nothing. Just hold them. The HODL value is what they'd be worth if you did that.",
      },
      {
        type: "lesson",
        title: "What is Impermanent Loss?",
        content: [
          "Liquidity providers (LPs) deposit tokens into the pool. But as the price changes, the pool automatically rebalances — selling the token that's going up and buying the one going down.",
          "This means LPs always end up with more of the cheaper token and less of the expensive one. Compared to simply HODLing, LPs lose value.",
          "This difference between LP value and HODL value is called Impermanent Loss (IL). It's the price you pay for providing liquidity.",
        ],
        visual: "il-animated",
      },
      {
        type: "quiz",
        question: "If token X doubles in price, what does the pool automatically do?",
        options: ["Buy more X", "Sell X and accumulate Y", "Nothing — the pool is static"],
        correctIndex: 1,
        explanation: "The constant product formula forces the pool to sell the appreciating token (X) as its price rises. Arbitrageurs execute these trades. LPs end up with less X and more Y.",
        wrongExplanation: "Remember the constant product: x × y = k. If X becomes more valuable, people buy X from the pool (removing it) and add Y. The pool ends up with less X, more Y.",
        followUpQuiz: {
          question: "After X doubles, an LP withdraws. Compared to HODLing, they have:",
          options: ["More X than if they'd held", "Less X AND less value overall", "The same amount of each token"],
          correctIndex: 1,
          explanation: "The pool sold X as it appreciated. The LP ends up with less X and more Y than if they'd HODLed. The total value is also lower — that's IL.",
          wrongExplanation: "The pool was selling X as the price rose. So the LP has less X. And since X is now worth more, having less of it means lower total value compared to just holding.",
        },
      },
      {
        type: "lesson",
        title: "The IL Formula",
        content: [
          "IL depends only on the price ratio change, not the direction.",
          "If price doubles (2x), IL ≈ 5.7%. If price quadruples (4x), IL ≈ 20%. If price 10x's, IL ≈ 42%.",
          "Notice: a 2x price drop (to 0.5x) gives the same IL as a 2x increase. IL is symmetric.",
        ],
        interactive: "il-slider",
      },
      {
        type: "quiz",
        question: "Token X drops 50% in price. Token Y stays the same. Approximate IL?",
        options: ["~50%", "~5.7%", "~25%"],
        correctIndex: 1,
        explanation: "A 50% drop means price ratio = 0.5x, which is the inverse of 2x. IL ≈ 5.7% — the same as a 2x increase. IL only depends on the magnitude of the ratio change.",
        wrongExplanation: "IL isn't proportional to the price change! A 50% drop = 0.5x ratio. The IL formula gives ~5.7% for any 2x change in either direction. It's about the ratio, not the direction.",
        calculatorNeeded: true,
      },
      {
        type: "quiz",
        question: "Why is it called 'impermanent'?",
        options: ["Because LPs can withdraw anytime", "Because the loss reverses if prices return to the entry ratio", "Because it's very small"],
        correctIndex: 1,
        explanation: "If the price returns to exactly where it was when you deposited, the loss disappears entirely. It only becomes permanent (\"realized\") if you withdraw while prices have diverged.",
        wrongExplanation: "The key word is 'impermanent' = not permanent. The loss exists only while prices have moved. If they come back to where they started, the loss goes to zero. It's only real if you withdraw at the wrong time.",
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
        wrongExplanation: "The pool is selling ETH too cheaply ($1,900 vs $2,000 market). So you'd BUY from the pool (cheap!) and sell elsewhere (expensive!). Profit = $100 per ETH.",
        followUpQuiz: {
          question: "After the arbitrage, the pool has less ETH and more USDC. Who 'paid' for the arbitrageur's profit?",
          options: ["The protocol treasury", "The liquidity providers", "Nobody — it was free money"],
          correctIndex: 1,
          explanation: "LPs paid. They sold ETH at $1,900 (too cheaply) when the market price was $2,000. This is exactly how impermanent loss works — arbitrageurs extract value from LPs.",
          wrongExplanation: "Someone always pays. The pool sold ETH at a discount ($1,900 vs $2,000). The LP's tokens were used for that sale. LPs bear the cost.",
        },
      },
      {
        type: "lesson",
        title: "Arbitrage and LPs",
        content: [
          "Here's the uncomfortable truth: arbitrage is the mechanism that causes impermanent loss.",
          "Every arbitrage trade extracts value from the pool — buying cheap assets from LPs.",
          "But arbitrage is also essential: without it, the pool price would be meaningless. It's the cost of having an accurate, trustworthy market.",
        ],
        visual: "arb-flow",
      },
      {
        type: "quiz",
        question: "If you disable arbitrage, what happens to the pool?",
        options: ["It becomes more profitable for LPs", "The pool price drifts away from the real market price", "Nothing changes"],
        correctIndex: 1,
        explanation: "Without arbitrage, the pool price only changes from direct trades. As the market moves, the pool becomes increasingly mispriced and unreliable.",
        wrongExplanation: "No arbitrage = no one correcting the price. The external market keeps moving, but the pool stays stuck at its old price. The gap just grows and grows.",
      },
    ],
  },
  {
    id: "usecases",
    title: "Real-World Applications",
    subtitle: "Where AMMs are used in practice",
    emoji: "🌍",
    reveals: [],
    steps: [
      {
        type: "lesson",
        title: "AMMs in the Wild",
        content: [
          "AMMs aren't just theoretical — they power billions of dollars in daily trading volume across DeFi.",
          "The biggest use cases include: token swaps (Uniswap, SushiSwap), stablecoin trading (Curve Finance), yield farming, and decentralized portfolio management (Balancer).",
          "Let's explore the major real-world applications and why different AMM designs are suited for different purposes.",
        ],
      },
      {
        type: "lesson",
        title: "Stablecoin Exchanges",
        content: [
          "Curve Finance pioneered AMMs optimized for stablecoin pairs (USDC/USDT/DAI).",
          "Because stablecoins trade near 1:1, Curve uses a StableSwap invariant that concentrates liquidity around that peg — giving 10-100x less slippage than a constant product AMM.",
          "This design is also used for other correlated pairs like wETH/stETH (liquid staking derivatives) and synthetic assets.",
        ],
      },
      {
        type: "quiz",
        question: "Why is Curve's StableSwap better than Uniswap V2 for stablecoin pairs?",
        options: ["It has lower fees", "It concentrates liquidity near the 1:1 peg, reducing slippage", "It doesn't have impermanent loss"],
        correctIndex: 1,
        explanation: "The StableSwap invariant is specifically designed to be very flat near the 1:1 ratio, dramatically reducing slippage for pegged assets compared to a generic constant product curve.",
        wrongExplanation: "Think about the curve shape: Curve's formula creates a nearly flat line around the 1:1 price, meaning trades barely move the price. A constant product curve is equally curved everywhere.",
      },
      {
        type: "lesson",
        title: "Portfolio Management & Index Funds",
        content: [
          "Balancer uses weighted pools (like 80/20 or custom multi-asset pools) to create self-rebalancing portfolios.",
          "Instead of paying someone to rebalance your portfolio, the AMM does it automatically — and you earn trading fees in the process.",
          "This is used for DeFi index funds, treasury management by DAOs, and liquidity bootstrapping pools (LBPs) for fair token launches.",
        ],
      },
      {
        type: "lesson",
        title: "Concentrated Liquidity & Professional Market Making",
        content: [
          "Uniswap V3's concentrated liquidity lets LPs act more like professional market makers, choosing specific price ranges.",
          "This is heavily used by sophisticated DeFi protocols, MEV searchers, and automated vault strategies (like Arrakis, Gamma).",
          "The tradeoff: much higher capital efficiency (up to 4000x), but requires active management to stay in range.",
        ],
      },
      {
        type: "quiz",
        question: "Which use case benefits MOST from concentrated liquidity?",
        options: ["Long-term passive holding", "Active market making within a specific price range", "Cross-chain bridging"],
        correctIndex: 1,
        explanation: "Concentrated liquidity is ideal for active market makers who can monitor and adjust their ranges. It provides massive capital efficiency but requires active management.",
        wrongExplanation: "Concentrated liquidity requires picking a price range. If the price moves out of your range, you earn nothing. This benefits active managers, not passive holders.",
      },
      {
        type: "lesson",
        title: "Emerging Applications",
        content: [
          "AMMs are expanding into new frontiers: perpetual futures (GMX, dYdX), options (Lyra, Panoptic), real-world assets (RWA tokenization), and prediction markets.",
          "Time-variant AMMs that change their parameters over time are being explored for LBP-style token launches and dynamic fee structures.",
          "Multi-asset pools enable complex financial instruments like index funds, synthetic baskets, and cross-margining systems.",
          "The AMM design space is still young — new invariants and mechanisms are being invented constantly.",
        ],
      },
      {
        type: "quiz",
        question: "What makes AMMs powerful beyond just token swaps?",
        options: ["They only work for crypto tokens", "They can implement any financial primitive that depends on reserve ratios", "They replace all traditional finance"],
        correctIndex: 1,
        explanation: "AMMs are a general-purpose financial primitive. Any system where prices should adjust based on supply and demand of reserves can use an AMM variant — from options to prediction markets.",
        wrongExplanation: "AMMs are versatile mathematical tools. The invariant curve concept applies to any system where you want automatic price discovery based on reserves — far beyond just swapping tokens.",
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
        wrongExplanation: "0.3% = 0.003 as a decimal. $1,000,000 × 0.003 = $3,000. Try the calculator!",
        calculatorNeeded: true,
        followUpQuiz: {
          question: "If the pool has $10M in liquidity and you provided $100K, what's your share of the $3,000 daily fees?",
          options: ["$30", "$300", "$3"],
          correctIndex: 0,
          explanation: "Your share = $100K / $10M = 1%. 1% of $3,000 = $30 per day. That's about $10,950 per year — but only if IL doesn't eat it up!",
          wrongExplanation: "Your share of the pool = your deposit ÷ total pool. $100,000 ÷ $10,000,000 = 1%. Then 1% of $3,000 in fees = $30.",
        },
      },
      {
        type: "lesson",
        title: "The LP Tradeoff",
        content: [
          "Being an LP is a balancing act. Volatility is both your friend and enemy.",
          "High volatility → more arbitrage trades → more fee revenue. But also: more price movement → more impermanent loss.",
          "The fee tier matters hugely. Too low and you can't cover IL. Too high and traders go elsewhere, reducing volume.",
        ],
        visual: "fees-vs-il",
      },
      {
        type: "quiz",
        question: "High volatility with high fees is best described as:",
        options: ["Always profitable for LPs", "High risk, high reward", "Always unprofitable for LPs"],
        correctIndex: 1,
        explanation: "High volatility drives both fee revenue AND impermanent loss. Whether the LP profits depends on the balance between the two — it's genuinely a risk/reward tradeoff.",
        wrongExplanation: "Neither 'always' option is correct. High volatility means more trading (= more fees) BUT also bigger price moves (= more IL). It could go either way — that's why it's a tradeoff.",
      },
      {
        type: "lesson",
        title: "🎓 You've Completed the Course!",
        content: [
          "You now understand the core mechanics of AMMs: reserves, pricing, slippage, impermanent loss, arbitrage, fees, and real-world applications.",
          "The full dashboard is now unlocked. You can freely experiment with all controls, run simulations, and test your knowledge with quizzes.",
          "Try increasing trade size to see nonlinear slippage. Run the auto-simulator to watch IL accumulate. Toggle arbitrage on and off. The best way to learn is to experiment!",
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

export const MODULE_TAB_MAP: Record<string, string> = {
  intro: "slippage",
  reserves: "slippage",
  price: "slippage",
  trading: "slippage",
  il: "il",
  arbitrage: "arbitrage",
  usecases: "fees",
  fees: "fees",
};
