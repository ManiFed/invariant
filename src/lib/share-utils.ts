/**
 * Shareable design URL utilities.
 * Encodes/decodes pool configurations into compact URL-safe strings.
 */

export interface ShareableDesign {
  name: string;
  type: "constant_product" | "stable_swap" | "weighted" | "concentrated";
  liquidity: number;
  feeRate: number;
  tokenAPrice: number;
  tokenBPrice: number;
  volatility: string;
}

/**
 * Encode a pool design into a URL-safe base64 string
 */
export function encodeDesign(design: ShareableDesign): string {
  const json = JSON.stringify(design);
  // Use base64url encoding (no padding, URL-safe chars)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe base64 string back into a pool design
 */
export function decodeDesign(encoded: string): ShareableDesign | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json);

    // Validate required fields
    if (!parsed.type || typeof parsed.liquidity !== "number") {
      return null;
    }

    return {
      name: parsed.name || "Shared Design",
      type: parsed.type,
      liquidity: parsed.liquidity,
      feeRate: parsed.feeRate ?? 0.003,
      tokenAPrice: parsed.tokenAPrice ?? 2000,
      tokenBPrice: parsed.tokenBPrice ?? 1,
      volatility: parsed.volatility ?? "Medium",
    };
  } catch {
    return null;
  }
}

/**
 * Build a full shareable URL for a design
 */
export function buildShareUrl(design: ShareableDesign): string {
  const encoded = encodeDesign(design);
  const base = window.location.origin;
  return `${base}/beginner?design=${encoded}`;
}

/**
 * Extract design from current URL search params
 */
export function extractDesignFromUrl(): ShareableDesign | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("design");
  if (!encoded) return null;
  return decodeDesign(encoded);
}

/**
 * Copy text to clipboard and return success
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    return success;
  }
}
