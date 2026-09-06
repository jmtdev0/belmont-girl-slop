import * as THREE from 'three';

export function dawnAtmosphereUniforms() {
  return {
    zenithColor: { value: new THREE.Color('#6386ad') },
    horizonColor: { value: new THREE.Color('#ff963f') },
  };
}

// Shared scene-linear background for the visible sky and distant cloud haze.
// Solar disc/halo remain separate and are attenuated by cloud transmittance.
export const dawnAtmosphereShader = `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  vec3 dawnBackground(vec3 d) {
    float height = max(d.y, 0.0);
    float alignment = max(dot(d, sunDirection), 0.0);
    float towardSun = pow(alignment, 6.0);
    vec3 horizon = mix(vec3(0.32, 0.21, 0.24), horizonColor, 0.35 + 0.65 * towardSun);
    vec3 color = mix(horizon, zenithColor, smoothstep(0.0, 0.48, pow(height, 0.72)));
    color += vec3(0.7, 0.18, 0.012) * exp(-height * 13.0) * towardSun;
    color += vec3(0.18, 0.09, 0.025) * pow(alignment, 80.0);
    return color;
  }
`;
