import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudNoise, periodicGradientNoise } from '../src/CloudNoise.js';

test('gradient noise is continuous across all periodic boundaries', () => {
  for (const period of [4, 8, 16]) {
    for (const point of [[0.13, 1.47, 2.71], [-1.7, 0.39, 3.21], [0, 0.5, 0.73]]) {
      const baseline = periodicGradientNoise(...point, period);
      for (let axis = 0; axis < 3; axis++) {
        const shifted = [...point];
        shifted[axis] += period;
        assert.ok(Math.abs(periodicGradientNoise(...shifted, period) - baseline) < 1e-12);
      }
    }
    const epsilon = 1e-5;
    const left = periodicGradientNoise(-epsilon, 0.37, 0.89, period);
    const right = periodicGradientNoise(epsilon, 0.37, 0.89, period);
    assert.ok(Math.abs(left - right) < 1e-4);
  }
});

test('bake is deterministic, bounded, cached on CPU and owned per GPU texture', () => {
  const a = createCloudNoise();
  const b = createCloudNoise();
  assert.notEqual(a, b);
  assert.equal(a.image.data, b.image.data);
  assert.equal(a.image.width, 96);
  assert.equal(a.image.data.length, 96 ** 3 * 4);
  assert.equal(a.generateMipmaps, true);
  let sum = 0, minimum = 255, maximum = 0;
  const data = a.image.data;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
    minimum = Math.min(minimum, data[i]);
    maximum = Math.max(maximum, data[i]);
  }
  const mean = sum / (data.length / 4);
  assert.ok(mean > 70 && mean < 180);
  assert.ok(maximum - minimum > 150);
  let disposed = 0;
  a.addEventListener('dispose', () => disposed++);
  a.dispose();
  assert.equal(disposed, 1);
  assert.equal(b.image.data.length, 96 ** 3 * 4);
  b.dispose();
});

test('baked wrap edges are no sharper than ordinary voxel neighbours', () => {
  const texture = createCloudNoise();
  const data = texture.image.data;
  const n = texture.image.width;
  const at = (x, y, z) => data[((z * n + y) * n + x) * 4];
  for (let axis = 0; axis < 3; axis++) {
    let seam = 0, interior = 0;
    for (let a = 0; a < n; a += 3) for (let b = 0; b < n; b += 3) {
      const p = [a, b, 0];
      if (axis === 0) p.splice(0, 3, 0, a, b);
      if (axis === 1) p.splice(0, 3, a, 0, b);
      p[axis] = 0; const first = at(...p);
      p[axis] = n - 1; seam += Math.abs(at(...p) - first);
      p[axis] = n / 2; const middle = at(...p);
      p[axis]++; interior += Math.abs(at(...p) - middle);
    }
    assert.ok(seam / interior < 2.0, `axis ${axis}: seam ratio ${seam / interior}`);
  }
  texture.dispose();
});
