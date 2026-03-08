// Advanced course content for the Teaching Lab
import type { CourseModule } from "./course-content";

export const ADVANCED_MODULES: CourseModule[] = [
  // ── Module 1: Custom Invariant Design ──
  {
    id: "invariant-design",
    title: "Custom Invariant Design",
    subtitle: "Engineering your own bonding curves",
    emoji: "🔬",
    reveals: ["controls", "curve"],
    steps: [
      {
        type: "lesson",
        title: "Beyond x·y = k",
        content: [
          "Every AMM is defined by its invariant — a mathematical equation that must hold true before and after every trade. The constant product formula x·y = k is the simplest, but it's not the only option.",
          "Different invariants create different trade-off profiles: slippage, capital efficiency, peg stability, and MEV resistance all depend on the curve shape.",
          "In this module, you'll learn how to design invariants from scratch, understanding why each mathematical choice has real economic consequences.",
        ],
        visual: "invariant-landscape",
      },
      {
        type: "quiz",
        question: "What does an AMM invariant define?",
        options: [
          "The gas cost of each swap",
          "The relationship between reserves that must hold before and after every trade",
          "The maximum number of tokens in the pool",
          "The governance voting power of LPs",
        ],
        correctIndex: 1,
        explanation: "The invariant is a constraint on the pool's reserves. Every valid trade must satisfy this equation — it's the fundamental law governing the AMM's behavior.",
        wrongExplanation: "Think about what stays constant (or follows a rule) when someone trades. Gas costs and governance are external concerns — the invariant is purely about the mathematical relationship between token balances.",
      },
      {
        type: "lesson",
        title: "The StableSwap Invariant",
        content: [
          "Curve Finance introduced the StableSwap invariant: A·n^n·Σxᵢ + D = A·D·n^n + D^(n+1) / (n^n · Πxᵢ). It blends constant-sum (zero slippage) with constant-product (infinite range).",
          "The amplification parameter A controls the blend. High A → nearly flat curve around the peg (great for stablecoins). Low A → behaves more like Uniswap.",
          "This was a breakthrough insight: you can interpolate between known invariants to create new behavior. The design space is continuous, not discrete.",
        ],
        visual: "stableswap-blend",
      },
      {
        type: "quiz",
        question: "What happens to a StableSwap pool when the amplification parameter A is very high?",
        options: [
          "The pool becomes more like constant-product (Uniswap)",
          "The pool gives near-zero slippage around the peg price",
          "The pool stops accepting trades",
          "Fee revenue increases dramatically",
        ],
        correctIndex: 1,
        explanation: "High A pushes the curve toward constant-sum behavior near the peg, giving extremely low slippage for stablecoin trades. This is why Curve dominates stablecoin trading.",
        wrongExplanation: "Think about the two extremes: constant-sum (x + y = k) gives zero slippage but can be drained, while constant-product gives infinite range but higher slippage. High A moves toward the constant-sum end.",
      },
      {
        type: "lesson",
        title: "Designing Your Own Invariant",
        content: [
          "To design an invariant, start with your goals: What asset types will it serve? What slippage profile do you want? What's the acceptable price range?",
          "Key properties to consider: (1) Convexity — the curve must be convex for the AMM to be arbitrage-consistent. (2) Monotonicity — more of one token in means more of the other out. (3) Boundary behavior — what happens at extreme prices?",
          "A useful technique: parameterize between known curves. f(x,y) = α·(x+y) + (1-α)·(x·y) blends constant-sum and constant-product. You can add higher-order terms for more nuanced behavior.",
        ],
        visual: "invariant-design-space",
      },
      {
        type: "quiz",
        question: "Why must an AMM invariant curve be convex?",
        options: [
          "Convexity makes the smart contract smaller",
          "Non-convex curves allow infinite arbitrage profit extraction",
          "Convexity is required by the EVM",
          "It reduces gas costs for swaps",
        ],
        correctIndex: 1,
        explanation: "If the curve is non-convex (has concave regions), an arbitrageur can extract value by trading back and forth through the concavity. Convexity ensures every round-trip trade costs the trader, protecting LPs.",
        wrongExplanation: "This is about economic security, not technical constraints. Think about what happens if a trader can buy low and sell high within the same curve — that's what concavity enables.",
      },
    ],
  },

  // ── Module 2: MEV Protection ──
  {
    id: "mev-protection",
    title: "MEV Protection Strategies",
    subtitle: "Defending pools against value extraction",
    emoji: "🛡️",
    reveals: ["controls", "curve", "reserves"],
    steps: [
      {
        type: "lesson",
        title: "The MEV Taxonomy",
        content: [
          "Maximal Extractable Value (MEV) is the profit that can be made by reordering, inserting, or censoring transactions within a block. For AMMs, the main attack vectors are sandwich attacks, backrunning, and JIT liquidity.",
          "Sandwich attacks: An attacker front-runs your swap (pushing the price against you), lets your swap execute at a worse price, then back-runs to capture the difference. You pay more; they pocket the spread.",
          "The total MEV extracted from Ethereum AMMs exceeds $600M+. Understanding these attacks is essential for designing resistant protocols.",
        ],
        visual: "mev-sandwich-diagram",
      },
      {
        type: "quiz",
        question: "In a sandwich attack, what does the attacker do?",
        options: [
          "Provide liquidity just before a large trade, then remove it after",
          "Place a buy order before your swap and a sell order after, profiting from the price movement your trade causes",
          "Bribe validators to exclude your transaction",
          "Exploit a smart contract bug to drain the pool",
        ],
        correctIndex: 1,
        explanation: "The attacker 'sandwiches' your trade: they buy first (pushing price up), your swap executes at the inflated price, then they sell at the new higher price. The price impact from your trade is their profit.",
        wrongExplanation: "A sandwich specifically involves two transactions around yours — one before (front-run) and one after (back-run). The attacker profits from the price impact your trade creates.",
      },
      {
        type: "lesson",
        title: "JIT Liquidity",
        content: [
          "Just-In-Time (JIT) liquidity is a subtler form of MEV. A searcher sees a large pending swap, adds concentrated liquidity in a tight range around the execution price, and removes it in the same block after earning fees.",
          "JIT liquidity is controversial: it improves execution for the swapper (more liquidity = less slippage) but steals fee revenue from passive LPs who provided liquidity 24/7.",
          "Some argue JIT is a feature, not a bug — it's efficient capital allocation. Others see it as parasitic extraction from committed liquidity providers.",
        ],
        visual: "jit-liquidity-timeline",
      },
      {
        type: "quiz",
        question: "Why is JIT liquidity controversial?",
        options: [
          "It always makes swaps more expensive",
          "It improves trade execution but diverts fee revenue from passive LPs",
          "It requires modifying the AMM smart contract",
          "It only works on proof-of-stake chains",
        ],
        correctIndex: 1,
        explanation: "JIT actually helps traders (more liquidity = better price), but it means passive LPs who commit capital long-term earn less in fees. The JIT provider captures most of the fee from the large swap without bearing ongoing risk.",
        wrongExplanation: "Think about who benefits and who loses. The swapper gets better execution (more liquidity), but someone's fee share is being diluted — the LPs who've been providing liquidity all along.",
      },
      {
        type: "lesson",
        title: "Defense Mechanisms",
        content: [
          "Several approaches exist to mitigate MEV: (1) Encrypted mempools (threshold encryption) hide transaction details until ordering is committed. (2) Batch auctions (like CoW Protocol) execute all trades at a uniform clearing price, eliminating front-running.",
          "(3) Time-weighted average pricing (TWAP) oracles resist manipulation by averaging over multiple blocks. (4) Dynamic fees that increase during high-MEV periods make sandwich attacks less profitable.",
          "(5) AMM-level defenses include wider tick spacing (reduces precision of JIT), asymmetric fees (higher fees for larger trades), and commitment schemes that lock trades into future blocks.",
        ],
        visual: "mev-defense-layers",
      },
      {
        type: "quiz",
        question: "How do batch auctions (like CoW Protocol) prevent sandwich attacks?",
        options: [
          "By requiring KYC for all traders",
          "By executing all trades at a single uniform clearing price within each batch",
          "By adding a 10-second delay to all transactions",
          "By limiting trade sizes to prevent large swaps",
        ],
        correctIndex: 1,
        explanation: "When all trades in a batch clear at the same price, there's no price movement between individual trades for a sandwicher to exploit. The attacker can't front-run because there's no sequential ordering within the batch.",
        wrongExplanation: "The key insight is that sandwich attacks exploit sequential ordering — your trade moves the price, and the attacker positions around that movement. What if all trades happen simultaneously at one price?",
      },
      {
        type: "quiz",
        question: "Which MEV defense operates at the AMM smart contract level rather than the network level?",
        options: [
          "Encrypted mempools",
          "Proposer-builder separation",
          "Dynamic fees that increase during high-volatility periods",
          "Flashbots Protect RPC",
        ],
        correctIndex: 2,
        explanation: "Dynamic fees are implemented within the AMM contract itself. When volatility or MEV activity spikes, fees automatically increase, making sandwich attacks less profitable. The other options operate at the network or infrastructure layer.",
        wrongExplanation: "Think about what the AMM contract can control directly. Mempools and block building happen outside the contract — but the contract does control its own fee structure.",
      },
    ],
  },

  // ── Module 3: Cross-Chain Liquidity ──
  {
    id: "cross-chain",
    title: "Cross-Chain Liquidity Routing",
    subtitle: "Unifying liquidity across networks",
    emoji: "🌐",
    reveals: ["controls", "curve", "reserves"],
    steps: [
      {
        type: "lesson",
        title: "The Fragmentation Problem",
        content: [
          "DeFi liquidity is fragmented across dozens of chains: Ethereum, Arbitrum, Optimism, Base, Solana, and more. Each chain has its own AMM pools, and liquidity doesn't naturally flow between them.",
          "This fragmentation means worse execution for traders (less depth on each chain), lower fee revenue for LPs (volume is split), and higher complexity for protocols.",
          "Cross-chain liquidity solutions aim to make all this fragmented liquidity behave as if it were in a single unified pool.",
        ],
        visual: "chain-fragmentation",
      },
      {
        type: "quiz",
        question: "What is the primary consequence of liquidity fragmentation across chains?",
        options: [
          "Smart contracts become more complex",
          "Traders experience higher slippage because depth is split across many venues",
          "Gas fees increase on all chains",
          "Token prices diverge permanently across chains",
        ],
        correctIndex: 1,
        explanation: "When $100M of liquidity is split across 5 chains, each chain effectively has $20M of depth. A large trade on any single chain faces 5x more slippage than if all liquidity were unified.",
        wrongExplanation: "Think about what matters most to a trader executing a large swap. If the pool is smaller, what happens to the price impact of their trade?",
      },
      {
        type: "lesson",
        title: "Bridge-Based vs. Intent-Based Routing",
        content: [
          "Bridge-based routing: Lock tokens on the source chain, mint wrapped tokens on the destination, swap there, then bridge back. This is slow (minutes to hours), expensive (multiple gas fees), and risky (bridge hacks).",
          "Intent-based routing: The user declares their intent ('I want to swap 1 ETH for USDC at the best price across all chains'). Solvers compete to fill the intent, using their own inventory or finding the optimal cross-chain path.",
          "Intent systems (UniswapX, CoW Protocol, Across) abstract away the complexity. The user doesn't care which chain the swap happens on — they just get the best price.",
        ],
        visual: "intent-vs-bridge",
      },
      {
        type: "quiz",
        question: "What advantage does intent-based routing have over traditional bridge-based swaps?",
        options: [
          "It's always cheaper in gas",
          "Solvers compete to fill orders, finding optimal paths the user doesn't need to know about",
          "It doesn't require any smart contracts",
          "It only works for stablecoins",
        ],
        correctIndex: 1,
        explanation: "Intent systems create a competitive market for order fulfillment. Solvers have inventory across chains and can find paths the user would never discover manually. Competition drives prices toward optimal execution.",
        wrongExplanation: "The core innovation of intents is delegation: instead of the user figuring out the best route, professional solvers compete to find it. Think about who has better information — a casual user or a professional solver with cross-chain inventory?",
      },
      {
        type: "lesson",
        title: "Virtual Liquidity and Shared Pools",
        content: [
          "Some protocols create 'virtual' unified pools: each chain has a local pool, but they're connected via messaging layers. When a trade on Chain A would get better execution using Chain B's liquidity, it's routed there automatically.",
          "The challenge: cross-chain messages have latency (seconds to minutes). During this window, the remote liquidity could change. Protocols must handle stale quotes, failed messages, and race conditions.",
          "Solutions include pessimistic pricing (quote slightly worse to buffer for latency), reserve commitments (remote chains lock liquidity), and optimistic execution with post-trade settlement.",
        ],
        visual: "virtual-pool-mesh",
      },
      {
        type: "quiz",
        question: "What is the biggest technical challenge with cross-chain virtual liquidity pools?",
        options: [
          "Smart contract size limits",
          "Message latency means remote liquidity state may be stale when the trade executes",
          "Tokens can't exist on multiple chains",
          "Gas costs are always higher cross-chain",
        ],
        correctIndex: 1,
        explanation: "Cross-chain messages take seconds to minutes. In that time, arbitrageurs or other traders could change the remote pool's state. The quoted price may no longer be available, requiring fallback mechanisms.",
        wrongExplanation: "Think about what happens in the time between requesting liquidity from another chain and actually executing the trade. What could change during that window?",
      },
    ],
  },

  // ── Module 4: Dynamic Fee Algorithms ──
  {
    id: "dynamic-fees",
    title: "Dynamic Fee Algorithms",
    subtitle: "Adaptive pricing for changing markets",
    emoji: "⚡",
    reveals: ["controls", "curve", "reserves", "metrics"],
    steps: [
      {
        type: "lesson",
        title: "Why Static Fees Fail",
        content: [
          "Most AMMs charge a fixed fee (e.g., 0.3% on Uniswap v2). But market conditions constantly change — volatility spikes, liquidity shifts, and informed vs. uninformed flow varies throughout the day.",
          "During high volatility, a 0.3% fee may be too low: LPs lose money to arbitrageurs who trade on stale prices faster than the pool can adjust. During calm periods, 0.3% may be too high, driving volume to competitors.",
          "Dynamic fees aim to charge the 'right' fee at every moment: high enough to compensate LPs for adverse selection, low enough to attract uninformed flow.",
        ],
        visual: "static-vs-dynamic-fees",
      },
      {
        type: "quiz",
        question: "Why do LPs lose money during high volatility with static fees?",
        options: [
          "Gas costs increase, eating into profits",
          "Arbitrageurs exploit stale pool prices faster than fees can compensate",
          "Traders stop using the pool entirely",
          "The invariant curve becomes unstable",
        ],
        correctIndex: 1,
        explanation: "When prices move fast, the pool's price lags the true market price. Arbitrageurs buy cheap (or sell expensive) until the pool price catches up. With a static 0.3% fee, the arbitrageur's profit exceeds the fee — LPs are net losers.",
        wrongExplanation: "Think about who trades with the pool and why. During volatility, arbitrageurs have an information advantage — they know the true price before the pool does. If the fee doesn't cover this advantage, who pays?",
      },
      {
        type: "lesson",
        title: "Volatility-Based Fee Models",
        content: [
          "The simplest dynamic fee: f = f_base + k·σ, where σ is recent realized volatility. When markets are calm, fees drop to attract volume. When markets are wild, fees spike to protect LPs.",
          "Measuring σ on-chain is tricky. Common approaches: (1) Track the rolling standard deviation of recent trade prices. (2) Use an external volatility oracle. (3) Measure the magnitude of arbitrage trades as a proxy.",
          "Trader Joe's Liquidity Book uses bin-crossing frequency as a volatility proxy. More bin crosses per block = higher implied volatility = higher fees. Simple, gas-efficient, and surprisingly effective.",
        ],
        visual: "volatility-fee-curve",
      },
      {
        type: "quiz",
        question: "In a volatility-based fee model, what happens to the fee during a flash crash?",
        options: [
          "The fee drops to zero to encourage trading",
          "The fee stays constant — it's only updated daily",
          "The fee increases sharply to compensate LPs for adverse selection risk",
          "The fee is paused until volatility subsides",
        ],
        correctIndex: 2,
        explanation: "A flash crash means extreme volatility. The dynamic fee spikes, making it expensive to arbitrage the pool. This protects LPs from losing value to informed traders who react faster than the pool can reprice.",
        wrongExplanation: "During a crash, who's trading with the pool? Mostly arbitrageurs exploiting the price lag. Should the pool make it cheap or expensive for them?",
      },
      {
        type: "lesson",
        title: "Directional Fees and Adverse Selection",
        content: [
          "Advanced systems charge different fees based on trade direction. If the pool's price is below the oracle price, buys (which push price up toward the oracle) are 'informed' — they should pay higher fees.",
          "This is called adverse selection pricing: trades that move the pool toward the true price are likely informed (arbitrage), while trades that move it away are likely uninformed (retail). Charge accordingly.",
          "Ambient Finance implements this with a 'surge' fee that activates when the pool's price deviates significantly from an oracle. The further the deviation, the higher the fee for trades that correct it.",
        ],
        visual: "directional-fee-diagram",
      },
      {
        type: "quiz",
        question: "Why should trades that move the pool price toward the oracle price be charged higher fees?",
        options: [
          "They use more gas",
          "They're likely informed trades (arbitrage) extracting value from stale pool pricing",
          "They increase impermanent loss for LPs",
          "The oracle might be wrong",
        ],
        correctIndex: 1,
        explanation: "If the pool price is stale and the oracle shows the 'true' price, traders who correct the pool price are profiting from information asymmetry. They know the pool is mispriced. Higher fees recapture some of this profit for LPs.",
        wrongExplanation: "Consider who benefits from correcting a mispriced pool. An arbitrageur buys cheap from the pool and sells at the true market price. Is that trade 'helpful' or 'extractive' from the LP's perspective?",
      },
      {
        type: "lesson",
        title: "Module 4 Checkpoint",
        content: [
          "Let's consolidate what we've covered so far across the first four modules:",
          "Module 1 — Custom invariants: the curve shape determines slippage, efficiency, and MEV resistance. Convexity is non-negotiable. Parameterization between known curves is a powerful design tool.",
          "Module 2 — MEV protection: sandwich attacks, backrunning, and JIT liquidity are the major threats. Defenses operate at network level (encrypted mempools, batch auctions) and contract level (dynamic fees, commitment schemes).",
          "Module 3 — Cross-chain routing: liquidity fragmentation hurts everyone. Intent-based systems and virtual pools are converging solutions, but latency remains the core challenge.",
          "Module 4 — Dynamic fees: static fees are a compromise. Volatility-based, directional, and surge fees adapt to market conditions, reclaiming value that would otherwise go to arbitrageurs.",
        ],
        visual: "checkpoint-summary",
      },
      {
        type: "quiz",
        question: "Which combination of techniques would best protect a concentrated liquidity AMM from MEV extraction?",
        options: [
          "Static 0.3% fee + full-range liquidity",
          "Dynamic volatility-based fees + directional pricing + encrypted mempool integration",
          "Lower fees to attract more volume",
          "Wider tick spacing + removing the fee entirely",
        ],
        correctIndex: 1,
        explanation: "Layered defense works best: dynamic fees adapt to market conditions, directional pricing penalizes informed flow, and encrypted mempools prevent front-running at the network level. No single technique is sufficient.",
        wrongExplanation: "Think about the attack vectors: sandwich attacks exploit transaction ordering, arbitrageurs exploit stale pricing, and JIT steals LP fees. You need multiple defenses addressing different attack types.",
      },
    ],
  },

  // ── Module 5: Protocol-Owned Liquidity ──
  {
    id: "protocol-owned-liquidity",
    title: "Protocol-Owned Liquidity",
    subtitle: "When protocols become their own market makers",
    emoji: "🏛️",
    reveals: ["controls", "curve", "reserves", "metrics", "price-chart"],
    steps: [
      {
        type: "lesson",
        title: "The Mercenary Capital Problem",
        content: [
          "Early DeFi protocols attracted liquidity with high token emissions: 'Provide liquidity, earn our governance token at 500% APY.' This worked initially but created a death spiral.",
          "When emissions decrease, mercenary LPs withdraw and move to the next high-yield farm. The protocol's liquidity evaporates, trading becomes expensive, and the token price collapses — triggering more LP exits.",
          "This is the fundamental tension: rented liquidity is unreliable. Protocols need liquidity that stays regardless of short-term incentive changes.",
        ],
        visual: "mercenary-capital-cycle",
      },
      {
        type: "quiz",
        question: "What is the 'mercenary capital' problem in DeFi?",
        options: [
          "Hackers stealing funds from liquidity pools",
          "LPs moving capital to wherever yields are highest, abandoning protocols when incentives decrease",
          "Protocols charging excessive fees to LPs",
          "Validators censoring LP transactions",
        ],
        correctIndex: 1,
        explanation: "Mercenary LPs chase yield without loyalty. When your APY drops from 500% to 50%, they leave immediately — taking liquidity (and often dumping your token) with them. The protocol's health depends on capital that doesn't care about it.",
        wrongExplanation: "Think about what motivates most LPs. If Protocol A offers 200% APY and Protocol B offers 500%, where does the capital go? What happens when Protocol B drops to 100%?",
      },
      {
        type: "lesson",
        title: "Olympus-Style Bonding",
        content: [
          "OlympusDAO pioneered 'bonding': instead of renting liquidity, the protocol buys it. Users sell their LP tokens to the protocol at a discount to the market price, receiving protocol tokens that vest over 5 days.",
          "The result: the protocol permanently owns its own liquidity. It doesn't need to pay ongoing emissions to keep LPs around — the liquidity is on its balance sheet.",
          "Trade-off: bonding creates sell pressure on the protocol token (bond buyers often sell once vested) and the protocol bears the IL risk instead of external LPs.",
        ],
        visual: "bonding-mechanism",
      },
      {
        type: "quiz",
        question: "What is the key advantage of protocol-owned liquidity over traditional LP incentives?",
        options: [
          "It generates more trading fees",
          "The protocol permanently owns the liquidity and doesn't need ongoing emissions to retain it",
          "It eliminates impermanent loss",
          "It makes governance decentralized",
        ],
        correctIndex: 1,
        explanation: "Once the protocol buys its LP tokens, that liquidity is permanent. No need for ongoing yield incentives. The protocol earns trading fees on its own liquidity, creating a sustainable revenue model.",
        wrongExplanation: "The core innovation is ownership vs. rental. Rented liquidity leaves when incentives stop. What's different about liquidity on your own balance sheet?",
      },
      {
        type: "lesson",
        title: "Modern POL Strategies",
        content: [
          "Post-Olympus, POL has evolved. Tokemak v2 acts as a 'liquidity router', directing protocol-owned liquidity to where it's most needed. Protocols deposit assets, and Tokemak's algorithms deploy them optimally.",
          "Concentrated POL: protocols deploy their own liquidity in tight ranges on Uniswap v3, actively managing the position. This requires infrastructure for rebalancing and range adjustment.",
          "Balancer's 80/20 pools are a lightweight POL approach: 80% protocol token, 20% ETH. This gives deep liquidity with minimal ETH exposure. Many DAOs use this as their primary trading pool.",
        ],
        visual: "pol-strategies-comparison",
      },
      {
        type: "quiz",
        question: "Why might a protocol choose an 80/20 Balancer pool for its own liquidity?",
        options: [
          "It has the lowest gas costs",
          "It provides trading liquidity while minimizing the amount of ETH/stables the protocol needs to commit",
          "It guarantees zero impermanent loss",
          "It prevents all MEV extraction",
        ],
        correctIndex: 1,
        explanation: "An 80/20 pool means the protocol only needs to pair 20% ETH/stables against 80% of its own token. For a DAO treasury heavy in its own token, this is efficient — deep liquidity without needing massive stablecoin reserves.",
        wrongExplanation: "Think about a DAO that holds mostly its own governance token. It wants to provide trading liquidity but doesn't have millions in ETH. What ratio lets it use what it already has?",
      },
    ],
  },

  // ── Module 6: Formal Verification ──
  {
    id: "formal-verification",
    title: "Formal Verification of AMMs",
    subtitle: "Mathematical proofs for financial code",
    emoji: "📐",
    reveals: ["controls", "curve", "reserves", "metrics", "price-chart", "learning"],
    steps: [
      {
        type: "lesson",
        title: "Why Testing Isn't Enough",
        content: [
          "Traditional testing checks specific inputs: 'Does swapping 100 USDC work?' But AMMs operate in a continuous space with adversarial actors. You can't test every possible sequence of trades, price movements, and attacks.",
          "Formal verification uses mathematical proofs to guarantee properties hold for ALL possible inputs and states. Instead of 'it worked in 1000 test cases', you get 'it works in every possible case.'",
          "For financial code holding billions, this matters. A single edge case can drain a pool. Formal verification eliminates entire classes of bugs, not just the ones you thought to test.",
        ],
        visual: "testing-vs-formal",
      },
      {
        type: "quiz",
        question: "What is the key difference between testing and formal verification?",
        options: [
          "Formal verification is faster to run",
          "Testing checks specific cases; formal verification proves properties hold for ALL possible inputs",
          "Formal verification only works on Solidity code",
          "Testing finds more bugs than formal verification",
        ],
        correctIndex: 1,
        explanation: "Testing is sampling: you check finite cases and hope they cover the edge cases. Formal verification is exhaustive: a mathematical proof that a property holds universally. No sampling, no gaps.",
        wrongExplanation: "Think about coverage. If you test 1 million random inputs, how confident are you that input 1,000,001 won't break things? What if you could prove it mathematically for all inputs at once?",
      },
      {
        type: "lesson",
        title: "Key Properties to Verify",
        content: [
          "For AMMs, the critical properties to formally verify include:",
          "(1) No-drain: No sequence of trades can extract more value than was deposited. (2) Monotonicity: Larger input always gives larger output (no weird discontinuities). (3) Conservation: The invariant holds before and after every operation.",
          "(4) Rounding safety: Integer rounding never benefits the trader at LP expense. (5) No stuck states: The pool can never reach a state where it rejects all valid trades. (6) Sandwich resistance: For a given fee level, sandwiching is unprofitable up to a proven bound.",
        ],
        visual: "verification-properties",
      },
      {
        type: "quiz",
        question: "Why is 'rounding safety' an important property to formally verify in AMMs?",
        options: [
          "Rounding errors slow down transaction processing",
          "Integer math rounding can systematically leak value from LPs to traders over millions of swaps",
          "It's required by ERC-20 compliance",
          "Rounding affects gas costs significantly",
        ],
        correctIndex: 1,
        explanation: "AMMs use integer math (no floating point in Solidity). If rounding favors the trader by even 1 wei per swap, an attacker can make millions of tiny swaps to drain the pool. Formal verification proves rounding always favors the pool.",
        wrongExplanation: "Think about what happens over millions of trades. If each swap has a tiny rounding error that benefits the trader, those wei add up. Multiply by an attacker making rapid small swaps...",
      },
      {
        type: "lesson",
        title: "Verification Tools and Approaches",
        content: [
          "Certora Prover: The most widely used tool for DeFi verification. You write specifications in CVL (Certora Verification Language) describing properties, and the prover checks them against the Solidity code using SMT solvers.",
          "Symbolic execution tools (like Halmos, HEVM) explore all possible execution paths, checking for violations. They're faster to set up but may struggle with complex mathematical operations.",
          "Lean/Coq/Isabelle: Full theorem provers for verifying the mathematical properties of the invariant itself (not just the Solidity implementation). Used for the deepest guarantees about curve correctness.",
        ],
        visual: "verification-toolchain",
      },
      {
        type: "quiz",
        question: "What does Certora Prover use to verify smart contract properties?",
        options: [
          "Fuzz testing with random inputs",
          "Manual code review by auditors",
          "SMT solvers that mathematically check specifications against the code",
          "Gas profiling and optimization",
        ],
        correctIndex: 2,
        explanation: "Certora translates your specs (CVL) and Solidity code into mathematical formulas, then uses SMT (Satisfiability Modulo Theories) solvers to prove or disprove properties. If a violation exists, it provides a concrete counterexample.",
        wrongExplanation: "Formal verification goes beyond testing and auditing. It uses mathematical logic engines to exhaustively check whether a property can ever be violated. What kind of tool can provide that mathematical guarantee?",
      },
      {
        type: "lesson",
        title: "Course Complete: The Full Picture",
        content: [
          "Congratulations — you've completed the Advanced AMM course. Let's recap the entire arc:",
          "You started with custom invariant design — the foundation that determines every behavioral property of an AMM. You learned that convexity, monotonicity, and boundary behavior aren't just math — they're economic security guarantees.",
          "You explored MEV protection (defense at contract and network layers), cross-chain liquidity (solving fragmentation with intents and virtual pools), dynamic fees (adaptive pricing that responds to market conditions), protocol-owned liquidity (permanent vs. rented capital), and formal verification (mathematical proofs for financial code).",
          "These six topics represent the frontier of AMM research. The design space is vast, and the best protocols will combine innovations across all these dimensions. Now go build something.",
        ],
        visual: "graduation-advanced",
      },
      {
        type: "quiz",
        question: "Which layer of the AMM stack is most fundamental — if you get it wrong, nothing else matters?",
        options: [
          "The fee structure",
          "The cross-chain routing",
          "The invariant curve design",
          "The frontend UI",
        ],
        correctIndex: 2,
        explanation: "The invariant is the foundation. A flawed curve can't be fixed by better fees or MEV protection — it's the mathematical core that defines every trade. Get the invariant right first, then layer on protections.",
        wrongExplanation: "Think about the dependency chain. Fees, MEV defenses, and routing all operate on top of the core swap mechanism. What defines that mechanism?",
      },
    ],
  },
];

// Tab mapping for advanced modules
export const ADVANCED_TAB_MAP: Record<string, string> = {
  "invariant-design": "slippage",
  "mev-protection": "impermanent-loss",
  "cross-chain": "impermanent-loss",
  "dynamic-fees": "fees",
  "protocol-owned-liquidity": "time-sim",
  "formal-verification": "slippage",
};
