import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { clampArcCamera } from './ArcCameraCollision.js';

const solarRadius = 0.00567;
const sampleCount = 9;

// Screen-space optics, evaluated in linear HDR before bloom and OutputPass.
// Sample the actual solar image: clouds, terrain and other foreground objects
// attenuate the flare too. Analytic arc occlusion also excludes bright videos.
export class SunGlarePass extends ShaderPass {
  constructor() {
    super({
      name: 'Dawn solar glare and lens ghosts',
      uniforms: {
        tDiffuse: { value: null },
        sunUv: { value: new THREE.Vector2(0.5, 0.5) },
        aspect: { value: 1 },
        strength: { value: 0 },
        solarSamples: { value: Array.from({ length: sampleCount }, () => new THREE.Vector3()) },
      },
      vertexShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 solarSamples[9];
        varying vec2 vUv;
        varying float vSunVisibility;
        void main() {
          vUv = uv;
          // Only three vertices run these reads, not every screen pixel.
          vSunVisibility = 0.0;
          for (int i = 0; i < 9; i++) {
            vec3 light = texture2D(tDiffuse, solarSamples[i].xy).rgb;
            float radiance = max(light.r, max(light.g, light.b));
            vSunVisibility += solarSamples[i].z * smoothstep(1.6, 10.0, radiance) / 9.0;
          }
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 sunUv;
        uniform float aspect;
        uniform float strength;
        varying vec2 vUv;
        varying float vSunVisibility;

        float hexagon(vec2 p, float radius) {
          p = abs(p) / (radius * 0.65);
          float d = max(p.x * 0.8660254 + p.y * 0.5, p.y);
          float edge = max(fwidth(d), 0.045);
          float fill = 1.0 - smoothstep(0.94 - edge, 1.0 + edge, d);
          float rim = exp(-pow((d - 0.85) / 0.095, 2.0));
          return fill * (0.28 + 0.24 * rim);
        }

        void main() {
          vec4 scene = texture2D(tDiffuse, vUv);
          float visibility = vSunVisibility * strength;
          if (visibility < 0.0001) {
            gl_FragColor = scene;
            return;
          }
          // Measure both axes in viewport heights; hexagons stay regular on
          // portrait screens, ultrawide screens and at any device pixel ratio.
          vec2 scale = vec2(aspect, 1.0);
          vec2 p = (vUv - sunUv) * scale;
          float r = length(p);
          float angle = atan(p.y, p.x);
          float core = 1.4 * exp(-r * r / 0.000065);
          float glow = 0.58 * exp(-r * 38.0) + 0.14 * exp(-r * 9.0);
          float rays = pow(abs(cos(angle * 6.0 + 0.22)), 52.0) * exp(-r * 23.0);
          rays += 0.24 * pow(abs(cos(angle * 4.0 - 0.35)), 80.0) * exp(-r * 15.0);
          rays *= smoothstep(0.003, 0.016, r);
          vec3 glare = vec3(1.0, 0.91, 0.73) * (core + glow + rays * 0.40);
          // A little veiling light lowers perceived contrast when facing the sun.
          glare += vec3(1.0, 0.77, 0.48) * 0.034 * exp(-r * r / 0.5);

          vec2 center = (vUv - 0.5) * scale;
          vec2 axis = (sunUv - 0.5) * scale;
          float spread = smoothstep(0.025, 0.16, length(axis));
          vec3 ghosts = vec3(0.0);
          ghosts += vec3(0.95, 0.50, 0.17) * hexagon(center + axis * 0.18, 0.017) * 0.26;
          ghosts += vec3(0.24, 0.83, 0.53) * hexagon(center + axis * 0.48, 0.025) * 0.28;
          ghosts += vec3(0.20, 0.60, 1.00) * hexagon(center + axis * 0.74, 0.011) * 0.45;
          ghosts += vec3(0.56, 0.32, 0.91) * hexagon(center + axis * 1.08, 0.038) * 0.18;
          ghosts += vec3(0.35, 0.90, 0.70) * hexagon(center + axis * 1.42, 0.021) * 0.23;
          glare += ghosts * spread * 0.55;
          gl_FragColor = vec4(scene.rgb + glare * visibility, scene.a);
        }
      `,
    });
    this.enabled = false;
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this.material.toneMapped = false;
    this.direction = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.sampleDirection = new THREE.Vector3();
    this.endpoint = new THREE.Vector3();
    this.clip = new THREE.Vector4();
  }

  projectDirection(direction, camera) {
    // A direction (w=0), so flying cannot introduce solar parallax.
    return this.clip.set(direction.x, direction.y, direction.z, 0)
      .applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }

  update(camera, sunDirection, arcs = null) {
    this.enabled = false;
    this.uniforms.strength.value = 0;
    if (!sunDirection || sunDirection.y <= 0) return;
    camera.updateMatrixWorld();
    this.direction.copy(sunDirection).normalize();
    const clip = this.projectDirection(this.direction, camera);
    if (clip.w <= 0) return;
    const x = clip.x / clip.w, y = clip.y / clip.w;
    const edgeDistance = Math.min(1 - Math.abs(x), 1 - Math.abs(y));
    if (edgeDistance <= 0) return;
    this.uniforms.sunUv.value.set(x * 0.5 + 0.5, y * 0.5 + 0.5);
    this.uniforms.aspect.value = camera.aspect;
    // Fall off with the viewing angle, well before the sun reaches an edge.
    this.uniforms.strength.value = THREE.MathUtils.smoothstep(edgeDistance, 0, 0.24)
      * 0.9 * Math.pow(clip.w, 24);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.right.addScaledVector(this.direction, -this.right.dot(this.direction)).normalize();
    this.up.crossVectors(this.right, this.direction).normalize();
    for (let i = 0; i < sampleCount; i++) {
      const angle = (i - 1) * Math.PI / 4;
      const radius = i === 0 ? 0 : solarRadius * 0.72;
      this.sampleDirection.copy(this.direction)
        .addScaledVector(this.right, Math.cos(angle) * radius)
        .addScaledVector(this.up, Math.sin(angle) * radius).normalize();
      this.projectDirection(this.sampleDirection, camera);
      const u = clip.x / clip.w * 0.5 + 0.5, v = clip.y / clip.w * 0.5 + 0.5;
      this.endpoint.copy(camera.position).addScaledVector(this.sampleDirection, camera.far);
      const blocked = arcs && clampArcCamera(camera.position, this.endpoint, arcs, 0);
      this.uniforms.solarSamples.value[i].set(u, v,
        !blocked && u >= 0 && u <= 1 && v >= 0 && v <= 1 ? 1 : 0);
    }
    this.enabled = this.uniforms.solarSamples.value.some(sample => sample.z > 0);
  }
}
