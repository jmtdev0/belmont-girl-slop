import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { SunGlarePass } from '../src/SunGlarePass.js';

const sun = new Vector3(0, 0.042, -1).normalize();
const arcs = { centerX: 240, centerZ: 0, angle: 0,
  innerRadius: 544, outerRadius: 672, bottom: -0.74, top: 599.26 };
function lookingAtSun(position, direction = sun, aspect = 16 / 9) {
  const camera = new PerspectiveCamera(52, aspect, 0.1, 12000);
  camera.position.copy(position);
  camera.lookAt(position.clone().add(direction));
  return camera;
}

test('solar optics stay fixed at infinity when flying and use the viewport aspect', () => {
  const pass = new SunGlarePass();
  for (const aspect of [16 / 9, 9 / 16]) {
    const camera = lookingAtSun(new Vector3(0, 20, 900), sun, aspect);
    pass.update(camera, sun);
    assert.equal(pass.enabled, true);
    const samples = pass.uniforms.solarSamples.value.map(sample => sample.clone());
    camera.position.add(new Vector3(4000, 800, -20000));
    pass.update(camera, sun);
    assert.equal(pass.uniforms.aspect.value, aspect);
    assert.ok(pass.uniforms.sunUv.value.distanceTo({ x: 0.5, y: 0.5 }) < 1e-10);
    samples.forEach((sample, i) => assert.ok(sample.distanceTo(pass.uniforms.solarSamples.value[i]) < 1e-10));
  }
  pass.dispose();
});

test('bright video walls block glare, while the opening and space above the roof do not', () => {
  const pass = new SunGlarePass();
  for (const [position, visible] of [
    [new Vector3(0, 20, 900), 1],
    [new Vector3(400, 20, 900), 0],
    [new Vector3(400, 620, 900), 1],
  ]) {
    pass.update(lookingAtSun(position), sun, arcs);
    assert.equal(pass.enabled, Boolean(visible));
    assert.ok(pass.uniforms.solarSamples.value.every(sample => sample.z === visible));
  }
  pass.dispose();
});

test('partial solar occlusion at an end cap samples both visible and blocked parts', () => {
  const pass = new SunGlarePass();
  pass.update(lookingAtSun(new Vector3(240, 20, 900)), sun, arcs);
  const visible = pass.uniforms.solarSamples.value.reduce((sum, sample) => sum + sample.z, 0);
  assert.ok(visible > 0 && visible < 9);
  pass.dispose();
});

test('solar occlusion follows the rotating installation', () => {
  const pass = new SunGlarePass();
  const up = new Vector3(0, 1, 0);
  for (const angle of [0.3, 1.57, 3.14, 5.1]) {
    const direction = sun.clone().applyAxisAngle(up, angle);
    const position = new Vector3(400, 20, 900).applyAxisAngle(up, angle);
    pass.update(lookingAtSun(position, direction), direction, { ...arcs, angle });
    assert.equal(pass.enabled, false);
  }
  pass.dispose();
});

test('looking away, night and scene changes disable the effect without stale glare', () => {
  const pass = new SunGlarePass();
  const camera = lookingAtSun(new Vector3(0, 20, 900));
  pass.update(camera, sun);
  assert.equal(pass.enabled, true);
  for (const direction of [null, new Vector3(0, -0.1, -1), sun.clone().negate(), new Vector3(1, 0.042, 0)]) {
    pass.update(camera, direction);
    assert.equal(pass.enabled, false);
    assert.equal(pass.uniforms.strength.value, 0);
  }
  pass.dispose();
});
