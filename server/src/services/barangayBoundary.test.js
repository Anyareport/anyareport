import test from 'node:test';
import assert from 'node:assert/strict';
import { isInsideBarangayBoundary } from './barangayBoundary.js';

test('accepts a point inside Barangay Don Mariano Marcos', () => {
  assert.equal(isInsideBarangayBoundary(16.482, 121.1557), true);
});

test('rejects a point outside Barangay Don Mariano Marcos', () => {
  assert.equal(isInsideBarangayBoundary(16.49, 121.1557), false);
});

test('accepts a point on the barangay boundary', () => {
  assert.equal(isInsideBarangayBoundary(16.485316, 121.154424), true);
});

test('rejects invalid coordinates', () => {
  assert.equal(isInsideBarangayBoundary(Number.NaN, 121.1557), false);
  assert.equal(isInsideBarangayBoundary(16.482, 181), false);
});
