import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { clampArcCamera } from '../src/ArcCameraCollision.js';

const arcs = {centerX: 240, centerZ: -20000, angle: 0,
  innerRadius: 544, outerRadius: 672, bottom: -0.74, top: 599.26};
const point = (x, y, z = 0) => new Vector3(x, y, z + arcs.centerZ);

test('camera contracts at inner and outer walls, including a segment crossing the whole wall', () => {
  for (const [from, to, expected] of [[780, 950, 783.65], [920, 760, 912.35]]) {
    const end = point(to, 20);
    assert.equal(clampArcCamera(point(from, 20), end, arcs), true);
    assert.ok(Math.abs(end.x - expected) < 0.02);
  }
});

test('camera collides with roof, base and straight end caps', () => {
  for (const [start, end] of [
    [point(820, 603), point(820, 590)],
    [point(820, -4), point(820, 2)],
    [point(237, 30, 600), point(245, 30, 600)],
  ]) {
    const original = end.clone();
    assert.ok(clampArcCamera(start, end, arcs));
    assert.ok(end.distanceTo(original) > 1);
  }
});

test('clear central opening and above-roof camera positions remain unchanged', () => {
  for (const [start, end] of [[point(0, 20), point(0, 20, 800)], [point(780, 610), point(950, 610)]]) {
    const original = end.clone();
    assert.equal(clampArcCamera(start, end, arcs), false);
    assert.ok(end.equals(original));
  }
});

test('camera obstruction follows rotating arcs and translation', () => {
  for (const angle of [0.3, 1.57, 3.14, 5.1]) {
    const rotate = p => p.add(new Vector3(0, 0, -arcs.centerZ))
      .applyAxisAngle(new Vector3(0, 1, 0), angle).add(new Vector3(0, 0, arcs.centerZ));
    const start = rotate(point(780, 20));
    const end = rotate(point(950, 20));
    assert.ok(clampArcCamera(start, end, {...arcs, angle}));
    assert.ok(Math.abs(start.distanceTo(end) - 3.64) < 1e-6);
  }
});
