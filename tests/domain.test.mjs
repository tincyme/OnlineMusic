import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomUrl, formatClassTime, routeFromHash, CLASS_PRICE_CENTS } from '../src/domain.mjs';

test('meeting links accept Zoom only and block lookalikes and script URLs', () => {
  assert.equal(zoomUrl('https://us02web.zoom.us/j/123?pwd=abc'), 'https://us02web.zoom.us/j/123?pwd=abc');
  for (const url of ['javascript:alert(1)', 'https://zoom.us.evil.test/j/1', 'https://evilzoom.us/j/1', 'http://zoom.us/j/1', 'https://user:pass@zoom.us/j/1']) assert.equal(zoomUrl(url), null);
});
test('hash routes survive GitHub project subpaths and unknown routes go home', () => {
  assert.equal(routeFromHash('#/student'), 'student');
  assert.equal(routeFromHash('#/teacher'), 'teacher');
  assert.equal(routeFromHash('#/admin'), 'admin');
  assert.equal(routeFromHash('#/unknown'), 'home');
  assert.equal(CLASS_PRICE_CENTS, 3500);
});
test('class times adjust for DST rather than using a fixed NRI offset', () => {
  assert.match(formatClassTime('2026-01-15T15:00:00Z', 'America/New_York'), /10:00/);
  assert.match(formatClassTime('2026-07-15T15:00:00Z', 'America/New_York'), /11:00/);
});
