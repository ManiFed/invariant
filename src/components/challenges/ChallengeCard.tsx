import { motion } from "framer-motion";
import { Lock, Star } from "lucide-react";
import type { Challenge, ChallengeProgress } from "@/lib/challenge-engine";
import { isUnlocked } from "@/lib/challenge-engine";

const difficultyColors: Record<string, string> = {
  beginner: "text-success border-success/30",
  intermediate: "text-warning border-warning/30",
  expert: "text-destructive border-destructive/30",
};

export default function ChallengeCard({
  challenge,
  progress,
  onClick,
  index,
}: {
  challenge: Challenge;
  progress: ChallengeProgress;
  onClick: () => void;
  index: number;
}) {
  const unlocked = isUnlocked(challenge, progress);
  const best = progress[challenge.id];
  const stars = best?.stars ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      whileHover={unlocked ? { y: -3 } : undefined}
      onClick={unlocked ? onClick : undefined}
      className={`surface-elevated rounded-xl p-5 transition-all duration-300 ${
        unlocked
          ? "cursor-pointer group hover:border-foreground/20"
          : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{unlocked ? challenge.icon : "🔒"}</span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ${difficultyColors[challenge.difficulty]}`}
        >
          {challenge.difficulty}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1">{challenge.name}</h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        {unlocked ? challenge.description : "Complete earlier challenges to unlock."}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {[1, 2, 3].map((s) => (
            <Star
              key={s}
              className={`w-3.5 h-3.5 ${
                s <= stars ? "fill-warning text-warning" : "text-muted-foreground/30"
              }`}
            />
          ))}
        </div>
        {best && (
          <span className="text-[10px] font-mono-data text-muted-foreground">
            Best: {best.bestScore}
          </span>
        )}
        {!unlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
    </motion.div>
  );
}
