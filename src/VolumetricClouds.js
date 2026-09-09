import * as THREE from 'three';
import { createCloudNoise } from './CloudNoise.js';
import { dawnAtmosphereShader, dawnAtmosphereUniforms } from './DawnAtmosphere.js';

// Authored weather/shape and approximate scattering, not a weather simulation.
// Distances are scene metres; extinction is shared by view and light marches.
export const volumetricCloudShader = `
  precision highp sampler3D;
  uniform sampler3D cloudNoise;
  uniform float cloudSteps;
  uniform float cloudLightSteps;
  uniform vec3 cloudOrigin;
  const float planetRadius = 6371000.0;
  const float cloudBottom = 1500.0;
  const float cloudTop = 2250.0;
  const float extinction = 0.007;

  float altitude(vec3 p) {
    return (dot(p, p) + 2.0 * planetRadius * p.y)
      / (length(p + vec3(0.0, planetRadius, 0.0)) + planetRadius);
  }
  vec2 sphereInterval(vec3 origin, vec3 d, float height) {
    vec3 radial = origin + vec3(0.0, planetRadius, 0.0);
    float b = dot(radial, d);
    float c = dot(origin, origin) + 2.0 * planetRadius * (origin.y - height) - height * height;
    float determinant = b * b - c;
    if (determinant < 0.0) return vec2(1.0, -1.0);
    float root = sqrt(determinant);
    // Stable roots near the surface of the large planet.
    float q = -b - (b >= 0.0 ? root : -root);
    float a = abs(q) > 0.0001 ? c / q : -b;
    return vec2(min(a, q), max(a, q));
  }
  float cloudDensity(vec3 p, float footprint) {
    float h = (altitude(p) - cloudBottom) / (cloudTop - cloudBottom);
    if (h <= 0.0 || h >= 1.0) return 0.0;
    vec3 moving = p + vec3(3.5, 0.0, 1.2) * (uTime * 1.5);
    float weatherField = textureLod(cloudNoise, vec3(moving.x / 21000.0 + 0.17, 0.37, moving.z / 21000.0 + 0.43), 0.0).r;
    // A broad, softly varying fair-weather region toward the sun. Reduce
    // cloud coverage in the density field so remaining clouds still occlude
    // the disc and halo, with the same density used for light and view rays.
    float sunward = dot(normalize(p - cloudOrigin), sunDirection);
    float fairWeather = smoothstep(0.94, 0.995, sunward);
    float coverageShift = 0.12 * fairWeather;
    float weather = smoothstep(0.42 + coverageShift, 0.70 + coverageShift, weatherField);
    if (weather < 0.035) return 0.0;
    vec3 uv = moving / 3000.0 + vec3(0.12, 0.29, 0.41);
    float lod = clamp(log2(max(footprint / 31.25, 1.0)), 0.0, 3.0);
    vec4 shape = textureLod(cloudNoise, uv, lod);
    float threshold = mix(0.80, 0.50, weather);
    float mass = max(0.0, (shape.r - threshold) / max(1.0 - threshold, 0.01));
    if (mass <= 0.0) return 0.0;
    float detailLod = clamp(log2(max(footprint / 3.8, 1.0)), 0.0, 4.0);
    vec3 detail = textureLod(cloudNoise, uv * 8.3, detailLod).gba;
    float erosion = dot(detail, vec3(0.625, 0.25, 0.125));
    float detailWeight = 1.0 - smoothstep(80.0, 350.0, footprint);
    mass = max(0.0, mass - (1.0 - erosion) * 0.17 * detailWeight);
    float lower = 0.025 + (1.0 - weather) * 0.10;
    float profile = smoothstep(lower, lower + 0.14, h) * (1.0 - smoothstep(0.55, 1.0, h));
    return clamp(mass * 3.5, 0.0, 1.0) * profile;
  }
  float phaseHG(float mu, float g) {
    return (1.0 - g * g) / (12.566370614 * pow(max(1.0 + g * g - 2.0 * g * mu, 0.001), 1.5));
  }
  vec4 marchClouds(vec3 direction) {
    vec2 outer = sphereInterval(cloudOrigin, direction, cloudTop);
    if (outer.y <= max(outer.x, 0.0)) return vec4(0.0);
    float entry = max(outer.x, 0.0);
    float end = min(outer.y, 160000.0);
    vec2 inner = sphereInterval(cloudOrigin, direction, cloudBottom);
    if (inner.y > inner.x) {
      if (inner.x > entry) end = min(end, inner.x);
      else if (inner.y > entry) entry = inner.y;
    }
    if (end <= entry) return vec4(0.0);
    float stepLength = (end - entry) / cloudSteps;
    // Static stratification breaks coherent bands without frame-random sparkle.
    float jitter = 0.15 + 0.70 * fract(sin(dot(direction, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    float transmission = 1.0;
    vec3 radiance = vec3(0.0);
    float mu = dot(direction, sunDirection);
    float phase = 0.8 * phaseHG(mu, 0.65) + 0.2 * phaseHG(mu, -0.2);
    vec3 haze = dawnBackground(direction);
    for (int i = 0; i < 192; i++) {
      if (float(i) >= cloudSteps || transmission < 0.008) break;
      float distance = entry + (float(i) + jitter) * stepLength;
      vec3 p = cloudOrigin + direction * distance;
      float density = cloudDensity(p, stepLength);
      if (density < 0.002) continue;
      float lightTau = 0.0;
      for (int j = 0; j < 12; j++) {
        if (float(j) >= cloudLightSteps) break;
        float lightStart = 2400.0 * pow(float(j) / cloudLightSteps, 2.0);
        float lightEnd = 2400.0 * pow((float(j) + 1.0) / cloudLightSteps, 2.0);
        float lightStep = lightEnd - lightStart;
        lightTau += cloudDensity(p + sunDirection * ((lightStart + lightEnd) * 0.5), min(lightStep * 0.35, 60.0))
          * lightStep * extinction;
      }
      float sunlight = exp(-lightTau);
      float h = clamp((altitude(p) - cloudBottom) / (cloudTop - cloudBottom), 0.0, 1.0);
      vec3 ambient = mix(vec3(0.055, 0.09, 0.14), vec3(0.22, 0.30, 0.42), h);
      // Bounded multiple-scattering approximation lifts dense interiors.
      vec3 direct = vec3(1.50, 0.80, 0.38) * (sunlight * phase * 2.4 + 0.16 * exp(-lightTau * 0.25));
      vec3 source = ambient + direct;
      source = mix(haze, source, exp(-distance / 42000.0));
      float opacity = 1.0 - exp(-density * stepLength * extinction);
      radiance += transmission * opacity * source;
      transmission *= 1.0 - opacity;
    }
    return vec4(radiance, 1.0 - transmission);
  }
`;

