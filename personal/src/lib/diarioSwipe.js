// Vertical pan belongs to the browser. Only a predominantly horizontal drag turns a leaf.
export function beginDiarySwipe(e, width) {
  if (e.isPrimary === false || e.button !== 0) return null;
  return { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, threshold: Math.max(42, Math.min(80, width * .14)) };
}
export function moveDiarySwipe(gesture, e) {
  if (!gesture || e.pointerId !== gesture.id) return null;
  const x = Math.abs(e.clientX - gesture.x), y = Math.abs(e.clientY - gesture.y);
  if (y > 10 && y >= x * .8) return null;
  return x > 10 && x > y * 1.25 ? { ...gesture, axis: 'horizontal' } : gesture;
}
export function endDiarySwipe(gesture, e) {
  const moved = moveDiarySwipe(gesture, e);
  if (!moved || moved.axis !== 'horizontal') return 0;
  const dx = e.clientX - moved.x;
  return Math.abs(dx) >= moved.threshold ? (dx < 0 ? 1 : -1) : 0;
}
