import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Exercise the production geometry without starting the DOM/video application.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const geometryCode = source.slice(
  source.indexOf('function makeOpenSeaVideoInstallation('),
  source.indexOf('function beachVideoMaterial('),
);
const makeInstallation = new Function(
  'THREE', 'state', 'activeTexture',
  'openSeaInstallationBlockEnvironmentIntensity', 'openSeaInstallationVideoFogStrength',
  `${geometryCode}\nreturn makeOpenSeaVideoInstallation;`,
)(THREE, { openSeaMode: 'dawn' }, null, 0.32, 0.08);

for (const arcStart of [-Math.PI / 2, Math.PI / 2]) {
  test(`video shell has no open seams at arcStart=${arcStart}`, () => {
    const group = makeInstallation({
      centerX: 240, centerZ: -19998.75, innerRadius: 544,
      outerRadius: 672, height: 600, baseY: -0.74,
      arcStart, arcEnd: arcStart + Math.PI,
    });
    const edges = new Map();
    const point = new THREE.Vector3();
    for (const mesh of group.children.slice(1)) {
      assert.equal(mesh.material.isMeshStandardMaterial, true);
      assert.equal(mesh.receiveShadow, true);
      assert.equal(mesh.material.toneMapped, true);
      mesh.updateMatrix();
      const geometry = mesh.geometry;
      const positions = geometry.attributes.position;
      const vertexKey = (index) => {
        point.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrix);
        return point.toArray().map(value => Math.round(value * 10000)).join(',');
      };
      const count = geometry.index?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map(j => vertexKey(geometry.index ? geometry.index.getX(i + j) : i + j));
        for (let j = 0; j < 3; j += 1) {
          const key = [triangle[j], triangle[(j + 1) % 3]].sort().join('|');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
    }
    assert.equal([...edges.values()].filter(count => count !== 2).length, 0,
      'Every video edge must meet exactly one adjoining triangle');
    group.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
  });
}
