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
    words: ["sparrow", "robin", "raven", "swallow", "magpie", "pigeon"],
  },
  {
    id: "stone",
    label: "Stone",
    anchor: "Stone",
    words: ["pebble", "crystal", "marble", "flint", "fossil", "gemstone"],
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

const CLAUSE_BUILDERS = [
  (word) => `blame the ${word}`,
  (word) => `follow the ${word}`,
  (word) => `argue with the ${word}`,
  (word) => `apologize to the ${word}`,
  (word) => `overthink a ${word}`,
  (word) => `befriend a ${word}`,
  (word) => `pocket a ${word}`,
  (word) => `bring snacks to the ${word}`,
  (word) => `get too close to a ${word}`,
];

const RESULT_TAGS = [
  "It also thinks this counts as science.",
  "Honestly, it has made worse guesses.",
  "No refunds on the personality diagnosis.",
  "Please do not make any major decisions based on this.",
];

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
  const minNodes = options.minNodes ?? 2;
  const maxNodes = options.maxNodes ?? 7;
  const normalized = normalizeTrace(points);
  if (normalized.length < 2) return [];

  const sampled = resampleTrace(normalized, 96);
  const smoothed = smoothTrace(sampled, options.smoothingRadius ?? 2);
  let landmarks = simplifyRdp(smoothed, options.cornerTolerance ?? 0.055);
  landmarks = pruneShallowCorners(landmarks, options.minimumTurn ?? 0.22);

  while (landmarks.length > maxNodes + 2) landmarks = removeLeastImportantLandmark(landmarks);

  let route = removeConsecutiveDuplicates(landmarks.map(pointToCell));

  if (route.length < minNodes) {
    const anchors = removeConsecutiveDuplicates(resampleTrace(normalized, 5).map(pointToCell));
    route = anchors.length > route.length ? anchors : route;
  }

  while (route.length > maxNodes) route = removeLeastInformativeTurn(route);

  return route;
}

export function generatePhrase(route, seed = randomSeed()) {
  if (route.length < 2 || route.length > 7) {
    throw new RangeError("A phrase route must contain between 2 and 7 nodes.");
  }

  const words = route.map((cell, index) => {
    const family = WORD_FAMILIES[cell];
    if (!family) throw new RangeError(`Unknown route cell: ${cell}`);
    return family.words[positiveModulo(seed + index * 11 + cell * 7, family.words.length)];
  });

  const clauses = words.map((word, index) => CLAUSE_BUILDERS[route[index]](word));
  const tag = RESULT_TAGS[positiveModulo(seed, RESULT_TAGS.length)];

  return {
    phrase: `The algorithm thinks you'd ${joinList(clauses)}. ${tag}`,
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

function smoothTrace(points, radius) {
  if (radius <= 0 || points.length < 3) return [...points];
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const start = Math.max(0, index - radius);
    const end = Math.min(points.length - 1, index + radius);
    const window = points.slice(start, end + 1);
    return {
      x: window.reduce((sum, item) => sum + item.x, 0) / window.length,
      y: window.reduce((sum, item) => sum + item.y, 0) / window.length,
    };
  });
}

function simplifyRdp(points, epsilon) {
  if (points.length <= 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let splitIndex = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = distanceToSegment(points[index], first, last);
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon) return [first, last];
  const left = simplifyRdp(points.slice(0, splitIndex + 1), epsilon);
  const right = simplifyRdp(points.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

function pruneShallowCorners(points, minimumTurn) {
  if (points.length < 3) return points;
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = result[result.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = Math.atan2(current.y - previous.y, current.x - previous.x);
    const outgoing = Math.atan2(next.y - current.y, next.x - current.x);
    const turn = Math.abs(normalizeAngle(outgoing - incoming));
    if (turn >= minimumTurn) result.push(current);
  }
  result.push(points[points.length - 1]);
  return result;
}

function removeLeastImportantLandmark(points) {
  if (points.length <= 2) return points;
  let removeIndex = 1;
  let smallestArea = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length - 1; index += 1) {
    const area = triangleArea(points[index - 1], points[index], points[index + 1]);
    if (area < smallestArea) {
      smallestArea = area;
      removeIndex = index;
    }
  }
  return points.filter((_, index) => index !== removeIndex);
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

function distanceToSegment(point, start, end) {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) return distance(point, start);
  const projection = clamp(
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
      lengthSquared,
    0,
    1,
  );
  return distance(point, {
    x: start.x + projection * (end.x - start.x),
    y: start.y + projection * (end.y - start.y),
  });
}

function triangleArea(a, b, c) {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
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

function joinList(items) {
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
