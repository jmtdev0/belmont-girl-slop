import * as THREE from 'three';

// Deterministic, periodic gradient/feature-point fields, baked once on the CPU.
// Unlike interpolated white noise, the texture resolves each feature with many
// voxels. RGB/A hold shape and three cellular scales, not display colors.
const wrap = (x, n) => ((x % n) + n) % n;
const fade = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const clamp = (x) => Math.max(0, Math.min(1, x));
function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ 1847;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function periodicGradientNoise(x, y, z, period) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  let sum = 0;
  for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const h = hash(wrap(ix + dx, period), wrap(iy + dy, period), wrap(iz + dz, period)) & 15;
    const px = fx - dx, py = fy - dy, pz = fz - dz;
    const a = h < 8 ? px : py;
    const b = h < 4 ? py : h === 12 || h === 14 ? px : pz;
    const gradient = ((h & 1) ? -a : a) + ((h & 2) ? -b : b);
    sum += gradient * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return sum;
}

function cellularField(period) {
  const points = new Float32Array(period ** 3 * 3);
  for (let z = 0; z < period; z++) for (let y = 0; y < period; y++) for (let x = 0; x < period; x++) {
    const i = ((z * period + y) * period + x) * 3;
    // Keep features away from cell corners; one-neighbour searches stay local.
    points[i] = 0.15 + 0.7 * hash(x, y, z) / 4294967295;
    points[i + 1] = 0.15 + 0.7 * hash(x + 41, y + 13, z + 7) / 4294967295;
    points[i + 2] = 0.15 + 0.7 * hash(x + 11, y + 53, z + 29) / 4294967295;
  }
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    let nearest = 3;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = ((wrap(iz + dz, period) * period + wrap(iy + dy, period)) * period + wrap(ix + dx, period)) * 3;
      const px = dx + points[i] - fx, py = dy + points[i + 1] - fy, pz = dz + points[i + 2] - fz;
      nearest = Math.min(nearest, px * px + py * py + pz * pz);
    }
    return 1 - clamp(Math.sqrt(nearest));
  };
}

let cachedData;
export function createCloudNoise() {
  const size = 96;
  if (!cachedData) {
    cachedData = new Uint8Array(size ** 3 * 4);
    const cells = [4, 8, 16].map(cellularField);
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, v = (y + 0.5) / size, w = (z + 0.5) / size;
      const perlin = clamp(0.5 + 0.65 * (
        periodicGradientNoise(u * 4, v * 4, w * 4, 4) * 0.50 +
        periodicGradientNoise(u * 8, v * 8, w * 8, 8) * 0.32 +
        periodicGradientNoise(u * 16, v * 16, w * 16, 16) * 0.18
      ));
      const c0 = cells[0](u * 4, v * 4, w * 4);
      const c1 = cells[1](u * 8, v * 8, w * 8);
      const c2 = cells[2](u * 16, v * 16, w * 16);
      const i = ((z * size + y) * size + x) * 4;
      const cellularShape = c0 * 0.625 + c1 * 0.25 + c2 * 0.125;
      cachedData[i] = Math.round(clamp((perlin - (1 - cellularShape) * 0.45) / 0.55) * 255);
      cachedData[i + 1] = Math.round(c0 * 255);
      cachedData[i + 2] = Math.round(c1 * 255);
      cachedData[i + 3] = Math.round(c2 * 255);
    }
  }
  const texture = new THREE.Data3DTexture(cachedData, size, size, size);
  texture.name = 'Periodic Perlin-Worley cloud shape';
  texture.format = THREE.RGBAFormat;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
