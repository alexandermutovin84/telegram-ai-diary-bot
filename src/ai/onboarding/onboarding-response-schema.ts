/**
 * Embedded in the system prompt so the model targets one JSON object.
 * Runtime validation lives in onboarding-response.validator.ts.
 */
export const ONBOARDING_AI_RESPONSE_JSON_SCHEMA = `{
  "profile_data": {
    "preferred_name": null,
    "gender": null,
    "age": null,
    "date_of_birth": null,
    "height_cm": null,
    "weight_kg": null,
    "occupation": null,
    "diary_goals": [],
    "bad_habits": [],
    "health_notes": null
  },
  "suggested_tracking_parameters": ["mood", "sleep"],
  "missing_fields": [],
  "follow_up_questions": [],
  "onboarding_complete": false
}`;
