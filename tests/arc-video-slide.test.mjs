import test from 'node:test';
import assert from 'node:assert/strict';
import { patchArcVideoSlide, waitForVideoReady } from '../src/ArcVideoSlide.js';

test('slide patches both video channels and retains video color decoding', () => {
  const shader = {uniforms: {}, fragmentShader: '#include <map_fragment>\n#include <emissivemap_fragment>'};
  const uniforms = {uArcSlide: {value: 0}, uArcPrevious: {value: null}};
  patchArcVideoSlide(shader, uniforms);
  assert.equal(shader.uniforms.uArcSlide, uniforms.uArcSlide);
  assert.match(shader.fragmentShader, /arcVideoFrame\( map, vMapUv \)/);
  assert.match(shader.fragmentShader, /arcVideoFrame\( emissiveMap, vEmissiveMapUv \)/);
  assert.match(shader.fragmentShader, /DECODE_VIDEO_TEXTURE_EMISSIVE/);
});

test('loading waits for canplay rather than metadata', async () => {
  const video = new EventTarget(); video.readyState = 1;
  const controller = new AbortController();
  let ready = false;
  const waiting = waitForVideoReady(video, controller.signal).then(() => { ready = true; });
  video.dispatchEvent(new Event('loadedmetadata'));
  await Promise.resolve();
  assert.equal(ready, false);
  video.dispatchEvent(new Event('canplay'));
  await waiting;
  assert.equal(ready, true);
});

test('cancelled, failed and stalled loads reject cleanly', async () => {
  for (const mode of ['abort', 'error', 'timeout']) {
    const video = new EventTarget(); video.readyState = 0;
    const controller = new AbortController();
    const waiting = waitForVideoReady(video, controller.signal, 10);
    const rejection = assert.rejects(waiting);
    if (mode === 'abort') controller.abort();
    if (mode === 'error') video.dispatchEvent(new Event('error'));
    await rejection;
  }
});
