import { useState, useCallback, useEffect } from "react";
import type { CourseLevel } from "@/components/teaching/CourseLevelPicker";

export interface Badge {
  id: string;
  title: string;
  emoji: string;
  description: string;
  unlockedAt?: string;
}

export const ALL_BADGES: Badge[] = [
  { id: "first-trade", title: "First Trade", emoji: "🔄", description: "Execute your first trade in the simulation" },
  { id: "slippage-master", title: "Slippage Master", emoji: "📐", description: "Complete the slippage challenge" },
  { id: "il-survivor", title: "IL Survivor", emoji: "🛡️", description: "Complete the IL module" },
  { id: "arb-hunter", title: "Arb Hunter", emoji: "⚡", description: "Complete the arbitrage module" },
  { id: "fee-strategist", title: "Fee Strategist", emoji: "💰", description: "Complete the fees module" },
  { id: "quiz-streak-3", title: "On Fire", emoji: "🔥", description: "Answer 3 quizzes correctly in a row" },
  { id: "quiz-streak-5", title: "Unstoppable", emoji: "⭐", description: "Answer 5 quizzes correctly in a row" },
  { id: "speed-learner", title: "Speed Learner", emoji: "🚀", description: "Complete a module in under 3 minutes" },
  { id: "challenge-5", title: "Challenge Accepted", emoji: "🎯", description: "Complete 5 challenges" },
  { id: "beginner-grad", title: "Beginner Graduate", emoji: "🎓", description: "Complete the beginner course" },
  { id: "intermediate-grad", title: "Intermediate Graduate", emoji: "🏅", description: "Complete the intermediate course" },
  { id: "advanced-grad", title: "Advanced Graduate", emoji: "👑", description: "Complete the advanced course" },
];

export interface CourseProgress {
  level: CourseLevel | null;
  completedModules: Record<string, number[]>; // level -> module indices
  xp: number;
  badges: string[];
  quizStreak: number;
  challengesCompleted: number;
  totalQuizzesCorrect: number;
  totalQuizzesAttempted: number;
  moduleStartTime?: number;
}

const STORAGE_KEY = "amm-course-progress";

const defaultProgress: CourseProgress = {
  level: null,
  completedModules: {},
  xp: 0,
  badges: [],
  quizStreak: 0,
  challengesCompleted: 0,
  totalQuizzesCorrect: 0,
  totalQuizzesAttempted: 0,
};

function loadProgress(): CourseProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultProgress, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultProgress };
}

function saveProgress(p: CourseProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
}

// XP rewards
const XP_STEP_COMPLETE = 10;
const XP_QUIZ_CORRECT = 25;
const XP_QUIZ_WRONG = 5;
const XP_CHALLENGE_COMPLETE = 50;
const XP_MODULE_COMPLETE = 100;
const XP_STREAK_BONUS = 15; // per streak quiz

export function useCourseProgress() {
  const [progress, setProgress] = useState<CourseProgress>(loadProgress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const addXP = useCallback((amount: number) => {
    setProgress(p => ({ ...p, xp: p.xp + amount }));
  }, []);

  const unlockBadge = useCallback((badgeId: string) => {
    setProgress(p => {
      if (p.badges.includes(badgeId)) return p;
      return { ...p, badges: [...p.badges, badgeId] };
    });
  }, []);

  const onStepComplete = useCallback(() => {
    addXP(XP_STEP_COMPLETE);
  }, [addXP]);

  const onQuizAnswer = useCallback((correct: boolean) => {
    setProgress(p => {
      const newStreak = correct ? p.quizStreak + 1 : 0;
      const streakBonus = correct && newStreak >= 3 ? XP_STREAK_BONUS : 0;
      const xpGain = (correct ? XP_QUIZ_CORRECT : XP_QUIZ_WRONG) + streakBonus;
      const newBadges = [...p.badges];
      if (newStreak >= 3 && !newBadges.includes("quiz-streak-3")) newBadges.push("quiz-streak-3");
      if (newStreak >= 5 && !newBadges.includes("quiz-streak-5")) newBadges.push("quiz-streak-5");
      return {
        ...p,
        xp: p.xp + xpGain,
        quizStreak: newStreak,
        totalQuizzesCorrect: p.totalQuizzesCorrect + (correct ? 1 : 0),
        totalQuizzesAttempted: p.totalQuizzesAttempted + 1,
        badges: newBadges,
      };
    });
  }, []);

  const onChallengeComplete = useCallback(() => {
    setProgress(p => {
      const count = p.challengesCompleted + 1;
      const newBadges = [...p.badges];
      if (count >= 5 && !newBadges.includes("challenge-5")) newBadges.push("challenge-5");
      return { ...p, xp: p.xp + XP_CHALLENGE_COMPLETE, challengesCompleted: count, badges: newBadges };
    });
  }, []);

  const onModuleComplete = useCallback((level: string, moduleIndex: number) => {
    setProgress(p => {
      const completed = { ...p.completedModules };
      const levelCompleted = completed[level] ? [...completed[level]] : [];
      if (!levelCompleted.includes(moduleIndex)) levelCompleted.push(moduleIndex);
      completed[level] = levelCompleted;

      // Speed badge
      const newBadges = [...p.badges];
      if (p.moduleStartTime && Date.now() - p.moduleStartTime < 180000 && !newBadges.includes("speed-learner")) {
        newBadges.push("speed-learner");
      }

      return { ...p, xp: p.xp + XP_MODULE_COMPLETE, completedModules: completed, badges: newBadges, moduleStartTime: undefined };
    });
  }, []);

  const onCourseComplete = useCallback((level: CourseLevel) => {
    const badgeMap: Record<string, string> = { beginner: "beginner-grad", intermediate: "intermediate-grad", advanced: "advanced-grad" };
    unlockBadge(badgeMap[level]);
  }, [unlockBadge]);

  const startModuleTimer = useCallback(() => {
    setProgress(p => ({ ...p, moduleStartTime: Date.now() }));
  }, []);

  const getLevelXPRange = useCallback((level: CourseLevel) => {
    const ranges: Record<string, [number, number]> = {
      beginner: [0, 1500],
      intermediate: [1500, 3500],
      advanced: [3500, 6000],
    };
    return ranges[level] || [0, 6000];
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({ ...defaultProgress });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    progress,
    addXP,
    unlockBadge,
    onStepComplete,
    onQuizAnswer,
    onChallengeComplete,
    onModuleComplete,
    onCourseComplete,
    startModuleTimer,
    getLevelXPRange,
    resetProgress,
  };
}
