import { ShaderChunk } from 'three';

// Stable, wider tent filter for the water receiver only. No frame-dependent
// sampling noise, extra shadow maps or changes to other scene materials.
export function softenWaterShadows(water) {
  const include = '#include <shadowmap_pars_fragment>';
  const begin = '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )';
  const end = '#elif defined( SHADOWMAP_TYPE_VSM )';
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  const start = chunk.indexOf(begin);
  const finish = chunk.indexOf(end, start);
  if (!water.material.fragmentShader.includes(include) || start < 0 || finish < 0) {
    throw new Error('Water shadow shader changed: soft-shadow injection needs review');
  }
  const filter = `${begin}
    vec2 waterShadowPixel = shadowCoord.xy * shadowMapSize - 0.5;
    vec2 waterShadowBase = floor(waterShadowPixel);
    vec2 waterShadowFraction = fract(waterShadowPixel);
    shadow = 0.0;
    // Six texels per axis; tent weights vary continuously with the receiver.
    // Each axis sums to nine, hence the total normalization of 81.
    for (int sy = -2; sy <= 3; sy++) {
      for (int sx = -2; sx <= 3; sx++) {
        vec2 offset = vec2(float(sx), float(sy));
        vec2 weight = max(vec2(0.0), vec2(3.0) - abs(offset - waterShadowFraction));
        vec2 sampleUv = (waterShadowBase + offset + 0.5) / shadowMapSize;
        shadow += weight.x * weight.y * texture2DCompare(shadowMap, sampleUv, shadowCoord.z);
      }
    }
    shadow /= 81.0;
  `;
  water.material.fragmentShader = water.material.fragmentShader.replace(include,
    chunk.slice(0, start) + filter + chunk.slice(finish));
  water.material.needsUpdate = true;
}
