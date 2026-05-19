export const MESSAGE_INTENTS = [
  'profile_request',
  'diary_entry',
  'diary_start',
  'analytics_request',
  'parameters_request',
  'help',
  'general_question',
  'unknown',
] as const;

export type MessageIntent = (typeof MESSAGE_INTENTS)[number];

export interface MessageIntentClassification {
  readonly intent: MessageIntent;
  readonly confidence: number;
}
