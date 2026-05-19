const GOAL_MIN_LEN = 4;
const GOAL_MAX_LEN = 120;
const MAX_GOALS = 8;
const RAW_TRANSCRIPT_MIN_LEN = 100;

function clampGoal(line: string): string {
  const t = line.trim().replace(/\s+/g, ' ');
  if (t.length <= GOAL_MAX_LEN) {
    return t;
  }
  return `${t.slice(0, GOAL_MAX_LEN - 1)}…`;
}

function normalizeGoalPhrase(raw: string): string | null {
  let t = raw.trim().replace(/\s+/g, ' ');
  if (t.length < GOAL_MIN_LEN) {
    return null;
  }
  t = t.replace(/^[-–—•]\s*/, '');
  t = t.replace(/^(я\s+)?хочу\s+/i, '');
  t = t.replace(/^отслеживать\s+/i, 'отслеживать ');
  const hasGoalVerb =
    /^отслеживать\s+/i.test(t) ||
    /^видеть\s+/i.test(t) ||
    /^сохранять\s+/i.test(t) ||
    /^получать\s+/i.test(t) ||
    /^фиксировать\s+/i.test(t);
  if (!hasGoalVerb && /настроени|привычк|событ|тренд|инсайт|аналитик/i.test(t)) {
    t = `отслеживать ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  }
  return clampGoal(t);
}

function dedupeGoals(goals: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of goals) {
    const key = g.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(g);
    }
  }
  return out.slice(0, MAX_GOALS);
}

/**
 * True when diary_goals look like pasted speech, not normalized bullets.
 */
export function looksLikeRawDiaryGoals(diaryGoals: string | null): boolean {
  if (diaryGoals === null || diaryGoals.trim() === '') {
    return false;
  }
  const lines = diaryGoals.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0];
  if (lines.length === 1 && first !== undefined && first.length >= RAW_TRANSCRIPT_MIN_LEN) {
    return true;
  }
  if (lines.length === 1 && first !== undefined && (first.match(/,/g)?.length ?? 0) >= 3) {
    return true;
  }
  if (/разных привычк|отслеживать прогресс настроения.*курение/i.test(diaryGoals)) {
    return true;
  }
  return false;
}

/**
 * Normalize AI or legacy goal lines into short profile bullets.
 */
export function normalizeDiaryGoalsArray(goals: readonly string[]): string[] {
  const normalized: string[] = [];
  for (const raw of goals) {
    const parts = raw.includes(',') && raw.length > 60 ? raw.split(/,\s*/) : [raw];
    for (const part of parts) {
      const g = normalizeGoalPhrase(part);
      if (g !== null) {
        normalized.push(g);
      }
    }
  }
  return dedupeGoals(normalized);
}

export function diaryGoalsToStorage(goals: readonly string[]): string | null {
  const clean = normalizeDiaryGoalsArray(goals);
  if (clean.length === 0) {
    return null;
  }
  return clean.join('\n');
}

export function parseDiaryGoalsFromStorage(diaryGoals: string | null): string[] {
  if (diaryGoals === null || diaryGoals.trim() === '') {
    return [];
  }
  return normalizeDiaryGoalsArray(diaryGoals.split(/\n+/));
}
