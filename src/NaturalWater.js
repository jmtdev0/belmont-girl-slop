// Keep Water's four animated normal samples and solar/reflection pipeline.
// Only deform their coordinates and gently vary the horizontal normal strength.
export function naturalizeWater(water) {
  const shader = water.material.fragmentShader;
  const entry = 'vec4 getNoise( vec2 uv ) {';
  const result = 'return noise * 0.5 - 1.0;';
  if (!shader.includes(entry) || !shader.includes(result)) {
    throw new Error('Water shader changed: natural-water injection needs review');
  }
  water.material.fragmentShader = shader.replace(entry, `
    float seaHash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float seaField(vec2 p) {
      vec2 cell = floor(p);
      vec2 f = fract(p);
      vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
      return mix(mix(seaHash(cell), seaHash(cell + vec2(1.0, 0.0)), w.x),
                 mix(seaHash(cell + vec2(0.0, 1.0)), seaHash(cell + vec2(1.0)), w.x), w.y);
    }
    vec4 getNoise( vec2 originalUv ) {
      // Advect slowly, without a modulo/reset that could make waves jump.
      vec2 region = originalUv * 0.0013 + vec2(0.003, -0.002) * time;
      vec2 warp = vec2(seaField(region), seaField(region + vec2(19.7, 43.1))) - 0.5;
      vec2 uv = originalUv + warp * 65.0;
      float localStrength = mix(0.78, 1.15, seaField(region * 0.57 + vec2(7.3, -11.2)));
  `).replace(result, `
      vec4 irregularNoise = noise * 0.5 - 1.0;
      // Water swizzles noise.xzy: x/y are slope, z is the upward component.
      irregularNoise.xy *= localStrength;
      return irregularNoise;
  `);
  water.material.needsUpdate = true;
}
