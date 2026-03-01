import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Download, Fuel, Settings2, FileCode2, ChevronDown, ChevronRight, Zap, FileJson, FileText, Share2, HelpCircle, Info, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useChartColors } from "@/hooks/use-chart-theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CurveType = "constant_product" | "stableswap" | "concentrated" | "weighted";

const curveOptions: { id: CurveType; label: string; desc: string }[] = [
  { id: "constant_product", label: "Constant Product", desc: "x·y = k (Uniswap V2)" },
  { id: "stableswap", label: "StableSwap", desc: "Hybrid invariant (Curve)" },
  { id: "concentrated", label: "Concentrated", desc: "Tick-based ranges (V3)" },
  { id: "weighted", label: "Weighted Pool", desc: "Configurable weights (Balancer)" },
];

const DEPLOY_HELP: Record<string, { title: string; desc: string }> = {
  contractName: { title: "Contract Name", desc: "The Solidity contract identifier. Must be a valid Solidity name." },
  curveType: { title: "Curve Type", desc: "The AMM invariant your contract implements." },
  swapFee: { title: "Swap Fee", desc: "Percentage taken from each trade. Goes to liquidity providers." },
  adminFee: { title: "Admin Fee", desc: "Percentage of the swap fee that goes to the protocol/admin." },
  gasPrice: { title: "Gas Price (gwei)", desc: "Current network gas price." },
  ethPrice: { title: "ETH Price", desc: "Current ETH market price in USD. Auto-fetched from CoinGecko." },
};

function DeployHelpBtn({ id }: { id: string }) {
  const help = DEPLOY_HELP[id];
  if (!help) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" type="button">
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-52 p-2.5">
        <h4 className="text-[11px] font-semibold text-foreground mb-1">{help.title}</h4>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{help.desc}</p>
      </PopoverContent>
    </Popover>
  );
}

