import { ShaderChunk } from 'three';

// Shared uniforms keep all twelve arc faces in lockstep. Sampling stays inside
// the existing map/emissive pipeline, including Three's video color decoding.
export function patchArcVideoSlide(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = `uniform sampler2D uArcPrevious;
uniform float uArcSlide;
vec4 arcVideoFrame(sampler2D currentVideo, vec2 uv) {
  if (uArcSlide >= 1.0) return texture2D(currentVideo, uv);
  if (uv.x < 1.0 - uArcSlide) return texture2D(uArcPrevious, uv + vec2(uArcSlide, 0.0));
  return texture2D(currentVideo, uv - vec2(1.0 - uArcSlide, 0.0));
}
` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <map_fragment>', ShaderChunk.map_fragment.replace(
      'texture2D( map, vMapUv )', 'arcVideoFrame( map, vMapUv )'))
    .replace('#include <emissivemap_fragment>', ShaderChunk.emissivemap_fragment.replace(
      'texture2D( emissiveMap, vEmissiveMapUv )', 'arcVideoFrame( emissiveMap, vEmissiveMapUv )'));
}

export function waitForVideoReady(video, signal, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('canplay', ready);
      video.removeEventListener('error', error);
      signal.removeEventListener('abort', abort);
    };
    const ready = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error('Video unavailable')); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(error, timeout);
    video.addEventListener('canplay', ready);
    video.addEventListener('error', error);
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
    else if (video.readyState >= 3) ready();
  });
}
