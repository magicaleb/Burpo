const WORD_FAMILIES = [
  {
    id: "weather",
    label: "Weather",
    anchor: "Cloud",
    words: ["mist", "rain", "thunder", "breeze", "frost", "storm"],
  },
  {
    id: "light",
    label: "Light",
    anchor: "Sun",
    words: ["sunlight", "lantern", "glow", "dawn", "shadow", "candle"],
  },
  {
    id: "space",
    label: "Space",
    anchor: "Star",
    words: ["moon", "comet", "star", "orbit", "planet", "eclipse"],
  },
  {
    id: "plants",
    label: "Plants",
    anchor: "Tree",
    words: ["pine", "cedar", "fern", "garden", "willow", "orchard"],
  },
  {
    id: "mind",
    label: "Mind",
    anchor: "Heart",
    words: ["memory", "dream", "thought", "heartbeat", "secret", "echo"],
  },
  {
    id: "birds",
    label: "Birds",
    anchor: "Bird",
    words: ["sparrow", "feather", "robin", "wings", "raven", "swallow"],
  },
  {
    id: "stone",
    label: "Stone",
    anchor: "Stone",
    words: ["pebble", "granite", "sand", "clay", "marble", "flint"],
  },
  {
    id: "water",
    label: "Water",
    anchor: "Wave",
    words: ["river", "tide", "lake", "brook", "ocean", "harbor"],
  },
  {
    id: "fire",
    label: "Fire",
    anchor: "Flame",
    words: ["ember", "flame", "spark", "fire", "cinder", "torch"],
  },
];

const TEMPLATES = {
  4: (w) => `Where ${w[0]} meets ${w[1]}, ${w[2]} remembers ${w[3]}.`,
  5: (w) => `Past ${w[0]}, ${w[1]} carries ${w[2]} toward ${w[3]} and ${w[4]}.`,
  6: (w) => `${capitalize(w[0])} follows ${w[1]}; ${w[2]} turns through ${w[3]}, beneath ${w[4]}, into ${w[5]}.`,
  7: (w) => `From ${w[0]} to ${w[1]}, ${w[2]} crosses ${w[3]}; ${w[4]} waits beside ${w[5]} and ${w[6]}.`,
};

export function getWordFamilies() {
  return WORD_FAMILIES.map((family) => ({ ...family, words: [...family.words] }));
}

export function gridCenter(index, size = 1) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: ((col + 0.5) / 3) * size, y: ((row + 0.5) / 3) * size };
}

export function pointToCell(point) {
  const col = clamp(Math.floor(point.x * 3), 0, 2);
  const row = clamp(Math.floor(point.y * 3), 0, 2);
  return row * 3 + col;
}

export function normalizeTrace(points) {
  if (!points.length) return [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scale = Math.max(width, height);
  const xPad = (scale - width) / 2;
  const yPad = (scale - height) / 2;

  return points.map((point) => ({
    x: clamp((point.x - minX + xPad) / scale, 0, 1),
    y: clamp((point.y - minY + yPad) / scale, 0, 1),
  }));
}

export function resampleTrace(points, targetCount = 96) {
  if (points.length < 2) return [...points];
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return [points[0]];

  const sampled = [];
  let segment = 1;
  for (let i = 0; i < targetCount; i += 1) {
    const target = (i / (targetCount - 1)) * total;
    while (segment < lengths.length - 1 && lengths[segment] < target) segment += 1;
    const before = lengths[segment - 1];
    const after = lengths[segment];
    const ratio = after === before ? 0 : (target - before) / (after - before);
    sampled.push({
      x: lerp(points[segment - 1].x, points[segment].x, ratio),
      y: lerp(points[segment - 1].y, points[segment].y, ratio),
    });
  }
  return sampled;
}

export function traceToRoute(points, options = {}) {
  const minNodes = options.minNodes ?? 4;
  const maxNodes = options.maxNodes ?? 7;
  const normalized = normalizeTrace(points);
  if (normalized.length < 2) return [];

  const sampled = resampleTrace(normalized, 120);
  let route = removeConsecutiveDuplicates(sampled.map(pointToCell));
  route = removeStraightRuns(route);

  while (route.length > maxNodes) {
    route = removeLeastInformativeTurn(route);
  }

  if (route.length < minNodes) {
    const anchors = resampleTrace(normalized, minNodes * 2 + 1).map(pointToCell);
    const expanded = removeConsecutiveDuplicates(anchors);
    route = expanded.length > route.length ? expanded : route;
    while (route.length > maxNodes) route = removeLeastInformativeTurn(route);
  }

  return route;
}

export function generatePhrase(route, seed = randomSeed()) {
  if (route.length < 4 || route.length > 7) {
    throw new RangeError("A phrase route must contain between 4 and 7 nodes.");
  }

  const words = route.map((cell, index) => {
    const family = WORD_FAMILIES[cell];
    if (!family) throw new RangeError(`Unknown route cell: ${cell}`);
    return family.words[positiveModulo(seed + index * 11 + cell * 7, family.words.length)];
  });

  return {
    phrase: TEMPLATES[route.length](words),
    words,
    route: [...route],
  };
}

export function decodeWords(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return tokens.flatMap((token) => {
    const index = WORD_FAMILIES.findIndex((family) => family.words.includes(token));
    return index === -1 ? [] : [index];
  });
}

export function routeSignature(route) {
  return route.map((cell) => cell + 1).join("");
}

export function routeComplexity(route) {
  if (route.length < 2) return 0;
  let score = 0;
  for (let i = 1; i < route.length; i += 1) {
    const a = gridCenter(route[i - 1]);
    const b = gridCenter(route[i]);
    score += distance(a, b);
  }
  return Math.round(score * 10);
}

function removeStraightRuns(route) {
  if (route.length < 3) return route;
  const result = [route[0]];
  for (let i = 1; i < route.length - 1; i += 1) {
    const a = gridCoordinates(result[result.length - 1]);
    const b = gridCoordinates(route[i]);
    const c = gridCoordinates(route[i + 1]);
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const sameDirection = ab.x * bc.y === ab.y * bc.x && ab.x * bc.x + ab.y * bc.y > 0;
    if (!sameDirection) result.push(route[i]);
  }
  result.push(route[route.length - 1]);
  return removeConsecutiveDuplicates(result);
}

function removeLeastInformativeTurn(route) {
  if (route.length <= 2) return route;
  let removeIndex = 1;
  let smallestCost = Number.POSITIVE_INFINITY;

  for (let i = 1; i < route.length - 1; i += 1) {
    const a = gridCenter(route[i - 1]);
    const b = gridCenter(route[i]);
    const c = gridCenter(route[i + 1]);
    const detour = distance(a, b) + distance(b, c) - distance(a, c);
    const revisitPenalty = route[i - 1] === route[i + 1] ? 0.25 : 0;
    const cost = detour + revisitPenalty;
    if (cost < smallestCost) {
      smallestCost = cost;
      removeIndex = i;
    }
  }

  return route.filter((_, index) => index !== removeIndex);
}

function gridCoordinates(index) {
  return { x: index % 3, y: Math.floor(index / 3) };
}

function removeConsecutiveDuplicates(items) {
  return items.filter((item, index) => index === 0 || item !== items[index - 1]);
}

function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
