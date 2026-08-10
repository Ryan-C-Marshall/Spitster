// One-time offline extraction of Venn-diagram region centroids.
//
// Approach:
//   1. Parse each SVG, keep only the on-canvas filled shapes (this
//      automatically discards the decorative "shadow" duplicates and the
//      off-canvas background art, since those live outside the viewBox
//      and get clipped by the SVG at render time anyway).
//   2. Flatten each shape's path data (m/l/c/z only - confirmed via grep
//      that's all these files use) into a polygon via bezier subdivision.
//   3. Sample a dense grid of points across the canvas. For each point,
//      compute the bitmask of which player-shapes contain it, and
//      accumulate running sums per bitmask.
//   4. EROSION STEP: for every sample point that landed in a region, also
//      compute its distance to the nearest shape boundary edge (across all
//      shapes, not just the ones forming this region - a region's border is
//      always the edge of *some* shape, whether that shape is a member of
//      the region or an adjacent one clipping it). Points closer than
//      ERODE_MARGIN_PX to any shape boundary are "border" points and get
//      filtered out before we pick centroids / emit sample points. This is
//      what keeps dots from spawning right on a region seam where it's
//      ambiguous which region they belong to.
//   5. Centroid = mean of the eroded (interior-only) sample points for that
//      bitmask. If the naive centroid isn't actually inside the region
//      (possible for concave/irregular regions), snap to the nearest
//      eroded sample point that is inside it.
//   6. Emit a TS constants file keyed the same way the app already keys
//      regions: sorted player indices joined by '-' (see
//      getDotRegionKey in CrowdFavouriteQuestion.tsx).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// This script lives at scripts/extractVennRegions.mjs - paths below are
// relative to the repo root from there.
const SVG_DIR = path.join(__dirname, '..', 'apps/web/src/resources/images');
const OUTPUT_TS_PATH = path.join(
  __dirname,
  '..',
  'apps/web/src/features/quiz/questionTypes/vennRegionCentroids.ts',
);
const OUTPUT_JSON_PATH = path.join(__dirname, 'out', 'venn-regions.json'); // debug-only, not needed by the app

const VIEW_BOX = { width: 960, height: 720 };
const GRID_STEP = 1; // px, in viewBox units -> 691,200 sample points per diagram
const CURVE_SEGMENTS = 24; // bezier flattening resolution per cubic segment

// --- Border erosion ---
// Minimum distance (in viewBox px) a sample point must be from *any* shape
// boundary edge to be considered "safe" (i.e. unambiguously inside one
// region, not straddling a seam). 960px wide canvas, so 22px is a little
// over 2% of the diagram width - enough to be visually obvious, small
// enough that thin sliver regions (e.g. the innermost overlap in the
// 5-player diagram) still retain usable interior points.
const ERODE_MARGIN_PX = 15;
// If the primary margin erodes a region down to nothing (can happen for
// genuinely thin sliver regions), retry with progressively smaller margins
// rather than falling back straight to unfiltered/border points.
const FALLBACK_MARGINS_PX = [ERODE_MARGIN_PX, 14, 8, 4, 1, 0];
// Below this many surviving points for a margin, try the next smaller one.
const MIN_SAFE_POINTS = 25;
// Upper bound used for bbox-based pruning when computing boundary distance.
// Must be >= the largest value in FALLBACK_MARGINS_PX. Points whose
// expanded bbox check rules out a shape are guaranteed to be farther than
// this from that shape's boundary, so it's safe to skip exact distance
// computation for them.
const PRUNE_MARGIN_PX = 40;

// When emitting the per-region sample point lists, keep the arrays bounded
// so the generated TS file doesn't explode in size. This caps the number of
// sample points we store per region while retaining spatial coverage.
const MAX_SAMPLES_PER_REGION = 2000; // deterministic downsampling; set to Infinity to disable cap

const DIAGRAM_FILES = {
  2: 'venn-diagram-2.svg',
  3: 'venn-diagram-3.svg',
  4: 'venn-diagram-4.svg',
  5: 'venn-diagram-5.svg',
};

// ---------- SVG path parsing ----------

