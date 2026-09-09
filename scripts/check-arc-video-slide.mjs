// Local integration smoke test: Vite on 5187 with the local video archive.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || undefined,
  headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on('pageerror', error => { pageErrors.push(error.message); console.error(error.message); });
  // Exercise production switching code without constructing the heavy ocean.
  await page.route('**/src/main.js', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace('setScene(state.sceneId);', '').replace(/\r?\nanimate\(\);/, '\n')
      .replace(/const videoBaseUrl = [^\n]+/, "const videoBaseUrl = ''; ")
      .replace('setVideo(state.videoId);', 'setVideo(videoCatalog[0].id);');
    body += `\nwindow.arcTest = {
      select: index => setVideo(videoCatalog[index].id),
      finish: finishArcVideoSlide,
      snapshot: () => ({id: state.videoId, ready: videoElement.readyState,
        pending: !!pendingArcVideo, sliding: !!activeArcSlide,
        oldMuted: activeArcSlide?.element.muted, paused: videoElement.paused}),
      expected: index => videoCatalog[index].id,
      render: () => {
        renderer.setSize(128, 128);
        const scene = new THREE.Scene();
        const view = new THREE.PerspectiveCamera(50, 1, 0.1, 10); view.position.z = 3;
        const material = openSeaInstallationVideoMaterial();
        scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), material), new THREE.AmbientLight(0xffffff));
        const errors = [];
        renderer.debug.onShaderError = (gl,p,v,f) => errors.push(gl.getShaderInfoLog(v),gl.getShaderInfoLog(f));
        for (const progress of [0, 0.5, 1]) { arcSlideUniforms.uArcSlide.value = progress; renderer.render(scene,view); }
        return errors;
      }
    };`;
    await route.fulfill({response, body});
  });
  await page.goto('http://127.0.0.1:5187/?preview&clouds=flat', {waitUntil: 'domcontentloaded'});
  console.log('Application loaded');
  await page.waitForFunction(() => window.arcTest?.snapshot().ready >= 3);
  console.log('Initial video ready');
  const original = await page.evaluate(() => arcTest.snapshot().id);
  await page.route('**/local-videos/002*', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.evaluate(() => arcTest.select(1));
  const loading = await page.evaluate(() => arcTest.snapshot());
  if (!loading.pending || loading.id !== original) throw new Error('Current video was replaced before readiness');
  await page.waitForFunction(() => arcTest.snapshot().sliding);
  const switching = await page.evaluate(() => arcTest.snapshot());
  if (!switching.oldMuted || switching.paused) throw new Error('Playback handoff failed');
  const shaderErrors = await page.evaluate(() => arcTest.render());
  await page.evaluate(() => { arcTest.finish(); arcTest.select(2); arcTest.select(3); });
  await page.waitForFunction(() => !arcTest.snapshot().pending);
  const latestWins = await page.evaluate(() => arcTest.snapshot().id === arcTest.expected(3));
  await page.evaluate(() => arcTest.finish());
  await page.route('**/local-videos/005*', route => route.abort());
  const retained = await page.evaluate(() => { const id = arcTest.snapshot().id; arcTest.select(4); return id; });
  await page.waitForFunction(() => !arcTest.snapshot().pending);
  const failurePreservesCurrent = await page.evaluate(id => arcTest.snapshot().id === id, retained);
  console.log(JSON.stringify({keptCurrentWhileLoading: true, latestWins, failurePreservesCurrent, shaderErrors, pageErrors}));
  if (!latestWins || !failurePreservesCurrent || shaderErrors.length || pageErrors.length) process.exitCode = 1;
} finally { await browser.close(); }
