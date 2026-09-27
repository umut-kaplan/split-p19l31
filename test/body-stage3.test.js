import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  measurementDeltas, measurementSinceFirst, mergeByDate, missingForNavy, goalProgress, inRange,
  mondayOf, photoReminderDue, photoWeeks, firstWeight,
} from '../js/domain/body.js';
import { silhouetteScales, clampScale, bodyShapes, silhouetteSVG, NEUTRAL, SCALE_LIMIT } from '../js/ui/silhouette.js';
import { restorableImages, attachImages, base64Bytes, sizeLabel } from '../js/store/backup.js';

test('Umfänge: jüngster Wert, Wert davor und Differenz je Maß', () => {
  const m = [
    { date: '2026-08-01', waist: 90, chest: 100 },
    { date: '2026-09-01', waist: 88.5 },
    { date: '2026-09-15', waist: 87, neck: 39 },
  ];
  const d = measurementDeltas(m);
  assert.deepEqual(d.waist, { value: 87, date: '2026-09-15', prev: 88.5, prevDate: '2026-09-01', delta: -1.5 });
  assert.equal(d.chest.delta, null);     // nur ein Wert
  assert.equal(d.neck.value, 39);
  assert.equal(d.hip, undefined);
  const s = measurementSinceFirst(m);
  assert.equal(s.waist.delta, -3);
  assert.equal(s.chest, undefined);
});

test('Ein Eintrag pro Tag: gleicher Tag ergänzt', () => {
  let list = mergeByDate([], { date: '2026-09-20', waist: 88 });
  list = mergeByDate(list, { date: '2026-09-20', neck: 38 });
  list = mergeByDate(list, { date: '2026-09-10', waist: 90 });
  assert.deepEqual(list, [{ date: '2026-09-10', waist: 90 }, { date: '2026-09-20', waist: 88, neck: 38 }]);
});

test('Was fehlt für die Navy-Schätzung', () => {
  assert.deepEqual(missingForNavy({ sex: 'm', heightCm: 180 }, []), ['Hals', 'Bauch']);
  assert.deepEqual(missingForNavy({ sex: 'm', heightCm: 180 }, [{ date: '2026-09-01', neck: 38, waist: 85 }]), []);
  assert.deepEqual(missingForNavy({ sex: 'f', heightCm: 165 }, [{ date: '2026-09-01', neck: 32, waist: 70 }]), ['Hüfte']);
  assert.deepEqual(missingForNavy({}, []), ['Geschlecht im Profil', 'Größe im Profil', 'Hals', 'Bauch']);
});

test('Fortschritt zum Zielgewicht, ab- und zunehmend', () => {
  assert.equal(goalProgress(90, 85, 80).pct, 0.5);
  assert.equal(goalProgress(90, 92, 80).pct, 0);             // falsche Richtung bleibt bei 0
  assert.equal(goalProgress(70, 72, 74).pct, 0.5);
  assert.equal(goalProgress(90, 80.1, 80).reached, true);
  assert.equal(goalProgress(90, 85, null), null);
  assert.equal(goalProgress(80, 80.5, 80).reached, false);   // 0,5 kg ist noch nicht am Ziel
});

test('Zeitraum für das Diagramm', () => {
  const w = [{ date: '2026-06-01', kg: 90 }, { date: '2026-09-01', kg: 86 }, { date: '2026-09-20', kg: 85 }, { date: '2026-09-30', kg: 84 }];
  assert.deepEqual(inRange(w, '2026-09-27', '4w').map(x => x.date), ['2026-09-01', '2026-09-20']);
  assert.equal(inRange(w, '2026-09-27', '3m').length, 2);
  assert.equal(inRange(w, '2026-09-27', 'all').length, 3); // nichts aus der Zukunft
  assert.equal(firstWeight(w).kg, 90);
});

test('Fotowoche beginnt am Montag', () => {
  assert.equal(mondayOf('2026-09-27'), '2026-09-21'); // Sonntag
  assert.equal(mondayOf('2026-09-21'), '2026-09-21'); // Montag
  assert.equal(mondayOf('2026-09-29'), '2026-09-28');
});

test('Foto-Erinnerung einmal pro Woche', () => {
  const today = '2026-09-24';
  assert.equal(photoReminderDue([], today, null), true);
  assert.equal(photoReminderDue([{ date: '2026-09-18', pose: 'front' }], today, null), true);  // letzte Woche
  assert.equal(photoReminderDue([{ date: '2026-09-22', pose: 'side' }], today, null), false);  // diese Woche
  assert.equal(photoReminderDue([], today, '2026-09-21'), false);                              // auf später gesetzt
  assert.equal(photoReminderDue([], '2026-09-28', '2026-09-21'), true);                        // neue Woche
});

