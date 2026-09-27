import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncBadges, firstRecordAt, nthSessionAt, tonnageReachedAt, nthLoggedDayAt, hadRecord } from '../js/domain/badges.js';

const at = d => new Date(d + 'T18:00').getTime();
const lift = (d, w, r = 8) => ({ startedAt: at(d), endedAt: at(d) + 3600e3, dayId: 'push', ex: [{ exId: 'bank', name: 'Bankdrücken', unit: 'reps', sets: [{ w, r, rir: 2 }, { w, r, rir: 2 }] }] });
const base = () => ({
  profile: { daysPerWeek: 3, weightKg: 80, heightCm: 180, age: 30, sex: 'm', goal: 'gain', activity: 'light', targetWeightKg: null },
  sessions: [], plans: [{ id: 'split' }], water: {}, checkins: {},
  body: { weights: [], measurements: [], composition: [], photos: [] },
  nutrition: { log: {}, recipes: [], savedMeals: [], customFoods: [], recent: [], overrides: null, kcalAdjust: 0 },
  activity: { steps: [], restingHr: [], sleep: [], cardio: [], burn: [] },
  motivation: { goals: [], weekly: { proteinDays: 5, waterDays: 5 }, badges: {}, reportSeen: null },
});

test('Zeitpunkte aus den Daten', () => {
  const s = [lift('2026-09-15', 80), lift('2026-09-21', 82.5), lift('2026-09-23', 80)];
  assert.equal(firstRecordAt(s), at('2026-09-21') + 3600e3);
  assert.equal(hadRecord(s), true);
  assert.equal(firstRecordAt([lift('2026-09-15', 80)]), null);
  assert.equal(nthSessionAt(s, 1), at('2026-09-15') + 3600e3);
  assert.equal(nthSessionAt(s, 4), null);
  // 2 Sätze × 80 × 8 = 1.280 kg, 2 × 82,5 × 8 = 1.320 kg: 2.600 kg sind mit der zweiten Einheit erreicht
  assert.equal(tonnageReachedAt(s, 2600), at('2026-09-21') + 3600e3);
  assert.equal(nthLoggedDayAt({ '2026-09-02': [{}], '2026-09-01': [{}], '2026-09-03': [] }, 2), new Date('2026-09-02T12:00').getTime());
});

test('Abzeichen tragen den Tag, an dem sie verdient wurden, nicht den des Erkennens', () => {
  const S = base();
  S.sessions = [lift('2026-09-15', 80), lift('2026-09-21', 82.5)];
  S.body.photos = [{ id: 'p', date: '2026-09-24', pose: 'front' }];
  S.body.measurements = [{ date: '2026-09-24', neck: 39 }];
  S.nutrition.recipes = [{ id: 'r', name: 'Reis', portions: 1, items: [], createdAt: at('2026-09-22') }];
  const now = at('2026-09-28');
  syncBadges(S, now);
  const b = S.motivation.badges;
  assert.equal(b['first-session'], at('2026-09-15') + 3600e3);
  assert.equal(b['first-pr'], at('2026-09-21') + 3600e3);
  assert.equal(b['first-photo'], new Date('2026-09-24T12:00').getTime());
  assert.equal(b['first-measure'], new Date('2026-09-24T12:00').getTime());
  assert.equal(b['first-recipe'], at('2026-09-22'));
});

test('Ohne Datum in den Daten oder bei Daten aus der Zukunft gilt der Moment des Erkennens', () => {
  const S = base();
  S.nutrition.recipes = [{ id: 'r', name: 'Alt', portions: 1, items: [] }];
  S.sessions = [lift('2026-10-01', 80)];
  syncBadges(S, at('2026-09-28'));
  assert.equal(S.motivation.badges['first-recipe'], at('2026-09-28'));
  assert.equal(S.motivation.badges['first-session'], at('2026-09-28'));
});
