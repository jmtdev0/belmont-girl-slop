import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeLunarGarden, resolveLunarGardenCollisions } from '../src/LunarGarden.js';

function fixture(kind = 'flower') {
  const garden = new THREE.Group();
  garden.position.set(0, -2, -500);
  garden.userData.lunarColliders = [{x: 0, z: 0, bottom: 1,
    top: kind === 'flower' ? 4 : 1, radius: 1, kind}];
  return garden;
}

for (const kind of ['flower', 'rock']) {
  test(`${kind} blocks fast crossing, including a translated island`, () => {
    const g = fixture(kind);
    const from = new THREE.Vector3(-10, 1, 0).add(g.position);
    const to = new THREE.Vector3(10, 1, 0).add(g.position);
    const velocity = new THREE.Vector3(100, 0, 0);
    resolveLunarGardenCollisions(g, from, to, velocity, 1);
    assert.ok(to.x <= -2);
    assert.ok(Math.abs(velocity.x) < 1e-6);
  });
}

test('flight above flowers and motion along the clear path are unobstructed', () => {
  const g = fixture();
  for (const [y, z] of [[8, 0], [1, 5]]) {
    const from = new THREE.Vector3(-10, y, z).add(g.position);
    const to = new THREE.Vector3(10, y, z).add(g.position);
    const expected = to.clone();
    resolveLunarGardenCollisions(g, from, to, new THREE.Vector3(20, 0, 0), 1);
    assert.ok(to.distanceTo(expected) < 1e-6);
  }
});

test('descending onto a flower stops above it', () => {
  const g = fixture();
  const from = new THREE.Vector3(0, 10, 0).add(g.position);
  const to = new THREE.Vector3(0, 0, 0).add(g.position);
  resolveLunarGardenCollisions(g, from, to, new THREE.Vector3(0, -20, 0), 1);
  assert.ok(to.y - g.position.y >= 6);
});

test('every generated flower and rock has a finite collision volume', () => {
  const garden = makeLunarGarden();
  const colliders = garden.userData.lunarColliders;
  assert.equal(colliders.filter(c => c.kind === 'flower').length, garden.userData.flowerCount);
  assert.equal(colliders.filter(c => c.kind === 'rock').length, 24);
  for (const c of colliders) {
    assert.ok([c.x, c.z, c.bottom, c.top, c.radius].every(Number.isFinite));
    assert.ok(c.top >= c.bottom && c.radius > 0);
  }
  garden.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
});