function tokenizePathD(d) {
  const tokens = [];
  const re = /([MLCZmlcz])|(-?\d*\.\d+|-?\d+\.?\d*)/g;
  let match;
  while ((match = re.exec(d)) !== null) {
    if (match[1]) tokens.push({ type: 'cmd', value: match[1] });
    else tokens.push({ type: 'num', value: parseFloat(match[2]) });
  }
  return tokens;
}

function argCountFor(cmd) {
  switch (cmd.toLowerCase()) {
    case 'm':
      return 2;
    case 'l':
      return 2;
    case 'c':
      return 6;
    case 'z':
      return 0;
    default:
      throw new Error(`Unsupported path command "${cmd}" - extend the parser`);
  }
}

function flattenCubicBezier(p0, p1, p2, p3, segments) {
  const points = [];
  for (let s = 1; s <= segments; s += 1) {
    const t = s / segments;
    const mt = 1 - t;
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
    points.push({ x, y });
  }
  return points;
}

// Parses a single-subpath "m ... c ... l ... z" path into a flattened polygon.
function pathDToPolygon(d) {
  const tokens = tokenizePathD(d);
  let i = 0;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let currentCmd = null;
  const polygon = [];

  while (i < tokens.length) {
    let cmd;
    if (tokens[i].type === 'cmd') {
      cmd = tokens[i].value;
      i += 1;
      currentCmd = cmd;
    } else {
      cmd = currentCmd; // implicit repeat of previous command
    }

    const argCount = argCountFor(cmd);
    const args = [];
    for (let k = 0; k < argCount; k += 1) {
      args.push(tokens[i].value);
      i += 1;
    }

    const isRelative = cmd === cmd.toLowerCase();

    switch (cmd.toLowerCase()) {
      case 'm': {
        const next = isRelative ? { x: cur.x + args[0], y: cur.y + args[1] } : { x: args[0], y: args[1] };
        cur = next;
        start = { ...next };
        polygon.push({ ...next });
        break;
      }
      case 'l': {
        const next = isRelative ? { x: cur.x + args[0], y: cur.y + args[1] } : { x: args[0], y: args[1] };
        polygon.push(next);
        cur = next;
        break;
      }
      case 'c': {
        const [x1, y1, x2, y2, x3, y3] = args;
        const p1 = isRelative ? { x: cur.x + x1, y: cur.y + y1 } : { x: x1, y: y1 };
        const p2 = isRelative ? { x: cur.x + x2, y: cur.y + y2 } : { x: x2, y: y2 };
        const p3 = isRelative ? { x: cur.x + x3, y: cur.y + y3 } : { x: x3, y: y3 };
        polygon.push(...flattenCubicBezier(cur, p1, p2, p3, CURVE_SEGMENTS));
        cur = p3;
        break;
      }
      case 'z': {
        polygon.push({ ...start });
        cur = { ...start };
        break;
      }
      default:
        throw new Error(`Unhandled command ${cmd}`);
    }
  }

  return polygon;
}

// ---------- Shape extraction / filtering ----------

function extractPathElements(svgText) {
  const pathRegex = /<path\b([^>]*?)\/?>/g;
  const results = [];
  let m;
  while ((m = pathRegex.exec(svgText)) !== null) {
    const attrs = m[1];
    const dMatch = attrs.match(/\bd="([^"]*)"/);
    if (!dMatch) continue;
    const fillOpacityMatch = attrs.match(/fill-opacity="([^"]*)"/);
    const fillMatch = attrs.match(/\bfill="([^"]*)"/);
    results.push({
      d: dMatch[1],
      fillOpacity: fillOpacityMatch ? parseFloat(fillOpacityMatch[1]) : 1,
      fill: fillMatch ? fillMatch[1] : null,
    });
  }
  return results;
}

function polygonBBox(polygon) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function isOnCanvas(bbox) {
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  return cx >= 0 && cx <= VIEW_BOX.width && cy >= 0 && cy <= VIEW_BOX.height;
}

