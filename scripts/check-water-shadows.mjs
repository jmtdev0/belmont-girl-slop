// Browser smoke test. Supply PLAYWRIGHT_MODULE and CHROME_PATH on machines
// without a project-local Playwright installation. Start Vite on port 5187.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5187/src/SoftWaterShadows.js');
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { Water } = await import('/node_modules/three/examples/jsm/objects/Water.js');
    const { softenWaterShadows } = await import('/src/SoftWaterShadows.js');
    const renderer = new T.WebGLRenderer();
    renderer.setSize(256, 256);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const errors = [];
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      errors.push(gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
    };
    const scene = new T.Scene();
    const light = new T.DirectionalLight(0xffffff, 2);
    light.position.set(0, 5, 20);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    Object.assign(light.shadow.camera, {left: -15, right: 15, top: 15, bottom: -15, far: 100});
    light.shadow.camera.updateProjectionMatrix();
    scene.add(light);
    const caster = new T.Mesh(new T.BoxGeometry(6, 3, 1), new T.MeshStandardMaterial());
    caster.position.y = 3;
    caster.castShadow = true;
    scene.add(caster);
    let shadowPasses = 0;
    caster.onBeforeShadow = () => shadowPasses++;
    const normal = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    normal.needsUpdate = true;
    const water = new Water(new T.PlaneGeometry(60, 60), {
      textureWidth: 64, textureHeight: 64, waterNormals: normal,
      sunDirection: light.position.clone().normalize(), sunColor: 0xffffff,
      waterColor: 0x506060, distortionScale: 0,
    });
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    scene.add(water);
    const original = water.material.fragmentShader;
    const camera = new T.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(10, 20, 24);
    camera.lookAt(0, 0, 0);
    const target = new T.WebGLRenderTarget(256, 256);
    const measure = soft => {
      water.material.fragmentShader = original;
      if (soft) softenWaterShadows(water);
      water.material.needsUpdate = true;
      const before = shadowPasses;
      let previous, squaredChange = 0;
      for (let frame = 0; frame < 20; frame++) {
        caster.rotation.y = frame * 0.001;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(256 * 256 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
        if (previous) for (let i = 0; i < pixels.length; i += 4) {
          squaredChange += (pixels[i] - previous[i]) ** 2;
        }
        previous = pixels;
      }
      return {frames: 20, shadowPasses: shadowPasses - before,
        meanSquaredFrameChange: squaredChange / (19 * 256 * 256),
        autoUpdateRestored: renderer.shadowMap.autoUpdate};
    };
    const before = measure(false), after = measure(true);
    renderer.dispose();
    return {before, after, shaderErrors: errors};
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.shaderErrors.length || result.after.shadowPasses !== result.after.frames
    || !result.after.autoUpdateRestored) process.exitCode = 1;
} finally {
  await browser.close();
}
