// Library Persistence — Save/load community AMM designs to/from the database

import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/lib/discovery-engine";

export interface LibraryAMM {
  id: string;
  name: string;
  description: string;
  formula: string;
  author: string;
  category: "famous" | "featured" | "community";
  candidate_id?: string;
  regime?: string;
  generation?: number;
  family_id?: string;
  family_params?: Record<string, number>;
  bins?: number[];
  score?: number;
  stability?: number;
  metrics?: Record<string, number>;
  features?: Record<string, number>;
  params: { wA: number; wB: number; k: number; amp?: number };
  upvotes: number;
  created_at: string;
}

/** Publish a discovered candidate to the community library */
export async function publishToLibrary(
  candidate: Candidate,
  name: string,
  description: string,
  author: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("library_amms" as any).insert({
      name,
      description,
      formula: `${candidate.familyId} (gen ${candidate.generation})`,
      author: author || "Anonymous",
      category: "community",
      candidate_id: candidate.id,
      regime: candidate.regime,
      generation: candidate.generation,
      family_id: candidate.familyId,
      family_params: candidate.familyParams,
      bins: Array.from(candidate.bins),
      score: candidate.score,
      stability: candidate.stability,
      metrics: candidate.metrics as any,
      features: candidate.features as any,
      params: { wA: 0.5, wB: 0.5, k: 10000 },
      upvotes: 0,
    } as any);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Load all community AMMs from the database */
export async function loadLibraryAMMs(): Promise<LibraryAMM[]> {
  try {
    const { data, error } = await supabase
      .from("library_amms" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !data) return [];
    return (data as any[]).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      formula: row.formula,
      author: row.author,
      category: row.category as "community",
      candidate_id: row.candidate_id,
      regime: row.regime,
      generation: row.generation,
      family_id: row.family_id,
      family_params: row.family_params,
      bins: row.bins,
      score: row.score,
      stability: row.stability,
      metrics: row.metrics,
      features: row.features,
      params: row.params || { wA: 0.5, wB: 0.5, k: 10000 },
      upvotes: row.upvotes || 0,
      created_at: row.created_at,
    }));
  } catch {
    return [];
  }
}

/** Upvote a library AMM */
export async function upvoteLibraryAMM(id: string): Promise<boolean> {
  try {
    // Read current upvotes then increment
    const { data } = await supabase
      .from("library_amms" as any)
      .select("upvotes")
      .eq("id", id)
      .single();

    const current = (data as any)?.upvotes || 0;
    const { error } = await supabase
      .from("library_amms" as any)
      .update({ upvotes: current + 1 } as any)
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}