const generateSolidity = (
  curve: CurveType,
  fee: number,
  tokens: number,
  name: string,
  adminFee: number,
  invariantExpr?: string,
  feeStructure?: number[]
) => {
  const feeScaled = Math.round(fee * 100);
  const adminFeeScaled = Math.round(adminFee * 100);

  const feeComment = feeStructure 
    ? `\n    // Fee structure: ${feeStructure.length} points, avg ${(feeStructure.reduce((a,b) => a+b, 0) / feeStructure.length).toFixed(0)} bps`
    : "";
  const invariantComment = invariantExpr 
    ? `\n    // Invariant: ${invariantExpr}` 
    : "";

  const common = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ${name}
/// @notice Auto-generated AMM contract — review before production use${invariantComment}${feeComment}
contract ${name.replace(/\s+/g, "")} is ReentrancyGuard, Ownable {

    uint256 public constant FEE_BPS = ${feeScaled};        // ${fee}%
    uint256 public constant ADMIN_FEE_BPS = ${adminFeeScaled}; // ${adminFee}%
    uint256 public constant NUM_TOKENS = ${tokens};
    uint256 public constant BPS = 10000;
`;

  switch (curve) {
    case "constant_product":
      return `${common}
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant returns (uint256 shares) {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);
        if (totalLiquidity == 0) { shares = sqrt(amountA * amountB); }
        else { shares = min((amountA * totalLiquidity) / reserveA, (amountB * totalLiquidity) / reserveB); }
        reserveA += amountA; reserveB += amountB;
        totalLiquidity += shares; liquidity[msg.sender] += shares;
    }

    function swap(address tokenIn, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");
        bool isA = tokenIn == address(tokenA);
        (uint256 resIn, uint256 resOut) = isA ? (reserveA, reserveB) : (reserveB, reserveA);
        uint256 fee = (amountIn * FEE_BPS) / BPS;
        uint256 adminFee = (fee * ADMIN_FEE_BPS) / BPS;
        uint256 netIn = amountIn - fee;
        amountOut = (resOut * netIn) / (resIn + netIn);
        if (isA) { reserveA += amountIn - adminFee; reserveB -= amountOut; tokenA.transferFrom(msg.sender, address(this), amountIn); tokenB.transfer(msg.sender, amountOut); }
        else { reserveB += amountIn - adminFee; reserveA -= amountOut; tokenB.transferFrom(msg.sender, address(this), amountIn); tokenA.transfer(msg.sender, amountOut); }
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) { uint256 z = (x + 1) / 2; y = x; while (z < y) { y = z; z = (x / z + z) / 2; } }
    function min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
}`;

    case "stableswap":
      return `${common}
    uint256 public constant A = 100;
    IERC20[NUM_TOKENS] public tokens;
    uint256[NUM_TOKENS] public balances;
    uint256 public totalSupply;

    constructor(address[${tokens}] memory _tokens) Ownable(msg.sender) { for (uint i = 0; i < NUM_TOKENS; i++) { tokens[i] = IERC20(_tokens[i]); } }

    function getD(uint256[NUM_TOKENS] memory xp) internal pure returns (uint256) {
        uint256 S; for (uint i = 0; i < NUM_TOKENS; i++) S += xp[i]; if (S == 0) return 0;
        uint256 D = S; uint256 Ann = A * NUM_TOKENS;
        for (uint _i = 0; _i < 255; _i++) { uint256 D_P = D; for (uint j = 0; j < NUM_TOKENS; j++) { D_P = (D_P * D) / (xp[j] * NUM_TOKENS); }
            uint256 Dprev = D; D = ((Ann * S + D_P * NUM_TOKENS) * D) / ((Ann - 1) * D + (NUM_TOKENS + 1) * D_P);
            if (D > Dprev) { if (D - Dprev <= 1) return D; } else { if (Dprev - D <= 1) return D; } } return D;
    }

    function swap(uint256 i, uint256 j, uint256 dx) external nonReentrant returns (uint256 dy) {
        require(i < NUM_TOKENS && j < NUM_TOKENS && i != j, "Invalid");
        tokens[i].transferFrom(msg.sender, address(this), dx); uint256 fee = (dx * FEE_BPS) / BPS;
        uint256[NUM_TOKENS] memory xp = balances; xp[i] += dx - fee;
        uint256 D = getD(xp); uint256 y = xp[j]; dy = balances[j] - y;
        balances[i] += dx - fee; balances[j] -= dy; tokens[j].transfer(msg.sender, dy);
    }
}`;

    case "concentrated":
      return `${common}
    int24 public constant TICK_SPACING = 60;
    struct Position { int24 tickLower; int24 tickUpper; uint128 liquidity; }
    IERC20 public immutable token0; IERC20 public immutable token1;
    int24 public currentTick; uint160 public sqrtPriceX96;
    mapping(bytes32 => Position) public positions;

    constructor(address _token0, address _token1, uint160 _initialSqrtPrice) Ownable(msg.sender) { token0 = IERC20(_token0); token1 = IERC20(_token1); sqrtPriceX96 = _initialSqrtPrice; }

    function mint(int24 tickLower, int24 tickUpper, uint128 amount) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(tickLower < tickUpper, "Invalid range"); require(tickLower % TICK_SPACING == 0 && tickUpper % TICK_SPACING == 0, "Tick spacing");
        bytes32 key = keccak256(abi.encodePacked(msg.sender, tickLower, tickUpper));
        positions[key].tickLower = tickLower; positions[key].tickUpper = tickUpper; positions[key].liquidity += amount;
        amount0 = uint256(amount) * 1e18 / uint256(sqrtPriceX96); amount1 = uint256(amount) * uint256(sqrtPriceX96) / (1 << 96);
        token0.transferFrom(msg.sender, address(this), amount0); token1.transferFrom(msg.sender, address(this), amount1);
    }

    function swap(bool zeroForOne, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        uint256 fee = (amountIn * FEE_BPS) / BPS; uint256 netIn = amountIn - fee; amountOut = netIn;
        if (zeroForOne) { token0.transferFrom(msg.sender, address(this), amountIn); token1.transfer(msg.sender, amountOut); }
        else { token1.transferFrom(msg.sender, address(this), amountIn); token0.transfer(msg.sender, amountOut); }
    }
}`;

    case "weighted":
      return `${common}
    uint256 public constant WEIGHT_A = 8000; uint256 public constant WEIGHT_B = 2000;
    IERC20 public immutable tokenA; IERC20 public immutable tokenB;
    uint256 public balanceA; uint256 public balanceB;

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) { tokenA = IERC20(_tokenA); tokenB = IERC20(_tokenB); }

    function swap(address tokenIn, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        bool isA = tokenIn == address(tokenA);
        (uint256 balIn, uint256 balOut, uint256 wIn, uint256 wOut) = isA ? (balanceA, balanceB, WEIGHT_A, WEIGHT_B) : (balanceB, balanceA, WEIGHT_B, WEIGHT_A);
        uint256 fee = (amountIn * FEE_BPS) / BPS; uint256 netIn = amountIn - fee;
        uint256 ratio = (netIn * BPS) / (balIn + netIn); uint256 weightedRatio = (ratio * wIn) / wOut;
        amountOut = (balOut * weightedRatio) / BPS;
        if (isA) { balanceA += amountIn; balanceB -= amountOut; tokenA.transferFrom(msg.sender, address(this), amountIn); tokenB.transfer(msg.sender, amountOut); }
        else { balanceB += amountIn; balanceA -= amountOut; tokenB.transferFrom(msg.sender, address(this), amountIn); tokenA.transfer(msg.sender, amountOut); }
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external nonReentrant { tokenA.transferFrom(msg.sender, address(this), amountA); tokenB.transferFrom(msg.sender, address(this), amountB); balanceA += amountA; balanceB += amountB; }
}`;
  }
};

const gasEstimates: Record<CurveType, { deploy: number; swap: number; addLiq: number; removeLiq: number }> = {
  constant_product: { deploy: 1_200_000, swap: 95_000, addLiq: 130_000, removeLiq: 110_000 },
  stableswap: { deploy: 2_400_000, swap: 180_000, addLiq: 210_000, removeLiq: 170_000 },
  concentrated: { deploy: 3_800_000, swap: 220_000, addLiq: 280_000, removeLiq: 240_000 },
  weighted: { deploy: 1_600_000, swap: 115_000, addLiq: 150_000, removeLiq: 125_000 },
};

interface Asset {
  id: string;
  symbol: string;
  reserve: number;
  weight: number;
  color: string;
}

interface SavedInvariant {
  expression: string;
  presetId: string;
  weightA: number;
  weightB: number;
  kValue: number;
  amplification: number;
  rangeLower: number;
  rangeUpper: number;
}

const DeploymentExport = ({ assets, savedInvariant, savedFees }: { assets?: Asset[]; savedInvariant?: SavedInvariant | null; savedFees?: number[] | null }) => {
  const colors = useChartColors();
  const [curve, setCurve] = useState<CurveType>("constant_product");
  const [fee, setFee] = useState(0.3);
  const [adminFee, setAdminFee] = useState(10);
  const [tokens, setTokens] = useState(assets?.length ?? 2);
  const [contractName, setContractName] = useState(assets && assets.length > 2 ? "MultiAssetAMM" : "MyAMM");
  const [gasPrice, setGasPrice] = useState(30);
  const [ethPrice, setEthPrice] = useState(3500);
  const [ethPriceLoading, setEthPriceLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(true);
  const [exportFormat, setExportFormat] = useState<"solidity" | "json" | "markdown">("solidity");

  // Fetch ETH price from free API
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const res = await fetch("https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD");
        const data = await res.json();
        if (data.USD) {
          setEthPrice(Math.round(data.USD));
        }
      } catch {
        // Fallback to default
      } finally {
        setEthPriceLoading(false);
      }
    };
    fetchEthPrice();
  }, []);

  // Use saved fee structure to set swap fee
  useEffect(() => {
    if (savedFees && savedFees.length > 0) {
      const avgBps = savedFees.reduce((a, b) => a + b, 0) / savedFees.length;
      setFee(parseFloat((avgBps / 100).toFixed(2)));
    }
  }, [savedFees]);

  const solidity = useMemo(() => generateSolidity(curve, fee, tokens, contractName, adminFee, savedInvariant?.expression, savedFees || undefined), [curve, fee, tokens, contractName, adminFee, savedInvariant, savedFees]);

  const gas = gasEstimates[curve];
  const gasData = useMemo(() => {
    const toUsd = (g: number) => parseFloat(((g * gasPrice * 1e-9) * ethPrice).toFixed(2));
    return [
      { op: "Deploy", gas: gas.deploy, usd: toUsd(gas.deploy) },
      { op: "Swap", gas: gas.swap, usd: toUsd(gas.swap) },
      { op: "Add Liq", gas: gas.addLiq, usd: toUsd(gas.addLiq) },
      { op: "Remove Liq", gas: gas.removeLiq, usd: toUsd(gas.removeLiq) },
    ];
  }, [gas, gasPrice, ethPrice]);

  const totalDeployCost = ((gas.deploy * gasPrice * 1e-9) * ethPrice).toFixed(2);

  const jsonConfig = useMemo(() => JSON.stringify({
    name: contractName,
    curveType: curve,
    invariant: savedInvariant?.expression || curveOptions.find(c => c.id === curve)?.desc,
    swapFeeBps: Math.round(fee * 100),
    adminFeeBps: Math.round(adminFee * 100),
    numTokens: tokens,
    feeStructure: savedFees || undefined,
    gasEstimates: gas,
    solidityVersion: "^0.8.20",
    dependencies: ["@openzeppelin/contracts"],
  }, null, 2), [contractName, curve, fee, adminFee, tokens, gas, savedInvariant, savedFees]);

  const markdownDoc = useMemo(() => `# ${contractName} — AMM Contract Documentation

