// Intermediate course content for the Teaching Lab
import type { CourseModule } from "./course-content";

export const INTERMEDIATE_MODULES: CourseModule[] = [
  // ── Module 1: Concentrated Liquidity ──
  {
    id: "concentrated-intro",
    title: "Concentrated Liquidity",
    subtitle: "Putting your capital exactly where it matters",
    emoji: "🎯",
    reveals: ["controls", "curve"],
    steps: [
      {
        type: "lesson",
        title: "Beyond Constant Product",
        content: [
          "In beginner AMMs, your liquidity is spread across every possible price — from $0 to ∞. But most trading happens in a narrow range around the current price.",
          "Concentrated liquidity lets you choose a price range. Your capital only provides liquidity within that range, making it dramatically more efficient.",
          "Think of it like this: instead of staffing a lemonade stand 24/7, you only staff it during rush hour — same revenue, fewer resources.",
        ],
        visual: "concentrated-range",
      },
      {
        type: "quiz",
        question: "Why is spreading liquidity from $0 to $∞ inefficient?",
        options: [
          "It costs more gas to deploy",
          "Most of the capital sits unused at prices far from the current price",
          "It makes the smart contract slower",
        ],
        correctIndex: 1,
        explanation: "If ETH is at $2,000, liquidity at $0.01 or $50,000 is just idle capital earning nothing. Concentrated positions focus capital where trades actually happen.",
        wrongExplanation: "Think about where trades actually occur. If the price is $2,000, is anyone trading at $5? At $50,000? All that capital at extreme prices just sits there doing nothing.",
      },
      {
        type: "lesson",
        title: "Capital Efficiency Multiplier",
        content: [
          "A concentrated position in a ±5% range around the current price can be ~20x more capital efficient than a full-range position.",
          "This means $50k in a tight range can provide the same depth as $1M spread across all prices. Same slippage for traders, way less capital required.",
          "The formula: efficiency ≈ 1 / (1 − √(pₗ/pᵤ)) where pₗ and pᵤ are your lower and upper price bounds.",
        ],
        visual: "capital-efficiency-bars",
      },
      {
        type: "quiz",
        question: "A ±5% concentrated position is roughly how much more capital efficient than full-range?",
        options: ["2x", "5x", "20x", "100x"],
        correctIndex: 2,
        explanation: "A ±5% range gives roughly 20x capital efficiency. That's the power of concentration — same depth, fraction of the capital.",
        wrongExplanation: "The narrower the range, the higher the multiplier. A ±5% range is roughly 20x. Even tighter ranges give higher multipliers, but with more risk.",
        calculatorNeeded: true,
      },
      {
        type: "lesson",
        title: "The Tradeoff: Amplified IL",
        content: [
          "There's a catch. When price moves outside your range, your position becomes 100% one token — maximum impermanent loss. You're fully exposed.",
          "Inside the range, IL is also amplified proportional to your concentration. A 20x efficient position has roughly 20x the IL per price move.",
          "This is the fundamental tradeoff: higher capital efficiency = higher IL exposure. The art is choosing ranges that balance these forces.",
        ],
        visual: "amplified-il",
      },
      {
        type: "quiz",
        question: "What happens to a concentrated liquidity position when price moves outside its range?",
        options: [
          "It earns extra fees to compensate",
          "It becomes 100% one token and earns zero fees",
          "It automatically rebalances to the new price",
        ],
        correctIndex: 1,
        explanation: "When price exits your range, your position is entirely converted to the less valuable token and earns no more fees. You must manually adjust or accept the loss.",
        wrongExplanation: "There's no automatic rebalancing. Once price leaves your chosen range, you hold 100% of whichever token lost value, and you earn nothing until price returns.",
        followUpQuiz: {
          question: "If ETH is at $2,000 and you set a range of $1,800–$2,200, what happens if ETH drops to $1,700?",
          options: [
            "Your position is 100% ETH, earning no fees",
            "Your position is 100% USDC, earning no fees",
            "Your position continues earning fees normally",
          ],
          correctIndex: 0,
          explanation: "When price drops below your range, the pool has sold all your USDC for ETH. You're 100% ETH at $1,800 (your lower bound), earning nothing.",
          wrongExplanation: "Think about which direction the pool rebalances. As ETH price falls, traders sell ETH to the pool. Your USDC gets converted to ETH. Below the range, it's all ETH.",
        },
      },
      {
        type: "lesson",
        title: "📝 Module 1 Recap",
        content: [
          "Let's review what we've covered about concentrated liquidity:",
          "• Full-range liquidity (like Uniswap v2) spreads capital across all prices, but most of it sits idle far from the current price.",
          "• Concentrated liquidity lets you pick a price range — capital efficiency can be 20x+ higher.",
          "• The tradeoff: IL is amplified proportionally to your concentration. If price exits your range, you're 100% in one token and earn zero fees.",
          "• Range width is a risk/reward dial: narrow = high fees but high IL risk, wide = safer but lower efficiency.",
          "Next up: how to actually pick the right range.",
        ],
      },
    ],
  },

  // ── Module 2: Range Strategy ──
  {
    id: "range-strategy",
    title: "Range Strategies",
    subtitle: "Choosing the right price range",
    emoji: "📐",
    reveals: ["reserves", "metrics"],
    steps: [
      {
        type: "lesson",
        title: "Narrow vs. Wide Ranges",
        content: [
          "Narrow ranges (±2–5%) earn maximum fees per dollar but go out-of-range frequently. Wide ranges (±20–50%) are safer but less capital efficient.",
          "The optimal range depends on the asset pair. Stablecoin pairs like USDC/DAI barely move — tight ranges work great. Volatile pairs like ETH/BTC need wider ranges.",
          "Professional LPs often use multiple positions at different ranges, creating a 'liquidity shape' that approximates their market view.",
        ],
        visual: "narrow-vs-wide",
      },
      {
        type: "quiz",
        question: "For a USDC/DAI stablecoin pair, which range strategy makes the most sense?",
        options: [
          "Very wide: $0.50–$1.50",
          "Very narrow: $0.999–$1.001",
          "Moderate: $0.95–$1.05",
        ],
        correctIndex: 2,
        explanation: "A moderate range like ±5% around peg captures virtually all trading while maintaining high capital efficiency. Ultra-narrow is risky even for stables (depegs happen), and ultra-wide wastes capital.",
        wrongExplanation: "Stablecoins stay near peg but can deviate. Too narrow risks going out-of-range during minor depegs. Too wide wastes capital at prices that'll never be reached. The middle ground wins.",
      },
      {
        type: "lesson",
        title: "Active vs. Passive Management",
        content: [
          "Passive LPs set a range and leave it. Active LPs continuously adjust their range as price moves — 'following the price' to stay in range.",
          "Active management sounds better, but each rebalance is a taxable event, costs gas, and crystallizes any impermanent loss into permanent loss.",
          "A popular middle ground: rebalance only when your position goes fully out of range, then re-center around the new price.",
        ],
      },
      {
        type: "quiz",
        question: "Why might frequently rebalancing a concentrated position actually hurt returns?",
        options: [
          "It uses too much blockchain storage",
          "Each rebalance locks in impermanent loss as permanent loss, plus gas costs",
          "The AMM charges a penalty for repositioning",
        ],
        correctIndex: 1,
        explanation: "When you close a position and open a new one, any IL that was 'impermanent' (could have reversed) becomes a realized loss. Plus you pay gas each time.",
        wrongExplanation: "There's no AMM penalty. The issue is that IL is only 'impermanent' while you hold the position. Closing it makes the loss permanent. Add gas costs, and frequent rebalancing erodes returns.",
      },
      {
        type: "lesson",
        title: "Real-World Range Selection",
        content: [
          "In practice, LPs look at implied volatility to gauge how much the price might move. A common heuristic: set your range to ±2σ (two standard deviations) for the expected holding period.",
          "For a token with 80% annualized vol held for 7 days, that's roughly ±(0.80 × √(7/365)) ≈ ±11%. So a range of roughly ±12–15% gives a good buffer.",
          "Tools like the ones in Invariant Studio's Advanced Mode help you backtest different range strategies against historical price data.",
        ],
      },
      {
        type: "quiz",
        question: "If a token has 100% annualized volatility, approximately what 7-day range (±2σ) should you consider?",
        options: ["±2%", "±7%", "±14%", "±28%"],
        correctIndex: 2,
        explanation: "7-day σ = 100% × √(7/365) ≈ 13.9%. So ±2σ ≈ ±28% total range, or ±14% each direction. This captures ~95% of expected price moves.",
        wrongExplanation: "Scale annual vol to weekly: σ_week = σ_annual × √(days/365). For 100% annual vol over 7 days: 100% × √(7/365) ≈ 14%. Two standard deviations ≈ ±14%.",
        calculatorNeeded: true,
      },
    ],
  },

  // ── Module 3: Multi-Fee Tier Strategies ──
  {
    id: "fee-tiers",
    title: "Multi-Fee Tier Design",
    subtitle: "Why one fee doesn't fit all",
    emoji: "🏗️",
    reveals: ["price-chart"],
    steps: [
      {
        type: "lesson",
        title: "The Fee Tier Spectrum",
        content: [
          "Modern AMMs like Uniswap v3 offer multiple fee tiers for the same token pair: 0.01%, 0.05%, 0.30%, and 1.00%.",
          "Different traders have different needs. Stablecoin arbitrageurs need ultra-low fees. Retail traders are less fee-sensitive. Exotic pairs need higher fees to compensate LPs for risk.",
          "Fee tier selection is a game-theoretic problem: LPs migrate to the tier that maximizes their risk-adjusted returns, and traders route to the tier with best execution.",
        ],
        visual: "fee-tier-spectrum",
      },
      {
        type: "quiz",
        question: "Which fee tier would most stablecoin-to-stablecoin trading volume concentrate in?",
        options: ["1.00%", "0.30%", "0.01%"],
        correctIndex: 2,
        explanation: "Stablecoins have tiny price differences, so arbitrageurs need ultra-low fees to profit. The 0.01% (1 basis point) tier captures the vast majority of stable-stable volume.",
        wrongExplanation: "Stablecoin arb opportunities are tiny — fractions of a cent. If the fee is larger than the opportunity, no one trades. That's why almost all volume goes to the lowest tier.",
      },
      {
        type: "lesson",
        title: "Fee Tier Competition",
        content: [
          "A lower fee tier attracts more volume but earns less per trade. A higher fee tier earns more per trade but gets less volume. LPs must pick their battles.",
          "In practice, there's often a 'winning' fee tier for each pair that captures 80%+ of volume. For ETH/USDC, it's typically 0.05% or 0.30%.",
          "The winning tier can shift over time as market conditions change. During low-volatility periods, the lower tier tends to win. During high-vol, LPs demand more compensation.",
        ],
      },
      {
        type: "quiz",
        question: "During a period of high market volatility, what tends to happen to fee tier preference?",
        options: [
          "LPs move to lower fee tiers for more volume",
          "LPs move to higher fee tiers to compensate for increased IL risk",
          "Fee tier doesn't matter during volatile markets",
        ],
        correctIndex: 1,
        explanation: "Higher volatility means more IL risk for LPs. They demand higher fees to compensate, shifting liquidity to higher tiers. Traders accept the higher cost because they need liquidity.",
        wrongExplanation: "When volatility rises, LP risk rises too (more IL). Rational LPs demand more compensation → they move to higher fee tiers. The market follows the liquidity.",
      },
      {
        type: "lesson",
        title: "Dynamic Fees: The Frontier",
        content: [
          "Some next-gen AMMs use dynamic fees that adjust automatically based on market conditions — higher fees during volatile periods, lower during calm periods.",
          "This automates the fee tier selection problem. Instead of LPs guessing, the protocol itself responds to conditions in real-time.",
          "Implementations include Uniswap v4's hooks system, Trader Joe's dynamic fees, and various academic proposals for volatility-aware fee schedules.",
        ],
      },
      {
        type: "quiz",
        question: "What's the main advantage of dynamic fees over fixed fee tiers?",
        options: [
          "They're cheaper for traders",
          "They automatically balance LP compensation with trading costs based on current conditions",
          "They eliminate impermanent loss entirely",
        ],
        correctIndex: 1,
        explanation: "Dynamic fees solve the problem of fixed tiers being suboptimal in changing conditions. They raise fees when LP risk is high and lower them when it's low — automatically.",
        wrongExplanation: "Dynamic fees don't eliminate IL — nothing can. And they're not always cheaper. Their advantage is adapting to conditions: high fees when risk is high, low fees when risk is low.",
      },
    ],
  },

  // ── Module 4: Liquidity Bootstrapping Pools ──
  {
    id: "lbps",
    title: "Liquidity Bootstrapping Pools",
    subtitle: "Fair token launches via weight-shifting",
    emoji: "🚀",
    reveals: ["learning"],
    steps: [
      {
        type: "lesson",
        title: "The Token Launch Problem",
        content: [
          "Launching a new token is hard. If you create a standard AMM pool, bots will snipe the initial liquidity — buying everything in the first block and reselling at a markup.",
          "Liquidity Bootstrapping Pools (LBPs) solve this by starting with a heavily skewed weight (e.g., 95% new token / 5% paired token) and gradually shifting to a balanced weight over time.",
          "This creates natural downward price pressure, discouraging early snipers and allowing organic price discovery over hours or days.",
        ],
        visual: "lbp-weight-shift",
      },
      {
        type: "quiz",
        question: "Why does an LBP start with a high weight for the new token (e.g., 95/5)?",
        options: [
          "To make the token more valuable",
          "To create selling pressure that prevents sniper bots from profiting",
          "Because the team owns 95% of the supply",
        ],
        correctIndex: 1,
        explanation: "The high initial weight means the token starts at a high price. As the weight shifts toward 50/50, the price naturally drops — even without sells. This means early buyers face a headwind, discouraging bots.",
        wrongExplanation: "It's about price dynamics, not ownership. Starting at 95/5 means the token price is artificially high. As weights shift, price drops naturally. Bots that buy early lose money as the weight shifts against them.",
      },
      {
        type: "lesson",
        title: "Weighted AMM Math",
        content: [
          "Standard AMMs use x × y = k (50/50 weights). Weighted AMMs generalize this to: x^w₁ × y^w₂ = k, where w₁ and w₂ are the token weights.",
          "When w₁ = 0.95 and w₂ = 0.05, the price is extremely sensitive to y (the paired token) and insensitive to x (the new token). This means you need very little paired token to maintain a high price.",
          "As weights shift to 50/50, the curve becomes a standard constant product — and the price adjusts accordingly.",
        ],
        visual: "weighted-curve",
      },
      {
        type: "quiz",
        question: "In a weighted pool with 80/20 weights (token A/B), what happens to the price if the weights shift to 50/50 without any trades?",
        options: [
          "Price of A increases",
          "Price of A decreases",
          "Price stays the same",
        ],
        correctIndex: 1,
        explanation: "Shifting weight from A means A becomes 'less important' in the invariant. With the same reserves, A's price relative to B drops. This is the core mechanism that creates selling pressure in LBPs.",
        wrongExplanation: "Think about it intuitively: if A had 80% of the weight and now only has 50%, A is now 'less dominant' in the pool. With same reserves, A's price drops. That's the designed selling pressure.",
      },
      {
        type: "lesson",
        title: "Real-World LBP Strategies",
        content: [
          "Successful LBPs typically run for 24–72 hours, starting at 90/10 or 95/5 and ending at 50/50 or 30/70.",
          "The team sets an initial price well above fair value. Natural weight decay brings the price down. Buyers wait for the price they're comfortable with, creating genuine price discovery.",
          "Projects like Balancer pioneered this approach, and it's been used by hundreds of token launches. Key: the team doesn't need to provide massive starting liquidity.",
        ],
      },
      {
        type: "quiz",
        question: "What's the optimal strategy for a buyer in an LBP?",
        options: [
          "Buy as early as possible to get the lowest price",
          "Wait and watch — price naturally decreases, buy when you think it's fair",
          "Buy at exactly the midpoint of the LBP",
        ],
        correctIndex: 1,
        explanation: "Unlike normal launches where early = cheap, LBPs intentionally start expensive. The price falls over time due to weight shifting. Smart buyers wait and assess fair value — which is exactly the point of the mechanism.",
        wrongExplanation: "LBPs invert the normal dynamic. Early ≠ cheap. The price starts HIGH and drops. Patient buyers who assess fair value get better prices than impatient snipers. That's the whole design.",
        followUpQuiz: {
          question: "If buy pressure is high enough, what happens to the price during an LBP?",
          options: [
            "It always goes down because of weight shifting",
            "It can actually go UP if demand exceeds the weight-shift selling pressure",
            "It stays constant regardless of demand",
          ],
          correctIndex: 1,
          explanation: "Weight shifting creates downward pressure, but actual buying creates upward pressure. If demand is strong enough, the price can rise despite the weight shift — indicating genuine strong demand.",
          wrongExplanation: "The weight shift pushes price down, but buying pushes it up. These forces compete. If demand outpaces the weight decay, the price rises — a strong signal of real demand.",
        },
      },
    ],
  },

  // ── Module 5: Oracle Pricing & TWAP ──
  {
    id: "oracles",
    title: "Oracle Pricing & TWAP",
    subtitle: "Using AMM prices as data feeds",
    emoji: "🔮",
    reveals: [],
    steps: [
      {
        type: "lesson",
        title: "AMMs as Price Oracles",
        content: [
          "AMM pools contain valuable information: the current price of a token pair, updated every time someone trades. Other smart contracts can read this price.",
          "But there's a problem: the spot price at any single block can be manipulated. A flash loan attack can temporarily distort the price within a single transaction.",
          "This is why raw spot prices from AMMs are dangerous to use directly. We need something more robust: Time-Weighted Average Prices (TWAP).",
        ],
        visual: "oracle-spot-vs-twap",
      },
      {
        type: "quiz",
        question: "Why is the spot price of an AMM in a single block potentially dangerous to use as an oracle?",
        options: [
          "It's too expensive to read on-chain",
          "It can be manipulated within a single transaction using flash loans",
          "The price is always stale by one block",
        ],
        correctIndex: 1,
        explanation: "Flash loans let an attacker borrow massive amounts, distort a pool's price, trigger an oracle-dependent contract (like a lending protocol), then repay — all in one transaction.",
        wrongExplanation: "The danger is manipulation. Flash loans give anyone access to unlimited capital for one transaction. They can push a pool's price to any extreme, exploit a contract that reads that price, then unwind.",
      },
      {
        type: "lesson",
        title: "TWAP: Time-Weighted Average Price",
        content: [
          "TWAP accumulates the price at each block over a window (e.g., 30 minutes) and returns the average. This makes manipulation exponentially expensive.",
          "To manipulate a 30-minute TWAP, an attacker would need to maintain the distorted price for many blocks — costing millions in capital lockup and trading fees.",
          "Uniswap v2 introduced on-chain TWAP accumulators. V3 improved this with a geometric mean TWAP, which is harder to manipulate and more gas-efficient to read.",
        ],
        visual: "twap-accumulator",
      },
      {
        type: "quiz",
        question: "How does TWAP make oracle manipulation more expensive?",
        options: [
          "It uses encryption to hide the price",
          "An attacker must sustain the manipulated price across many blocks, not just one",
          "It requires the attacker to hold the token for 24 hours",
        ],
        correctIndex: 1,
        explanation: "TWAP averages price over time. Distorting one block barely moves the average. To meaningfully shift a 30-minute TWAP, you'd need to hold the pool at an extreme price for dozens of blocks — prohibitively expensive.",
        wrongExplanation: "TWAP isn't about encryption or holding periods. It's about averaging over time. One block of manipulation barely moves a 30-minute average. The attacker would need to sustain the manipulation across many blocks.",
        followUpQuiz: {
          question: "If a TWAP window is 5 minutes (~25 blocks), and an attacker can manipulate the price for only 1 block, how much can they shift the TWAP?",
          options: ["By ~4%", "By ~100%", "By ~4% of the price distortion (1/25th)"],
          correctIndex: 2,
          explanation: "With 25 blocks in the window, 1 manipulated block shifts the average by only 1/25 of the distortion. A 100% price spike only moves the TWAP by ~4%. That's the power of time-weighting.",
          wrongExplanation: "The TWAP is an average of all blocks in the window. One block out of 25 contributes only 1/25th = 4% of its value to the average. Manipulation is diluted proportionally.",
        },
      },
      {
        type: "lesson",
        title: "Geometric Mean vs. Arithmetic Mean",
        content: [
          "Uniswap v3 uses geometric mean TWAP instead of arithmetic mean. This has a subtle but important property: it's harder to bias upward.",
          "Arithmetic mean: (P₁ + P₂ + ... + Pₙ) / n. This is vulnerable to outliers — one extremely high price pulls the whole average up.",
          "Geometric mean: (P₁ × P₂ × ... × Pₙ)^(1/n). This is more robust to outliers and treats upward and downward deviations symmetrically in log-price space.",
        ],
      },
      {
        type: "quiz",
        question: "Why is geometric mean TWAP preferred over arithmetic mean for on-chain oracles?",
        options: [
          "It's cheaper to compute on-chain",
          "It's more resistant to outlier manipulation and treats price movements symmetrically",
          "It returns a higher price, which benefits LPs",
        ],
        correctIndex: 1,
        explanation: "Geometric mean handles outliers better. A price spike from $100 to $10,000 pulls an arithmetic mean much harder than the geometric mean, making manipulation more expensive.",
        wrongExplanation: "The choice isn't about cost or benefiting LPs. Geometric mean is naturally more robust to extreme values. In price terms, it treats a 2x increase the same as a 2x decrease — symmetric in log space.",
      },
    ],
  },

  // ── Module 6: Advanced Arbitrage Mechanics ──
  {
    id: "advanced-arb",
    title: "Advanced Arbitrage",
    subtitle: "Multi-hop, cross-pool, and MEV dynamics",
    emoji: "⚡",
    reveals: [],
    steps: [
      {
        type: "lesson",
        title: "Multi-Hop Arbitrage",
        content: [
          "Simple arbitrage: if ETH is cheaper on Pool A than Pool B, buy on A, sell on B. But real DeFi arbitrage is often multi-hop.",
          "Example: ETH → USDC on Pool A, USDC → DAI on Pool B, DAI → ETH on Pool C. If this cycle returns more ETH than you started with, it's a profitable arbitrage loop.",
          "Finding these loops is a graph search problem. Professional arbitrageurs run algorithms that continuously scan hundreds of pools for profitable cycles.",
        ],
        visual: "multi-hop-arb",
      },
      {
        type: "quiz",
        question: "What makes multi-hop arbitrage different from simple two-pool arbitrage?",
        options: [
          "It's slower to execute",
          "It finds profitable cycles through three or more pools that aren't visible by comparing just two",
          "It only works with stablecoins",
        ],
        correctIndex: 1,
        explanation: "Multi-hop arb finds cycles: A→B→C→A where the product of exchange rates exceeds 1.0 (after fees). These opportunities are invisible when looking at any two pools in isolation.",
        wrongExplanation: "Multi-hop isn't about speed or stablecoins. It's about finding circular routes through multiple pools where you end up with more than you started. These paths are only visible by analyzing the full graph.",
      },
      {
        type: "lesson",
        title: "Just-In-Time (JIT) Liquidity",
        content: [
          "JIT liquidity is a sophisticated MEV strategy: a bot sees a large pending trade in the mempool, adds concentrated liquidity just before the trade executes, and removes it immediately after.",
          "The bot earns a large share of that trade's fees with minimal exposure to impermanent loss (since they're only in the pool for a single block).",
          "This is controversial: it 'steals' fee revenue from LPs who provide persistent liquidity. But it also reduces slippage for the trader, so it has benefits too.",
        ],
      },
      {
        type: "quiz",
        question: "Why does JIT liquidity minimize impermanent loss for the provider?",
        options: [
          "Because they use a special formula",
          "Because the position is only active for a single block — no time for price to diverge",
          "Because they hedge with futures contracts",
        ],
        correctIndex: 1,
        explanation: "IL accumulates as the price moves away from your entry price over time. A JIT position exists for only one block (~12 seconds), so there's almost zero time for IL to accumulate.",
        wrongExplanation: "IL is a function of price change over time. If your position exists for only one block, the price barely has time to move. Effectively zero IL exposure, maximum fee capture.",
      },
      {
        type: "lesson",
        title: "Sandwich Attacks Explained",
        content: [
          "A sandwich attack is the most common form of MEV: a bot frontrun your trade (pushing price against you), lets your trade execute at a worse price, then backruns to profit from the price impact.",
          "Your transaction: Buy 10 ETH. Attacker: Buy 50 ETH (frontrun) → your trade executes at higher price → Sell 50 ETH (backrun). The attacker profits from the difference.",
          "Defenses include: higher fee tiers (reduce attack profitability), private mempools (Flashbots Protect), slippage limits, and smaller trade sizes.",
        ],
        visual: "sandwich-attack",
      },
      {
        type: "quiz",
        question: "Which of these is the most effective defense against sandwich attacks for a regular trader?",
        options: [
          "Using a larger trade size to overwhelm the attacker",
          "Submitting transactions through a private mempool like Flashbots Protect",
          "Setting a very high slippage tolerance",
        ],
        correctIndex: 1,
        explanation: "Private mempools hide your transaction from MEV bots until it's included in a block. The attacker can't see it to frontrun. This is by far the most effective defense.",
        wrongExplanation: "Larger trades make you a bigger target. High slippage tolerance gives the attacker more room to profit. The best defense is hiding your transaction entirely — private mempools prevent bots from seeing it.",
        followUpQuiz: {
          question: "Why do higher AMM fee tiers naturally reduce sandwich attack profitability?",
          options: [
            "The attacker pays higher fees on both the frontrun and backrun, eating into profits",
            "Higher fees make the pool have less liquidity",
            "Bots can't interact with high-fee pools",
          ],
          correctIndex: 0,
          explanation: "The attacker must execute TWO trades (frontrun + backrun). Each one pays the fee. At 1% fee tier, the attacker pays ~2% in round-trip fees, making most sandwiches unprofitable.",
          wrongExplanation: "Bots can interact with any pool. The mechanism is simpler: the attacker does two trades and pays fees twice. Higher fees mean higher costs, making the sandwich less profitable or unprofitable.",
        },
      },
      {
        type: "lesson",
        title: "🎓 Intermediate Course Complete!",
        content: [
          "Congratulations! You now understand concentrated liquidity, range strategies, fee tier design, LBPs, oracle pricing, and advanced arbitrage mechanics.",
          "These concepts are the building blocks of modern DeFi protocol design. You can now reason about capital efficiency, MEV dynamics, and oracle security.",
          "Ready for more? Try the Advanced track when it launches — covering custom invariant design, dynamic fee algorithms, and formal verification of AMM properties.",
        ],
      },
    ],
  },
];

export const INTERMEDIATE_TAB_MAP: Record<string, string> = {
  "concentrated-intro": "concentrated",
  "range-strategy": "concentrated",
  "fee-tiers": "fees",
  "lbps": "fees",
  "oracles": "arbitrage",
  "advanced-arb": "arbitrage",
};
