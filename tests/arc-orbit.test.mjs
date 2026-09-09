import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function resolveOpenSeaInstallationCollisions('),
  source.indexOf('function getButterflyFloorFold()'));
const centerZ = -19998.75;
const axis = new THREE.Vector3(0, 1, 0);
function solve(point, angle, previousY) {
  const player = { position: point.clone() };
  const velocity = new THREE.Vector3();
  new Function('THREE', 'player', 'playerVelocity', 'openSeaOrbitAngle', 'previousY', `
    const state = {sceneId: 'realistic-beach'};
    const openSeaOrbitGroup = {};
    const openSeaInstallationCenterZ = ${centerZ};
    const openSeaOrbitActualSpeed = Math.PI * 2 / 960;
    const openSeaOrbitAxis = new THREE.Vector3(0, 1, 0);
    const openSeaInstallationCenterX = 240;
    const openSeaInstallationInnerRadius = 544;
    const openSeaInstallationOuterRadius = 672;
    const openSeaInstallationBaseY = -0.74;
    const openSeaInstallationHeight = 600;
    const avatarFloorClearance = 1.45;
    const avatarRoot = {position: {y: 0}};
    const getAvatarCollisionRadius = () => 1.65;
    ${code}
    resolveOpenSeaInstallationCollisions(previousY === undefined ? null : {y: previousY});
  `)(THREE, player, velocity, angle, previousY);
  return player.position;
}

test('orbit collision is equivalent at different rail angles', () => {
  const original = new THREE.Vector3(-820, 10, 0);
  const expected = solve(original.clone().add(new THREE.Vector3(0, 0, centerZ)), 0);
  for (const angle of [0.3, Math.PI / 2, Math.PI, 6.27]) {
    const point = original.clone().applyAxisAngle(axis, angle);
    point.z += centerZ;
    const result = solve(point, angle);
    result.z -= centerZ;
    result.applyAxisAngle(axis, -angle);
    result.z += centerZ;
    assert.ok(result.distanceTo(expected) < 1e-7);
  }
});

test('stationary avatar in the central opening does not jump or orbit', () => {
  const point = new THREE.Vector3(0, 10, centerZ);
  for (const angle of [0, 0.5, 2, 4, 6]) {
    assert.ok(solve(point, angle).distanceTo(point) < 1e-8);
  }
});

test('landing on the roof preserves horizontal position at every orbit angle', () => {
  const top = -0.74 + 600;
  const verticalRadius = 1.45 * 0.72;
  for (const angle of [0, 0.7, 2.1, 4.8]) {
    const point = new THREE.Vector3(-820, top + verticalRadius - 0.2, 0).applyAxisAngle(axis, angle);
    point.z += centerZ;
    const result = solve(point, angle, top + verticalRadius + 1);
    assert.ok(Math.abs(result.x - point.x) < 1e-7);
    assert.ok(Math.abs(result.z - point.z) < 1e-7);
    assert.ok(result.y >= top + verticalRadius);
    assert.ok(solve(result, angle).distanceTo(result) < 1e-7);
  }
});

test('descending quickly onto the roof edge does not eject the avatar sideways', () => {
  const point = new THREE.Vector3(-240 - 544, 598, centerZ);
  const result = solve(point, 0, 603);
  assert.equal(result.x, point.x);
  assert.ok(result.y > 600);
});
