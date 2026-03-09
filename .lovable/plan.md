

# Plan: Enhanced Interactive Courses

## Current State Analysis

The Teaching Lab has a solid foundation:
- **3 difficulty levels** (Beginner, Intermediate, Advanced) with 6-7 modules each
- **Step-based lessons** with text content, quizzes, and follow-up questions
- **Static SVG visuals** that illustrate concepts
- **Separate simulation panel** with live AMM controls

**Key Issues Identified:**
1. **Passive learning** — users read content, then separately play with controls
2. **No guided tasks** — nothing bridges theory → practice within lessons
3. **Quiz-only assessment** — multiple choice doesn't verify understanding
4. **No progress persistence** — users lose progress on refresh
5. **Overwhelming controls** — all sliders visible at once, no contextual highlighting
6. **No immediate feedback loop** — users don't see cause/effect in real-time during lessons

---

## Proposed Improvements

### 1. Embedded Interactive Challenges (High Impact)

Add a new step type `"challenge"` that requires users to hit specific targets using the simulation:

```text
Challenge: "Create 5% slippage"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal: Execute a trade that causes exactly 5% slippage
Hint: Adjust trade size until you hit the target

[Live target indicator: Current: 2.3% → Target: 5.0%]
[✓ Complete] [Skip →]
```

**Implementation:**
- Add `ChallengeStep` type with `targetMetric`, `targetValue`, `tolerance`
- Connect challenge component to live simulation state
- Auto-advance when target is hit (with celebration animation)
- Track completion for XP/badges

---

### 2. Contextual Control Highlighting

During lessons, highlight ONLY the relevant controls:

```text
Module: Slippage
━━━━━━━━━━━━━━━
Step 3: "Try increasing trade size..."

[Trade Size slider] ← HIGHLIGHTED, pulsing
[Other sliders]    ← Dimmed/disabled
```

**Implementation:**
- Add `highlightControls: string[]` to `LessonStep`
- Wrap sliders in conditional highlight animation
- Disable non-relevant controls during guided steps

---

### 3. Inline Live Previews

Replace static SVG visuals with miniature live simulations embedded in the lesson content:

```text
┌─────────────────────────────────────┐
│  As trade size increases,           │
│  slippage accelerates:              │
│                                     │
│  [Mini curve with draggable dot]    │
│   Drag the trade →                  │
│   Slippage: 2.3%                    │
└─────────────────────────────────────┘
```

**Implementation:**
- Create `InlineMiniSim` component variants (SlippageMini, ILMini, etc.)
- Self-contained state, isolated from main simulation
- Touch-friendly drag interactions

---

### 4. Progress Persistence & XP System

Save progress to localStorage (or Supabase for logged-in users):

```text
┌─────────────────────┐
│ Level: Intermediate │
│ XP: 2,450 / 5,000   │
│ ████████░░░░ 49%    │
│                     │
│ 🏆 Badges:          │
│ ✓ Slippage Master   │
│ ✓ IL Survivor       │
│ ○ Range Strategist  │
└─────────────────────┘
```

**Implementation:**
- Store `completedModules`, `xp`, `badges`, `selectedLevel` in localStorage
- Award XP for completing steps, challenges, and quizzes
- Unlock badges for specific achievements

---

### 5. Animated Concept Transitions

When explaining cause → effect, show animated transitions:

```text
"When you buy Y, the reserves shift..."

[Before]          [After]
 X: 1000  ───→     X: 1050
 Y: 1000  ───→     Y: 952
 
[Animated arrows + number morphing]
```

**Implementation:**
- Extend `LessonVisual` with `"animated-trade-flow"` type
- Use framer-motion `AnimatePresence` for smooth number transitions
- Trigger on step entry

---

### 6. Quiz Improvements

- **Shuffle options** with seeded randomization (already exists, verify working)
- **Hint system** — 1 hint per quiz, costs XP to use
- **Streak bonus** — 3 correct in a row = bonus XP
- **Wrong answer feedback** — show the correct answer with visual explanation

---

## Implementation Phases

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | Progress persistence + XP display | 2-3 hours |
| **Phase 2** | Contextual control highlighting | 1-2 hours |
| **Phase 3** | 3-5 inline mini-simulations | 3-4 hours |
| **Phase 4** | Challenge step type + 10 challenges | 4-5 hours |
| **Phase 5** | Badge system + achievements | 2-3 hours |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/course-content.ts` | Add `ChallengeStep` type, `highlightControls` field |
| `src/components/teaching/ChallengeStep.tsx` | **New** — challenge UI with target tracking |
| `src/components/teaching/InlineMiniSim.tsx` | **New** — self-contained mini simulations |
| `src/components/teaching/CourseSidebar.tsx` | Integrate challenges, mini-sims |
| `src/components/teaching/LabControls.tsx` | Add highlight animation logic |
| `src/hooks/use-course-progress.ts` | **New** — localStorage persistence + XP |
| `src/pages/TeachingLab.tsx` | Connect progress hook, pass highlight state |

---

## Summary

Transform the course from **passive reading** to **active experimentation** by:

1. ✅ Embedding hands-on challenges that require using the simulation
2. ✅ Highlighting only relevant controls during each lesson
3. ✅ Adding inline interactive visuals users can manipulate
4. ✅ Persisting progress with an XP/badge reward system
5. ✅ Improving quiz feedback with hints and streaks

This creates a "learn by doing" experience where users prove understanding through action, not just multiple-choice answers.

