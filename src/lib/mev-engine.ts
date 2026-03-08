/**
 * MEV Impact Analyzer Engine
 * Simulates sandwich attacks, backruns, JIT liquidity, and value extraction
 * against custom AMM invariant curves.
 */

export interface MEVSimConfig {
  bins: number[];
  feeRate: number;
  numBlocks: number;
  swapsPerBlock: number;
  attackerBudget: number; // in units of token Y
  sandwichEnabled: boolean;
  backrunEnabled: boolean;
  jitEnabled: boolean;
}

export interface MEVEvent {
  block: number;
  type: "swap" | "sandwich" | "backrun" | "jit";
  victimSize: number;
  attackerProfit: number;
  lpLoss: number;
  priceImpact: number;
  gasUsed: number;
}

export interface MEVFlowBreakdown {
  lpEarnings: number;
  arbitrageurProfit: number;
  searcherProfit: number;
  protocolFees: number;
  totalVolume: number;
}

export interface MEVResult {
  events: MEVEvent[];
  flow: MEVFlowBreakdown;
  blockSummaries: BlockSummary[];
  metrics: {
    sandwichCount: number;
    backrunCount: number;
    jitCount: number;
    avgSandwichProfit: number;
    avgBackrunProfit: number;
    avgJitProfit: number;
    totalExtractedValue: number;
    lpValueLost: number;
    protectionScore: number; // 0-100, higher = more MEV resistant
    slippageAmplification: number;
  };
  cumulativeExtraction: { block: number; sandwich: number; backrun: number; jit: number; lpFees: number }[];
}

export interface BlockSummary {
  block: number;
  swapCount: number;
  mevCount: number;
  extractedValue: number;
  lpFees: number;
  price: number;
}

function computeSwapOutput(
  bins: number[],
  reserveX: number,
  reserveY: number,
  amountIn: number,
  isXtoY: boolean,
  feeRate: number
): { amountOut: number; priceImpact: number; fee: number } {
  const k = reserveX * reserveY;
  const fee = amountIn * feeRate;
  const netIn = amountIn - fee;
  
  // Use bin concentration to modulate effective liquidity
  const binCount = bins.length || 64;
  const priceRatio = reserveY / reserveX;
  const activeBin = Math.min(binCount - 1, Math.max(0, Math.floor((priceRatio / 5000) * binCount)));
  const concentration = bins[activeBin] || 0.5;
  const effectiveLiquidity = 1 + concentration * 2;
  
  let amountOut: number;
  if (isXtoY) {
    const newReserveX = reserveX + netIn / effectiveLiquidity;
    const newReserveY = k / newReserveX;
    amountOut = reserveY - newReserveY;
  } else {
    const newReserveY = reserveY + netIn / effectiveLiquidity;
    const newReserveX = k / newReserveY;
    amountOut = reserveX - newReserveX;
  }
  
  const spotBefore = reserveY / reserveX;
  const spotAfter = isXtoY ? (reserveY - amountOut) / (reserveX + netIn) : (reserveY + netIn) / (reserveX - amountOut);
  const priceImpact = Math.abs(spotAfter - spotBefore) / spotBefore;
  
  return { amountOut: Math.max(0, amountOut), priceImpact, fee };
}