// Returns an ordered list of { polygon, bbox } - one per player, in document order.
function extractPlayerShapes(svgText, expectedCount) {
  const rawPaths = extractPathElements(svgText);
  const seen = new Set();
  const shapes = [];

  for (const raw of rawPaths) {
    if (raw.fill === null) continue; // stroke-only outline path, no fill attribute at all
    if (raw.fillOpacity <= 0) continue; // invisible fill, e.g. stroke-only redraws
    if (seen.has(raw.d)) continue; // dedupe shadow/duplicate layers sharing geometry

    const polygon = pathDToPolygon(raw.d);
    const bbox = polygonBBox(polygon);
    if (!isOnCanvas(bbox)) continue; // clipped decorative background art

    seen.add(raw.d);
    shapes.push({ polygon, bbox, fill: raw.fill });
  }

  if (shapes.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} on-canvas shapes but found ${shapes.length}. ` +
        `Fills found: ${shapes.map((s) => s.fill).join(', ')}`,
    );
  }

  return shapes;
}

// ---------- Point-in-polygon ----------

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// ---------- Point-to-boundary distance ----------

function distToSegmentSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return ddx * ddx + ddy * ddy;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy;
}

// Minimum distance from (px, py) to the polygon's boundary (its edges, not
// its fill) - i.e. how far the point is from the nearest edge of this shape,
// regardless of whether the point is inside or outside it.
function distanceToPolygonBoundary(px, py, polygon) {
  let bestSq = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const dSq = distToSegmentSquared(px, py, polygon[j].x, polygon[j].y, polygon[i].x, polygon[i].y);
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

// Distance from (px, py) to the nearest boundary edge across *all* shapes.
// A region's border is always the edge of some shape - either a member
// shape's own edge, or a non-member shape's edge clipping into it - so this
// single distance is what determines how "deep" inside its region a point
// really is. Uses expanded-bbox pruning to skip far-away shapes cheaply;
// values >= PRUNE_MARGIN_PX are clamped since we only ever compare against
// margins <= PRUNE_MARGIN_PX.
function minBoundaryDistanceAllShapes(px, py, shapes) {
  let best = PRUNE_MARGIN_PX;
  for (const shape of shapes) {
    const { bbox, polygon } = shape;
    if (
      px < bbox.minX - PRUNE_MARGIN_PX ||
      px > bbox.maxX + PRUNE_MARGIN_PX ||
      py < bbox.minY - PRUNE_MARGIN_PX ||
      py > bbox.maxY + PRUNE_MARGIN_PX
    ) {
      continue; // guaranteed farther than PRUNE_MARGIN_PX from this shape's boundary
    }
    const d = distanceToPolygonBoundary(px, py, polygon);
    if (d < best) best = d;
  }
  return best;
}

// ---------- Sampling ----------

function regionKeyFromIndices(indices) {
  return indices.slice().sort((a, b) => a - b).join('-');
}

function sampleDiagram(shapes) {
  const shapeCount = shapes.length;

  // bucket key -> { points: [{x, y, boundaryDist}] }
  const buckets = new Map();

  // Overall bbox we actually need to scan (union of shape bboxes, clamped to canvas).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.bbox.minX);
    minY = Math.min(minY, s.bbox.minY);
    maxX = Math.max(maxX, s.bbox.maxX);
    maxY = Math.max(maxY, s.bbox.maxY);
  }
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(VIEW_BOX.width, Math.ceil(maxX));
  maxY = Math.min(VIEW_BOX.height, Math.ceil(maxY));

  let pointsTested = 0;

  for (let y = minY; y <= maxY; y += GRID_STEP) {
    for (let x = minX; x <= maxX; x += GRID_STEP) {
      pointsTested += 1;
      const memberIndices = [];
      for (let i = 0; i < shapeCount; i += 1) {
        const { bbox, polygon } = shapes[i];
        if (x < bbox.minX || x > bbox.maxX || y < bbox.minY || y > bbox.maxY) continue;
        if (pointInPolygon(x, y, polygon)) memberIndices.push(i);
      }
      if (memberIndices.length === 0) continue;

      const key = regionKeyFromIndices(memberIndices);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { points: [] };
        buckets.set(key, bucket);
      }

      const boundaryDist = minBoundaryDistanceAllShapes(x, y, shapes);
      bucket.points.push({ x, y, boundaryDist });
    }
  }

  return { buckets, pointsTested };
}

// Picks the interior (border-eroded) point set for a bucket, trying
// progressively smaller margins if the strictest one leaves too few points
// (this happens for genuinely thin sliver regions, e.g. the innermost
// overlap of the 5-player diagram).
function pickInteriorPoints(bucket) {
  for (const margin of FALLBACK_MARGINS_PX) {
    const filtered = bucket.points.filter((p) => p.boundaryDist >= margin);
    if (filtered.length >= MIN_SAFE_POINTS || margin === FALLBACK_MARGINS_PX[FALLBACK_MARGINS_PX.length - 1]) {
      return { points: filtered, marginUsed: margin };
    }
  }
  // Unreachable (last margin is 0, which keeps everything), but keep a
  // sane fallback just in case.
  return { points: bucket.points, marginUsed: 0 };
}

// Naive centroid can fall outside an irregular/concave region; snap to the
// nearest actual sample point belonging to that region if so.
function resolveCentroid(points, shapes, memberIndices, nonMemberIndices) {
  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const naive = { x: sumX / points.length, y: sumY / points.length };

  const isValid = (pt) => {
    for (const i of memberIndices) {
      if (!pointInPolygon(pt.x, pt.y, shapes[i].polygon)) return false;
    }
    for (const i of nonMemberIndices) {
      if (pointInPolygon(pt.x, pt.y, shapes[i].polygon)) return false;
    }
    return true;
  };

  if (isValid(naive)) return naive;

  // Prefer snapping to the point deepest inside the region (largest
  // boundaryDist) among the closest few, rather than purely nearest to the
  // (possibly invalid) naive centroid - keeps the centroid itself away from
  // borders too.
  let best = points[0];
  let bestScore = -Infinity;
  for (const p of points) {
    const dSq = (p.x - naive.x) ** 2 + (p.y - naive.y) ** 2;
    const score = p.boundaryDist - Math.sqrt(dSq) * 0.05; // mild distance-to-naive tiebreak
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

// ---------- Main ----------

function processDiagram(playerCount, fileName) {
  const svgText = readFileSync(path.join(SVG_DIR, fileName), 'utf8');
  const shapes = extractPlayerShapes(svgText, playerCount);

  console.log(`\n[${playerCount}-player diagram] ${fileName}`);
  shapes.forEach((s, i) => {
    console.log(
      `  player ${i}: fill=${s.fill} bbox=(${s.bbox.minX.toFixed(0)},${s.bbox.minY.toFixed(0)})-(${s.bbox.maxX.toFixed(0)},${s.bbox.maxY.toFixed(0)})`,
    );
  });

  const t0 = Date.now();
  const { buckets, pointsTested } = sampleDiagram(shapes);
  const elapsedMs = Date.now() - t0;

  const regions = {};
  for (const [key, bucket] of buckets.entries()) {
    const memberIndices = key.split('-').map(Number);
    const allIndices = shapes.map((_, i) => i);
    const nonMemberIndices = allIndices.filter((i) => !memberIndices.includes(i));

    const { points: interiorPoints, marginUsed } = pickInteriorPoints(bucket);
    const centroid = resolveCentroid(interiorPoints, shapes, memberIndices, nonMemberIndices);

    // Downsample the eroded point set deterministically so emitted files stay
    // reasonably sized. Use a stride to pick roughly evenly-spaced points.
    let rawPoints = interiorPoints;
    if (MAX_SAMPLES_PER_REGION && rawPoints.length > MAX_SAMPLES_PER_REGION) {
      const stride = Math.floor(rawPoints.length / MAX_SAMPLES_PER_REGION);
      const sampled = [];
      for (let i = 0; i < rawPoints.length; i += stride) sampled.push(rawPoints[i]);
      rawPoints = sampled.slice(0, MAX_SAMPLES_PER_REGION);
    }

    if (marginUsed < ERODE_MARGIN_PX) {
      console.log(
        `  region ${key}: too thin for ${ERODE_MARGIN_PX}px margin, fell back to ${marginUsed}px ` +
          `(${bucket.points.length} raw -> ${interiorPoints.length} interior points)`,
      );
    }

    regions[key] = {
      x: Number((centroid.x / VIEW_BOX.width).toFixed(4)),
      y: Number((centroid.y / VIEW_BOX.height).toFixed(4)),
      sampleCount: bucket.points.length,
      interiorCount: interiorPoints.length,
      marginUsed,
      // samplePoints are fractional [0..1] coordinates for use at runtime.
      // These are already border-eroded, so any point picked from this list
      // at random is safely inside the region.
      samplePoints: rawPoints.map((p) => ({ x: Number((p.x / VIEW_BOX.width).toFixed(4)), y: Number((p.y / VIEW_BOX.height).toFixed(4)) })),
    };
  }

  // Report coverage: how many of the 2^n - 1 possible non-empty subsets
  // actually exist as a region in this diagram.
  const totalPossible = 2 ** playerCount - 1;
  const found = Object.keys(regions).length;
  const allSubsetKeys = [];
  for (let mask = 1; mask < 2 ** playerCount; mask += 1) {
    const indices = [];
    for (let i = 0; i < playerCount; i += 1) if (mask & (1 << i)) indices.push(i);
    allSubsetKeys.push(regionKeyFromIndices(indices));
  }
  const missing = allSubsetKeys.filter((k) => !regions[k]);

  console.log(`  sampled ${pointsTested.toLocaleString()} points in ${elapsedMs}ms`);
  console.log(`  found ${found}/${totalPossible} possible regions`);
  if (missing.length > 0) {
    console.log(`  missing (no such region drawn): ${missing.join(', ')}`);
  }

  return regions;
}

function main() {
  const output = {};
  for (const [playerCount, fileName] of Object.entries(DIAGRAM_FILES)) {
    output[playerCount] = processDiagram(Number(playerCount), fileName);
  }

  mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });

  // Raw JSON (includes sampleCount/interiorCount/marginUsed, useful for
  // sanity-checking region size / erosion behavior). Debug-only - not read
  // by the app, no need to commit it.
  writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output, null, 2));

  // Clean TS constants file ready to drop into the app. Keys match
  // getDotRegionKey's format (sorted indices joined by '-').
  const tsLines = [];
  tsLines.push('// AUTO-GENERATED by scripts/extractVennRegions.mjs - do not hand-edit.');
  tsLines.push('// Regenerate if the venn-diagram-*.svg artwork changes.');
  tsLines.push('');
  tsLines.push('export interface VennRegionCentroid {');
  tsLines.push('  x: number;');
  tsLines.push('  y: number;');
  tsLines.push('}');
  tsLines.push('');
  tsLines.push('// playerCount -> regionKey ("sorted-player-indices-joined-by-dash") -> fractional centroid');
  tsLines.push('// samplePoints are pre-filtered to stay clear of region borders (see ERODE_MARGIN_PX');
  tsLines.push('// in extractVennRegions.mjs), so any point picked from the list is safely interior.');
  tsLines.push('export const VENN_REGION_CENTROIDS: Record<number, Record<string, VennRegionCentroid>> = {');
  for (const [playerCount, regions] of Object.entries(output)) {
    tsLines.push(`  ${playerCount}: {`);
    for (const [key, region] of Object.entries(regions)) {
      const pts = (region.samplePoints || [])
        .map((p) => `{ x: ${p.x}, y: ${p.y} }`)
        .join(', ');
      tsLines.push(
        `    '${key}': { x: ${region.x}, y: ${region.y}, samplePoints: [ ${pts} ] }, ` +
          `// ${region.interiorCount}/${region.sampleCount} interior samples (margin ${region.marginUsed}px)`,
      );
    }
    tsLines.push('  },');
  }
  tsLines.push('};');
  tsLines.push('');

  writeFileSync(OUTPUT_TS_PATH, tsLines.join('\n'));

  console.log(`\nWrote ${OUTPUT_JSON_PATH}`);
  console.log(`Wrote ${OUTPUT_TS_PATH}`);
}

main();
