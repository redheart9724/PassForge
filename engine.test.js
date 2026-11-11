'use strict';

const assert = require('node:assert/strict');
const PassForge = require('../engine.js');

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

console.log('PassForge engine tests\n');

const sample = {
  firstName: 'John',
  lastName: 'Smith',
  nickName: 'Johnny',
  dob: '1990-05-14',
  phone: '+91 98765 43210',
  email: 'john.smith@example.com',
  petName: 'Tommy',
  partnerName: 'Jane',
  childName: 'Alice',
  company: 'Acme Corp',
  city: 'Pune',
  wifiName: 'Home Wifi 5G',
  team: 'Mumbai Indians',
  hobby: 'cricket',
  extra: 'Royal Enfield, MH12AB1234'
};

test('generates a meaningful number of candidates', function () {
  const res = PassForge.generate(sample, { maxResults: 20000 });
  assert.ok(res.passwords.length > 1000, 'expected >1000 candidates, got ' + res.passwords.length);
  assert.equal(res.truncated, true);
});

test('candidates are unique', function () {
  const res = PassForge.generate(sample, { maxResults: 20000 });
  const unique = new Set(res.passwords);
  assert.equal(unique.size, res.passwords.length);
});

test('respects min/max length', function () {
  const res = PassForge.generate(sample, { maxResults: 20000, minLength: 8, maxLength: 12 });
  assert.ok(res.passwords.length > 100);
  for (const p of res.passwords) {
    assert.ok(p.length >= 8 && p.length <= 12, 'bad length: ' + p);
  }
});

test('produces name + number and leet variants', function () {
  const res = PassForge.generate(sample, { maxResults: 20000 });
  const set = new Set(res.passwords);
  assert.ok(set.has('JohnSmith123'), 'missing JohnSmith123');
  assert.ok(set.has('johnsmith123'), 'missing johnsmith123');
  assert.ok(set.has('j0hn'), 'missing j0hn');
  assert.ok(set.has('j0hn123'), 'missing j0hn123');
  assert.ok(set.has('john.smith'), 'missing john.smith');
  assert.ok(set.has('Tommy'), 'missing Tommy');
});

test('includes date, phone and email local-part material', function () {
  const res = PassForge.generate(sample, { maxResults: 20000, usePairs: false });
  const set = new Set(res.passwords);
  assert.ok(set.has('14051990'), 'missing DOB ddmmyyyy');
  assert.ok(set.has('1990'), 'missing year');
  assert.ok(set.has('43210'), 'missing phone tail');
  assert.ok(res.passwords.some((p) => p.toLowerCase() === 'john.smith'), 'missing email local part');
});

test('honours the result cap', function () {
  const res = PassForge.generate(sample, { maxResults: 500 });
  assert.equal(res.passwords.length, 500);
  assert.equal(res.truncated, true);
});

test('lowercase-only mode works', function () {
  const res = PassForge.generate(
    { firstName: 'Rahul', lastName: 'Sharma' },
    { maxResults: 5000, caseMode: 'lower', leet: 'none', usePairs: false, includeCommon: false }
  );
  assert.ok(res.passwords.length > 0);
  for (const p of res.passwords) {
    assert.equal(p, p.toLowerCase(), 'expected lowercase: ' + p);
  }
});

test('can disable all suffix families', function () {
  const res = PassForge.generate(
    { firstName: 'Rahul', lastName: 'Sharma' },
    {
      maxResults: 50000,
      useNumbers: false,
      useYears: false,
      useSymbols: false,
      usePairs: false,
      includeCommon: false,
      leet: 'full'
    }
  );
  assert.ok(res.passwords.includes('Rahul'), 'missing Rahul');
  assert.ok(res.passwords.includes('Sharma'), 'missing Sharma');
  assert.ok(!res.truncated, 'should not be truncated');
});

test('produces two-field combinations', function () {
  const res = PassForge.generate(sample, { maxResults: 200000, includeCommon: false });
  const set = new Set(res.passwords);
  assert.ok(set.has('TommyJohn123'), 'missing pet+first combination');
  assert.ok(set.has('tommy.smith123'), 'missing pet+last combination');
});

test('generates symbol+number suffixes and number-first patterns', function () {
  const res = PassForge.generate(
    { firstName: 'Sunny', lastName: 'J', dob: '1996-05-14', phone: '9591314312' },
    { maxResults: 200000 }
  );
  const set = new Set(res.passwords);

  // The reported real-world miss: name + @ + phone prefix.
  assert.ok(set.has('Sunny@9591'), 'missing Sunny@9591');
  assert.ok(set.has('Sunny@9591!'), 'missing Sunny@9591!');
  assert.ok(set.has('Sunny#1996'), 'missing Sunny#1996');
  assert.ok(set.has('Sunny@1996'), 'missing Sunny@1996');
  assert.ok(set.has('Sunny9591'), 'missing Sunny9591');
  assert.ok(set.has('Sunny9591@'), 'missing Sunny9591@');
  assert.ok(set.has('9591Sunny'), 'missing 9591Sunny');
  assert.ok(set.has('9591@Sunny'), 'missing 9591@Sunny');
});

test('uses explicitly supplied important numbers', function () {
  const res = PassForge.generate(
    { firstName: 'Sunny', numbers: '9591' },
    { maxResults: 50000 }
  );
  const set = new Set(res.passwords);
  assert.ok(set.has('Sunny@9591'), 'missing Sunny@9591 from the numbers field');
  assert.ok(set.has('9591@Sunny'), 'missing 9591@Sunny from the numbers field');
});

test('mines phone prefixes and suffixes as number candidates', function () {
  const internals = PassForge._internals;
  const numbers = internals.collectNumbers(
    { phone: '9591314312' },
    null,
    internals.normalizeOptions({}),
    new Date()
  );
  assert.ok(numbers.includes('9591'), 'missing phone prefix 9591');
  assert.ok(numbers.includes('4312'), 'missing phone suffix 4312');
  assert.ok(numbers.includes('9591314312'), 'missing full phone number');

  const intl = internals.collectNumbers(
    { phone: '+91 95913 14312' },
    null,
    internals.normalizeOptions({}),
    new Date()
  );
  assert.ok(intl.includes('9591'), 'country code hid the local prefix 9591');
});

test('empty input does not crash', function () {
  const res = PassForge.generate({}, { maxResults: 5000 });
  assert.ok(Array.isArray(res.passwords));
  assert.equal(res.passwords.length, 0);
});

test('does not emit empty strings', function () {
  const res = PassForge.generate(sample, { maxResults: 20000 });
  assert.ok(res.passwords.every((p) => p.length > 0));
});

test('parses dates safely', function () {
  const internals = PassForge._internals;
  assert.deepEqual(internals.parseDob('1990-05-14'), { year: 1990, month: 5, day: 14 });
  assert.equal(internals.parseDob('14/05/1990'), null);
  assert.equal(internals.parseDob(''), null);
});

console.log('\n' + passed + ' tests passed.\n');
