import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginDiarySwipe, moveDiarySwipe, endDiarySwipe } from '../personal/src/lib/diarioSwipe.js';
const point = (x, y, overrides = {}) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, ...overrides });
const start = (width = 375) => beginDiarySwipe(point(200, 200), width);
test('phone swipe accepts finger drift that the old 30px vertical limit rejected', () => {
  const s = moveDiarySwipe(start(), point(150, 220));
  assert.equal(endDiarySwipe(s, point(125, 235)), 1);
  assert.equal(endDiarySwipe(start(), point(275, 235)), -1);
});
test('vertical reading can never become a page turn later in the same drag', () => {
  const s = moveDiarySwipe(start(), point(208, 155));
  assert.equal(s, null);
  assert.equal(endDiarySwipe(s, point(90, 150)), 0);
});
test('a horizontal start that changes into vertical motion is abandoned', () => {
  const s = moveDiarySwipe(start(), point(175, 203));
  assert.equal(endDiarySwipe(s, point(120, 290)), 0);
});
test('taps, short movement, other pointers and cancellation do not turn', () => {
  assert.equal(endDiarySwipe(start(), point(200, 200)), 0);
  assert.equal(endDiarySwipe(start(), point(180, 201)), 0);
  assert.equal(endDiarySwipe(start(), point(100, 200, {pointerId:2})), 0);
  assert.equal(endDiarySwipe(null, point(100, 200)), 0);
  assert.equal(beginDiarySwipe(point(0,0,{isPrimary:false}),375),null);
  assert.equal(beginDiarySwipe(point(0,0,{button:2}),375),null);
});
test('distance scales to phone width and is capped on desktop', () => {
  assert.equal(endDiarySwipe(start(320),point(154,200)),1);
  assert.equal(endDiarySwipe(start(1440),point(121,200)),0);
  assert.equal(endDiarySwipe(start(1440),point(119,200)),1);
});
