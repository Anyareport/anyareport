import assert from 'node:assert/strict';
import test from 'node:test';
import { getClassificationInputMode } from './gemini.js';

const photo = { buffer: Buffer.from('image'), mimetype: 'image/jpeg' };

test('identifies text-only classification input', () => {
  assert.equal(getClassificationInputMode('A detailed incident description', []), 'text only');
});

test('identifies photo-only classification input', () => {
  assert.equal(getClassificationInputMode('', [photo]), 'photos only');
});

test('identifies combined text and photo classification input', () => {
  assert.equal(
    getClassificationInputMode('A detailed incident description', [photo]),
    'text and photos'
  );
});

test('does not count incomplete image files as classification input', () => {
  assert.equal(getClassificationInputMode('  ', [{ buffer: Buffer.from('image') }]), 'text only');
});
