import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Trophy } from "lucide-react";
import { useAmmyContext } from "@/lib/ammy-context";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ThemeToggle from "@/components/ThemeToggle";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeWorkbench from "@/components/challenges/ChallengeWorkbench";
import {
  challenges,
  loadProgress,
  getCompletionStats,
  type Challenge,
  type ChallengeProgress,
  type Difficulty,
} from "@/lib/challenge-engine";

export default function Challenges() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ChallengeProgress>(loadProgress);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [filter, setFilter] = useState<"all" | Difficulty>("all");

  const stats = useMemo(() => getCompletionStats(progress), [progress]);

  const filtered = filter === "all" ? challenges : challenges.filter((c) => c.difficulty === filter);

  const refreshProgress = () => setProgress(loadProgress());

  if (activeChallenge) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
          <span className="text-lg font-bold tracking-tight text-foreground">INVARIANT STUDIO</span>
          <ThemeToggle />
        </nav>
        <div className="max-w-5xl mx-auto px-8 pb-16">
          <ChallengeWorkbench
            challenge={activeChallenge}
            onBack={() => setActiveChallenge(null)}
            onProgressUpdate={refreshProgress}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-foreground">INVARIANT STUDIO</span>
        <ThemeToggle />
      </nav>

      <div className="max-w-5xl mx-auto px-8 pb-16">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Home
        </Button>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-2">
            🎯 AMM Challenges
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Solve progressively harder AMM design puzzles. Configure pool parameters to meet
            constraints and earn stars. Unlock expert challenges by completing earlier tiers.
          </p>
        </motion.div>

        {/* Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="surface-elevated rounded-xl p-5 mb-8"
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              <div>
                <div className="text-lg font-bold font-mono-data text-foreground">
                  {stats.completed}/{stats.total}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Completed
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-warning text-warning" />
              <div>
                <div className="text-lg font-bold font-mono-data text-foreground">
                  {stats.totalStars}/{stats.maxStars}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Stars
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Progress value={(stats.completed / stats.total) * 100} className="h-2" />
            </div>
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="beginner">
              🌱 Beginner ({stats.beginner.completed}/{stats.beginner.total})
            </TabsTrigger>
            <TabsTrigger value="intermediate">
              ⚡ Intermediate ({stats.intermediate.completed}/{stats.intermediate.total})
            </TabsTrigger>
            <TabsTrigger value="expert">
              🔥 Expert ({stats.expert.completed}/{stats.expert.total})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Challenge Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((challenge, i) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              progress={progress}
              onClick={() => setActiveChallenge(challenge)}
              index={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
