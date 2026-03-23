// Testnet Simulation Engine — runs AMM market simulation with bot traders
import { createPool, executeTrade, poolPrice, type PoolState } from "./amm-engine";
import type { BotProgram, BotBlockInstance } from "./bot-blocks";
import { getBotBlockDef } from "./bot-blocks";

// ─── Market Types ───────────────────────────────────────────

export type MarketType = "token_swap" | "prediction" | "stablecoin" | "custom";

export interface MarketConfig {
  type: MarketType;
  initialPrice: number;
  volatility: number;      // annualized %
  drift: number;            // annualized %
  meanRevSpeed: number;     // for stablecoin (Ornstein-Uhlenbeck)
  jumpProb: number;         // daily jump probability %
  jumpSize: number;         // avg jump magnitude %
  expiryTicks: number;      // for prediction markets
  customTarget: number;     // for prediction market target / stablecoin peg
}

export interface PoolConfig {
  reserveX: number;
  reserveY: number;
  feeRate: number;
}

export interface SimConfig {
  market: MarketConfig;
  pool: PoolConfig;
  durationTicks: number;
  ticksPerSecond: number;
}

// ─── State ──────────────────────────────────────────────────

export interface TradeEvent {
  tick: number;
  botId: string;
  botName: string;
  botColor: string;
  direction: "buyX" | "buyY";
  inputAmount: number;
  outputAmount: number;
  slippage: number;
  priceAfter: number;
}

export interface BotState {
  id: string;
  name: string;
  color: string;
  capital: number;         // remaining Y (quote)
  holdingsX: number;       // token X held
  holdingsY: number;       // token Y held
  initialCapital: number;
  pnl: number;
  pnlPct: number;
  tradeCount: number;
  lastTradeTick: number;
  cooldownUntil: number;
  enabled: boolean;
  // Internal EMA state
  emaFast: number;
  emaSlow: number;
  prevSignals: Record<string, number>;
}

export interface TickSnapshot {
  tick: number;
  poolPrice: number;
  externalPrice: number;
  reserveX: number;
  reserveY: number;
  totalFees: number;
  trades: TradeEvent[];
  botStates: { id: string; pnlPct: number; capital: number }[];
}

export interface SimState {
  tick: number;
  running: boolean;
  pool: PoolState;
  externalPrice: number;
  bots: BotState[];
  history: TickSnapshot[];
  trades: TradeEvent[];
  totalVolume: number;
  marketConfig: MarketConfig;
}

// ─── Price Generators ───────────────────────────────────────