test('Fotos nach Wochen, jüngstes pro Pose', () => {
  const w = photoWeeks([
    { id: 'a', date: '2026-09-15', pose: 'front' },
    { id: 'b', date: '2026-09-16', pose: 'front' },
    { id: 'c', date: '2026-09-22', pose: 'side' },
  ]);
  assert.deepEqual(w.map(x => x.week), ['2026-09-21', '2026-09-14']);
  assert.equal(w[1].poses.front.id, 'b');
  assert.equal(w[1].all.length, 2);
});

test('Silhouette: Verhältnis zum ersten Eintrag, begrenzt', () => {
  const m = [
    { date: '2026-06-01', waist: 100, upperArmL: 34, upperArmR: 36, thigh: 60, chest: 100 },
    { date: '2026-09-01', waist: 90, upperArmL: 36, upperArmR: 38, thigh: 90, chest: 60 },
  ];
  const s = silhouetteScales(m);
  assert.equal(s.waist, 0.9);
  assert.equal(s.belly, 0.9);                 // übernimmt die Taille
  assert.equal(s.upperArm, 37 / 35);          // Mittel aus links und rechts
  assert.equal(s.thigh, SCALE_LIMIT[1]);      // 1,5 wird auf 1,25 begrenzt
  assert.equal(s.chest, SCALE_LIMIT[0]);      // 0,6 wird auf 0,75 begrenzt
  assert.equal(s.shoulders, SCALE_LIMIT[0]);  // ohne Schultermaß wie die Brust
  assert.equal(s.hip, 0.9);                   // ohne Hüfte wie Bauch bzw. Taille
  assert.equal(s.neck, 1);                    // ohne Daten neutral
  assert.deepEqual(silhouetteScales([]), NEUTRAL);
  assert.equal(clampScale(2), 1.25);
  assert.equal(clampScale(0.1), 0.75);
});

test('Silhouette: breitere Taille ergibt einen breiteren Umriss', () => {
  const widthAt = (d, y) => {
    const xs = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m => [+m[1], +m[2]]).filter(p => Math.abs(p[1] - y) < 0.01).map(p => p[0]);
    return Math.max(...xs) - Math.min(...xs);
  };
  const base = bodyShapes(NEUTRAL, 'm').outline;
  const wide = bodyShapes({ ...NEUTRAL, waist: 1.2 }, 'm').outline;
  assert.ok(widthAt(wide, 152) > widthAt(base, 152));
  assert.equal(Math.round(widthAt(wide, 152) / widthAt(base, 152) * 100) / 100, 1.2);
  const svg = silhouetteSVG({ mode: 'overlay', scales: { ...NEUTRAL, waist: 0.9 } });
  assert.match(svg, /<mask/);
  assert.doesNotMatch(silhouetteSVG({ mode: 'now' }), /<mask/);
});

test('Backup: nur gültige Bilder werden übernommen', () => {
  const raw = { images: [
    { store: 'photos', id: 'p1', dataUrl: 'data:image/jpeg;base64,AAA', date: '2026-09-20', pose: 'front' },
    { store: 'foodCache', id: 'x', dataUrl: 'data:image/jpeg;base64,AAA' },
    { store: 'photos', id: 'p2', dataUrl: 'javascript:alert(1)' },
    { store: 'exerciseImages', id: 'e1', dataUrl: 'data:image/png;base64,BBB' },
    null,
  ] };
  assert.deepEqual(restorableImages(raw).map(i => i.id), ['p1', 'e1']);
  assert.deepEqual(restorableImages({}), []);
  assert.deepEqual(restorableImages({ app: 'split', version: 1 }), []);
  const b = { app: 'fit', version: 2, data: {} };
  assert.equal(attachImages(b, []), b);
  assert.equal(attachImages(b, [{ id: 'p1' }]).images.length, 1);
});

test('Backup: Größe grob angeben', () => {
  assert.equal(base64Bytes(3000), 4000);
  assert.equal(sizeLabel(50 * 1024), '50 KB');
  assert.equal(sizeLabel(3.4 * 1024 * 1024), '3,4 MB');
  assert.equal(sizeLabel(10), '1 KB');
});
