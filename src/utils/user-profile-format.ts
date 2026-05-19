import type { User } from '@prisma/client';

import { jsonStringArray } from './onboarding-profile-payload.js';
import { parseDiaryGoalsFromStorage } from './profile-goals.js';
import { formatTrackingKeysForDisplay } from './tracking-parameters.js';

function ageFromUser(user: User): string | null {
  if (user.age !== null) {
    return `${String(user.age)} лет`;
  }
  if (user.dateOfBirth !== null) {
    return `дата рождения: ${user.dateOfBirth.toISOString().slice(0, 10)}`;
  }
  return null;
}

export function formatProfileSummary(user: User): string {
  return formatFriendlyProfileSummary(user);
}

export function formatFriendlyProfileSummary(user: User): string {
  const identity: string[] = [];
  const name = user.preferredName?.trim();
  if (name !== undefined && name !== '') {
    identity.push(`— имя: ${name}`);
  }
  const occ = user.occupation?.trim();
  if (occ !== undefined && occ !== '') {
    identity.push(`— род занятий: ${occ}`);
  }
  const age = ageFromUser(user);
  if (age !== null && identity.length < 3) {
    identity.push(`— ${age}`);
  }

  const goals = parseDiaryGoalsFromStorage(user.diaryGoals);
  const trackingLabels = formatTrackingKeysForDisplay(jsonStringArray(user.trackingParameters));

  if (identity.length === 0 && goals.length === 0) {
    return (
      'вот что я пока про тебя знаю:\n\n' +
      'профиль почти пустой — расскажи о себе через /start или дополни позже.\n\n' +
      'если что-то поменялось — можно обновить.'
    );
  }

  const parts: string[] = ['вот что я пока про тебя знаю:\n'];
  if (identity.length > 0) {
    parts.push(identity.join('\n'));
  }
  if (goals.length > 0) {
    parts.push('\n\nцели дневника:\n' + goals.map((g) => `— ${g}`).join('\n'));
  }
  parts.push('\n\nотслеживаем:\n' + trackingLabels.map((l) => `— ${l}`).join('\n'));
  parts.push('\n\nесли что-то поменялось — можно обновить.');
  return parts.join('');
}

export function formatTrackingParametersList(user: User): string {
  const labels = formatTrackingKeysForDisplay(jsonStringArray(user.trackingParameters));
  const body = labels.map((x) => `- ${x}`).join('\n');
  return `отслеживаем сейчас:\n${body}`;
}