## Overview
- **Curve Type:** ${curveOptions.find(c => c.id === curve)?.label}
- **Formula:** ${savedInvariant?.expression || curveOptions.find(c => c.id === curve)?.desc}
- **Swap Fee:** ${fee}%
- **Admin Fee:** ${adminFee}% of swap fees
- **Tokens:** ${tokens}
${savedFees ? `- **Fee Structure:** ${savedFees.length} points, avg ${(savedFees.reduce((a,b) => a+b, 0) / savedFees.length).toFixed(0)} bps` : ""}

## Gas Estimates (at ${gasPrice} gwei, ETH $${ethPrice})
| Operation | Gas | Cost (USD) |
|-----------|-----|------------|
${gasData.map(g => `| ${g.op} | ${g.gas.toLocaleString()} | $${g.usd.toFixed(2)} |`).join("\n")}

## Deployment Checklist
- [ ] Review all contract code before deployment
- [ ] Set up token addresses for your trading pair
- [ ] Test on a testnet first (Sepolia/Goerli)
- [ ] Verify contract on Etherscan after deployment
- [ ] Set up monitoring for pool events

## Security Notes
- Uses OpenZeppelin ReentrancyGuard
- Uses OpenZeppelin Ownable for admin functions
- ⚠️ This is auto-generated code — audit before production use
`, [contractName, curve, fee, adminFee, tokens, gasData, gasPrice, ethPrice, savedInvariant, savedFees]);

  const exportContent = exportFormat === "solidity" ? solidity : exportFormat === "json" ? jsonConfig : markdownDoc;
  const exportExt = exportFormat === "solidity" ? ".sol" : exportFormat === "json" ? ".json" : ".md";
  const exportMime = exportFormat === "solidity" ? "text/plain" : exportFormat === "json" ? "application/json" : "text/markdown";

  const handleCopy = () => {
    navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportContent], { type: exportMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contractName.replace(/\s+/g, "")}${exportExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = () => {
    const config = btoa(JSON.stringify({ curve, fee, adminFee, tokens, contractName }));
    const url = `${window.location.origin}/advanced?config=${config}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tooltipStyle = { background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 10, color: colors.tooltipText };

  return (
    <div className="space-y-4">
      {/* Config */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Contract Parameters</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[10px] text-muted-foreground">Contract Name</label>
                <DeployHelpBtn id="contractName" />
              </div>
              <input value={contractName} onChange={e => setContractName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>

            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[10px] text-muted-foreground">Curve Type</label>
                <DeployHelpBtn id="curveType" />
              </div>
              {savedInvariant && (
                <div className="mb-2 px-2 py-1.5 rounded-md bg-secondary border border-border">
                  <span className="text-[9px] text-muted-foreground">Active invariant: </span>
                  <span className="text-[9px] font-mono text-foreground">{savedInvariant.expression}</span>
                  {savedFees && (
                    <span className="text-[9px] text-muted-foreground ml-2">| Fee: {(savedFees.reduce((a,b) => a+b, 0) / savedFees.length).toFixed(0)} bps avg</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {curveOptions.map(c => (
                  <button key={c.id} onClick={() => setCurve(c.id)}
                    className={`p-2 rounded-lg border text-left transition-all text-[10px] ${curve === c.id ? "border-foreground/30 bg-foreground/5" : "border-border bg-card hover:border-foreground/10"}`}>
                    <span className="font-medium text-foreground block">{c.label}</span>
                    <span className="text-muted-foreground text-[9px]">{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-muted-foreground">Swap Fee</label>
                    <DeployHelpBtn id="swapFee" />
                  </div>
                  <span className="text-[10px] font-mono text-foreground">{fee}%</span>
                </div>
                <input type="range" min={0.01} max={1} step={0.01} value={fee} onChange={e => setFee(Number(e.target.value))} className="w-full accent-foreground h-1" />
                {savedFees && <p className="text-[8px] text-muted-foreground mt-0.5">From fee structure</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-muted-foreground">Admin Fee</label>
                    <DeployHelpBtn id="adminFee" />
                  </div>
                  <span className="text-[10px] font-mono text-foreground">{adminFee}%</span>
                </div>
                <input type="range" min={0} max={50} step={1} value={adminFee} onChange={e => setAdminFee(Number(e.target.value))} className="w-full accent-foreground h-1" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Gas Simulation */}
        <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Fuel className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Gas Cost Simulation</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Gas Price</label>
                  <DeployHelpBtn id="gasPrice" />
                </div>
                <span className="text-[10px] font-mono text-foreground">{gasPrice} gwei</span>
              </div>
              <input type="range" min={5} max={200} step={1} value={gasPrice} onChange={e => setGasPrice(Number(e.target.value))} className="w-full accent-foreground h-1" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">ETH Price</label>
                  <DeployHelpBtn id="ethPrice" />
                  {ethPriceLoading && <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />}
                </div>
                <span className="text-[10px] font-mono text-foreground">${ethPrice.toLocaleString()}</span>
              </div>
              <input type="range" min={1000} max={10000} step={100} value={ethPrice} onChange={e => setEthPrice(Number(e.target.value))} className="w-full accent-foreground h-1" />
              {!ethPriceLoading && <p className="text-[8px] text-muted-foreground mt-0.5">Live price from CryptoCompare</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2.5 rounded-lg bg-secondary border border-border">
              <p className="text-[9px] text-muted-foreground">Deploy Cost</p>
              <p className="text-sm font-semibold font-mono-data text-foreground">${totalDeployCost}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-secondary border border-border">
              <p className="text-[9px] text-muted-foreground">Swap Cost</p>
              <p className="text-sm font-semibold font-mono-data text-foreground">${gasData[1].usd.toFixed(2)}</p>
            </div>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gasData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: colors.tick }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="op" tick={{ fontSize: 9, fill: colors.tick }} width={65} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} gas ($${((v * gasPrice * 1e-9) * ethPrice).toFixed(2)})`, "Gas"]} />
                <Bar dataKey="gas" radius={[0, 4, 4, 0]}>
                  {gasData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? colors.line : colors.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Export Format Selector + Output */}
      <motion.div className="surface-elevated rounded-xl p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCode(!showCode)} className="text-muted-foreground hover:text-foreground transition-colors">
              {showCode ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <FileCode2 className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {contractName.replace(/\s+/g, "")}{exportExt}
            </h3>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
              {exportContent.split("\n").length} lines
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md border border-border overflow-hidden mr-2">
              {([
                { id: "solidity" as const, icon: FileCode2, label: "Solidity" },
                { id: "json" as const, icon: FileJson, label: "JSON" },
                { id: "markdown" as const, icon: FileText, label: "Docs" },
              ]).map(f => (
                <button key={f.id} onClick={() => setExportFormat(f.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-[9px] font-medium transition-all ${
                    exportFormat === f.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <f.icon className="w-3 h-3" />
                  {f.label}
                </button>
              ))}
            </div>
            <motion.button onClick={handleShareLink} whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-secondary border border-border text-foreground hover:bg-accent transition-colors">
              <Share2 className="w-3 h-3" />
              Share
            </motion.button>
            <motion.button onClick={handleCopy} whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-secondary border border-border text-foreground hover:bg-accent transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy" }
            </motion.button>
            <motion.button onClick={handleDownload} whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Download className="w-3 h-3" />
              Download
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {showCode && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="relative rounded-lg bg-secondary border border-border overflow-hidden">
                <pre className="p-4 text-[11px] font-mono text-foreground overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed">
                  <code>{exportContent}</code>
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Solidity ^0.8.20</span>
          <span>OpenZeppelin v5</span>
          <span>ReentrancyGuard</span>
          <span>Ownable</span>
          <span className="ml-auto text-warning">⚠️ Review before mainnet deployment</span>
        </div>
      </motion.div>
    </div>
  );
};

export default DeploymentExport;
