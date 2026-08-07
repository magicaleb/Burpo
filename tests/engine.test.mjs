import assert from "node:assert/strict";
import {
  decodeWords,
  generatePhrase,
  getWordFamilies,
  gridCenter,
  normalizeTrace,
  pointToCell,
  routeSignature,
  traceToRoute,
} from "../src/trace-engine.js";

const families = getWordFamilies();
assert.equal(families.length, 9, "decoder should expose a 3×3 map");
assert.equal(new Set(families.flatMap((family) => family.words)).size, 54, "cue words must be unique");

for (let index = 0; index < 9; index += 1) {
  const center = gridCenter(index);
  assert.equal(pointToCell(center), index, `grid center ${index} should map back to itself`);
}

const source = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 300 },
  { x: 100, y: 300 },
  { x: 100, y: 100 },
];
const normalized = normalizeTrace(source);
assert.deepEqual(normalized[0], { x: 0, y: 0 });
assert.deepEqual(normalized[2], { x: 1, y: 1 });

const detailedSquare = [];
for (let i = 0; i <= 40; i += 1) detailedSquare.push({ x: i * 5, y: Math.sin(i) * 1.8 });
for (let i = 1; i <= 40; i += 1) detailedSquare.push({ x: 200 + Math.sin(i) * 1.8, y: i * 5 });
for (let i = 1; i <= 40; i += 1) detailedSquare.push({ x: 200 - i * 5, y: 200 + Math.sin(i) * 1.8 });
for (let i = 1; i <= 40; i += 1) detailedSquare.push({ x: Math.sin(i) * 1.8, y: 200 - i * 5 });

const squareRoute = traceToRoute(detailedSquare);
assert.deepEqual(squareRoute, [0, 2, 8, 6, 0], "hand wobble must not invent extra square corners");

for (let phase = 0; phase < 20; phase += 1) {
  const amplitude = 1 + phase * 0.22;
  const noisySquare = [];
  for (let i = 0; i <= 40; i += 1) noisySquare.push({ x: i * 5, y: Math.sin(i * 0.9 + phase) * amplitude });
  for (let i = 1; i <= 40; i += 1) noisySquare.push({ x: 200 + Math.sin(i * 0.8 + phase) * amplitude, y: i * 5 });
  for (let i = 1; i <= 40; i += 1) noisySquare.push({ x: 200 - i * 5, y: 200 + Math.sin(i * 1.1 + phase) * amplitude });
  for (let i = 1; i <= 40; i += 1) noisySquare.push({ x: Math.sin(i * 0.7 + phase) * amplitude, y: 200 - i * 5 });
  assert.deepEqual(traceToRoute(noisySquare), [0, 2, 8, 6, 0], `square phase ${phase} should remain stable`);
}

const route = [0, 2, 8, 6, 4, 1];
const generated = generatePhrase(route, 42);
assert.deepEqual(decodeWords(generated.phrase), route, "generated language should decode losslessly");
assert.match(generated.phrase, /^The algorithm thinks you'd /, "result should sound like a fake personality test");
assert.equal(routeSignature([0, 4, 8]), "159");

assert.doesNotThrow(() => generatePhrase([0, 8]), "simple two-point traces should be supported");
assert.throws(() => generatePhrase([0]), RangeError);
assert.throws(() => generatePhrase([0, 1, 2, 3, 4, 5, 6, 7]), RangeError);

console.log(`✓ engine tests passed (${squareRoute.length}-node square route: ${routeSignature(squareRoute)})`);
