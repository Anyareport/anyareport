import assert from 'node:assert/strict';
import test from 'node:test';
import { PH_MOBILE_REGEX } from './phone.js';

test('accepts Philippine mobile numbers in 09XXXXXXXXX format', () => {
  assert.equal(PH_MOBILE_REGEX.test('09171234567'), true);
});

test('rejects phone numbers outside 09XXXXXXXXX format', () => {
  for (const phone of ['0917123456', '+639171234567', '123', 'abcdefghijk']) {
    assert.equal(PH_MOBILE_REGEX.test(phone), false);
  }
});
