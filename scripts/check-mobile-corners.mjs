const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5187/', {waitUntil: 'domcontentloaded'});
  await page.locator('#enter-button').click();
  const initial = await page.evaluate(() => ({
    started: document.querySelector('#welcome').classList.contains('is-hidden'),
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
    joystickTransition: {
      property: getComputedStyle(document.querySelector('#mobile-controls')).transitionProperty,
      duration: getComputedStyle(document.querySelector('#mobile-controls')).transitionDuration,
    },
  }));
  await page.waitForTimeout(4200);
  const afterDelay = await page.evaluate(() => ({
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
  }));
  await page.mouse.click(30, 80);
  const left = await page.evaluate(() => ({
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
  }));
  await page.mouse.click(150, 80);
  const leftHiddenAgain = await page.evaluate(() => ({
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
  }));
  await page.mouse.click(360, 80);
  const right = await page.evaluate(() => ({
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
  }));
  await page.mouse.click(300, 80);
  const rightHiddenAgain = await page.evaluate(() => ({
    playerHidden: document.querySelector('#mini-player').classList.contains('is-mobile-hidden'),
    controlsHidden: document.querySelector('#menu-button').classList.contains('is-mobile-hidden'),
  }));
  const moveStick = await page.locator('#mobile-move-stick').boundingBox();
  const stickCenter = {
    x: moveStick.x + moveStick.width / 2,
    y: moveStick.y + moveStick.height / 2,
  };
  await page.mouse.move(stickCenter.x, stickCenter.y);
  await page.mouse.down();
  await page.mouse.move(stickCenter.x + 35, stickCenter.y, {steps: 4});
  await page.waitForTimeout(1900);
  await page.mouse.up();
  await page.waitForTimeout(450);
  const joysticksHidden = await page.evaluate(() => !document.querySelector('#mobile-controls').classList.contains('is-active'));
  await page.mouse.click(40, 760);
  const joysticksRemainHidden = await page.evaluate(() => !document.querySelector('#mobile-controls').classList.contains('is-active'));
  const canvasBox = await page.locator('#world').boundingBox();
  await page.evaluate(() => {
    const canvas = document.querySelector('#world');
    window.__pinchPointerEvents = [];
    window.__pinchPointerListener = event => window.__pinchPointerEvents.push({type: event.type, pointerId: event.pointerId});
    canvas.addEventListener('pointerdown', window.__pinchPointerListener);
    canvas.addEventListener('pointermove', window.__pinchPointerListener);
    canvas.addEventListener('pointerup', window.__pinchPointerListener);
  });
  const cdp = await context.newCDPSession(page);
  const pinchY = canvasBox.y + canvasBox.height * 0.5;
  const pinchCenterX = canvasBox.x + canvasBox.width * 0.5;
  const touchPoint = (id, x, y = pinchY) => ({id, x, y, radiusX: 8, radiusY: 8, force: 1});
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(9, canvasBox.x + canvasBox.width * 0.25)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(9, canvasBox.x + canvasBox.width * 0.25, pinchY - 90)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: [], modifiers: 0});
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(10, canvasBox.x + canvasBox.width * 0.75)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(10, canvasBox.x + canvasBox.width * 0.75 + 70)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: [], modifiers: 0});
  const splitTouch = await page.evaluate(() => ({
    pointerDowns: window.__pinchPointerEvents.filter(event => event.type === 'pointerdown').length,
    pointerMoves: window.__pinchPointerEvents.filter(event => event.type === 'pointermove').length,
    pointerUps: window.__pinchPointerEvents.filter(event => event.type === 'pointerup').length,
  }));
  await page.evaluate(() => { window.__pinchPointerEvents = []; });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(11, pinchCenterX - 55), touchPoint(12, pinchCenterX + 55)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [touchPoint(11, pinchCenterX - 125), touchPoint(12, pinchCenterX + 125)],
    modifiers: 0,
  });
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: [], modifiers: 0});
  const pinch = await page.evaluate(() => {
    const events = window.__pinchPointerEvents;
    document.querySelector('#world').removeEventListener('pointerdown', window.__pinchPointerListener);
    document.querySelector('#world').removeEventListener('pointermove', window.__pinchPointerListener);
    document.querySelector('#world').removeEventListener('pointerup', window.__pinchPointerListener);
    delete window.__pinchPointerEvents;
    delete window.__pinchPointerListener;
    return {
      pointerDowns: events.filter(event => event.type === 'pointerdown').length,
      pointerMoves: events.filter(event => event.type === 'pointermove').length,
      pointerUps: events.filter(event => event.type === 'pointerup').length,
    };
  });
  await context.close();
  const desktopContext = await browser.newContext({viewport: {width: 1280, height: 720}, isMobile: false, hasTouch: false});
  const desktopPage = await desktopContext.newPage();
  const desktopErrors = [];
  desktopPage.on('pageerror', error => desktopErrors.push(error.message));
  await desktopPage.goto('http://127.0.0.1:5187/', {waitUntil: 'domcontentloaded'});
  await desktopPage.locator('#enter-button').click();
  const desktop = await desktopPage.evaluate(() => {
    const controls = document.querySelector('#mobile-controls');
    const styles = getComputedStyle(controls);
    return {
      classActive: controls.classList.contains('is-active'),
      opacity: styles.opacity,
      visibility: styles.visibility,
      pointerEvents: styles.pointerEvents,
    };
  });
  await desktopContext.close();
  const result = {initial, afterDelay, left, leftHiddenAgain, right, rightHiddenAgain, joysticksHidden, joysticksRemainHidden, splitTouch, pinch, desktop, errors: [...errors, ...desktopErrors]};
  console.log(JSON.stringify(result));
  if (!initial.started || initial.playerHidden || initial.controlsHidden
    || !initial.joystickTransition.property.includes('opacity')
    || !initial.joystickTransition.duration.includes('0.45s')
    || !afterDelay.playerHidden || !afterDelay.controlsHidden
    || left.playerHidden || !left.controlsHidden || !leftHiddenAgain.playerHidden
    || !leftHiddenAgain.controlsHidden || right.controlsHidden || !right.playerHidden
    || !rightHiddenAgain.controlsHidden || !rightHiddenAgain.playerHidden
    || !joysticksHidden || !joysticksRemainHidden || splitTouch.pointerDowns < 2 || splitTouch.pointerMoves < 2
    || splitTouch.pointerUps < 2 || pinch.pointerDowns < 2 || pinch.pointerMoves < 1
    || pinch.pointerUps < 2 || desktop.opacity !== '0' || desktop.visibility !== 'hidden' || errors.length
    || desktopErrors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
