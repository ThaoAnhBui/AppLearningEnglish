import type { CardState } from '@prisma/client';
import { fsrs, Rating, State, type Card } from 'ts-fsrs';

const scheduler = fsrs();

const dbStateByFsrsState: Record<State, CardState> = {
  [State.New]: 'NEW',
  [State.Learning]: 'LEARNING',
  [State.Review]: 'REVIEW',
  [State.Relearning]: 'RELEARNING',
};

const fsrsStateByDbState: Record<CardState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

const ratingMap = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
} as const;

export function toFsrsCard(progress: {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  learningSteps: number;
  state: CardState;
  lastReview: Date | null;
}): Card {
  return {
    due: progress.due,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    reps: progress.reps,
    lapses: progress.lapses,
    learning_steps: progress.learningSteps,
    state: fsrsStateByDbState[progress.state],
    last_review: progress.lastReview ?? undefined,
  };
}

export function schedule(card: Card, rating: 1 | 2 | 3 | 4, now = new Date()) {
  const result = scheduler.next(card, now, ratingMap[rating]);

  return {
    card: result.card,
    log: result.log,
    stateAfter: dbStateByFsrsState[result.card.state],
  };
}
