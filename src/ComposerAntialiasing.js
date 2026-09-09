// EffectComposer uses RGBA16F color and a 24-bit depth buffer by default.
// Canvas antialiasing does not apply to these offscreen render targets.
export function enableComposerAntialiasing(renderer, composer) {
  const gl = renderer.getContext();
  const colorSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) || []);
  const depthSamples = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) || []);
  const samples = Math.max(0, ...colorSamples.filter(n =>
    n > 1 && n <= 4 && n <= renderer.capabilities.maxSamples && depthSamples.includes(n)));
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.dispose();
    target.samples = samples;
  }
  return samples;
}