function boxMuller(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

function gbmPrice(current: number, vol: number, drift: number, dt: number, jumpProb: number, jumpSize: number): number {
  const dailyVol = (vol / 100) / Math.sqrt(252);
  const dailyDrift = (drift / 100) / 252;
  const z = boxMuller();
  const jump = Math.random() < jumpProb / 100 ? (Math.random() - 0.5) * 2 * (jumpSize / 100) : 0;
  return current * Math.exp((dailyDrift - 0.5 * dailyVol * dailyVol) * dt + dailyVol * Math.sqrt(dt) * z + jump);
}

function ouPrice(current: number, target: number, speed: number, vol: number, dt: number): number {
  const dailyVol = (vol / 100) / Math.sqrt(252);
  const z = boxMuller();
  const mean = current + speed * (target - current) * dt;
  return Math.max(0.001, mean + dailyVol * Math.sqrt(dt) * z);
}

function predictionPrice(current: number, target: number, ticksLeft: number, vol: number, dt: number): number {
  if (ticksLeft <= 0) return target;
  const z = boxMuller();
  const pull = (target - current) * (1 / Math.max(ticksLeft, 1)) * 0.5;
  const noise = (vol / 100) / Math.sqrt(252) * Math.sqrt(dt) * z * 0.3;
  return Math.max(0.001, Math.min(current + pull + noise, target * 2));
}

function stepExternalPrice(config: MarketConfig, current: number, tick: number, dt: number): number {
  switch (config.type) {
    case "token_swap":
      return gbmPrice(current, config.volatility, config.drift, dt, config.jumpProb, config.jumpSize);
    case "stablecoin":
      return ouPrice(current, config.customTarget || 1, config.meanRevSpeed, config.volatility, dt);
    case "prediction":
      return predictionPrice(current, config.customTarget || 1, config.expiryTicks - tick, config.volatility, dt);
    case "custom":
      return gbmPrice(current, config.volatility, config.drift, dt, config.jumpProb, config.jumpSize);
    default:
      return current;
  }
}

// ─── Bot Executor ───────────────────────────────────────────

interface BotAction {
  type: "buy" | "sell" | "skip" | "close_all" | "flip";
  amount: number;
  sizeMode: string;
}

function computeEMA(prev: number, value: number, period: number): number {
  const k = 2 / (period + 1);
  return prev === 0 ? value : value * k + prev * (1 - k);
}

function evaluateBotBlocks(
  blocks: BotBlockInstance[],
  state: SimState,
  bot: BotState,
  priceHistory: number[],
): BotAction | null {
  for (const block of blocks) {
    const def = getBotBlockDef(block.blockId);
    if (!def) continue;

    switch (block.blockId) {
      // Timing blocks — return skip if not triggered
      case "tim_every_n": {
        const n = (block.params.n as number) || 1;
        if (state.tick % n !== 0) return { type: "skip", amount: 0, sizeMode: "" };
        break;
      }
      case "tim_poisson": {
        const rate = (block.params.rate as number) || 10;
        const prob = rate / 100;
        if (Math.random() > prob) return { type: "skip", amount: 0, sizeMode: "" };
        break;
      }
      case "tim_delay": {
        const ticks = (block.params.ticks as number) || 5;
        if (state.tick < ticks) return { type: "skip", amount: 0, sizeMode: "" };
        break;
      }

      // Modifiers — enforce constraints
      case "mod_cooldown": {
        const coolTicks = (block.params.ticks as number) || 5;
        if (state.tick < bot.cooldownUntil) return { type: "skip", amount: 0, sizeMode: "" };
        // Set cooldown on next trade
        bot.cooldownUntil = state.tick + coolTicks;
        break;
      }
      case "mod_stop_loss": {
        const threshold = (block.params.value as number) || 10;
        if (bot.pnlPct < -threshold) return { type: "close_all", amount: 0, sizeMode: "" };
        break;
      }
      case "mod_take_profit": {
        const target = (block.params.value as number) || 20;
        if (bot.pnlPct > target) return { type: "close_all", amount: 0, sizeMode: "" };
        break;
      }

      // Conditions — check and potentially skip
      case "cond_gt": {
        // Use previous sensor value from context
        break;
      }
      case "cond_random": {
        const prob = (block.params.probability as number) || 0.5;
        if (Math.random() > prob) return null; // condition failed
        break;
      }
      case "cond_ema_cross": {
        const fast = (block.params.fast as number) || 10;
        const slow = (block.params.slow as number) || 30;
        const dir = block.params.direction as string;
        const price = poolPrice(state.pool);
        const emaF = computeEMA(bot.emaFast, price, fast);
        const emaS = computeEMA(bot.emaSlow, price, slow);
        bot.emaFast = emaF;
        bot.emaSlow = emaS;
        if (dir === "bullish" && emaF <= emaS) return null;
        if (dir === "bearish" && emaF >= emaS) return null;
        break;
      }

      // Structural — recurse into children
      case "bot_if":
      case "bot_repeat": {
        if (block.children.length > 0) {
          const result = evaluateBotBlocks(block.children, state, bot, priceHistory);
          if (result) return result;
        }
        break;
      }
      case "bot_else": {
        if (block.children.length > 0) {
          const result = evaluateBotBlocks(block.children, state, bot, priceHistory);
          if (result) return result;
        }
        break;
      }

      // Actions — return trade
      case "act_buy":
        return { type: "buy", amount: block.params.amount as number, sizeMode: block.params.size_mode as string };
      case "act_sell":
        return { type: "sell", amount: block.params.amount as number, sizeMode: block.params.size_mode as string };
      case "act_skip":
        return { type: "skip", amount: 0, sizeMode: "" };
      case "act_close_all":
        return { type: "close_all", amount: 0, sizeMode: "" };
      case "act_flip":
        return { type: "flip", amount: block.params.amount as number, sizeMode: block.params.size_mode as string };

      default:
        // Sensors, math blocks — evaluate children
        if (block.children.length > 0) {
          const result = evaluateBotBlocks(block.children, state, bot, priceHistory);
          if (result) return result;
        }
        break;
    }
  }
  return null;
}

function resolveTradeAmount(action: BotAction, bot: BotState, pool: PoolState, externalPrice: number): number {
  const price = poolPrice(pool);
  switch (action.sizeMode) {
    case "pct_capital":
      return (action.amount / 100) * bot.holdingsY;
    case "fixed":
      return Math.min(action.amount, bot.holdingsY);
    case "close_gap": {
      const deviation = Math.abs(price - externalPrice);
      return Math.min(deviation * pool.x * 0.5, bot.holdingsY * 0.5);
    }
    default:
      return Math.min(action.amount, bot.holdingsY);
  }
}

// ─── Simulation Core ────────────────────────────────────────

export function createSimState(config: SimConfig, bots: BotProgram[]): SimState {
  const pool = createPool(config.pool.reserveX, config.pool.reserveY, config.pool.feeRate);
  const botStates: BotState[] = bots.filter(b => b.enabled).map(b => ({
    id: b.id,
    name: b.name,
    color: b.color,
    capital: b.capital,
    holdingsX: 0,
    holdingsY: b.capital,
    initialCapital: b.capital,
    pnl: 0,
    pnlPct: 0,
    tradeCount: 0,
    lastTradeTick: -100,
    cooldownUntil: 0,
    enabled: b.enabled,
    emaFast: 0,
    emaSlow: 0,
    prevSignals: {},
  }));

  return {
    tick: 0,
    running: false,
    pool,
    externalPrice: config.market.initialPrice,
    bots: botStates,
    history: [],
    trades: [],
    totalVolume: 0,
    marketConfig: config.market,
  };
}

export function stepSimulation(
  state: SimState,
  botPrograms: BotProgram[],
): SimState {
  const tick = state.tick + 1;
  const dt = 1; // 1 tick = 1 time unit

  // Step external price
  const externalPrice = stepExternalPrice(state.marketConfig, state.externalPrice, tick, dt);

  let pool = { ...state.pool };
  const tickTrades: TradeEvent[] = [];
  const bots = state.bots.map(b => ({ ...b }));

  // Execute each bot
  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    if (!bot.enabled) continue;

    const program = botPrograms.find(p => p.id === bot.id);
    if (!program || program.blocks.length === 0) continue;

    const priceHistory = state.history.map(h => h.poolPrice);
    const action = evaluateBotBlocks(program.blocks, { ...state, tick, externalPrice, pool }, bot, priceHistory);

    if (!action || action.type === "skip") continue;

    if (action.type === "close_all") {
      // Sell all X holdings
      if (bot.holdingsX > 0) {
        const sellAmountY = bot.holdingsX * poolPrice(pool);
        try {
          const { pool: newPool, result } = executeTrade(pool, bot.holdingsX, "buyY");
          pool = newPool;
          bot.holdingsY += result.output;
          bot.holdingsX = 0;
          bot.tradeCount++;
          bot.lastTradeTick = tick;
          tickTrades.push({
            tick, botId: bot.id, botName: bot.name, botColor: bot.color,
            direction: "buyY", inputAmount: bot.holdingsX, outputAmount: result.output,
            slippage: result.slippagePct, priceAfter: poolPrice(newPool),
          });
        } catch { /* pool exhausted */ }
      }
      continue;
    }

    const tradeAmount = resolveTradeAmount(action, bot, pool, externalPrice);
    if (tradeAmount <= 0.01) continue;

    try {
      if (action.type === "buy" || action.type === "flip") {
        // Buy X by selling Y
        const inputY = Math.min(tradeAmount, bot.holdingsY * 0.95);
        if (inputY <= 0.01) continue;
        const { pool: newPool, result } = executeTrade(pool, inputY, "buyX");
        pool = newPool;
        bot.holdingsY -= inputY;
        bot.holdingsX += result.output;
        bot.tradeCount++;
        bot.lastTradeTick = tick;
        tickTrades.push({
          tick, botId: bot.id, botName: bot.name, botColor: bot.color,
          direction: "buyX" as const, inputAmount: inputY, outputAmount: result.output,
          slippage: result.slippagePct, priceAfter: poolPrice(newPool),
        });
      } else if (action.type === "sell") {
        // Sell X for Y
        const price = poolPrice(pool);
        const xToSell = Math.min(tradeAmount / price, bot.holdingsX * 0.95);
        if (xToSell <= 0.001) continue;
        const { pool: newPool, result } = executeTrade(pool, xToSell, "buyY");
        pool = newPool;
        bot.holdingsX -= xToSell;
        bot.holdingsY += result.output;
        bot.tradeCount++;
        bot.lastTradeTick = tick;
        tickTrades.push({
          tick, botId: bot.id, botName: bot.name, botColor: bot.color,
          direction: "buyY", inputAmount: xToSell, outputAmount: result.output,
          slippage: result.slippagePct, priceAfter: poolPrice(newPool),
        });
      }
    } catch {
      // Pool exhausted or invalid trade
    }

    // Update bot P&L
    const currentValue = bot.holdingsX * poolPrice(pool) + bot.holdingsY;
    bot.pnl = currentValue - bot.initialCapital;
    bot.pnlPct = (bot.pnl / bot.initialCapital) * 100;
  }

  // Build snapshot
  const snapshot: TickSnapshot = {
    tick,
    poolPrice: poolPrice(pool),
    externalPrice,
    reserveX: pool.x,
    reserveY: pool.y,
    totalFees: pool.totalFees,
    trades: tickTrades,
    botStates: bots.map(b => ({ id: b.id, pnlPct: b.pnlPct, capital: b.holdingsX * poolPrice(pool) + b.holdingsY })),
  };

  const volume = tickTrades.reduce((sum, t) => sum + t.inputAmount, 0);

  return {
    tick,
    running: state.running,
    pool,
    externalPrice,
    bots,
    history: [...state.history, snapshot],
    trades: [...state.trades, ...tickTrades],
    totalVolume: state.totalVolume + volume,
    marketConfig: state.marketConfig,
  };
}