// Premultiplied HDR cloud radiance/opacity shared by all sky/reflection views.
// The solar disc is composed separately at display resolution.
export function createCloudVolume(sunDirection, timeUniform, { quality = 'high' } = {}) {
  const preset = quality === 'low'
    ? { size: 128, steps: 64, reflectionSteps: 40, scale: 0.4, lightSteps: 4 }
    : quality === 'reference'
      ? { size: 256, steps: 192, reflectionSteps: 128, scale: 1.0, lightSteps: 12 }
      : { size: 192, steps: 128, reflectionSteps: 64, scale: 0.75, lightSteps: 6 };
  const noise = createCloudNoise();
  const target = new THREE.WebGLCubeRenderTarget(preset.size, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  target.texture.name = 'Dawn volumetric cloud cache';
  const viewTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter, depthBuffer: false,
  });
  viewTarget.texture.name = 'Dawn current-view cloud radiance';
  const material = new THREE.ShaderMaterial({
    name: 'Dawn cloud raymarch',
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      cloudNoise: { value: noise },
      cloudSteps: { value: preset.steps },
      cloudLightSteps: { value: preset.lightSteps },
      cloudOrigin: { value: new THREE.Vector3() },
      sunDirection: { value: sunDirection.clone().normalize() },
      uTime: { value: timeUniform.value },
      ...dawnAtmosphereUniforms(),
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform float uTime;
      varying vec3 vDirection;
      ${dawnAtmosphereShader}
      ${volumetricCloudShader}
      void main() { gl_FragColor = marchClouds(normalize(vDirection)); }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cubeCamera = new THREE.CubeCamera(0.1, 10, target);
  let lastUpdate = -Infinity;
  const lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  let disposed = false;
  const viewPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  const viewQuaternion = new THREE.Quaternion();
  const viewProjection = new THREE.Matrix4();
  const bufferSize = new THREE.Vector2();
  let viewTime = -Infinity;
  const result = {
    texture: target.texture,
    viewTexture: viewTarget.texture,
    viewReady: false,
    quality,
    update(renderer, cameraOrPosition, force = false) {
      if (disposed) return;
      const viewCamera = cameraOrPosition.isCamera ? cameraOrPosition : null;
      const position = viewCamera ? viewCamera.position : cameraOrPosition;
      const updateCube = force || timeUniform.value - lastUpdate >= 0.30 || lastPosition.distanceToSquared(position) >= 400;
      let updateView = false;
      if (viewCamera) {
        renderer.getDrawingBufferSize(bufferSize);
        const scale = Math.min(preset.scale, 1200 / bufferSize.x, 800 / bufferSize.y);
        const width = Math.max(1, Math.round(bufferSize.x * scale));
        const height = Math.max(1, Math.round(bufferSize.y * scale));
        const resized = width !== viewTarget.width || height !== viewTarget.height;
        if (resized) viewTarget.setSize(width, height);
        updateView = force || resized || timeUniform.value - viewTime >= 0.10
          || viewPosition.distanceToSquared(position) > 0.0001
          || viewQuaternion.angleTo(viewCamera.quaternion) > 0.00001
          || !viewProjection.equals(viewCamera.projectionMatrix);
      }
      if (!updateCube && !updateView) return;
      material.uniforms.cloudOrigin.value.copy(position);
      material.uniforms.uTime.value = timeUniform.value;
      const previousTarget = renderer.getRenderTarget();
      const previousFace = renderer.getActiveCubeFace();
      const previousMip = renderer.getActiveMipmapLevel();
      const previousXr = renderer.xr.enabled;
      try {
        if (updateCube) {
          material.uniforms.cloudSteps.value = preset.reflectionSteps;
          cubeCamera.update(renderer, scene);
          lastUpdate = timeUniform.value;
          lastPosition.copy(position);
        }
        if (updateView) {
          // Dedicated current-view march: do not magnify the coarse reflection
          // cubemap across the screen. No history means no camera-cut ghosts.
          material.uniforms.cloudSteps.value = preset.steps;
          renderer.setRenderTarget(viewTarget);
          renderer.render(scene, viewCamera);
          viewPosition.copy(position);
          viewQuaternion.copy(viewCamera.quaternion);
          viewProjection.copy(viewCamera.projectionMatrix);
          viewTime = timeUniform.value;
          result.viewReady = true;
        }
      } finally {
        renderer.setRenderTarget(previousTarget, previousFace, previousMip);
        renderer.xr.enabled = previousXr;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      viewTarget.dispose();
      noise.dispose();
      material.dispose();
      mesh.geometry.dispose();
      scene.clear();
    },
  };
  return result;
}
