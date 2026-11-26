import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordIssues, validEmail, validName, validPhone } from '../src/lib/validate.ts';
import { fresh, onFail, remainingSeconds, MAX_FREE } from '../src/lib/throttle.ts';

test('password policy', () => {
  assert.deepEqual(passwordIssues('abcdefg1'), []);
  assert.ok(passwordIssues('short1').length > 0);
  assert.ok(passwordIssues('onlyletters').includes('at least one number'));
  assert.ok(passwordIssues('12345678').includes('at least one letter'));
});
test('email, name, phone', () => {
  assert.ok(validEmail('a@b.co')); assert.ok(!validEmail('a@b')); assert.ok(!validEmail('a b@c.com'));
  assert.ok(validName('Maria Santos')); assert.ok(!validName('A')); assert.ok(!validName('<script>'));
  assert.ok(validPhone('')); assert.ok(validPhone('+63 912 345 6789')); assert.ok(!validPhone('abc'));
});
test('login lockout grows after 5 wrong tries', () => {
  let s = fresh(); const now = 1_000_000;
  for (let i = 1; i < MAX_FREE; i++) { s = onFail(s, now); assert.equal(remainingSeconds(s, now), 0); }
  s = onFail(s, now); assert.equal(remainingSeconds(s, now), 30);
  s = onFail(s, now); assert.equal(remainingSeconds(s, now), 60);
  for (let i = 0; i < 20; i++) s = onFail(s, now);
  assert.equal(remainingSeconds(s, now), 900);          // capped at 15 minutes
  assert.equal(remainingSeconds(s, now + 900_000), 0);  // and it expires
});
