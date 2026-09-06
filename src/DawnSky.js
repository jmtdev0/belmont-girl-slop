import * as THREE from 'three';
import { dawnAtmosphereShader, dawnAtmosphereUniforms } from './DawnAtmosphere.js';

// A bounded HDR sky: the small solar disc, atmospheric glow and cloud light
// have independent intensities, so bloom cannot turn the horizon into a sun.
export function makeDawnSky(sunDirection, timeUniform = { value: 0 }, options = {}) {
  const material = new THREE.ShaderMaterial({
    name: 'OpenSeaDawnSky',
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: timeUniform,
      cloudVolume: { value: options.cloudVolume?.texture ?? null },
      cloudView: { value: options.cloudVolume?.viewTexture ?? null },
      useCloudView: { value: false },
      cloudViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
      volumetricClouds: { value: Boolean(options.cloudVolume) },
      sunDirection: { value: sunDirection.clone().normalize() },
      ...dawnAtmosphereUniforms(),
      solarColor: { value: new THREE.Color('#fff1bf') },
    },
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        // Remove translation: this sky stays at infinity as the avatar flies.
        vSkyDirection = position;
        vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 solarColor;
      uniform float uTime;
      varying vec3 vSkyDirection;

      uniform samplerCube cloudVolume;
      uniform sampler2D cloudView;
      uniform bool useCloudView;
      uniform vec4 cloudViewport;
      uniform bool volumetricClouds;
      ${dawnAtmosphereShader}

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float n = 0.0, weight = 0.5;
        for (int i = 0; i < 5; i++) {
          n += noise(p) * weight;
          p = p * 2.03 + vec2(17.1, 9.2);
          weight *= 0.5;
        }
        return n;
      }
      void main() {
        vec3 d = normalize(vSkyDirection);
        float height = max(d.y, 0.0);
        float alignment = max(dot(d, sunDirection), 0.0);
        float towardSun = pow(alignment, 6.0);
        vec3 color = dawnBackground(d);

        float clouds = 0.0;
        if (!volumetricClouds) {
        // Retain the lightweight sky for comparison with ?clouds=flat.
        vec2 cloudUv = d.xz / max(d.y + 0.13, 0.035);
        // Advect the whole layer together; let its fine detail evolve slightly.
        // No wrapping/reset: the cloud pattern must never jump between frames.
        cloudUv += vec2(0.0018, 0.00065) * uTime;
        float broad = fbm(cloudUv * vec2(2.0, 3.5) + vec2(8.0, 3.0));
        float detail = fbm(cloudUv * vec2(8.0, 12.0) + vec2(-0.002, 0.001) * uTime);
        clouds = smoothstep(0.49, 0.7, broad * 0.76 + detail * 0.24);
        clouds *= smoothstep(0.005, 0.055, d.y) * (1.0 - smoothstep(0.45, 0.8, d.y));
        vec3 cloudShadow = vec3(0.27, 0.29, 0.37);
        vec3 cloudLight = mix(vec3(0.65, 0.62, 0.62), vec3(1.65, 0.65, 0.17), towardSun);
        vec3 cloudColor = mix(cloudLight, cloudShadow, smoothstep(0.12, 0.85, clouds) * 0.48);
        color = mix(color, cloudColor, clouds * 0.8);
        }

        // 0.65-degree angular diameter, gently antialiased at the limb.
        float angle = acos(clamp(dot(d, sunDirection), -1.0, 1.0));
        float edge = max(fwidth(angle), 0.00012);
        float disc = 1.0 - smoothstep(0.00567 - edge, 0.00567 + edge, angle);
        // Two soft scattering lobes join the small disc to the atmosphere.
        // Keep this independent of global bloom so flowers/video stay unchanged.
        float corona = 0.75 * exp(-pow(angle / 0.014, 2.0));
        float halo = 0.20 * exp(-pow(angle / 0.055, 2.0));
        vec3 solarLight = solarColor * (4.0 * disc + corona);
        solarLight += vec3(1.0, 0.62, 0.25) * halo;
        color += solarLight * (1.0 - clouds * 0.65);
        if (volumetricClouds) {
          vec2 screenUv = (gl_FragCoord.xy - cloudViewport.xy) / cloudViewport.zw;
          vec4 volume = useCloudView ? texture2D(cloudView, screenUv) : textureCube(cloudVolume, d);
          // Art-directed clearing around the dawn sun, shared by the visible
          // sky and reflections. Fade premultiplied radiance and opacity alike
          // so the opening does not leave a bright cloud fringe.
          volume *= smoothstep(0.018, 0.10, angle);
          color = color * (1.0 - volume.a) + volume.rgb;
        }
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  sky.name = 'Warm dawn sky';
  sky.frustumCulled = false;
  sky.onBeforeRender = (renderer, _scene, renderCamera) => {
    material.uniforms.useCloudView.value = Boolean(options.cloudVolume?.viewReady && renderCamera === options.viewCamera);
    renderer.getCurrentViewport(material.uniforms.cloudViewport.value);
  };
  return sky;
}