export function simulateMEV(config: MEVSimConfig): MEVResult {
  const { bins, feeRate, numBlocks, swapsPerBlock, attackerBudget } = config;
  
  let reserveX = 100;
  let reserveY = 200_000;
  const events: MEVEvent[] = [];
  const blockSummaries: BlockSummary[] = [];
  const cumulative: MEVResult["cumulativeExtraction"] = [];
  
  let totalSandwich = 0, totalBackrun = 0, totalJit = 0, totalLpFees = 0;
  let sandwichCount = 0, backrunCount = 0, jitCount = 0;
  let totalExtracted = 0, totalLpLoss = 0, totalVolume = 0;

  for (let block = 0; block < numBlocks; block++) {
    let blockMev = 0;
    let blockFees = 0;
    let blockMevCount = 0;

    for (let s = 0; s < swapsPerBlock; s++) {
      const isXtoY = Math.random() > 0.5;
      const baseSize = (Math.random() * 0.02 + 0.001) * reserveY;
      const swapResult = computeSwapOutput(bins, reserveX, reserveY, baseSize, isXtoY, feeRate);
      blockFees += swapResult.fee;
      totalVolume += baseSize;

      // Apply swap
      if (isXtoY) {
        reserveX += baseSize - swapResult.fee;
        reserveY -= swapResult.amountOut;
      } else {
        reserveY += baseSize - swapResult.fee;
        reserveX -= swapResult.amountOut;
      }

      // Sandwich attack
      if (config.sandwichEnabled && swapResult.priceImpact > 0.001 && baseSize > reserveY * 0.005) {
        const frontrunSize = Math.min(attackerBudget, baseSize * 0.8);
        const frontResult = computeSwapOutput(bins, reserveX, reserveY, frontrunSize, isXtoY, feeRate);
        const backResult = computeSwapOutput(bins, reserveX, reserveY, frontrunSize, !isXtoY, feeRate);
        const profit = Math.max(0, backResult.amountOut - frontrunSize - frontResult.fee - backResult.fee);
        
        if (profit > 0) {
          const lpLoss = profit * 0.6;
          sandwichCount++;
          totalSandwich += profit;
          totalExtracted += profit;
          totalLpLoss += lpLoss;
          blockMevCount++;
          blockMev += profit;
          events.push({
            block,
            type: "sandwich",
            victimSize: baseSize,
            attackerProfit: profit,
            lpLoss,
            priceImpact: swapResult.priceImpact * 2.1,
            gasUsed: 250000 + Math.random() * 100000,
          });
        }
      }

      // Backrun
      if (config.backrunEnabled && swapResult.priceImpact > 0.002) {
        const arbSize = Math.min(attackerBudget * 0.5, baseSize * 0.3);
        const arbResult = computeSwapOutput(bins, reserveX, reserveY, arbSize, !isXtoY, feeRate);
        const profit = Math.max(0, arbResult.amountOut * (1 + swapResult.priceImpact) - arbSize - arbResult.fee);
        
        if (profit > 0) {
          backrunCount++;
          totalBackrun += profit;
          totalExtracted += profit;
          blockMevCount++;
          blockMev += profit;
          events.push({
            block,
            type: "backrun",
            victimSize: baseSize,
            attackerProfit: profit,
            lpLoss: profit * 0.3,
            priceImpact: swapResult.priceImpact,
            gasUsed: 120000 + Math.random() * 50000,
          });
          totalLpLoss += profit * 0.3;
        }
      }

      // JIT Liquidity
      if (config.jitEnabled && baseSize > reserveY * 0.01) {
        const jitLiquidity = baseSize * 2;
        const jitFee = baseSize * feeRate * 0.8;
        const profit = Math.max(0, jitFee - baseSize * 0.0005);
        
        if (profit > 0) {
          jitCount++;
          totalJit += profit;
          totalExtracted += profit;
          const lpLoss = jitFee * 0.7; // JIT steals fees from passive LPs
          totalLpLoss += lpLoss;
          blockMevCount++;
          blockMev += profit;
          events.push({
            block,
            type: "jit",
            victimSize: baseSize,
            attackerProfit: profit,
            lpLoss,
            priceImpact: 0,
            gasUsed: 180000 + Math.random() * 70000,
          });
        }
      }
    }

    totalLpFees += blockFees;
    blockSummaries.push({
      block,
      swapCount: swapsPerBlock,
      mevCount: blockMevCount,
      extractedValue: blockMev,
      lpFees: blockFees,
      price: reserveY / reserveX,
    });

    cumulative.push({
      block,
      sandwich: totalSandwich,
      backrun: totalBackrun,
      jit: totalJit,
      lpFees: totalLpFees,
    });
  }

  // Protection score: higher concentrated liquidity = harder to sandwich
  const avgBin = bins.length > 0 ? bins.reduce((a, b) => a + b, 0) / bins.length : 0.5;
  const binVariance = bins.length > 0 ? bins.reduce((a, b) => a + (b - avgBin) ** 2, 0) / bins.length : 0.1;
  const concentrationFactor = Math.min(1, Math.sqrt(binVariance) * 5);
  const extractionRatio = totalExtracted / Math.max(1, totalExtracted + totalLpFees);
  // Score: low extraction ratio + high concentration = better protection
  const protectionScore = Math.max(0, Math.min(100,
    (1 - extractionRatio) * 60 + concentrationFactor * 40
  ));

  return {
    events,
    flow: {
      lpEarnings: totalLpFees - totalLpLoss,
      arbitrageurProfit: totalBackrun,
      searcherProfit: totalSandwich + totalJit,
      protocolFees: totalLpFees * 0.1,
      totalVolume,
    },
    blockSummaries,
    metrics: {
      sandwichCount,
      backrunCount,
      jitCount,
      avgSandwichProfit: sandwichCount > 0 ? totalSandwich / sandwichCount : 0,
      avgBackrunProfit: backrunCount > 0 ? totalBackrun / backrunCount : 0,
      avgJitProfit: jitCount > 0 ? totalJit / jitCount : 0,
      totalExtractedValue: totalExtracted,
      lpValueLost: totalLpLoss,
      protectionScore,
      slippageAmplification: sandwichCount > 0 ? events.filter(e => e.type === "sandwich").reduce((a, e) => a + e.priceImpact, 0) / sandwichCount / 0.002 : 1,
    },
    cumulativeExtraction: cumulative,
  };
}