// ─── Default configs ────────────────────────────────────────

export function defaultMarketConfig(type: MarketType): MarketConfig {
  switch (type) {
    case "token_swap":
      return { type, initialPrice: 100, volatility: 60, drift: 0, meanRevSpeed: 0, jumpProb: 2, jumpSize: 5, expiryTicks: 0, customTarget: 0 };
    case "stablecoin":
      return { type, initialPrice: 1, volatility: 5, drift: 0, meanRevSpeed: 0.1, jumpProb: 0.5, jumpSize: 0.5, expiryTicks: 0, customTarget: 1 };
    case "prediction":
      return { type, initialPrice: 0.5, volatility: 30, drift: 0, meanRevSpeed: 0, jumpProb: 1, jumpSize: 3, expiryTicks: 500, customTarget: 1 };
    case "custom":
      return { type, initialPrice: 100, volatility: 40, drift: 0, meanRevSpeed: 0, jumpProb: 1, jumpSize: 3, expiryTicks: 0, customTarget: 100 };
  }
}

export function defaultPoolConfig(marketConfig: MarketConfig): PoolConfig {
  const price = marketConfig.initialPrice;
  const totalLiq = 100000;
  return {
    reserveX: totalLiq / (2 * price),
    reserveY: totalLiq / 2,
    feeRate: 0.003,
  };
}
