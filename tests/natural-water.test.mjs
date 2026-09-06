import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { naturalizeWater } from '../src/NaturalWater.js';

test('natural water patches the installed shader without changing lighting or sample count', () => {
  const water = new Water(new THREE.PlaneGeometry(10, 10));
  const before = water.material.fragmentShader;
  naturalizeWater(water);
  const after = water.material.fragmentShader;
  assert.equal((after.match(/texture2D\( normalSampler/g) ?? []).length, 4);
  assert.ok(after.includes('vec2 uv = originalUv + warp * 65.0;'));
  assert.ok(after.includes('irregularNoise.xy *= localStrength;'));
  assert.equal(after.slice(after.indexOf('void sunLight')), before.slice(before.indexOf('void sunLight')));
  water.geometry.dispose();
  water.material.dispose();
});

test('an incompatible shader fails explicitly', () => {
  assert.throws(() => naturalizeWater({ material: { fragmentShader: '' } }), /needs review/);
});
