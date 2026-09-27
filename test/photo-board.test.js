import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardLayout, fitContain, boardTitle, boardPoses, BOARD } from '../js/ui/photo-board.js';

const inside = (t, L) => t.x >= 0 && t.y >= 0 && t.x + t.w <= L.width && t.y + t.h <= L.height;

test('Tafel für eine, zwei und drei Posen', () => {
  for (const n of [1, 2, 3]) {
    const L = boardLayout(n);
    assert.equal(L.height, 1080);
    assert.equal(L.tiles.length, n);
    L.tiles.forEach(t => {
      assert.ok(inside(t, L), `Feld liegt im Bild (${n})`);
      assert.ok(t.labelY > t.y + t.h && t.labelY < L.height, 'Beschriftung unter dem Bild');
      assert.equal(Math.round(t.w / t.h * 100), 75);
    });
    /* Felder überlappen nicht und haben gleichen Abstand */
    for (let i = 1; i < n; i++) assert.equal(L.tiles[i].x - (L.tiles[i - 1].x + L.tiles[i - 1].w), BOARD.gap);
    /* gleicher Rand links und rechts */
    const last = L.tiles[n - 1];
    assert.equal(L.width - (last.x + last.w), L.tiles[0].x);
  }
  const [a, b, c] = [1, 2, 3].map(n => boardLayout(n).width);
  assert.ok(a < b && b < c);
  assert.ok(c > 1080, 'drei Posen ergeben Querformat');
  assert.ok(c >= 1900 && c <= 2200, 'etwa 2000 bis 2160 Pixel breit, war ' + c);
});

test('Anzahl wird auf 1 bis 3 begrenzt', () => {
  assert.equal(boardLayout(0).tiles.length, 1);
  assert.equal(boardLayout(5).tiles.length, 3);
});

test('Bild wird ohne Abschneiden eingepasst', () => {
  const box = { x: 40, y: 130, w: 600, h: 800 };
  /* gleiches Seitenverhältnis füllt das Feld */
  assert.deepEqual(fitContain(1536, 2048, box), { x: 40, y: 130, w: 600, h: 800 });
  /* hohes Bild: volle Höhe, mittig */
  const tall = fitContain(1080, 1920, box);
  assert.equal(tall.h, 800);
  assert.equal(tall.w, 450);
  assert.equal(tall.x, 40 + 75);
  /* Querformat: volle Breite, mittig */
  const wide = fitContain(1920, 1080, box);
  assert.equal(wide.w, 600);
  assert.equal(wide.y, 130 + Math.round((800 - wide.h) / 2));
  assert.ok(wide.h <= 800);
});

test('Datum über der Tafel', () => {
  assert.equal(boardTitle(['2026-09-27']), '27. September 2026');
  assert.equal(boardTitle(['2026-09-27', '2026-09-27']), '27. September 2026');
  assert.equal(boardTitle(['2026-09-24', '2026-09-21']), '21. bis 24. September 2026');
  assert.equal(boardTitle(['2026-09-29', '2026-10-02']), '29. September bis 2. Oktober 2026');
  assert.equal(boardTitle(['2026-12-30', '2027-01-02']), '30. Dezember 2026 bis 2. Januar 2027');
  assert.equal(boardTitle([]), '');
});

test('Posen in fester Reihenfolge, fehlende fallen weg', () => {
  assert.deepEqual(boardPoses({ back: {}, front: {} }), ['front', 'back']);
  assert.deepEqual(boardPoses({ side: {}, back: {}, front: {} }), ['front', 'side', 'back']);
  assert.deepEqual(boardPoses({}), []);
});
