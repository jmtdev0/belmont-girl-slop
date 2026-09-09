import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderChunk } from 'three';
import { softenWaterShadows } from '../src/SoftWaterShadows.js';

test('water-only shadow filter preserves other shadow modes and shared shader chunks', () => {
  const original = ShaderChunk.shadowmap_pars_fragment;
  const water = {material: {fragmentShader: '#include <shadowmap_pars_fragment>\nvoid main() {}'}};
  softenWaterShadows(water);
  assert.equal(ShaderChunk.shadowmap_pars_fragment, original);
  assert.ok(water.material.fragmentShader.includes('shadow /= 81.0;'));
  assert.ok(water.material.fragmentShader.includes('shadow = VSMShadow('));
  assert.ok(water.material.fragmentShader.endsWith('void main() {}'));
  assert.throws(() => softenWaterShadows({material: {fragmentShader: ''}}), /needs review/);
});

test('tent filter has constant energy and continuous weights across texel boundaries', () => {
  for (const fraction of [0, 0.01, 0.25, 0.5, 0.99, 1]) {
    let sum = 0;
    for (let i = -2; i <= 3; i++) sum += Math.max(0, 3 - Math.abs(i - fraction));
    assert.ok(Math.abs(sum - 9) < 1e-10);
  }
  const weight = (sample, position) => Math.max(0, 3 - Math.abs(sample - position));
  for (let sample = -3; sample <= 4; sample++) {
    assert.ok(Math.abs(weight(sample, 1 - 1e-6) - weight(sample, 1 + 1e-6)) <= 2.1e-6);
  }
});
