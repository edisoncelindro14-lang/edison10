import test from "node:test";
import assert from "node:assert/strict";
import { buildProductQuery } from "../src/lib/productQuery.js";

function fake() {
  const calls = [];
  const q = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); return q; } });
  return { sb: { from: (t) => { calls.push(["from", t]); return q; } }, calls };
}

test("active-only + category + network + search build the expected filters", () => {
  const { sb, calls } = fake();
  buildProductQuery(sb, { category: "esim", network: "JoyTel", query: "japan", activeOnly: true });
  const names = calls.map(c => c[0]);
  assert.deepEqual(names, ["from", "select", "neq", "eq", "eq", "or"]);
  assert.deepEqual(calls[2], ["neq", "is_active", false]);
  assert.ok(calls[5][1].includes("name.ilike.%japan%"));
});

test("no filters adds nothing but the active-only guard", () => {
  const { sb, calls } = fake();
  buildProductQuery(sb, { activeOnly: false });
  assert.deepEqual(calls.map(c => c[0]), ["from", "select"]);
});

test("search text cannot break out of the or() filter", () => {
  const { sb, calls } = fake();
  buildProductQuery(sb, { query: "a,b%)_(*\\c" });
  const or = calls.find(c => c[0] === "or")[1];
  assert.ok(!/[,()*\\](?!.*ilike)/.test(or.split("ilike.")[1].split(",")[0]));
  assert.ok(!or.includes("%)"));
});
