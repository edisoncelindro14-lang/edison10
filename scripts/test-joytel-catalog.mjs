import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchCatalog, productFromCatalog } from '../src/lib/joytelCatalog.js';

const raw = readFileSync(new URL('../public/joytel-esim-catalog.json', import.meta.url), 'utf8');
const j = JSON.parse(raw);
const rows = j.rows.map(([code, name, expires]) => ({ code, name, expires }));

test('catalog has the Philippines eSIMs and the test product', () => {
  assert.ok(rows.length > 6000);
  assert.ok(searchCatalog(rows, 'philippines').length >= 100);
  assert.ok(rows.some(r => r.code === 'eSIM-test'));
  assert.equal(searchCatalog(rows, 'eSIM-PH500M-01')[0].code, 'eSIM-PH500M-01');
  assert.equal(new Set(rows.map(r => r.code)).size, rows.length, 'codes are unique');
});

test('the public catalog file carries no wholesale prices', () => {
  assert.deepEqual(j.cols, ['code', 'name', 'expires']);
  assert.ok(j.rows.every(r => r.length === 3 && typeof r[0] === 'string' && typeof r[1] === 'string'));
});

test('imported product is a hidden JoyTel eSIM with the right code and no warehouse', () => {
  const p = productFromCatalog({ code: 'eSIM-PH500M-01', name: 'eSIM - JOY - Philippines (500MB/day) - 01day' }, 227);
  assert.equal(p.joytel_product_code, 'eSIM-PH500M-01');
  assert.equal(p.joytel_enabled, true);
  assert.equal(p.joytel_type, 3);
  assert.equal(p.joytel_warehouse, null);
  assert.equal(p.is_active, false);
  assert.equal(p.category, 'esim');
  assert.equal(p.price, 227);
});
