import * as THREE from 'three';
import { naturalizeWater } from './NaturalWater.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeDawnSky } from './DawnSky.js';
import { createCloudVolume } from './VolumetricClouds.js';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { videoCatalog, localVideoUrl } from './data/catalog.js';
import { videoPalettes } from './data/video-palettes.js';
import './styles.css';

// Share one clock between the visible dawn sky and the prism reflection sky.
const openSeaSkyTime = { value: 0 };
let openSeaCloudVolume = null;

const scenes = [
  { id: 'sphere', label: 'Enveloping sphere', description: 'Inside a sphere of memory', icon: '◌' },
  { id: 'sky', label: 'Sky', description: 'A suspended projection', icon: '☁' },
  { id: 'realistic-beach', label: 'Open sea', description: 'An endless surface of moving water', icon: '◒' },
  { id: 'luminous', label: 'Luminous space', description: 'Orbs holding the image', icon: '✦' },
  { id: 'cube', label: 'Enveloping cube', description: 'A six-sided room', icon: '□' },
  { id: 'cylinder', label: 'Enveloping cylinder', description: 'A circular chamber of light', icon: '○' },
  { id: 'cinema', label: 'Cinema', description: 'A tiered screening room', icon: '▰' },
  { id: 'youtube-cinema', label: 'YouTube cinema', description: 'A tiered screening with possible ads', icon: '▶' },
];

const openSeaModes = [
  { id: 'daylight', label: 'Daylight', description: 'Clear and bright', icon: '☀' },
  { id: 'dawn', label: 'Dawn', description: 'Warm horizon light', icon: '◒' },
  { id: 'night', label: 'Night', description: 'Stars over dark water', icon: '✦' },
];

const openSeaAtmospheres = {
  daylight: {
    background: '#9ebbc8',
    fogColor: '#afc2c6',
    fogDensity: 0.00042,
    sky: { turbidity: 2.6, rayleigh: 1.45, mieCoefficient: 0.0012, mieDirectionalG: 0.68 },
    sunElevation: 27,
    sunAzimuth: 180,
    sunColor: 0xfff1d8,
    waterColor: 0x477f8d,
    prismTopColor: '#679aa1',
    prismSideColor: '#3f7078',
    prismDeepColor: '#153f4b',
    prismHighlightColor: '#bde9df',
    exposure: 1.02,
    ambientColor: '#d2e7ee',
    groundColor: '#244d58',
    ambientIntensity: 0.92,
    moonColor: '#d5e4ff',
    moonIntensity: 0.18,
    bloomStrength: 0.12,
    bloomRadius: 0.32,
    bloomThreshold: 1.35,
    stars: false,
  },
  dawn: {
    background: '#dfa57c',
    fogColor: '#caa28e',
    fogDensity: 0.00016,
    sky: { turbidity: 4.8, rayleigh: 1.05, mieCoefficient: 0.0024, mieDirectionalG: 0.76 },
    sunElevation: 2.4,
    sunAzimuth: 180,
    sunColor: 0xffa348,
    waterColor: 0x24495e,
    prismTopColor: '#6f9697',
    prismSideColor: '#456f73',
    prismDeepColor: '#173f4c',
    prismHighlightColor: '#b7e8e2',
    exposure: 1.05,
    ambientColor: '#c8d5e2',
    groundColor: '#655042',
    ambientIntensity: 0.35,
    moonColor: '#d5e4ff',
    moonIntensity: 0,
    bloomStrength: 0.12,
    bloomRadius: 0.25,
    bloomThreshold: 1.3,
    stars: false,
  },
  night: {
    background: '#071225',
    fogColor: '#0b1830',
    fogDensity: 0.00072,
    sky: { turbidity: 1.55, rayleigh: 0.22, mieCoefficient: 0.00035, mieDirectionalG: 0.92 },
    sunElevation: -9,
    sunAzimuth: 180,
    sunColor: 0x1c3568,
    waterColor: 0x12384b,
    prismTopColor: '#285c6b',
    prismSideColor: '#1b4657',
    prismDeepColor: '#081f32',
    prismHighlightColor: '#6ba8b1',
    exposure: 0.55,
    ambientColor: '#526f9e',
    groundColor: '#081d30',
    ambientIntensity: 0.24,
    moonColor: '#819bd0',
    moonIntensity: 0.52,
    bloomStrength: 0.3,
    bloomRadius: 0.48,
    bloomThreshold: 1.3,
    stars: true,
  },
};

const butterflyPalettes = [
  { id: 'pearl', label: 'Pearl', color: '#fffdf8', fill: '#fffdf8', line: '#fffaf0', emissive: '#eee5ff', body: '#fffdf8', bodyEmissive: '#f2ddff', aura: '#ffffff', glow: '#ffffff' },
  { id: 'rose', label: 'Rose', color: '#ffd7eb', fill: '#ffd7eb', line: '#fff1fb', emissive: '#f3a8d2', body: '#ffe3f2', bodyEmissive: '#ec9ac9', aura: '#ffe8f6', glow: '#ffd2eb' },
  { id: 'aqua', label: 'Aqua', color: '#c8f7ff', fill: '#c8f7ff', line: '#efffff', emissive: '#8ee4ef', body: '#d9fbff', bodyEmissive: '#7fd9e7', aura: '#c8f7ff', glow: '#a6efff' },
  { id: 'lilac', label: 'Lilac', color: '#e5d5ff', fill: '#e5d5ff', line: '#faf4ff', emissive: '#b89ae9', body: '#eadfff', bodyEmissive: '#b895e8', aura: '#e4d4ff', glow: '#d0b6ff' },
  { id: 'gold', label: 'Gold', color: '#fff0c9', fill: '#fff0c9', line: '#fffdf0', emissive: '#edc26b', body: '#fff1c8', bodyEmissive: '#e7b656', aura: '#ffeec1', glow: '#ffe2a0' },
];

const previewParameters = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
const previewSceneId = previewParameters?.get('scene');
const previewOpenSeaMode = previewParameters?.get('open-sea-mode');
const previewButterflyColorParameter = previewParameters?.get('butterfly-color');
const previewButterflyPreset = butterflyPalettes.find((palette) => palette.id === previewButterflyColorParameter);
const butterflyColorCookieName = 'belmontgirl-butterfly-color';
const storedButterflyColor = readCookie(butterflyColorCookieName);
const previewButterflyColor = normalizeButterflyColor(previewButterflyPreset?.color ?? previewButterflyColorParameter)
  ?? normalizeButterflyColor(storedButterflyColor)
  ?? '#fffdf8';
const videoBaseUrl = (import.meta.env.VITE_VIDEO_BASE_URL ?? '').trim().replace(/\/+$/, '');
const playableVideoCatalog = videoBaseUrl ? videoCatalog.filter((video) => !video.localOnly) : videoCatalog;

const state = {
  sceneId: scenes.some((scene) => scene.id === previewSceneId) ? previewSceneId : 'realistic-beach',
  openSeaMode: openSeaModes.some((mode) => mode.id === previewOpenSeaMode) ? previewOpenSeaMode : 'dawn',
  avatarId: 'butterfly',
  butterflyColorId: butterflyPalettes.find((palette) => palette.color === previewButterflyColor)?.id ?? 'custom',
  butterflyColor: previewButterflyColor,
  videoId: playableVideoCatalog[Math.floor(Math.random() * playableVideoCatalog.length)].id,
  started: false,
};

const dom = {
  canvas: document.querySelector('#world'),
  welcome: document.querySelector('#welcome'),
  enterButton: document.querySelector('#enter-button'),
  menu: document.querySelector('#menu'),
  menuButton: document.querySelector('#menu-button'),
  fullscreenButton: document.querySelector('#fullscreen-button'),
  closeMenu: document.querySelector('#close-menu'),
  sceneOptions: document.querySelector('#scene-options'),
  openSeaModes: document.querySelector('#open-sea-modes'),
  openSeaModeOptions: document.querySelector('#open-sea-mode-options'),
  butterflyPalette: document.querySelector('#butterfly-palette'),
  butterflyColorPicker: document.querySelector('#butterfly-color-picker'),
  butterflyColorValue: document.querySelector('#butterfly-color-value'),
  videoOptions: document.querySelector('#video-options'),
  videoFilter: document.querySelector('#video-filter'),
  audioNotice: document.querySelector('#audio-notice'),
  loading: document.querySelector('#loading'),
  loadingLabel: document.querySelector('#loading-label'),
  miniPlayer: document.querySelector('#mini-player'),
  miniPlayerToggle: document.querySelector('#mini-player-toggle'),
  miniVideoSeek: document.querySelector('#mini-video-seek'),
  miniVideoLoop: document.querySelector('#mini-video-loop'),
  miniVideoMute: document.querySelector('#mini-video-mute'),
  miniVideoVolume: document.querySelector('#mini-video-volume'),
  miniVideoTime: document.querySelector('#mini-video-time'),
  miniVideoTitle: document.querySelector('#mini-video-title'),
};

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const youtubeRenderer = new CSS3DRenderer();
youtubeRenderer.setSize(window.innerWidth, window.innerHeight);
youtubeRenderer.domElement.className = 'youtube-layer';
dom.canvas.insertAdjacentElement('afterend', youtubeRenderer.domElement);
const avatarOverlayRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
avatarOverlayRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
avatarOverlayRenderer.setSize(window.innerWidth, window.innerHeight);
avatarOverlayRenderer.setClearColor(0x000000, 0);
avatarOverlayRenderer.outputColorSpace = THREE.SRGBColorSpace;
avatarOverlayRenderer.toneMapping = THREE.ACESFilmicToneMapping;
avatarOverlayRenderer.domElement.className = 'avatar-overlay';
youtubeRenderer.domElement.insertAdjacentElement('afterend', avatarOverlayRenderer.domElement);

const world = new THREE.Scene();
const youtubeWorld = new THREE.Scene();
world.background = new THREE.Color('#090c1b');
world.fog = new THREE.FogExp2('#090c1b', 0.012);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 12000);
camera.position.set(0, 3.5, 8);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.24, 0.94);
composer.addPass(bloomPass);
// The dawn lighting is authored in linear HDR and needs a display transform
// after bloom. Keep the other, independently tuned scenes on their current path.
const dawnOutputPass = new OutputPass();
dawnOutputPass.enabled = false;
composer.addPass(dawnOutputPass);

const clock = new THREE.Clock();
const stage = new THREE.Group();
const player = new THREE.Group();
const avatarRoot = new THREE.Group();
let ambientLight = null;
let moonLight = null;
let flashlight = null;
let flashlightTarget = null;
let flashlightEnabled = false;
const textureFallback = makeFallbackTexture();
const luminousGlowTexture = makeLuminousGlowTexture();
const videoElement = document.createElement('video');
videoElement.crossOrigin = 'anonymous';
videoElement.loop = false;
videoElement.playsInline = true;
videoElement.preload = 'auto';
videoElement.setAttribute('aria-hidden', 'true');
videoElement.className = 'mini-player__video';
videoElement.controls = false;
videoElement.tabIndex = -1;
let lastAudibleVolume = Number(dom.miniVideoVolume?.value ?? 0.85);
videoElement.volume = lastAudibleVolume;
dom.miniPlayer.prepend(videoElement);
const cinemaLightCanvas = document.createElement('canvas');
cinemaLightCanvas.width = 48;
cinemaLightCanvas.height = 27;
const cinemaLightContext = cinemaLightCanvas.getContext('2d', { alpha: false, willReadFrequently: true });
const cinemaProjectionSample = {
  average: { color: new THREE.Color('#ffffff'), response: 0 },
  zones: Array.from({ length: 3 }, () => ({ color: new THREE.Color('#ffffff'), response: 0 })),
};
let lastCinemaLightSample = -Infinity;
videoElement.addEventListener('loadeddata', () => {
  lastPaletteUpdate = 0;
  lastCinemaLightSample = -Infinity;
  syncMiniVideoControls();
});
videoElement.addEventListener('loadedmetadata', syncMiniVideoControls);
videoElement.addEventListener('durationchange', syncMiniVideoControls);
videoElement.addEventListener('timeupdate', syncMiniVideoControls);
videoElement.addEventListener('emptied', resetMiniVideoControls);
videoElement.addEventListener('ended', () => {
  if (state.sceneId !== 'youtube-cinema' && !videoElement.loop) playRandomVideo();
});

let videoTexture = new THREE.VideoTexture(videoElement);
videoTexture.colorSpace = THREE.SRGBColorSpace;
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.generateMipmaps = false;
let activeTexture = textureFallback;
let sceneObjects = [];
let realisticBeachWater = null;
let realisticSeaPrism = null;
let openSeaOrbitGroup = null;
let openSeaOrbitAngle = 0;
let openSeaOrbitTargetAngle = 0;
let openSeaOrbitActualSpeed = 0;
const openSeaOrbitSpeed = Math.PI * 2 / (16 * 60);
const openSeaOrbitAxis = new THREE.Vector3(0, 1, 0);
let realisticBeachEnvironment = null;
let proceduralSandNoise = null;
let proceduralSandTextures = null;
const sphereRadius = 90;
const sphereAvatarMargin = 2.2;
const cubeHalfExtent = 42;
const cubeAvatarMargin = 2.2;
const cylinderRadius = 48;
const cylinderHalfHeight = 42;
const cylinderAvatarMargin = 2.2;
const cinemaHalfWidth = 16;
const cinemaHalfDepth = 24;
const cinemaFloor = -3.2;
const cinemaCeiling = 15;
const cinemaScreenWidth = 25;
const cinemaScreenHeight = cinemaScreenWidth * 9 / 16;
const cinemaScreenCenterY = 4.25;
const cinemaRowPositions = [-5, 0.2, 5.4, 10.6, 15.8];
const cinemaChairXPositions = [-12.2, -9.25, -6.3, -3.35, 3.35, 6.3, 9.25, 12.2];
const cinemaTierRise = 0.78;
const cinemaAisleWidth = 3.8;
const cinemaStepsPerTier = 4;
// Keep the physical obstacle tighter than the visible armrests so the avatar can
// pass through the narrow gaps between chairs without needing pixel-perfect aim.
const cinemaChairCollisionHalfWidth = 0.82;
const cinemaChairCollisionHalfDepth = 0.64;
const cinemaChairCollisionTop = 2.5;
const floatingParticleLightnessFloor = 0.5;
const youtubeScreenZ = -cinemaHalfDepth + 0.42;
const beachHalfWidth = 7250;
const beachLandDepth = 6500;
const beachOceanWidth = 18000;
const beachOceanDepth = 19500;
const beachFloorHeight = -0.58;
const realisticSeaPrismEdgeRadius = 16;
const realisticSeaPrismDepth = 120;
const realisticSeaPrismSurfaceOverlap = 1.5;
const realisticSeaPrismShoulderHighlightThreshold = 0.5;
const realisticSeaPrismShoulderHighlightStrength = 1.15;
const openSeaWaterSize = 40000;
const openSeaWaterCenterZ = -openSeaWaterSize / 2 + 1.25;
// Anchor the island and paired arcs to the circular sea's centre. Preserve
// the original opening distance and view direction when moving the avatar.
const openSeaInstallationCenterZ = openSeaWaterCenterZ;
const realisticBeachStartZ = openSeaInstallationCenterZ + 1200;
const openSeaDawnStartZ = openSeaInstallationCenterZ + 1730;
// Keep the two installations closer together while scaling their radial
// footprint with their height. This preserves the panoramic proportions of
// the C-shaped video surfaces instead of making them simply taller.
const openSeaInstallationCenterX = 240;
const openSeaInstallationInnerRadius = 544;
const openSeaInstallationOuterRadius = 672;
const openSeaInstallationHeight = 600;
const openSeaInstallationBaseY = beachFloorHeight - 0.16;
const openSeaInstallationVideoFogStrength = 0.08;
const openSeaInstallationBlockEnvironmentIntensity = 0.32;
const openSeaLunarIslandRadiusX = 172;
const openSeaLunarIslandRadiusZ = 132;
const openSeaLunarIslandWaterY = beachFloorHeight - 0.08;
const openSeaLunarIslandFlowerCount = 520;
const openSeaLunarIslandProfile = [
  { radius: 0, height: 7.4 },
  { radius: 0.22, height: 7.05 },
  { radius: 0.48, height: 5.75 },
  { radius: 0.7, height: 3.45 },
  { radius: 0.84, height: 1.35 },
  { radius: 0.94, height: -0.12 },
  { radius: 1, height: -1.35 },
];
// The reference demo places a compact, asset-based island in the scene center
// and surrounds it with instanced rocks and vegetation. Keep the equivalent
// landmark centered in the opening between our two installations.
const openSeaIslandCenterX = 0;
const openSeaIslandCenterZ = openSeaInstallationCenterZ;
// The downloaded model has a pronounced arched underside. Sink it enough for
// that underside to meet the water instead of only touching at its lowest tip.
const openSeaIslandSubmergeDepth = 4.5;
const openSeaIslandBaseY = beachFloorHeight - 0.22 - openSeaIslandSubmergeDepth;
const openSeaIslandHeight = 52;
const openSeaIslandCollisionRadius = 122;
// Use the downloaded demo asset locally for this trial. The procedural island
// remains available as an immediate fallback if the asset cannot be decoded.
const openSeaIslandUseDownloadedAsset = true;
const openSeaIslandAssetPath = '/assets/island.glb';
const openSeaIslandAssetScale = 2.2;
const openSeaIslandFlattenUnderside = true;
const openSeaIslandFlattenHeight = 9;
const openSeaIslandFlatBottomY = beachFloorHeight - 0.46;
const realisticBeachFogColor = '#9aa5a8';
const realisticBeachFogDensity = 0.00085;
const realisticBeachHalfWidth = 6000;
const realisticBeachLandDepth = 12000;
const skyFloorHeight = -1.2;
const luminousLowerBoundary = -26;
const avatarFloorClearance = 1.82;
const firstPersonDistance = 2.8;
const firstPersonBlendStart = 5.5;
let yaw = 0;
let pitch = 0.18;
let cameraDistance = state.sceneId === 'sphere' ? 8.5 : 9;
let dragging = false;
let menuPointerNear = false;
let miniPlayerDismissTimer = 0;
let lastPointer = { x: 0, y: 0 };
let lastPaletteUpdate = 0;
let butterflyFlutterPhase = 0;
let butterflyFlutterBlend = 0;
let avatarHiddenForFirstPerson = false;
let youtubeApiPromise = null;
let youtubePlayer = null;
let youtubePlayerReady = false;
let youtubeScreenObject = null;
let youtubeMountToken = 0;
let sceneTransitionToken = 0;
let sceneTransitionTimer = 0;
let luminousBubbleBodies = [];
let butterflyDustObject = null;
let openSeaIslandAssetLoadToken = 0;
let openSeaIslandObject = null;
const playerVelocity = new THREE.Vector3();
const flashlightDirection = new THREE.Vector3();
const cameraLookMatrix = new THREE.Matrix4();
const cameraDesiredQuaternion = new THREE.Quaternion();
const butterflyDustWorld = new THREE.Group();
const butterflyDustWorldPoint = new THREE.Vector3();
const butterflyDustSpawnPoint = new THREE.Vector3();
const luminousPhysicsDummy = new THREE.Object3D();
const keys = new Set();
const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'alt', 'shift', 'q']);
const gamepadInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, ascend: 0, descend: 0 };
let activeGamepadIndex = null;
let lastWPressTime = -Infinity;
let forwardBoostActive = false;
let forwardBoostFlutterRemaining = 0;
let forwardBoostFlutterBlend = 0;
let highSpeedMode = false;
let highSpeedSequenceIndex = 0;
let highSpeedSequenceLastInputTime = -Infinity;
const sceneTransitionMinimumDuration = 560;
const forwardBoostDoubleTapWindow = 280;
const forwardBoostSpeedMultiplier = 2.15;
const forwardBoostFlutterDuration = 0.82;
const highSpeedSequence = ['6', '7', '6', '7'];
const highSpeedSequenceWindow = 520;
const highSpeedMultiplier = 7;

world.add(stage, player, butterflyDustWorld);
player.add(avatarRoot);
buildInterface();
buildLights();
setAvatar(state.avatarId);
setScene(state.sceneId);
setVideo(state.videoId);
if (previewParameters?.has('preview')) {
  state.started = true;
  dom.welcome.classList.add('is-hidden');
  videoElement.muted = true;
  videoElement.play().catch(() => {});
  if (previewParameters.has('clean')) {
    dom.miniPlayer.hidden = true;
    dom.menuButton.hidden = true;
    dom.fullscreenButton.hidden = true;
  }
}
animate();

function buildInterface() {
  scenes.forEach((item, index) => {
    const button = document.createElement('button');
    button.className = 'choice-card';
    button.dataset.id = item.id;
    button.innerHTML = `<span class="choice-card__icon">${item.icon}</span><span><strong>${item.label}</strong><small>${item.description}</small></span>`;
    button.addEventListener('click', () => setScene(item.id));
    dom.sceneOptions.append(button);
    if (item.id === state.sceneId) button.classList.add('is-selected');
  });

  openSeaModes.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'choice-card choice-card--suboption';
    button.dataset.id = item.id;
    button.type = 'button';
    button.innerHTML = `<span class="choice-card__icon">${item.icon}</span><span><strong>${item.label}</strong><small>${item.description}</small></span>`;
    button.addEventListener('click', () => setOpenSeaMode(item.id));
    dom.openSeaModeOptions.append(button);
  });
  updateOpenSeaModeUI();

  butterflyPalettes.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'palette-card';
    button.dataset.id = item.id;
    button.type = 'button';
    button.setAttribute('aria-label', `Choose ${item.label.toLowerCase()} butterfly`);
    button.innerHTML = `<span class="palette-card__swatch" style="--palette-color: ${item.fill}; --palette-glow: ${item.glow}"></span><strong>${item.label}</strong>`;
    button.addEventListener('click', () => setButterflyPalette(item.id));
    dom.butterflyPalette.append(button);
  });
  dom.butterflyColorPicker.addEventListener('input', (event) => setButterflyColor(event.target.value));

  playableVideoCatalog.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'video-card';
    button.dataset.id = item.id;
    button.dataset.search = [item.title, item.id, item.fileName].join(' ').toLocaleLowerCase();
    button.innerHTML = `<span class="video-card__thumb" style="--thumb: url('${item.thumbnail}')"><span class="video-card__play">▶</span></span><span class="video-card__title">${item.title}</span>`;
    button.addEventListener('click', () => setVideo(item.id));
    dom.videoOptions.append(button);
  });
  dom.videoFilter.addEventListener('input', () => {
    const query = dom.videoFilter.value.trim().toLocaleLowerCase();
    dom.videoOptions.querySelectorAll('.video-card').forEach((button) => {
      button.hidden = Boolean(query) && !button.dataset.search.includes(query);
    });
  });
  dom.videoFilter.addEventListener('focus', () => keys.clear());
  dom.miniPlayerToggle.addEventListener('click', () => {
    const isCollapsed = dom.miniPlayer.classList.contains('is-collapsed');
    window.clearTimeout(miniPlayerDismissTimer);
    dom.miniPlayer.classList.toggle('is-collapsed', !isCollapsed);
    dom.miniPlayer.classList.remove('is-dismissed');
    updateMiniPlayerToggle(!isCollapsed);
    if (!isCollapsed) scheduleMiniPlayerDismissal();
  });
  dom.miniVideoSeek.addEventListener('input', (event) => {
    const duration = getMiniVideoDuration();
    if (!duration) return;
    const progress = THREE.MathUtils.clamp(Number(event.target.value) / 100, 0, 1);
    videoElement.currentTime = progress * duration;
    syncMiniVideoControls();
  });
  dom.miniVideoVolume.addEventListener('input', (event) => {
    const volume = THREE.MathUtils.clamp(Number(event.target.value), 0, 1);
    if (volume > 0) lastAudibleVolume = volume;
    videoElement.muted = false;
    videoElement.volume = volume;
    syncMiniVideoMuteControl();
  });
  dom.miniVideoMute.addEventListener('click', () => {
    if (videoElement.muted) {
      const volume = Number(dom.miniVideoVolume.value);
      if (volume <= 0) {
        const restoredVolume = THREE.MathUtils.clamp(lastAudibleVolume || 0.85, 0, 1);
        dom.miniVideoVolume.value = String(restoredVolume);
        videoElement.volume = restoredVolume;
      }
      videoElement.muted = false;
    } else {
      videoElement.muted = true;
    }
    syncMiniVideoMuteControl();
  });
  dom.miniVideoLoop.addEventListener('click', () => {
    videoElement.loop = !videoElement.loop;
    dom.miniVideoLoop.classList.toggle('is-active', videoElement.loop);
    dom.miniVideoLoop.setAttribute('aria-pressed', String(videoElement.loop));
  });
  [dom.miniVideoSeek, dom.miniVideoLoop, dom.miniVideoMute, dom.miniVideoVolume].forEach((control) => {
    control.addEventListener('focus', clearMovementState);
    control.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      clearMovementState();
    });
    control.addEventListener('pointermove', (event) => event.stopPropagation());
    control.addEventListener('click', (event) => event.stopPropagation());
    control.addEventListener('keydown', (event) => event.stopPropagation());
  });

  dom.enterButton.addEventListener('click', async () => {
    state.started = true;
    dom.welcome.classList.add('is-hidden');
    await playVideoWithAudio();
  });
  dom.menuButton.addEventListener('click', () => toggleMenu(true));
  dom.fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  dom.closeMenu.addEventListener('click', () => toggleMenu(false));
  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    if (key === '6' || key === '7') {
      updateHighSpeedSequence(key);
      event.preventDefault();
      return;
    }
    if (key === 'f' && !event.repeat) {
      toggleFlashlight();
      event.preventDefault();
      return;
    }
    if (key === 'w' && !event.repeat) {
      const now = performance.now();
      if (now - lastWPressTime <= forwardBoostDoubleTapWindow) {
        forwardBoostActive = true;
        forwardBoostFlutterRemaining = forwardBoostFlutterDuration;
        lastWPressTime = -Infinity;
      } else {
        lastWPressTime = now;
      }
    }
    if (movementKeys.has(key)) event.preventDefault();
    keys.add(key);
    if (event.key === 'Escape') toggleMenu(false);
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (key === 'w') {
      if (forwardBoostActive) {
        forwardBoostActive = false;
        forwardBoostFlutterRemaining = 0;
        lastWPressTime = -Infinity;
      }
    }
  });
  window.addEventListener('gamepadconnected', (event) => {
    if (activeGamepadIndex === null) activeGamepadIndex = event.gamepad.index;
  });
  window.addEventListener('gamepaddisconnected', (event) => {
    if (activeGamepadIndex === event.gamepad.index) activeGamepadIndex = null;
    resetGamepadInput();
    clearMovementState();
  });
  window.addEventListener('pointermove', (event) => {
    menuPointerNear = event.clientX > window.innerWidth - 280 && event.clientY < 140;
    revealCornerControls(menuPointerNear || dom.menu.classList.contains('is-open'));
    if (event.clientX < 280 && event.clientY > window.innerHeight - 230) revealMiniPlayer();
  });
  window.addEventListener('blur', clearMovementState);
  window.addEventListener('focus', clearMovementState);
  window.addEventListener('pagehide', clearMovementState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMovementState();
  });
  dom.canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    dom.canvas.setPointerCapture(event.pointerId);
  });
  dom.canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    dom.canvas.releasePointerCapture(event.pointerId);
  });
  dom.canvas.addEventListener('pointercancel', () => {
    dragging = false;
  });
  dom.canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw += (event.clientX - lastPointer.x) * 0.005;
    const maximumPitch = avatarHiddenForFirstPerson ? Math.PI / 2 - 0.01 : 1.1;
    const minimumPitch = avatarHiddenForFirstPerson ? -Math.PI / 2 + 0.01 : -1.1;
    pitch = THREE.MathUtils.clamp(pitch - (event.clientY - lastPointer.y) * 0.006, minimumPitch, maximumPitch);
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  dom.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.012, 2.6, 24);
  }, { passive: false });
  window.addEventListener('resize', onResize);
}

function clearMovementState() {
  keys.clear();
  dragging = false;
  playerVelocity.set(0, 0, 0);
  lastWPressTime = -Infinity;
  forwardBoostActive = false;
  forwardBoostFlutterRemaining = 0;
  forwardBoostFlutterBlend = 0;
  highSpeedSequenceIndex = 0;
  highSpeedSequenceLastInputTime = -Infinity;
}

function updateHighSpeedSequence(key) {
  const now = performance.now();
  if (now - highSpeedSequenceLastInputTime > highSpeedSequenceWindow) {
    highSpeedSequenceIndex = 0;
  }

  if (key === highSpeedSequence[highSpeedSequenceIndex]) {
    highSpeedSequenceIndex += 1;
  } else {
    highSpeedSequenceIndex = key === highSpeedSequence[0] ? 1 : 0;
  }
  highSpeedSequenceLastInputTime = now;

  if (highSpeedSequenceIndex === highSpeedSequence.length) {
    highSpeedMode = !highSpeedMode;
    highSpeedSequenceIndex = 0;
    highSpeedSequenceLastInputTime = -Infinity;
  }
}

function resetGamepadInput() {
  gamepadInput.moveX = 0;
  gamepadInput.moveY = 0;
  gamepadInput.lookX = 0;
  gamepadInput.lookY = 0;
  gamepadInput.ascend = 0;
  gamepadInput.descend = 0;
}

function applyGamepadDeadzone(value, deadzone = 0.14) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

function getGamepadAxis(gamepad, index) {
  return applyGamepadDeadzone(Number(gamepad.axes?.[index] ?? 0));
}

function getGamepadButtonValue(gamepad, index) {
  const button = gamepad.buttons?.[index];
  if (!button) return 0;
  return Math.max(Number(button.value ?? 0), button.pressed ? 1 : 0);
}

function findActiveGamepad() {
  if (typeof navigator.getGamepads !== 'function') return null;
  const gamepads = navigator.getGamepads();
  const preferred = activeGamepadIndex === null ? null : gamepads[activeGamepadIndex];
  if (preferred?.connected) return preferred;
  const connected = Array.from(gamepads).find((gamepad) => gamepad?.connected);
  activeGamepadIndex = connected?.index ?? null;
  return connected ?? null;
}

function updateGamepadInput(delta) {
  resetGamepadInput();
  if (document.hidden || isTypingTarget(document.activeElement)) return;
  const gamepad = findActiveGamepad();
  if (!gamepad) return;

  const dpadX = getGamepadButtonValue(gamepad, 15) - getGamepadButtonValue(gamepad, 14);
  const dpadY = getGamepadButtonValue(gamepad, 13) - getGamepadButtonValue(gamepad, 12);
  gamepadInput.moveX = THREE.MathUtils.clamp(getGamepadAxis(gamepad, 0) + dpadX, -1, 1);
  gamepadInput.moveY = THREE.MathUtils.clamp(getGamepadAxis(gamepad, 1) + dpadY, -1, 1);
  gamepadInput.lookX = getGamepadAxis(gamepad, 2);
  gamepadInput.lookY = getGamepadAxis(gamepad, 3);
  // Standard DualShock 4 mapping: L2 is button 6 and R2 is button 7.
  gamepadInput.descend = getGamepadButtonValue(gamepad, 6);
  gamepadInput.ascend = getGamepadButtonValue(gamepad, 7);

  yaw += gamepadInput.lookX * 2.4 * delta;
  const maximumPitch = avatarHiddenForFirstPerson ? Math.PI / 2 - 0.01 : 1.1;
  const minimumPitch = avatarHiddenForFirstPerson ? -Math.PI / 2 + 0.01 : -1.1;
  pitch = THREE.MathUtils.clamp(pitch - gamepadInput.lookY * 1.9 * delta, minimumPitch, maximumPitch);
}

function updateMiniPlayerToggle(isCollapsed) {
  dom.miniPlayerToggle.textContent = isCollapsed ? '▣' : '×';
  dom.miniPlayerToggle.setAttribute('aria-expanded', String(!isCollapsed));
  dom.miniPlayerToggle.setAttribute('aria-label', isCollapsed ? 'Show video preview' : 'Hide video preview');
  dom.miniPlayerToggle.title = isCollapsed ? 'Show video preview' : 'Hide video preview';
}

function syncMiniVideoMuteControl() {
  const isMuted = videoElement.muted;
  dom.miniVideoMute.textContent = isMuted ? '🔇' : '🔊';
  dom.miniVideoMute.classList.toggle('is-active', isMuted);
  dom.miniVideoMute.setAttribute('aria-pressed', String(isMuted));
  dom.miniVideoMute.setAttribute('aria-label', isMuted ? 'Unmute video' : 'Mute video');
  dom.miniVideoMute.title = isMuted ? 'Unmute video' : 'Mute video';
}

function scheduleMiniPlayerDismissal() {
  miniPlayerDismissTimer = window.setTimeout(() => {
    if (dom.miniPlayer.classList.contains('is-collapsed')) dom.miniPlayer.classList.add('is-dismissed');
  }, 1000);
}

function revealMiniPlayer() {
  if (!dom.miniPlayer.classList.contains('is-dismissed')) return;
  window.clearTimeout(miniPlayerDismissTimer);
  dom.miniPlayer.classList.remove('is-dismissed', 'is-collapsed');
  updateMiniPlayerToggle(false);
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
}

function buildLights() {
  ambientLight = new THREE.HemisphereLight('#bcd3ff', '#121124', 1.4);
  ambientLight.layers.enable(1);
  world.add(ambientLight);
  moonLight = new THREE.DirectionalLight('#d5e4ff', 2.2);
  moonLight.layers.enable(1);
  moonLight.position.set(-10, 14, 8);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  world.add(moonLight);

  flashlight = new THREE.SpotLight('#fff4d6', 0, 100, Math.PI / 5.5, 0.34, 1.15);
  flashlightTarget = new THREE.Object3D();
  flashlight.target = flashlightTarget;
  flashlight.castShadow = false;
  world.add(flashlight, flashlightTarget);
}

function toggleFlashlight() {
  flashlightEnabled = !flashlightEnabled;
  if (flashlight) flashlight.intensity = flashlightEnabled ? 180 : 0;
}

function disableFlashlight() {
  flashlightEnabled = false;
  if (flashlight) flashlight.intensity = 0;
}

function updateFlashlight() {
  if (!flashlight || !flashlightTarget || !flashlightEnabled) return;
  camera.getWorldDirection(flashlightDirection);
  flashlight.position.copy(camera.position);
  flashlightTarget.position.copy(camera.position).addScaledVector(flashlightDirection, 40);
}

function updateOpenSeaModeUI() {
  const isOpenSea = state.sceneId === 'realistic-beach';
  dom.openSeaModes.hidden = !isOpenSea;
  dom.openSeaModes.setAttribute('aria-hidden', String(!isOpenSea));
  dom.openSeaModeOptions.querySelectorAll('[data-id]').forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.id === state.openSeaMode);
  });
}

function setOpenSeaMode(modeId) {
  if (!openSeaModes.some((mode) => mode.id === modeId)) return;
  state.openSeaMode = modeId;
  if (state.sceneId === 'realistic-beach') {
    setScene('realistic-beach', { force: true });
  } else {
    updateOpenSeaModeUI();
  }
}

function getOpenSeaAtmosphere() {
  return openSeaAtmospheres[state.openSeaMode] ?? openSeaAtmospheres.dawn;
}

function setScene(sceneId, { force = false } = {}) {
  const scene = scenes.find((item) => item.id === sceneId);
  if (!scene || (!force && state.sceneId === sceneId && sceneObjects.length > 0)) return;

  const transitionToken = ++sceneTransitionToken;
  window.clearTimeout(sceneTransitionTimer);
  showSceneLoader(scene.label);
  requestAnimationFrame(() => {
    if (transitionToken !== sceneTransitionToken) return;
    const startedAt = performance.now();
    applyScene(sceneId);
    requestAnimationFrame(() => {
      if (transitionToken !== sceneTransitionToken) return;
      const remaining = Math.max(0, sceneTransitionMinimumDuration - (performance.now() - startedAt));
      sceneTransitionTimer = window.setTimeout(() => {
        if (transitionToken === sceneTransitionToken) hideSceneLoader();
      }, remaining);
    });
  });
}

function showSceneLoader(sceneLabel) {
  dom.loadingLabel.textContent = sceneLabel;
  dom.loading.classList.add('is-visible');
  dom.loading.setAttribute('aria-hidden', 'false');
}

function hideSceneLoader() {
  dom.loading.classList.remove('is-visible');
  dom.loading.setAttribute('aria-hidden', 'true');
}

function applyScene(sceneId) {
  const previousSceneId = state.sceneId;
  if (previousSceneId === 'youtube-cinema') destroyYouTubeScreen();
  realisticBeachWater = null;
  realisticSeaPrism = null;
  if (realisticBeachEnvironment) {
    realisticBeachEnvironment.dispose();
    realisticBeachEnvironment = null;
  }
  world.environment = null;
  state.sceneId = sceneId;
  const isCinema = ['cinema', 'youtube-cinema'].includes(sceneId);
  const isRealisticBeach = sceneId === 'realistic-beach';
  const atmosphere = isRealisticBeach ? getOpenSeaAtmosphere() : null;
  dawnOutputPass.enabled = isRealisticBeach && state.openSeaMode === 'dawn';
  ambientLight.color.set(atmosphere?.ambientColor ?? '#bcd3ff');
  ambientLight.groundColor.set(atmosphere?.groundColor ?? '#121124');
  moonLight.color.set(atmosphere?.moonColor ?? '#d5e4ff');
  ambientLight.intensity = isCinema ? 0 : isRealisticBeach ? atmosphere.ambientIntensity : 1.4;
  moonLight.intensity = isCinema ? 0 : isRealisticBeach ? atmosphere.moonIntensity : 2.2;
  cameraDistance = sceneId === 'sphere' ? 8.5 : sceneId === 'realistic-beach' ? 18 : ['cinema', 'youtube-cinema'].includes(sceneId) ? 8.3 : 9;
  if (sceneId === 'realistic-beach') {
    if (previousSceneId !== 'realistic-beach' || (sceneObjects.length === 0 && state.openSeaMode === 'dawn')) {
      yaw = 0;
      const isDawn = state.openSeaMode === 'dawn';
      pitch = isDawn ? 0.24 : 0.02;
      // Start near the central installation, well clear of the circular rim.
      player.position.set(0, beachFloorHeight + avatarFloorClearance, isDawn ? openSeaDawnStartZ : realisticBeachStartZ);
    }
    renderer.toneMappingExposure = atmosphere.exposure;
    bloomPass.strength = atmosphere.bloomStrength;
    bloomPass.radius = atmosphere.bloomRadius;
    bloomPass.threshold = atmosphere.bloomThreshold;
  } else if (sceneId === 'luminous') {
    yaw = 0;
    pitch = 0.12;
    player.position.set(0, 0, 5);
    renderer.toneMappingExposure = 0.7;
    bloomPass.strength = 0.2;
    bloomPass.radius = 0.42;
    bloomPass.threshold = 0.92;
  } else if (['cinema', 'youtube-cinema'].includes(sceneId)) {
    yaw = 0;
    pitch = 0.06;
    const cinemaStartZ = 14;
    player.position.set(0, getCinemaFloorHeightAt(0, cinemaStartZ) + 1.45, cinemaStartZ);
    avatarHiddenForFirstPerson = false;
    avatarRoot.visible = true;
    renderer.toneMappingExposure = 0.74;
    bloomPass.strength = 0.2;
    bloomPass.radius = 0.42;
    bloomPass.threshold = 0.9;
  } else {
    renderer.toneMappingExposure = 0.92;
    bloomPass.strength = 0.18;
    bloomPass.radius = 0.24;
    bloomPass.threshold = 0.94;
  }
  clearScene();
  if (sceneId === 'sphere') buildSphereScene();
  if (sceneId === 'sky') buildSkyScene();
  if (sceneId === 'realistic-beach') buildRealisticBeachScene();
  if (sceneId === 'luminous') buildLuminousScene();
  if (sceneId === 'cube') buildCubeScene();
  if (sceneId === 'cylinder') buildCylinderScene();
  if (sceneId === 'cinema') buildCinemaScene();
  if (sceneId === 'youtube-cinema') {
    buildCinemaScene(true);
    videoElement.pause();
    mountYouTubeScreen();
  } else if (previousSceneId === 'youtube-cinema' && state.started) {
    setVideo(state.videoId);
  }
  dom.miniPlayer.hidden = sceneId === 'youtube-cinema' || Boolean(previewParameters?.has('clean'));
  if (state.avatarId === 'butterfly') {
    applyButterflySceneStyle();
    resetButterflyDust();
  }
  updateButterflyWingDepthMode();
  document.querySelectorAll('#scene-options [data-id]').forEach((button) => button.classList.toggle('is-selected', button.dataset.id === sceneId));
  updateOpenSeaModeUI();
  if (sceneId === 'realistic-beach') updateCamera(0, true);
}

function clearScene() {
  openSeaOrbitGroup = null;
  openSeaCloudVolume?.dispose();
  openSeaCloudVolume = null;
  // Invalidate an in-flight GLB request before disposing the current scene.
  // A late response must never resurrect an island after a scene switch.
  openSeaIslandAssetLoadToken += 1;
  openSeaIslandObject = null;
  sceneObjects.forEach((object) => {
    const waterCapture = object.userData.realisticSeaPrism?.waterCapture;
    if (waterCapture?.captureScene) {
      const mirrorTexture = waterCapture.captureWater?.material?.uniforms?.mirrorSampler?.value;
      mirrorTexture?.dispose?.();
      waterCapture.captureScene.traverse((captureObject) => {
        captureObject.geometry?.dispose?.();
        captureObject.material?.dispose?.();
      });
      waterCapture.captureTarget?.dispose?.();
      waterCapture.captureScene.clear();
    }
    stage.remove(object);
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.isLight) child.shadow?.dispose();
      if (child.material && child.material !== materialForVideo()) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose?.());
      }
    });
  });
  sceneObjects = [];
  realisticSeaPrism = null;
}

function addToStage(object) {
  stage.add(object);
  sceneObjects.push(object);
  return object;
}

function buildSphereScene() {
  world.background.set('#0b1024');
  world.fog.color.set('#0b1024');
  world.fog.density = 0.006;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(sphereRadius, 128, 80), doubleHemisphereVideoMaterial());
  addToStage(sphere);
  addGlowParticles(420, '#9dc7ff', 72, true);
}

function buildSkyScene() {
  world.background.set('#a5c7e8');
  world.fog.color.set('#a5c7e8');
  world.fog.density = 0.018;
  const cloudLayer = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshLambertMaterial({ color: '#e8f5ff', transparent: true, opacity: 0.78 }));
  cloudLayer.rotation.x = -Math.PI / 2;
  cloudLayer.position.y = -1.2;
  addToStage(cloudLayer);
  addClouds();
  const projection = videoPlane(13, 7.4);
  projection.position.set(2.5, 7.2, -10);
  projection.rotation.y = -0.1;
  addToStage(projection);
  addFramedGlow(projection.position, '#b8f4ff');
}

function beachShorelineZ(x) {
  const base = -4 + 0.36 * x;
  return base + 0.9 * Math.sin((x + 18) * 0.055) + 0.35 * Math.sin(x * 0.14);
}

function buildBeachScene() {
  world.background.set('#718b91');
  world.fog.color.set('#b99a86');
  world.fog.density = 0.0042;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10500, 64, 36),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uHorizon: { value: new THREE.Color('#e8a060') },
        uMiddle: { value: new THREE.Color('#a7aaa0') },
        uZenith: { value: new THREE.Color('#718b91') },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uMiddle;
        uniform vec3 uZenith;
        varying vec3 vPosition;
        void main() {
          float height = clamp(vPosition.y / 7800.0, -0.08, 1.0);
          vec3 lowerSky = mix(uHorizon, uMiddle, smoothstep(-0.04, 0.34, height));
          vec3 color = mix(lowerSky, uZenith, smoothstep(0.28, 0.88, height));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  addToStage(sky);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(beachOceanWidth, beachOceanDepth, 300, 240),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHorizonColor: { value: new THREE.Color('#c48a61') },
      },
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying vec2 vSurface;
        varying float vWave;
        varying vec3 vWorldPosition;
        void main() {
          vec3 transformed = position;
          float broadWave = sin(position.x * 0.012 + uTime * 0.42) * 0.24;
          broadWave += sin(position.y * 0.018 - uTime * 0.31) * 0.15;
          float fineWave = sin((position.x + position.y) * 0.035 + uTime * 0.72) * 0.045;
          transformed.z += broadWave + fineWave;
          vWave = broadWave + fineWave;
          vSurface = position.xy;
          vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uHorizonColor;
        varying vec2 vSurface;
        varying float vWave;
        varying vec3 vWorldPosition;
        void main() {
          float distanceTone = 1.0 - smoothstep(-235.0, 10.0, vWorldPosition.z);
          vec3 nearColor = vec3(0.34, 0.31, 0.24);
          vec3 middleColor = vec3(0.46, 0.27, 0.14);
          vec3 deepColor = vec3(0.16, 0.11, 0.09);
          vec3 color = mix(nearColor, middleColor, smoothstep(0.0, 0.55, distanceTone));
          color = mix(color, deepColor, smoothstep(0.52, 1.0, distanceTone));
          vec2 facetCell = floor(vSurface * 0.095 + vec2(floor(vSurface.y * 0.05) * 0.5, 0.0));
          float facet = fract(sin(dot(facetCell, vec2(12.9898, 78.233))) * 43758.5453);
          color *= mix(0.93, 1.07, facet);
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - abs(dot(vec3(0.0, 1.0, 0.0), viewDirection)), 3.0);
          color += vec3(0.32, 0.25, 0.16) * fresnel * 0.42;
          color += vWave * vec3(0.15, 0.11, 0.08);
          float shoreline = -4.0 + 0.36 * vWorldPosition.x;
          shoreline += 0.9 * sin((vWorldPosition.x + 18.0) * 0.055) + 0.35 * sin(vWorldPosition.x * 0.14);
          float waterMask = 1.0 - smoothstep(shoreline - 1.8, shoreline + 0.1, vWorldPosition.z);
          float horizonBlend = smoothstep(0.76, 1.0, distanceTone);
          color = mix(color, uHorizonColor, horizonBlend * 0.54);
          if (waterMask < 0.015) discard;
          gl_FragColor = vec4(color, waterMask * 0.99);
        }
      `,
      transparent: true,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.84, -4875);
  sea.userData.beachTime = true;
  addToStage(sea);

  const sandGeometry = makeBeachSandGeometry();
  const sand = new THREE.Mesh(sandGeometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
    emissive: '#6b4031',
    emissiveIntensity: 0.1,
  }));
  sand.receiveShadow = true;
  addToStage(sand);

  addToStage(makeWetSandBand());
  [-0.35, -1.75].forEach((shoreOffset, index) => {
    const foam = makeShorelineFoam(shoreOffset, index * 1.7);
    addToStage(foam);
  });

  const horizonHaze = new THREE.Mesh(
    new THREE.PlaneGeometry(18000, 24),
    new THREE.ShaderMaterial({
       uniforms: { uColor: { value: new THREE.Color('#e4a372') } },
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float verticalFade = sin(vUv.y * 3.14159265);
          float sideFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(0.0, 0.18, 1.0 - vUv.x);
          gl_FragColor = vec4(uColor, verticalFade * sideFade * 0.24);
        }
      `,
    }),
  );
  horizonHaze.position.set(0, 3.6, -74);
  horizonHaze.renderOrder = 3;
  addToStage(horizonHaze);

  const sun = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), beachSunMaterial());
  sun.position.set(0, 4.2, -420);
  sun.renderOrder = 1;
  addToStage(sun);

  addBeachStars();
  addBeachClouds();
  addButterflyGroundGlow();

  const twilightLight = new THREE.DirectionalLight('#f3b37d', 1.45);
  twilightLight.position.set(-24, 20, -18);
  addToStage(twilightLight);
}

function buildRealisticBeachScene() {
  const atmosphere = getOpenSeaAtmosphere();
  world.background.set(atmosphere.background);
  world.fog.color.set(atmosphere.fogColor);
  world.fog.density = atmosphere.fogDensity;

  const sun = new THREE.Vector3();
  const sunElevation = THREE.MathUtils.degToRad(atmosphere.sunElevation);
  const sunAzimuth = THREE.MathUtils.degToRad(atmosphere.sunAzimuth);
  sun.setFromSphericalCoords(1, Math.PI / 2 - sunElevation, sunAzimuth);
  const sky = makeOpenSeaSky(atmosphere, sun);
  addToStage(sky);

  if (state.openSeaMode === 'dawn') {
    const sunlight = new THREE.DirectionalLight(atmosphere.sunColor, 2.6);
    sunlight.name = 'Dawn sunlight';
    sunlight.layers.enable(1);
    sunlight.target.position.set(0, 250, openSeaInstallationCenterZ + 900);
    sunlight.position.copy(sunlight.target.position).addScaledVector(sun, 5000);
    sunlight.castShadow = true;
    const solarShadowResolution = Math.min(4096, renderer.capabilities.maxTextureSize);
    sunlight.shadow.mapSize.set(solarShadowResolution, solarShadowResolution);
    // The rotating pair fits inside radius 912. Keep a fixed, tighter light
    // frustum with margin for every orbit angle; moving the frustum with the
    // arcs would introduce a second source of shadow-grid shimmering.
    // A low dawn sun magnifies each vertical shadow texel across the water.
    Object.assign(sunlight.shadow.camera, {
      left: -1200, right: 1200, top: 850, bottom: -850,
      near: 1, far: 10000,
    });
    sunlight.shadow.camera.updateProjectionMatrix();
    sunlight.shadow.normalBias = 0.6;
    sunlight.shadow.bias = -0.00003;
    addToStage(sunlight.target);
    addToStage(sunlight);
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  realisticBeachEnvironment = pmremGenerator.fromScene(sky).texture;
  world.environment = realisticBeachEnvironment;
  pmremGenerator.dispose();

  // Extend the water beyond the camera far plane so its lateral and distant
  // edges never become visible during normal exploration.
  const waterSize = openSeaWaterSize;
  const waterSurfaceSize = waterSize - (realisticSeaPrismEdgeRadius - realisticSeaPrismSurfaceOverlap) * 2;
  const waterNormals = new THREE.TextureLoader().load('/assets/textures/waternormals.jpg', (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  });
  realisticBeachWater = new Water(new THREE.CircleGeometry(waterSurfaceSize / 2, 2048), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: sun.clone().normalize(),
    sunColor: atmosphere.sunColor,
    waterColor: atmosphere.waterColor,
    distortionScale: 2.6,
    fog: true,
    alpha: 1,
    side: THREE.DoubleSide,
  });
  realisticBeachWater.rotation.x = -Math.PI / 2;
  tuneDawnWater(realisticBeachWater, atmosphere);
  realisticBeachWater.position.set(0, beachFloorHeight - 0.08, openSeaWaterCenterZ);
  realisticBeachWater.renderOrder = 1;
  realisticBeachWater.receiveShadow = state.openSeaMode === 'dawn';
  addToStage(realisticBeachWater);
  const prismWaterCapture = makeRealisticSeaSurfaceCapture({
    waterNormals,
    sunDirection: sun.clone().normalize(),
    sunColor: atmosphere.sunColor,
    waterColor: atmosphere.waterColor,
    atmosphere,
    waterSize,
    edgeRadius: realisticSeaPrismEdgeRadius,
  });
  applyRealisticSeaWaterEdgeBlend({
    water: realisticBeachWater,
    captureTexture: prismWaterCapture.captureTarget.texture,
    halfExtent: waterSurfaceSize / 2,
    blendWidth: realisticSeaPrismEdgeRadius,
  });
  realisticSeaPrism = makeRealisticSeaPrism({
    waterSize,
    waterCenterZ: openSeaWaterCenterZ,
    topY: beachFloorHeight - 0.08,
    edgeRadius: realisticSeaPrismEdgeRadius,
    waterMaterial: prismWaterCapture.material,
    waterCapture: prismWaterCapture,
  });
  const waterBeforeRender = realisticBeachWater.onBeforeRender;
  realisticBeachWater.onBeforeRender = function (...renderArguments) {
    const prismWasVisible = realisticSeaPrism.visible;
    // The Water shader renders a mirrored scene into its reflection target.
    // Keep the prism out of that pass so its captured sea texture never feeds
    // back into the reflection rendered for the upper surface.
    realisticSeaPrism.visible = false;
    try {
      waterBeforeRender.call(this, ...renderArguments);
    } finally {
      realisticSeaPrism.visible = prismWasVisible;
    }
  };
  addToStage(realisticSeaPrism);
  if (atmosphere.stars) addOpenSeaStars();
  // Replace the single convex screen with two thick, mirrored C-shaped
  // installations lying in the water. Their curved footprint surrounds the
  // butterfly from the left and right, while the openings face one another.
  const installationArc = THREE.MathUtils.degToRad(180);
  const installationOptions = {
    centerZ: 0,
    innerRadius: openSeaInstallationInnerRadius,
    outerRadius: openSeaInstallationOuterRadius,
    height: openSeaInstallationHeight,
    baseY: openSeaInstallationBaseY,
  };
  openSeaOrbitGroup = new THREE.Group();
  openSeaOrbitGroup.name = 'Orbiting Open Sea arcs';
  openSeaOrbitGroup.position.z = openSeaInstallationCenterZ;
  openSeaOrbitGroup.rotation.y = openSeaOrbitAngle;
  [
    { centerX: -openSeaInstallationCenterX, arcStart: Math.PI - installationArc / 2, arcEnd: Math.PI + installationArc / 2 },
    { centerX: openSeaInstallationCenterX, arcStart: -installationArc / 2, arcEnd: installationArc / 2 },
  ].forEach((side) => openSeaOrbitGroup.add(makeOpenSeaVideoInstallation({ ...installationOptions, ...side })));
  addToStage(openSeaOrbitGroup);
  addOpenSeaLunarTearIsland();

  // This version is open sea only: the water is the sole physical surface.
  // Keep the sky and the two horizontal video installations, but do not add
  // sand, a tide wash, shoreline foam, or a separate horizon plane.
}

function addOpenSeaLunarTearIsland() {
  const island = makeOpenSeaLunarTearIsland();
  island.position.set(0, openSeaLunarIslandWaterY, openSeaInstallationCenterZ);
  openSeaIslandObject = island;
  addToStage(island);
}

function makeOpenSeaLunarTearIsland() {
  const random = createOpenSeaLunarIslandRandom();
  const island = new THREE.Group();
  island.name = 'Lunar Tear island';
  island.add(makeOpenSeaLunarIslandTerrain(random));
  island.add(makeOpenSeaLunarIslandRocks(random));
  island.add(makeOpenSeaLunarIslandGroundCover(random));
  island.add(makeOpenSeaLunarTearField(random));

  const atmosphereStrength = state.openSeaMode === 'night' ? 42 : state.openSeaMode === 'dawn' ? 24 : 11;
  const flowerLight = new THREE.PointLight('#fff2cf', atmosphereStrength, 250, 2);
  flowerLight.position.set(0, 18, 0);
  flowerLight.userData.openSeaLunarIslandLight = {
    baseIntensity: atmosphereStrength,
    phase: random() * Math.PI * 2,
  };
  island.add(flowerLight);
  island.userData.openSeaLunarIsland = true;
  return island;
}

function makeOpenSeaLunarIslandTerrain() {
  const segments = 128;
  const rings = [...openSeaLunarIslandProfile].reverse().filter((ring) => ring.radius > 0);
  const positions = [];
  const colors = [];
  const indices = [];
  const topColor = new THREE.Color('#3b4435');
  const middleColor = new THREE.Color('#333a32');
  const wetColor = new THREE.Color('#293937');

  rings.forEach((ring) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const edgeNoise = Math.sin(angle * 3 + 0.7) * 0.032
        + Math.sin(angle * 7 - 1.1) * 0.018
        + Math.sin(angle * 13 + 2.4) * 0.008;
      const radiusScale = 1 + edgeNoise * THREE.MathUtils.lerp(0.32, 1, ring.radius);
      const x = Math.cos(angle) * openSeaLunarIslandRadiusX * ring.radius * radiusScale;
      const z = Math.sin(angle) * openSeaLunarIslandRadiusZ * ring.radius * radiusScale;
      const surfaceNoise = openSeaLunarIslandSurfaceNoise(angle, ring.radius);
      positions.push(x, ring.height + surfaceNoise, z);

      const edgeBlend = THREE.MathUtils.smoothstep(ring.radius, 0.55, 1);
      const middleBlend = THREE.MathUtils.smoothstep(ring.radius, 0.18, 0.72);
      const color = topColor.clone().lerp(middleColor, middleBlend).lerp(wetColor, edgeBlend);
      const colorNoise = Math.sin(x * 0.047 + z * 0.019) * 0.54
        + Math.sin(z * 0.061 - x * 0.013) * 0.31;
      color.offsetHSL(colorNoise * 0.006, colorNoise * 0.008, colorNoise * 0.018);
      colors.push(color.r, color.g, color.b);
    }
  });

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const current = ringIndex * segments + segment;
      const currentNext = ringIndex * segments + nextSegment;
      const inner = (ringIndex + 1) * segments + segment;
      const innerNext = (ringIndex + 1) * segments + nextSegment;
      indices.push(current, inner, currentNext, currentNext, inner, innerNext);
    }
  }

  const centerIndex = positions.length / 3;
  positions.push(0, sampleOpenSeaLunarIslandProfile(0), 0);
  colors.push(topColor.r, topColor.g, topColor.b);
  const innerRingStart = (rings.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(innerRingStart + segment, centerIndex, innerRingStart + ((segment + 1) % segments));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const terrain = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive: '#101a15',
    emissiveIntensity: 0.26,
    roughness: 0.96,
    metalness: 0.015,
    envMapIntensity: 0.34,
    side: THREE.DoubleSide,
  }));
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  return terrain;
}

function makeOpenSeaLunarIslandRocks(random) {
  const rockCount = 72;
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: '#ffffff',
    emissive: '#111817',
    emissiveIntensity: 0.18,
    roughness: 0.87,
    metalness: 0.04,
    envMapIntensity: 0.42,
    flatShading: true,
  });
  const rocks = new THREE.InstancedMesh(geometry, material, rockCount);
  const palette = [
    new THREE.Color('#43514b'),
    new THREE.Color('#56594f'),
    new THREE.Color('#655f54'),
    new THREE.Color('#354945'),
  ];
  const instance = new THREE.Object3D();

  for (let index = 0; index < rockCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = index < 52
      ? THREE.MathUtils.lerp(0.83, 0.985, random())
      : THREE.MathUtils.lerp(0.3, 0.79, random());
    const x = Math.cos(angle) * openSeaLunarIslandRadiusX * radius;
    const z = Math.sin(angle) * openSeaLunarIslandRadiusZ * radius;
    const scale = index < 52
      ? THREE.MathUtils.lerp(1.5, 4.5, random())
      : THREE.MathUtils.lerp(0.8, 2.4, random());
    const verticalScale = scale * THREE.MathUtils.lerp(0.42, 0.74, random());
    instance.position.set(
      x,
      getOpenSeaLunarIslandSurfaceOffset(x, z) + verticalScale * 0.46,
      z,
    );
    instance.rotation.set(
      THREE.MathUtils.lerp(-0.22, 0.22, random()),
      random() * Math.PI * 2,
      THREE.MathUtils.lerp(-0.22, 0.22, random()),
    );
    instance.scale.set(scale * THREE.MathUtils.lerp(0.82, 1.35, random()), verticalScale, scale);
    instance.updateMatrix();
    rocks.setMatrixAt(index, instance.matrix);
    rocks.setColorAt(index, palette[Math.floor(random() * palette.length)]);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.instanceColor.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.frustumCulled = false;
  return rocks;
}

function makeOpenSeaLunarIslandGroundCover(random) {
  const leafCount = 1400;
  const geometry = makeOpenSeaLunarPetalGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    emissive: '#0b1711',
    emissiveIntensity: 0.36,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const leaves = new THREE.InstancedMesh(geometry, material, leafCount);
  const palette = [
    new THREE.Color('#233b2d'),
    new THREE.Color('#2c4635'),
    new THREE.Color('#1d3328'),
    new THREE.Color('#354b38'),
  ];
  const instance = new THREE.Object3D();
  for (let index = 0; index < leafCount; index += 1) {
    const radius = Math.sqrt(random()) * 0.86;
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * openSeaLunarIslandRadiusX * radius;
    const z = Math.sin(angle) * openSeaLunarIslandRadiusZ * radius;
    const scale = THREE.MathUtils.lerp(0.72, 1.38, random());
    instance.position.set(x, getOpenSeaLunarIslandSurfaceOffset(x, z) + 0.08, z);
    instance.rotation.set(
      THREE.MathUtils.lerp(-0.06, 0.06, random()),
      random() * Math.PI * 2,
      THREE.MathUtils.lerp(-0.14, 0.14, random()),
    );
    instance.scale.set(scale * THREE.MathUtils.lerp(0.82, 1.28, random()), scale, scale);
    instance.updateMatrix();
    leaves.setMatrixAt(index, instance.matrix);
    leaves.setColorAt(index, palette[Math.floor(random() * palette.length)]);
  }
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  leaves.receiveShadow = true;
  leaves.frustumCulled = false;
  leaves.renderOrder = 3;
  return leaves;
}

function makeOpenSeaLunarTearField(random) {
  const field = new THREE.Group();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const flowers = [];
  for (let index = 0; index < openSeaLunarIslandFlowerCount; index += 1) {
    const normalizedRadius = Math.min(
      0.82,
      Math.sqrt((index + random() * 0.85) / openSeaLunarIslandFlowerCount) * 0.82,
    );
    const angle = index * goldenAngle + THREE.MathUtils.lerp(-0.36, 0.36, random());
    const x = Math.cos(angle) * openSeaLunarIslandRadiusX * normalizedRadius;
    const z = Math.sin(angle) * openSeaLunarIslandRadiusZ * normalizedRadius;
    flowers.push({
      x,
      z,
      groundY: getOpenSeaLunarIslandSurfaceOffset(x, z),
      stemHeight: THREE.MathUtils.lerp(3.6, 6.2, random()) * THREE.MathUtils.lerp(1.06, 0.9, normalizedRadius),
      scale: THREE.MathUtils.lerp(1.4, 2.08, random()),
      rotation: random() * Math.PI * 2,
      colorIndex: Math.floor(random() * 3),
    });
  }

  const petalGeometry = makeOpenSeaLunarPetalGeometry();
  const stemGeometry = new THREE.CylinderGeometry(0.11, 0.15, 1, 5, 5);
  const centerGeometry = new THREE.SphereGeometry(0.26, 8, 6);
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: '#fffdf4',
    emissive: '#fff4d8',
    emissiveIntensity: state.openSeaMode === 'night' ? 3.4 : state.openSeaMode === 'dawn' ? 0.85 : 1.15,
    roughness: 0.7,
    metalness: 0,
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const centerMaterial = new THREE.MeshBasicMaterial({
    color: '#fff3bd',
    toneMapped: false,
  });
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: '#294637',
    roughness: 0.94,
    metalness: 0,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: '#172d24',
    emissive: '#08140f',
    emissiveIntensity: 0.28,
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const petalPalette = [
    new THREE.Color('#fffdf4'),
    new THREE.Color('#f4fbf5'),
    new THREE.Color('#fff7df'),
  ];
  applyOpenSeaLunarInstancedWind(petalMaterial, 'petal', 0.98);
  applyOpenSeaLunarInstancedWind(centerMaterial, 'whole', 0.98);
  applyOpenSeaLunarInstancedWind(stemMaterial, 'stem', 0.98);
  applyOpenSeaLunarInstancedWind(leafMaterial, 'leaf', 0.98);
  const baseGlowOpacity = state.openSeaMode === 'night' ? 0.25 : state.openSeaMode === 'dawn' ? 0.14 : 0.07;

  for (let layerIndex = 0; layerIndex < 3; layerIndex += 1) {
    const layerFlowers = flowers.filter((_, flowerIndex) => flowerIndex % 3 === layerIndex);
    const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, layerFlowers.length * 5);
    const centers = new THREE.InstancedMesh(centerGeometry, centerMaterial, layerFlowers.length);
    const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, layerFlowers.length);
    const leaves = new THREE.InstancedMesh(petalGeometry, leafMaterial, layerFlowers.length * 2);
    const glowPositions = new Float32Array(layerFlowers.length * 3);
    const instance = new THREE.Object3D();

    layerFlowers.forEach((flower, flowerIndex) => {
      const blossomY = flower.groundY + flower.stemHeight;
      instance.position.set(flower.x, flower.groundY + flower.stemHeight * 0.5, flower.z);
      instance.rotation.set(0, flower.rotation, 0);
      instance.scale.set(flower.scale, flower.stemHeight, flower.scale);
      instance.updateMatrix();
      stems.setMatrixAt(flowerIndex, instance.matrix);

      for (let leafIndex = 0; leafIndex < 2; leafIndex += 1) {
        const leafAngle = flower.rotation + leafIndex * Math.PI + THREE.MathUtils.lerp(-0.45, 0.45, random());
        const leafHeight = flower.groundY + flower.stemHeight * THREE.MathUtils.lerp(0.22, 0.48, random());
        instance.position.set(flower.x, leafHeight, flower.z);
        instance.rotation.set(0, leafAngle, leafIndex === 0 ? -0.1 : 0.1);
        instance.scale.setScalar(flower.scale * THREE.MathUtils.lerp(0.58, 0.82, random()));
        instance.updateMatrix();
        leaves.setMatrixAt(flowerIndex * 2 + leafIndex, instance.matrix);
      }

      for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
        const petalAngle = flower.rotation + petalIndex / 5 * Math.PI * 2;
        instance.position.set(flower.x, blossomY, flower.z);
        instance.rotation.set(0, petalAngle, THREE.MathUtils.lerp(-0.045, 0.045, random()));
        instance.scale.setScalar(flower.scale * THREE.MathUtils.lerp(0.9, 1.08, random()));
        instance.updateMatrix();
        const petalInstanceIndex = flowerIndex * 5 + petalIndex;
        petals.setMatrixAt(petalInstanceIndex, instance.matrix);
        petals.setColorAt(petalInstanceIndex, petalPalette[flower.colorIndex]);
      }

      instance.position.set(flower.x, blossomY + flower.scale * 0.16, flower.z);
      instance.rotation.set(0, 0, 0);
      instance.scale.setScalar(flower.scale);
      instance.updateMatrix();
      centers.setMatrixAt(flowerIndex, instance.matrix);
      glowPositions[flowerIndex * 3] = flower.x;
      glowPositions[flowerIndex * 3 + 1] = blossomY + flower.scale * 0.3;
      glowPositions[flowerIndex * 3 + 2] = flower.z;
    });

    [petals, centers, stems, leaves].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
    });
    petals.instanceColor.needsUpdate = true;
    petals.renderOrder = 5;
    centers.renderOrder = 6;

    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
    const glowMaterial = new THREE.PointsMaterial({
      color: '#fff4d8',
      map: luminousGlowTexture,
      size: state.openSeaMode === 'night' ? 10 : 8.2,
      opacity: baseGlowOpacity,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });
    applyOpenSeaLunarPointWind(glowMaterial, 0.98);
    const glow = new THREE.Points(glowGeometry, glowMaterial);
    glow.frustumCulled = false;
    glow.renderOrder = 7;

    const layer = new THREE.Group();
    layer.add(stems, leaves, petals, centers, glow);
    layer.userData.openSeaLunarFlowerLayer = {
      phase: layerIndex / 3 * Math.PI * 2,
      glow,
      baseGlowOpacity,
    };
    field.add(layer);
  }
  return field;
}

function openSeaLunarWindShaderPreamble(amplitude) {
  return `
    uniform float uOpenSeaLunarWindTime;

    vec3 openSeaLunarWindOffset(vec3 anchor, float response) {
      float primaryPhase = uOpenSeaLunarWindTime * 0.74 + anchor.x * 0.038 + anchor.z * 0.027;
      float secondaryPhase = uOpenSeaLunarWindTime * 0.31 - anchor.x * 0.013 + anchor.z * 0.019 + 1.7;
      float broadWave = sin(primaryPhase) * 0.72 + sin(secondaryPhase) * 0.28;
      float crossWave = sin(primaryPhase * 0.53 + secondaryPhase * 0.37 + 2.4);
      float gust = 0.78 + sin(uOpenSeaLunarWindTime * 0.17 + anchor.x * 0.006 - anchor.z * 0.004) * 0.22;
      vec3 direction = vec3(
        broadWave * 0.88 + crossWave * 0.12,
        sin(primaryPhase + 1.1) * 0.07,
        broadWave * 0.34 + crossWave * 0.16
      );
      return direction * ${amplitude.toFixed(3)} * response * gust;
    }
  `;
}

function applyOpenSeaLunarInstancedWind(material, mode, amplitude) {
  const response = {
    stem: 'pow(clamp(position.y + 0.5, 0.0, 1.0), 1.65)',
    petal: '1.0 + clamp(position.z / 2.36, 0.0, 1.0) * 0.12',
    leaf: '0.28 + clamp(position.z / 2.36, 0.0, 1.0) * 0.08',
    whole: '1.0',
  }[mode] ?? '1.0';
  const windState = { shader: null };
  material.userData.openSeaLunarWind = windState;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOpenSeaLunarWindTime = { value: 0 };
    windState.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${openSeaLunarWindShaderPreamble(amplitude)}\nvoid main() {`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);

        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif

        #ifdef USE_INSTANCING
          vec3 openSeaLunarWindAnchor = instanceMatrix[3].xyz;
          float openSeaLunarWindResponse = ${response};
          mvPosition = instanceMatrix * mvPosition;
          mvPosition.xyz += openSeaLunarWindOffset(openSeaLunarWindAnchor, openSeaLunarWindResponse);
        #endif

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `)
      .replace('#include <worldpos_vertex>', `
        #if defined(USE_ENVMAP) || defined(DISTANCE) || defined(USE_SHADOWMAP) || defined(USE_TRANSMISSION) || NUM_SPOT_LIGHT_COORDS > 0
          vec4 worldPosition = vec4(transformed, 1.0);

          #ifdef USE_BATCHING
            worldPosition = batchingMatrix * worldPosition;
          #endif

          #ifdef USE_INSTANCING
            vec3 openSeaLunarWorldWindAnchor = instanceMatrix[3].xyz;
            float openSeaLunarWorldWindResponse = ${response};
            worldPosition = instanceMatrix * worldPosition;
            worldPosition.xyz += openSeaLunarWindOffset(openSeaLunarWorldWindAnchor, openSeaLunarWorldWindResponse);
          #endif

          worldPosition = modelMatrix * worldPosition;
        #endif
      `);
  };
  material.customProgramCacheKey = () => `open-sea-lunar-wind-${mode}-${amplitude}`;
}

function applyOpenSeaLunarPointWind(material, amplitude) {
  const windState = { shader: null };
  material.userData.openSeaLunarWind = windState;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOpenSeaLunarWindTime = { value: 0 };
    windState.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${openSeaLunarWindShaderPreamble(amplitude)}\nvoid main() {`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed += openSeaLunarWindOffset(position, 1.0);
      `);
  };
  material.customProgramCacheKey = () => `open-sea-lunar-point-wind-${amplitude}`;
}

function makeOpenSeaLunarPetalGeometry() {
  const sections = [
    { distance: 0, width: 0.04, height: 0 },
    { distance: 0.28, width: 0.34, height: 0.08 },
    { distance: 0.72, width: 0.66, height: 0.2 },
    { distance: 1.22, width: 0.78, height: 0.31 },
    { distance: 1.72, width: 0.62, height: 0.35 },
    { distance: 2.12, width: 0.32, height: 0.28 },
    { distance: 2.36, width: 0.02, height: 0.2 },
  ];
  const positions = [];
  const uvs = [];
  const indices = [];
  sections.forEach((section, index) => {
    positions.push(-section.width, section.height, section.distance);
    positions.push(section.width, section.height, section.distance);
    const v = index / (sections.length - 1);
    uvs.push(0, v, 1, v);
  });
  for (let index = 0; index < sections.length - 1; index += 1) {
    const current = index * 2;
    const next = current + 2;
    indices.push(current, next + 1, current + 1, current, next, next + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function sampleOpenSeaLunarIslandProfile(normalizedRadius) {
  const radius = THREE.MathUtils.clamp(normalizedRadius, 0, 1);
  for (let index = 1; index < openSeaLunarIslandProfile.length; index += 1) {
    const previous = openSeaLunarIslandProfile[index - 1];
    const next = openSeaLunarIslandProfile[index];
    if (radius > next.radius) continue;
    const blend = THREE.MathUtils.smootherstep(radius, previous.radius, next.radius);
    return THREE.MathUtils.lerp(previous.height, next.height, blend);
  }
  return openSeaLunarIslandProfile[openSeaLunarIslandProfile.length - 1].height;
}

function openSeaLunarIslandSurfaceNoise(angle, normalizedRadius) {
  const centerFade = THREE.MathUtils.smoothstep(normalizedRadius, 0.04, 0.28);
  const edgeFade = 1 - THREE.MathUtils.smoothstep(normalizedRadius, 0.78, 1);
  return (
    Math.sin(angle * 5 + normalizedRadius * 11.2) * 0.17
    + Math.sin(angle * 11 - normalizedRadius * 7.4) * 0.08
  ) * centerFade * edgeFade;
}

function getOpenSeaLunarIslandSurfaceOffset(localX, localZ) {
  const normalizedX = localX / openSeaLunarIslandRadiusX;
  const normalizedZ = localZ / openSeaLunarIslandRadiusZ;
  const normalizedRadius = Math.hypot(normalizedX, normalizedZ);
  const angle = Math.atan2(normalizedZ, normalizedX);
  return sampleOpenSeaLunarIslandProfile(normalizedRadius)
    + openSeaLunarIslandSurfaceNoise(angle, normalizedRadius);
}

function getOpenSeaLunarIslandFloorHeight(x, z) {
  if (!openSeaIslandObject || state.sceneId !== 'realistic-beach') return null;
  const localX = x - openSeaIslandObject.position.x;
  const localZ = z - openSeaIslandObject.position.z;
  const normalizedRadius = Math.hypot(
    localX / openSeaLunarIslandRadiusX,
    localZ / openSeaLunarIslandRadiusZ,
  );
  if (normalizedRadius >= 0.955) return null;
  const islandSurface = openSeaIslandObject.position.y + getOpenSeaLunarIslandSurfaceOffset(localX, localZ);
  return islandSurface > beachFloorHeight ? islandSurface : null;
}

function getOpenSeaFloorHeightAt(x, z) {
  return Math.max(beachFloorHeight, getOpenSeaLunarIslandFloorHeight(x, z) ?? beachFloorHeight);
}

function createOpenSeaLunarIslandRandom() {
  let seed = 0x91e10da5;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function addOpenSeaIsland() {
  if (!openSeaIslandUseDownloadedAsset) {
    addOpenSeaProceduralIsland();
    return;
  }

  addOpenSeaIslandAsset();
}

function addOpenSeaProceduralIsland() {
  const island = makeOpenSeaIsland();
  island.position.set(openSeaIslandCenterX, openSeaIslandBaseY, openSeaIslandCenterZ);
  openSeaIslandObject = island;
  addToStage(island);
}

function addOpenSeaIslandAsset() {
  const loadToken = ++openSeaIslandAssetLoadToken;
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    openSeaIslandAssetPath,
    (gltf) => {
      dracoLoader.dispose();
      if (loadToken !== openSeaIslandAssetLoadToken || state.sceneId !== 'realistic-beach') {
        disposeOpenSeaIslandAsset(gltf.scene);
        return;
      }

      const island = gltf.scene;
      island.rotation.x = Math.PI / 2;
      island.rotation.y = -Math.PI;
      island.scale.setScalar(openSeaIslandAssetScale);
      island.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(island);
      island.position.set(
        openSeaIslandCenterX,
        openSeaIslandBaseY - bounds.min.y + 0.02,
        openSeaIslandCenterZ,
      );
      if (openSeaIslandFlattenUnderside) flattenOpenSeaIslandUnderside(island);
      island.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
          material.side = THREE.DoubleSide;
          if (material.transparent || material.alphaTest > 0 || material.name?.toLowerCase().includes('blaetter')) {
            material.transparent = true;
            material.alphaTest = Math.max(material.alphaTest || 0, 0.18);
            material.depthWrite = true;
          }
          material.needsUpdate = true;
        });
      });

      openSeaIslandObject = island;
      addToStage(island);
    },
    undefined,
    (error) => {
      dracoLoader.dispose();
      console.warn('Open Sea island asset could not be loaded; using procedural fallback.', error);
      if (loadToken === openSeaIslandAssetLoadToken && state.sceneId === 'realistic-beach') {
        addOpenSeaProceduralIsland();
      }
    },
  );
}

function flattenOpenSeaIslandUnderside(island) {
  // The downloaded model's main ground mesh is named Plane. Work in world
  // space so this remains correct even if the asset's source-up axis changes,
  // then convert the edited vertices back to their mesh-local coordinates.
  island.updateMatrixWorld(true);
  island.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry?.attributes?.position;
    if (!position) return;
    object.geometry.computeBoundingBox();
    const localSize = object.geometry.boundingBox.getSize(new THREE.Vector3());
    const isMainIslandSurface = object.name === 'Plane'
      || (position.count > 7000 && localSize.x > 70 && localSize.y > 70);
    if (!isMainIslandSurface) return;

    const matrixWorld = object.matrixWorld.clone();
    const matrixWorldInverse = matrixWorld.clone().invert();
    const vertex = new THREE.Vector3();
    let changed = false;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(matrixWorld);
      const distanceFromFlatBottom = vertex.y - openSeaIslandFlatBottomY;
      if (distanceFromFlatBottom >= openSeaIslandFlattenHeight) continue;

      const blend = THREE.MathUtils.smoothstep(
        THREE.MathUtils.clamp(distanceFromFlatBottom, 0, openSeaIslandFlattenHeight),
        0,
        openSeaIslandFlattenHeight,
      );
      vertex.y = THREE.MathUtils.lerp(openSeaIslandFlatBottomY, vertex.y, blend);
      vertex.applyMatrix4(matrixWorldInverse);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
      changed = true;
    }

    if (changed) {
      position.needsUpdate = true;
      object.geometry.computeVertexNormals();
      object.geometry.computeBoundingBox();
      object.geometry.computeBoundingSphere();
    }
  });
}

function disposeOpenSeaIslandAsset(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    const materials = child.material
      ? (Array.isArray(child.material) ? child.material : [child.material])
      : [];
    materials.forEach((material) => {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.metalnessMap?.dispose();
      material.emissiveMap?.dispose();
      material.dispose?.();
    });
  });
}

function makeOpenSeaIsland() {
  const island = new THREE.Group();
  island.add(makeOpenSeaIslandTerrain());
  island.add(makeOpenSeaIslandSandSurface());

  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 36);
  const rockPalette = [
    new THREE.Color('#8f7960'),
    new THREE.Color('#b39a78'),
    new THREE.Color('#756b62'),
    new THREE.Color('#c3aa82'),
  ];
  const grassGeometry = new THREE.ConeGeometry(1, 1, 5, 1);
  const grassMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });
  const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, 38);
  const grassPalette = [
    new THREE.Color('#5d783b'),
    new THREE.Color('#718c43'),
    new THREE.Color('#4d6e3b'),
  ];
  const instance = new THREE.Object3D();
  const random = createOpenSeaIslandRandom();

  for (let index = 0; index < rocks.count; index += 1) {
    const angle = random() * Math.PI * 2;
    const onIsland = random() > 0.28;
    const radius = onIsland
      ? THREE.MathUtils.lerp(26, 126, random())
      : THREE.MathUtils.lerp(142, 174, random());
    const scale = THREE.MathUtils.lerp(2.2, 6.8, random());
    instance.position.set(
      Math.cos(angle) * radius,
      onIsland ? THREE.MathUtils.lerp(17, 23, random()) : THREE.MathUtils.lerp(0.7, 3.1, random()),
      Math.sin(angle) * radius * 0.88,
    );
    instance.rotation.set(
      random() * 0.35,
      random() * Math.PI * 2,
      random() * 0.35,
    );
    instance.scale.set(scale * 1.15, scale * THREE.MathUtils.lerp(0.55, 0.92, random()), scale);
    instance.updateMatrix();
    rocks.setMatrixAt(index, instance.matrix);
    rocks.setColorAt(index, rockPalette[Math.floor(random() * rockPalette.length)]);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.instanceColor.needsUpdate = true;
  island.add(rocks);

  for (let index = 0; index < grass.count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = THREE.MathUtils.lerp(22, 82, random());
    const height = THREE.MathUtils.lerp(4, 10, random());
    instance.position.set(
      Math.cos(angle) * radius,
      THREE.MathUtils.lerp(20, 24, random()) + height * 0.5,
      Math.sin(angle) * radius * 0.86,
    );
    instance.rotation.set(
      THREE.MathUtils.randFloat(-0.28, 0.28),
      random() * Math.PI * 2,
      THREE.MathUtils.randFloat(-0.28, 0.28),
    );
    instance.scale.set(
      THREE.MathUtils.lerp(0.8, 1.7, random()),
      height,
      THREE.MathUtils.lerp(0.8, 1.7, random()),
    );
    instance.updateMatrix();
    grass.setMatrixAt(index, instance.matrix);
    grass.setColorAt(index, grassPalette[Math.floor(random() * grassPalette.length)]);
  }
  grass.castShadow = true;
  grass.receiveShadow = true;
  grass.instanceColor.needsUpdate = true;
  island.add(grass);

  [
    { x: -48, z: -22, scale: 1.08 },
    { x: -8, z: -46, scale: 1.02 },
    { x: 43, z: -18, scale: 0.92 },
    { x: 28, z: 34, scale: 0.84 },
    { x: -30, z: 38, scale: 0.76 },
  ].forEach((palmPosition) => {
    const palm = makeOpenSeaPalm(palmPosition.scale, random);
    palm.position.set(palmPosition.x, THREE.MathUtils.lerp(20.5, 22.2, random()), palmPosition.z);
    palm.rotation.y = random() * Math.PI * 2;
    island.add(palm);
  });

  const foam = new THREE.Mesh(
    new THREE.RingGeometry(140, 158, 96),
    new THREE.MeshBasicMaterial({
      color: '#eaf4e8',
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.08;
  foam.renderOrder = 4;
  foam.userData.openSeaIslandFoam = {
    baseOpacity: 0.3,
    phase: createOpenSeaIslandRandom() * Math.PI * 2,
  };
  island.add(foam);

  island.userData.openSeaIsland = true;
  return island;
}

function makeOpenSeaIslandTerrain() {
  const segments = 18;
  const rings = [
    { radius: 148, y: 0 },
    { radius: 142, y: 6 },
    { radius: 126, y: 12 },
    { radius: 96, y: 18 },
    { radius: 62, y: 21 },
  ];
  const palette = [
    new THREE.Color('#40565a'),
    new THREE.Color('#5c6662'),
    new THREE.Color('#77766b'),
    new THREE.Color('#8b816e'),
  ];
  const positions = [];
  const colors = [];
  const indices = [];
  const random = createOpenSeaIslandRandom();

  rings.forEach((ring, ringIndex) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const jitter = THREE.MathUtils.lerp(0.92, 1.08, random());
      const radius = ring.radius * jitter;
      const irregularity = 1 + Math.sin(angle * 3 + ringIndex * 0.8) * 0.045;
      positions.push(
        Math.cos(angle) * radius * irregularity,
        ring.y,
        Math.sin(angle) * radius * 0.88 * irregularity,
      );
      const color = palette[Math.min(ringIndex, palette.length - 1)].clone();
      color.offsetHSL(THREE.MathUtils.lerp(-0.018, 0.018, random()), 0, THREE.MathUtils.lerp(-0.035, 0.035, random()));
      colors.push(color.r, color.g, color.b);
    }
  });

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const current = ringIndex * segments + segment;
      const currentNext = ringIndex * segments + nextSegment;
      const next = (ringIndex + 1) * segments + segment;
      const nextNext = (ringIndex + 1) * segments + nextSegment;
      indices.push(current, currentNext, next, currentNext, nextNext, next);
    }
  }

  const topCenterIndex = positions.length / 3;
  positions.push(0, 22, 0);
  colors.push(0.49, 0.45, 0.36);
  const topRingStart = (rings.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(topRingStart + segment, topRingStart + ((segment + 1) % segments), topCenterIndex);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.02,
    flatShading: true,
  });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  return terrain;
}

function makeOpenSeaIslandSandSurface() {
  const segments = 48;
  const rings = [
    { radius: 138, y: 14 },
    { radius: 130, y: 17 },
    { radius: 110, y: 20.5 },
    { radius: 76, y: 23 },
    { radius: 32, y: 24 },
  ];
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const random = createOpenSeaIslandRandom();
  const drySand = new THREE.Color('#e2c99a');
  const warmSand = new THREE.Color('#c9a77a');

  rings.forEach((ring, ringIndex) => {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const jitter = THREE.MathUtils.lerp(0.94, 1.06, random());
      const radius = ring.radius * jitter;
      const irregularity = 1 + Math.sin(angle * 4 + 0.6) * 0.035 + Math.sin(angle * 7 - 1.2) * 0.018;
      const x = Math.cos(angle) * radius * irregularity;
      const z = Math.sin(angle) * radius * 0.86 * irregularity;
      positions.push(x, ring.y, z);
      uvs.push(x / 138 + 0.5, z / 118 + 0.5);
      const edgeBlend = THREE.MathUtils.smoothstep(ringIndex, 0, rings.length - 1);
      const color = warmSand.clone().lerp(drySand, 1 - edgeBlend * 0.58);
      color.offsetHSL(THREE.MathUtils.lerp(-0.012, 0.012, random()), 0, THREE.MathUtils.lerp(-0.028, 0.028, random()));
      colors.push(color.r, color.g, color.b);
    }
  });

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments;
      const current = ringIndex * segments + segment;
      const currentNext = ringIndex * segments + nextSegment;
      const next = (ringIndex + 1) * segments + segment;
      const nextNext = (ringIndex + 1) * segments + nextSegment;
      indices.push(current, next, currentNext, currentNext, next, nextNext);
    }
  }

  const centerIndex = positions.length / 3;
  positions.push(0, 24.5, 0);
  uvs.push(0.5, 0.5);
  colors.push(drySand.r, drySand.g, drySand.b);
  const topRingStart = (rings.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(topRingStart + segment, centerIndex, topRingStart + ((segment + 1) % segments));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const textures = getProceduralSandTextures();
  const sand = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.92,
    roughnessMap: textures.roughness,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    metalness: 0,
    side: THREE.DoubleSide,
  }));
  sand.castShadow = true;
  sand.receiveShadow = true;
  sand.renderOrder = 2;
  return sand;
}

function makeOpenSeaPalm(scale, random) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.78, 9.5, 8, 3),
    new THREE.MeshStandardMaterial({
      color: '#79684b',
      roughness: 0.93,
      metalness: 0,
      flatShading: true,
    }),
  );
  trunk.position.y = 4.75;
  trunk.rotation.z = THREE.MathUtils.lerp(-0.1, 0.1, random());
  trunk.rotation.x = THREE.MathUtils.lerp(-0.06, 0.06, random());
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  palm.add(trunk);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(1.25, 0.58, 3.05, 0.75, 4.9, 0.12);
  leafShape.bezierCurveTo(3.05, -0.32, 1.25, -0.28, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 6);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: '#5f7d3d',
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const crown = new THREE.Group();
  crown.position.y = 9.35;
  palm.add(crown);
  for (let index = 0; index < 8; index += 1) {
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.rotation.set(
      -Math.PI / 2 + THREE.MathUtils.lerp(-0.18, 0.18, random()),
      (index / 8) * Math.PI * 2,
      THREE.MathUtils.lerp(-0.12, 0.12, random()),
    );
    leaf.scale.setScalar(THREE.MathUtils.lerp(0.72, 1.04, random()));
    leaf.userData.openSeaIslandPalmLeaf = {
      baseRotationX: leaf.rotation.x,
      baseRotationZ: leaf.rotation.z,
      phase: random() * Math.PI * 2,
    };
    leaf.renderOrder = 2;
    crown.add(leaf);
  }
  palm.scale.setScalar(scale);
  palm.userData.openSeaIslandPalm = true;
  return palm;
}

function createOpenSeaIslandRandom() {
  let seed = 0x6d2b79f5;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeRealisticSeaPrism({ waterSize, waterCenterZ, topY, edgeRadius, waterMaterial, waterCapture }) {
  // Revolve an open-topped profile: the circular Water surface owns the cap.
  // Rounded shoulders retain the softened transition without a coplanar lid.
  const radius = waterSize / 2;
  const halfDepth = realisticSeaPrismDepth / 2;
  const profile = [new THREE.Vector2(0, -halfDepth)];
  for (let i = 0; i <= 16; i += 1) {
    const angle = -Math.PI / 2 + (i / 16) * Math.PI / 2;
    profile.push(new THREE.Vector2(
      radius - edgeRadius + Math.cos(angle) * edgeRadius,
      -halfDepth + edgeRadius + Math.sin(angle) * edgeRadius,
    ));
  }
  for (let i = 0; i <= 16; i += 1) {
    const angle = (i / 16) * Math.PI / 2;
    profile.push(new THREE.Vector2(
      radius - edgeRadius + Math.cos(angle) * edgeRadius,
      halfDepth - edgeRadius + Math.sin(angle) * edgeRadius,
    ));
  }
  const geometry = new THREE.LatheGeometry(profile, 2048);
  const body = new THREE.Mesh(geometry, waterMaterial);
  body.position.set(0, topY - realisticSeaPrismDepth / 2, waterCenterZ);
  body.renderOrder = 2;

  const prism = new THREE.Group();
  prism.add(body);
  prism.userData.realisticSeaPrism = {
    material: waterMaterial,
    depth: realisticSeaPrismDepth,
    waterCapture,
  };
  return prism;
}

function makeRealisticSeaSurfaceCapture({
  waterNormals,
  sunDirection,
  sunColor,
  waterColor,
  atmosphere,
  waterSize,
  edgeRadius,
}) {
  // A vertical Water plane behaves like a mirror aimed at the horizon. Capture
  // a genuine horizontal sample instead and project that moving result onto the
  // prism walls, making their look independent of face orientation.
  const captureScene = new THREE.Scene();
  captureScene.background = new THREE.Color(atmosphere.background);
  captureScene.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);

  const captureSky = makeOpenSeaSky(atmosphere, sunDirection);
  captureScene.add(captureSky);

  const captureWater = new Water(new THREE.PlaneGeometry(420, 420), {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals,
    sunDirection,
    sunColor,
    waterColor,
    distortionScale: 2.6,
    fog: true,
    alpha: 1,
    side: THREE.DoubleSide,
  });
  captureWater.rotation.x = -Math.PI / 2;
  tuneDawnWater(captureWater, atmosphere);
  captureScene.add(captureWater);

  const captureCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 1600);
  captureCamera.position.set(0, 58, 78);
  captureCamera.lookAt(0, 0, -18);
  captureCamera.updateMatrixWorld();

  const captureTarget = new THREE.WebGLRenderTarget(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  captureTarget.texture.name = 'OpenSeaPrismWaterCapture';
  captureTarget.texture.wrapS = THREE.MirroredRepeatWrapping;
  captureTarget.texture.wrapT = THREE.MirroredRepeatWrapping;
  captureTarget.texture.generateMipmaps = false;
  captureTarget.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshBasicMaterial({
    map: captureTarget.texture,
    side: THREE.DoubleSide,
    // The captured Water pass already contains the active atmosphere. Applying
    // the main scene fog again here would wash the moving detail out twice.
    fog: false,
    toneMapped: false,
  });
  material.name = 'OpenSeaPrismCapturedWaterMaterial';
  const capturedPatchWorldSize = 160;
  const triplanarScale = (1 / capturedPatchWorldSize).toFixed(8);
  const innerHalfExtent = (waterSize / 2 - edgeRadius).toFixed(3);
  const prismTopLocalY = (realisticSeaPrismDepth / 2).toFixed(3);
  const shoulderHighlightThreshold = realisticSeaPrismShoulderHighlightThreshold.toFixed(2);
  const shoulderHighlightStrength = realisticSeaPrismShoulderHighlightStrength.toFixed(2);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWaterLocalPosition;\nvarying vec3 vWaterLocalNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWaterLocalPosition = position;\nvWaterLocalNormal = normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWaterLocalPosition;\nvarying vec3 vWaterLocalNormal;',
      )
      .replace(
        '#include <map_fragment>',
        [
          '#ifdef USE_MAP',
          `  float foldedDepth = max( 0.0, ${prismTopLocalY} - vWaterLocalPosition.y );`,
          `  vec2 waterTopCoordinates = vWaterLocalPosition.xz;`,
          '  vec3 waterNormal = normalize( vWaterLocalNormal );',
          '  vec2 radialDirection = waterTopCoordinates / max( length( waterTopCoordinates ), 0.0001 );',
          `  vec2 foldedCoordinates = radialDirection * ( ${innerHalfExtent} + foldedDepth );`,
          '  float topWeight = smoothstep( 0.0, 1.0, max( waterNormal.y, 0.0 ) );',
          '  vec2 waterCoordinates = mix( foldedCoordinates, waterTopCoordinates, topWeight );',
          `  vec4 sampledDiffuseColor = texture2D( map, waterCoordinates * ${triplanarScale} + vec2( 0.43, 0.23 ) );`,
          '  float shoulderHighlightSoftening = smoothstep( 0.15, 0.92, max( waterNormal.y, 0.0 ) );',
          '  float shoulderLuminance = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );',
          `  float shoulderHighlightScale = 1.0 / ( 1.0 + max( shoulderLuminance - ${shoulderHighlightThreshold}, 0.0 ) * ${shoulderHighlightStrength} );`,
          '  vec3 softenedShoulderColor = sampledDiffuseColor.rgb * shoulderHighlightScale;',
          '  sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, softenedShoulderColor, shoulderHighlightSoftening );',
          '  diffuseColor *= sampledDiffuseColor;',
          '#endif',
        ].join('\n'),
      );
  };
  material.customProgramCacheKey = () => 'open-sea-rounded-cylinder-folded-water-v1';
  material.needsUpdate = true;
  return {
    captureScene,
    captureCamera,
    captureWater,
    captureTarget,
    material,
  };
}

function applyRealisticSeaWaterEdgeBlend({ water, captureTexture, halfExtent, blendWidth }) {
  const capturedPatchWorldSize = 160;
  const captureScale = (1 / capturedPatchWorldSize).toFixed(8);
  const shoulderHighlightThreshold = realisticSeaPrismShoulderHighlightThreshold.toFixed(2);
  const shoulderHighlightStrength = realisticSeaPrismShoulderHighlightStrength.toFixed(2);
  water.material.uniforms.edgeWaterSampler = { value: captureTexture };
  water.material.uniforms.edgeWaterHalfExtent = { value: halfExtent };
  water.material.uniforms.edgeWaterBlendWidth = { value: blendWidth };
  water.material.vertexShader = water.material.vertexShader
    .replace(
      'varying vec4 worldPosition;',
      'varying vec4 worldPosition;\nvarying vec2 edgeWaterCoordinates;',
    )
    .replace(
      'worldPosition = mirrorCoord.xyzw;',
      'worldPosition = mirrorCoord.xyzw;\nedgeWaterCoordinates = vec2( position.x, -position.y );',
    );
  water.material.fragmentShader = water.material.fragmentShader
    .replace(
      'uniform vec3 waterColor;',
      'uniform vec3 waterColor;\nuniform sampler2D edgeWaterSampler;\nuniform float edgeWaterHalfExtent;\nuniform float edgeWaterBlendWidth;',
    )
    .replace(
      'varying vec4 worldPosition;',
      'varying vec4 worldPosition;\nvarying vec2 edgeWaterCoordinates;',
    )
    .replace(
      '#include <fog_fragment>',
      [
        '#include <fog_fragment>',
        'float edgeWaterDistance = edgeWaterHalfExtent - length( edgeWaterCoordinates );',
        'float edgeWaterBlendBase = 1.0 - smoothstep( 0.0, edgeWaterBlendWidth, max( edgeWaterDistance, 0.0 ) );',
        'float edgeWaterBlendSquared = edgeWaterBlendBase * edgeWaterBlendBase;',
        'float edgeWaterBlend = edgeWaterBlendSquared * edgeWaterBlendSquared;',
        'if ( edgeWaterBlend > 0.0 ) {',
        `  vec3 edgeWaterColor = texture2D( edgeWaterSampler, edgeWaterCoordinates * ${captureScale} + vec2( 0.43, 0.23 ) ).rgb;`,
        '  float edgeWaterLuminance = dot( edgeWaterColor, vec3( 0.2126, 0.7152, 0.0722 ) );',
        `  float edgeWaterHighlightScale = 1.0 / ( 1.0 + max( edgeWaterLuminance - ${shoulderHighlightThreshold}, 0.0 ) * ${shoulderHighlightStrength} );`,
        '  edgeWaterColor *= edgeWaterHighlightScale;',
        '  vec3 edgeWaterOutputColor = linearToOutputTexel( vec4( edgeWaterColor, 1.0 ) ).rgb;',
        '  gl_FragColor.rgb = mix( gl_FragColor.rgb, edgeWaterOutputColor, edgeWaterBlend );',
        '}',
      ].join('\n'),
    );
  water.material.needsUpdate = true;
}

function updateRealisticSeaPrismTexture(elapsedTime) {
  const waterCapture = realisticSeaPrism?.userData.realisticSeaPrism?.waterCapture;
  if (!waterCapture) return;
  waterCapture.captureWater.material.uniforms.time.value = elapsedTime;
  const previousRenderTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(waterCapture.captureTarget);
  renderer.clear();
  renderer.render(waterCapture.captureScene, waterCapture.captureCamera);
  renderer.setRenderTarget(previousRenderTarget);
}

function makeOpenSeaVideoInstallation({ centerX, centerZ, innerRadius, outerRadius, height, baseY, arcStart, arcEnd }) {
  const segmentCount = 112;
  const shape = new THREE.Shape();
  // ShapeGeometry is created in X/Y and rotated below so its local Y becomes
  // world Z. The sign keeps the footprint and the video edge geometry aligned.
  const pointOnArc = (radius, angle) => new THREE.Vector2(Math.cos(angle) * radius, -Math.sin(angle) * radius);

  shape.moveTo(...pointOnArc(outerRadius, arcStart).toArray());
  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = THREE.MathUtils.lerp(arcStart, arcEnd, index / segmentCount);
    shape.lineTo(...pointOnArc(outerRadius, angle).toArray());
  }
  shape.lineTo(...pointOnArc(innerRadius, arcEnd).toArray());
  for (let index = segmentCount - 1; index >= 0; index -= 1) {
    const angle = THREE.MathUtils.lerp(arcStart, arcEnd, index / segmentCount);
    shape.lineTo(...pointOnArc(innerRadius, angle).toArray());
  }
  shape.closePath();

  const blockGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    curveSegments: 8,
    // The video skins meet these faces directly. Removing the bevel prevents
    // a second set of near-coplanar slivers at every edge and end cap.
    bevelEnabled: false,
  });
  blockGeometry.rotateX(-Math.PI / 2);
  blockGeometry.computeVertexNormals();

  const block = new THREE.Mesh(blockGeometry, new THREE.MeshPhysicalMaterial({
    // Keep the structural block untextured. The video is rendered once on
    // each face below; mapping it here as well would create depth conflicts.
    color: state.openSeaMode === 'dawn' ? '#8696ac' : '#a7bcba',
    roughness: 0.42,
    metalness: 0.16,
    clearcoat: 0.36,
    clearcoatRoughness: 0.24,
    envMapIntensity: openSeaInstallationBlockEnvironmentIntensity,
    side: THREE.DoubleSide,
  }));
  block.castShadow = true;
  block.receiveShadow = true;

  // All skins must share the block's exact boundary vertices. Offsetting each
  // face along its own normal separates the caps from the curved walls.
  // The video material's polygonOffset handles depth separation instead.
  const installationSurfaceOffset = 0;
  // Run the curved video layers all the way into the end caps so the
  // structural material cannot show through at the joins.
  const installationEdgeAngleInset = 0;
  const topVideo = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), openSeaInstallationVideoMaterial());
  topVideo.geometry.rotateX(-Math.PI / 2);
  topVideo.position.y = height + installationSurfaceOffset;
  topVideo.renderOrder = 3;

  const bottomVideo = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), openSeaInstallationVideoMaterial());
  bottomVideo.geometry.rotateX(-Math.PI / 2);
  bottomVideo.position.y = -installationSurfaceOffset;
  bottomVideo.renderOrder = 3;

  const innerEdgeVideo = new THREE.Mesh(
    makeCurvedInstallationEdgeVideoGeometry(
      innerRadius - installationSurfaceOffset,
      height,
      arcStart + installationEdgeAngleInset,
      arcEnd - installationEdgeAngleInset,
      segmentCount,
    ),
    openSeaInstallationVideoMaterial(),
  );
  innerEdgeVideo.renderOrder = 3;

  const outerEdgeVideo = new THREE.Mesh(
    makeCurvedInstallationEdgeVideoGeometry(
      outerRadius + installationSurfaceOffset,
      height,
      arcStart + installationEdgeAngleInset,
      arcEnd - installationEdgeAngleInset,
      segmentCount,
    ),
    openSeaInstallationVideoMaterial(),
  );
  outerEdgeVideo.renderOrder = 3;

  const startCapVideo = new THREE.Mesh(
    makeInstallationEndVideoGeometry(
      innerRadius - installationSurfaceOffset,
      outerRadius + installationSurfaceOffset,
      height + installationSurfaceOffset * 2,
      arcStart,
      -1,
      installationSurfaceOffset,
    ),
    openSeaInstallationVideoMaterial(),
  );
  startCapVideo.position.y = -installationSurfaceOffset;
  startCapVideo.renderOrder = 3;

  const endCapVideo = new THREE.Mesh(
    makeInstallationEndVideoGeometry(
      innerRadius - installationSurfaceOffset,
      outerRadius + installationSurfaceOffset,
      height + installationSurfaceOffset * 2,
      arcEnd,
      1,
      installationSurfaceOffset,
    ),
    openSeaInstallationVideoMaterial(),
  );
  endCapVideo.position.y = -installationSurfaceOffset;
  endCapVideo.renderOrder = 3;

  const installation = new THREE.Group();
  installation.position.set(centerX, baseY, centerZ);
  installation.add(block, topVideo, bottomVideo, innerEdgeVideo, outerEdgeVideo, startCapVideo, endCapVideo);
  for (const face of [topVideo, bottomVideo, innerEdgeVideo, outerEdgeVideo, startCapVideo, endCapVideo]) {
    face.receiveShadow = state.openSeaMode === 'dawn';
  }
  return installation;
}

function openSeaInstallationVideoMaterial() {
  const isDawn = state.openSeaMode === 'dawn';
  const Material = isDawn ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
  const material = new Material({
    map: activeTexture,
    ...(isDawn ? {
      color: '#c1c5cc', roughness: 0.68, metalness: 0.05,
      emissive: '#ffffff', emissiveMap: activeTexture, emissiveIntensity: 0.08,
      envMapIntensity: 0.35,
    } : {}),
    side: THREE.DoubleSide,
    // The video is opaque, so keep depth writes enabled and avoid transparent
    // sorting. This makes each video face a single stable depth layer.
    transparent: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    toneMapped: isDawn,
    fog: true,
  });
  material.userData.openSeaVideoSurface = true;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );",
        `float fogFactor = (1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth )) * ${openSeaInstallationVideoFogStrength.toFixed(2)};`,
      )
      .replace(
        "float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );",
        `float fogFactor = smoothstep( fogNear, fogFar, vFogDepth ) * ${openSeaInstallationVideoFogStrength.toFixed(2)};`,
      );
  };
  return material;
}

function makeInstallationEndVideoGeometry(innerRadius, outerRadius, height, angle, offsetDirection, offset) {
  const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(offsetDirection * offset);
  const point = (radius, y) => [
    Math.cos(angle) * radius + tangent.x,
    y,
    Math.sin(angle) * radius + tangent.z,
  ];
  const positions = [
    ...point(innerRadius, 0),
    ...point(outerRadius, 0),
    ...point(outerRadius, height),
    ...point(innerRadius, height),
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCurvedInstallationEdgeVideoGeometry(radius, height, arcStart, arcEnd, segmentCount) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let row = 0; row <= 1; row += 1) {
    const y = row * height;
    for (let index = 0; index <= segmentCount; index += 1) {
      const progress = index / segmentCount;
      const angle = THREE.MathUtils.lerp(arcStart, arcEnd, progress);
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      uvs.push(progress, row);
    }
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const bottomLeft = index;
    const bottomRight = index + 1;
    const topLeft = segmentCount + 1 + index;
    const topRight = topLeft + 1;
    indices.push(bottomLeft, bottomRight, topRight, bottomLeft, topRight, topLeft);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function beachVideoMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: activeTexture },
      uMistColor: { value: new THREE.Color('#b5afd0') },
      uOpacity: { value: 0.42 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: true,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uMistColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 video = texture2D(uMap, vUv);
        vec2 centered = vUv - 0.5;
        float horizontalFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
        float verticalFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(0.0, 0.18, 1.0 - vUv.y);
        float centerDrift = sin(vUv.x * 7.0 + 0.8) * 0.035 + sin(vUv.x * 17.0) * 0.018;
        float bankEdge = 0.29 + sin(vUv.x * 11.0) * 0.055 + sin(vUv.x * 25.0 + 1.4) * 0.025;
        float veil = 1.0 - smoothstep(bankEdge - 0.12, bankEdge, abs(centered.y + centerDrift));
        float cloudNoise = sin(vUv.x * 43.0 + vUv.y * 19.0) * 0.04;
        veil *= smoothstep(-0.05, 0.12, veil + cloudNoise);
        float luma = dot(video.rgb, vec3(0.299, 0.587, 0.114));
        vec3 softened = mix(vec3(luma), video.rgb, 0.76);
        softened = mix(uMistColor, softened, 0.72);
        vec3 videoColor = min(softened * 0.82 + uMistColor * 0.12, vec3(0.78));
        float alpha = horizontalFade * verticalFade * veil * uOpacity * mix(0.84, 1.0, luma);
        gl_FragColor = vec4(videoColor, video.a * alpha);
      }
    `,
  });
}

function curvedBeachVideoMaterial(surfaceAspect) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: activeTexture },
      uSurfaceAspect: { value: surfaceAspect },
      uOpacity: { value: 0.94 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.FrontSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uSurfaceAspect;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        const float videoAspect = 16.0 / 9.0;
        vec2 videoUv = vUv;
        if (uSurfaceAspect > videoAspect) {
          videoUv.y = 0.5 + (vUv.y - 0.5) * videoAspect / uSurfaceAspect;
        } else {
          videoUv.x = 0.5 + (vUv.x - 0.5) * uSurfaceAspect / videoAspect;
        }

        vec4 video = texture2D(uMap, videoUv);
        float horizontalFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
        float verticalFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(0.0, 0.1, 1.0 - vUv.y);
        float edgeFade = horizontalFade * verticalFade;
        float luminance = dot(video.rgb, vec3(0.299, 0.587, 0.114));
        float projectionPresence = mix(0.78, 1.0, smoothstep(0.02, 0.38, luminance));
        gl_FragColor = vec4(video.rgb, video.a * edgeFade * uOpacity * projectionPresence);
      }
    `,
  });
}

function beachSunMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float distanceToCenter = distance(vUv, vec2(0.5));
        float core = 1.0 - smoothstep(0.0, 0.12, distanceToCenter);
        float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
        vec3 color = mix(vec3(1.0, 0.62, 0.34), vec3(1.0, 0.93, 0.72), core);
        gl_FragColor = vec4(color, core * 0.92 + halo * 0.22);
      }
    `,
  });
}

function makeBeachSandGeometry() {
  const xSegments = 600;
  const depthSegments = 140;
  const positions = [];
  const colors = [];
  const indices = [];
  const dryColor = new THREE.Color('#d4ae88');
  const lavenderColor = new THREE.Color('#bd9578');
  const wetColor = new THREE.Color('#a77d64');

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const depthRatio = depthIndex / depthSegments;
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const xRatio = xIndex / xSegments;
      const x = THREE.MathUtils.lerp(-beachHalfWidth, beachHalfWidth, xRatio);
      const shoreline = beachShorelineZ(x);
      const z = shoreline + beachLandDepth * Math.pow(depthRatio, 1.8);
      const largeDune = Math.sin(x * 0.045 + z * 0.029) * 0.14 + Math.sin(z * 0.085 - x * 0.015) * 0.08;
      const height = beachFloorHeight + largeDune * THREE.MathUtils.smoothstep(depthRatio, 0.05, 0.72);
      positions.push(x, height, z);

      const variation = 0.94 + Math.sin(x * 0.055 + z * 0.04) * 0.055 + Math.sin(z * 0.12 - x * 0.025) * 0.025;
      const color = wetColor.clone().lerp(dryColor, THREE.MathUtils.smoothstep(depthRatio, 0.015, 0.14));
      color.lerp(lavenderColor, THREE.MathUtils.smoothstep(depthRatio, 0.7, 1) * 0.18).multiplyScalar(variation);
      colors.push(color.r, color.g, color.b);

      if (xIndex < xSegments && depthIndex < depthSegments) {
        const cursor = depthIndex * (xSegments + 1) + xIndex;
        const nextRow = cursor + xSegments + 1;
        indices.push(cursor, nextRow, cursor + 1, cursor + 1, nextRow, nextRow + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function realisticBeachShorelineZ(x) {
  return Math.sin(x * 0.011) * 0.42 + Math.sin(x * 0.029 + 1.2) * 0.18;
}

function getProceduralSandNoise() {
  if (proceduralSandNoise) return proceduralSandNoise;
  proceduralSandNoise = {
    base: createPerlinNoise(0x1451),
    dunes: createPerlinNoise(0x2a71),
    secondaryDunes: createPerlinNoise(0x3c91),
    ridges: createPerlinNoise(0x4eb1),
    detail: createPerlinNoise(0x5fd1),
    microRipples: createPerlinNoise(0x71f1),
    sandGrains: createPerlinNoise(0x8311),
    color: createPerlinNoise(0x9431),
  };
  return proceduralSandNoise;
}

function createPerlinNoise(seed) {
  const gradients = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];
  const permutation = new Uint8Array(512);
  const values = Array.from({ length: 256 }, (_, index) => index);
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  for (let index = 0; index < permutation.length; index += 1) permutation[index] = values[index & 255];

  const fade = (value) => value * value * value * (value * (value * 6 - 15) + 10);
  const lerp = (start, end, amount) => start + amount * (end - start);
  const grad = (hash, x, y, z) => {
    const gradient = gradients[permutation[hash & 255] % gradients.length];
    return gradient[0] * x + gradient[1] * y + gradient[2] * z;
  };

  return {
    noise(x, y, z = 0) {
      const xFloor = Math.floor(x);
      const yFloor = Math.floor(y);
      const zFloor = Math.floor(z);
      const localX = x - xFloor;
      const localY = y - yFloor;
      const localZ = z - zFloor;
      const X = xFloor & 255;
      const Y = yFloor & 255;
      const Z = zFloor & 255;
      const u = fade(localX);
      const v = fade(localY);
      const w = fade(localZ);
      const A = permutation[X] + Y;
      const AA = permutation[A & 255] + Z;
      const AB = permutation[(A + 1) & 255] + Z;
      const B = permutation[(X + 1) & 255] + Y;
      const BA = permutation[B & 255] + Z;
      const BB = permutation[(B + 1) & 255] + Z;

      return lerp(
        lerp(
          lerp(grad(AA, localX, localY, localZ), grad(BA, localX - 1, localY, localZ), u),
          lerp(grad(AB, localX, localY - 1, localZ), grad(BB, localX - 1, localY - 1, localZ), u),
          v,
        ),
        lerp(
          lerp(grad(AA + 1, localX, localY, localZ - 1), grad(BA + 1, localX - 1, localY, localZ - 1), u),
          lerp(grad(AB + 1, localX, localY - 1, localZ - 1), grad(BB + 1, localX - 1, localY - 1, localZ - 1), u),
          v,
        ),
        w,
      );
    },
  };
}

function getProceduralSandTextures() {
  if (proceduralSandTextures) return proceduralSandTextures;
  const noise = getProceduralSandNoise();
  proceduralSandTextures = {
    normal: makeProceduralSandNormalMap(noise),
    roughness: makeProceduralSandRoughnessMap(noise),
  };
  return proceduralSandTextures;
}

function makeProceduralSandNormalMap(noise) {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const sampleHeight = (u, v) => {
    const windAngle = Math.PI * 0.25;
    const rotatedU = u * Math.cos(windAngle) + v * Math.sin(windAngle);
    const rotatedV = -u * Math.sin(windAngle) + v * Math.cos(windAngle);
    return noise.microRipples.noise(rotatedU * 26, rotatedV * 7) * 0.78
      + noise.detail.noise(rotatedU * 76, rotatedV * 24) * 0.16
      + noise.sandGrains.noise(u * 150, v * 150) * 0.06;
  };
  const step = 1 / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const dx = (sampleHeight(u + step, v) - sampleHeight(u - step, v)) * 1.7;
      const dy = (sampleHeight(u, v + step) - sampleHeight(u, v - step)) * 1.7;
      const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
      const offset = (y * size + x) * 4;
      data[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
      data[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      data[offset + 2] = Math.round(normal.z * 255);
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  return texture;
}

function makeProceduralSandRoughnessMap(noise) {
  const size = 256;
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const variation = noise.sandGrains.noise(u * 180, v * 180) * 7
        + noise.microRipples.noise(u * 32, v * 10) * 5;
      data[y * size + x] = THREE.MathUtils.clamp(Math.round(238 + variation), 224, 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.needsUpdate = true;
  return texture;
}

function makeRealisticBeachSandGeometry() {
  const xSegments = 260;
  const depthSegments = 150;
  const noise = getProceduralSandNoise();
  const windAngle = Math.PI * 0.25;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const dryColor = new THREE.Color('#e4c79e');
  const warmColor = new THREE.Color('#d2aa7e');
  const wetColor = new THREE.Color('#a28d7b');
  const shadowColor = new THREE.Color('#b27f5d');
  const highlightColor = new THREE.Color('#f3d7ad');

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const depthRatio = depthIndex / depthSegments;
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const xRatio = xIndex / xSegments;
      const x = THREE.MathUtils.lerp(-realisticBeachHalfWidth, realisticBeachHalfWidth, xRatio);
      const shoreline = realisticBeachShorelineZ(x);
      const z = shoreline + realisticBeachLandDepth * Math.pow(depthRatio, 1.55);
      const rotatedX = x * Math.cos(windAngle) + z * Math.sin(windAngle);
      const rotatedZ = -x * Math.sin(windAngle) + z * Math.cos(windAngle);
      const inlandBlend = THREE.MathUtils.smoothstep(depthRatio, 0.035, 0.72);
      const baseDune = noise.base.noise(x * 0.00024, z * 0.00024) * 0.12;
      const directionalDune = noise.dunes.noise(rotatedX * 0.00042, rotatedZ * 0.00018) * 0.42;
      const secondaryDune = noise.secondaryDunes.noise(rotatedX * 0.0009, rotatedZ * 0.00046) * 0.18;
      const softRidge = Math.pow(Math.abs(noise.ridges.noise(rotatedX * 0.0015, rotatedZ * 0.0007)), 1.35) * 0.08;
      const windRipple = noise.microRipples.noise(rotatedX * 0.008, rotatedZ * 0.032) * 0.05;
      const duneRelief = (baseDune + directionalDune + secondaryDune + softRidge + windRipple) * inlandBlend;
      const fineRipple = Math.sin(x * 0.032 + z * 0.021) * 0.035 + Math.sin(x * 0.095 - z * 0.014) * 0.018;
      const broadRipple = Math.sin(x * 0.006 - z * 0.004) * 0.045;
      positions.push(x, beachFloorHeight + duneRelief + fineRipple + broadRipple * inlandBlend, z);
      uvs.push(xRatio, depthRatio);

      const colorVariation = noise.color.noise(x * 0.00072, z * 0.00072);
      const grain = 0.98 + noise.sandGrains.noise(x * 0.024, z * 0.024) * 0.035;
      const color = wetColor.clone().lerp(warmColor, THREE.MathUtils.smoothstep(depthRatio, 0.015, 0.11));
      color.lerp(dryColor, THREE.MathUtils.smoothstep(depthRatio, 0.12, 0.34));
      if (colorVariation > 0) color.lerp(highlightColor, colorVariation * 0.16);
      else color.lerp(shadowColor, -colorVariation * 0.12);
      color.multiplyScalar(grain);
      colors.push(color.r, color.g, color.b);

      if (xIndex < xSegments && depthIndex < depthSegments) {
        const cursor = depthIndex * (xSegments + 1) + xIndex;
        const nextRow = cursor + xSegments + 1;
        indices.push(cursor, nextRow, cursor + 1, cursor + 1, nextRow, nextRow + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeRealisticTideWash() {
  const segments = 520;
  const depthSegments = 12;
  const positions = [];
  const uvs = [];
  const indices = [];
  const washDepth = 14;

  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const depthRatio = depthIndex / depthSegments;
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = THREE.MathUtils.lerp(-realisticBeachHalfWidth, realisticBeachHalfWidth, xIndex / segments);
      const z = realisticBeachShorelineZ(x) - washDepth * 0.42 + depthRatio * washDepth;
      positions.push(x, beachFloorHeight + 0.026 + Math.sin(x * 0.02) * 0.008, z);
      uvs.push(xIndex / segments, depthRatio);
      if (xIndex < segments && depthIndex < depthSegments) {
        const cursor = depthIndex * (segments + 1) + xIndex;
        const nextRow = cursor + segments + 1;
        indices.push(cursor, nextRow, cursor + 1, cursor + 1, nextRow, nextRow + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const wash = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.3 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        transformed.z += sin(position.x * 0.035 + uTime * 0.42) * 0.16 * sin(vUv.y * 3.14159265);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float across = sin(vUv.y * 3.14159265);
        float tideTexture = sin(vUv.x * 82.0 + uTime * 0.34) * 0.5 + 0.5;
        tideTexture *= sin(vUv.x * 181.0 - uTime * 0.21) * 0.5 + 0.5;
        vec3 washColor = mix(vec3(0.78, 0.88, 0.86), vec3(0.98, 0.88, 0.76), vUv.y);
        float alpha = across * mix(0.16, 0.5, tideTexture) * uOpacity;
        gl_FragColor = vec4(washColor, alpha);
      }
    `,
  }));
  wash.userData.beachTime = true;
  wash.userData.realisticTide = { phase: 0.8, amplitude: 0.9, speed: 0.16, baseZ: 0 };
  wash.renderOrder = 2;
  return wash;
}

function makeRealisticShorelineFoam({ offset, width, phase, opacity, amplitude, speed }) {
  const segments = 520;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const x = THREE.MathUtils.lerp(-realisticBeachHalfWidth, realisticBeachHalfWidth, ratio);
    const center = realisticBeachShorelineZ(x) + offset + Math.sin(x * 0.022 + phase) * 0.12;
    positions.push(x, beachFloorHeight + 0.062, center - width, x, beachFloorHeight + 0.062, center + width);
    uvs.push(ratio, 0, ratio, 1);
    if (index < segments) {
      const cursor = index * 2;
      indices.push(cursor, cursor + 1, cursor + 2, cursor + 1, cursor + 3, cursor + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const foam = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phase },
      uOpacity: { value: opacity },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 transformed = position;
        transformed.z += sin(position.x * 0.04 + uTime * 0.5 + uPhase) * 0.1 * sin(vUv.y * 3.14159265);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float across = sin(vUv.y * 3.14159265);
        float broadBreak = sin(vUv.x * 74.0 + uPhase * 3.0 + uTime * 0.24) * 0.5 + 0.5;
        float fineBreak = sin(vUv.x * 193.0 - uPhase * 1.7 - uTime * 0.38) * 0.5 + 0.5;
        float broken = smoothstep(0.2, 0.68, broadBreak * 0.72 + fineBreak * 0.28);
        float alpha = across * mix(0.22, 1.0, broken) * uOpacity;
        vec3 foamColor = mix(vec3(0.92, 0.97, 0.96), vec3(1.0, 0.88, 0.76), 0.16);
        gl_FragColor = vec4(foamColor, alpha);
      }
    `,
  }));
  foam.userData.beachTime = true;
  foam.userData.realisticTide = { phase, amplitude, speed, baseZ: 0 };
  foam.renderOrder = 3;
  return foam;
}

function makeWetSandBand() {
  const segments = 1800;
  const positions = [];
  const indices = [];
  const width = 5.6;
  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const x = THREE.MathUtils.lerp(-beachHalfWidth, beachHalfWidth, ratio);
    const center = beachShorelineZ(x) + 1.6;
    positions.push(x, -0.49, center - width, x, -0.49, center + width);
    if (index < segments) {
      const cursor = index * 2;
      indices.push(cursor, cursor + 1, cursor + 2, cursor + 1, cursor + 3, cursor + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
     color: '#9d7660',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
}

function addSunReflectionPath(centerX) {
  const group = new THREE.Group();
  const reflectionGeometry = new THREE.PlaneGeometry(1, 1);
  for (let index = 0; index < 34; index += 1) {
    const progress = index / 33;
    const z = THREE.MathUtils.lerp(-112, -4, Math.pow(progress, 1.08));
    const width = THREE.MathUtils.lerp(0.45, 6.2, progress) * THREE.MathUtils.randFloat(0.62, 1.18);
    const reflection = new THREE.Mesh(
      reflectionGeometry,
      new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? '#fff1d5' : '#ffb7ce',
        transparent: true,
        opacity: THREE.MathUtils.randFloat(0.26, 0.68),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    reflection.rotation.x = -Math.PI / 2;
    const perspectiveX = THREE.MathUtils.lerp(centerX, 0, progress);
    reflection.position.set(perspectiveX + THREE.MathUtils.randFloatSpread(1.2 + progress * 3.2), -0.36, z);
    reflection.scale.set(width, THREE.MathUtils.randFloat(0.06, 0.22), 1);
    reflection.renderOrder = 5;
    reflection.userData.beachReflection = {
      phase: Math.random() * Math.PI * 2,
      baseOpacity: reflection.material.opacity,
      baseScaleX: width,
    };
    group.add(reflection);
  }
  addToStage(group);
}

function addOpenSeaStars() {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const starPalette = [
    new THREE.Color('#fff8e9'),
    new THREE.Color('#d8e8ff'),
    new THREE.Color('#f1d9ff'),
  ];
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = THREE.MathUtils.randFloatSpread(5200);
    positions[index * 3 + 1] = THREE.MathUtils.randFloat(18, 520);
    positions[index * 3 + 2] = THREE.MathUtils.randFloat(-5200, 1400);
    const color = starPalette[index % starPalette.length];
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    vertexColors: true,
    size: 0.22,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  stars.renderOrder = 1;
  stars.userData.openSeaStars = { baseOpacity: 0.88, phase: Math.random() * Math.PI * 2 };
  addToStage(stars);
}

function suppressSkySunDisk(sky) {
  const sunDiskSource = 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk;';
  if (!sky.material.fragmentShader.includes(sunDiskSource)) return;
  sky.material.fragmentShader = sky.material.fragmentShader.replace(sunDiskSource, 'L0 += vec3(0.0);');
  sky.material.needsUpdate = true;
}

function makeOpenSeaSky(atmosphere, sunDirection) {
  if (atmosphere === openSeaAtmospheres.dawn) {
    const volumetric = new URLSearchParams(window.location.search).get('clouds') !== 'flat';
    if (volumetric && !openSeaCloudVolume) {
      const requestedQuality = new URLSearchParams(window.location.search).get('cloud-quality');
      const quality = ['low', 'reference'].includes(requestedQuality) ? requestedQuality : 'high';
      openSeaCloudVolume = createCloudVolume(sunDirection, openSeaSkyTime, { quality });
      openSeaCloudVolume.update(renderer, camera, true);
    }
    return makeDawnSky(sunDirection, openSeaSkyTime, { cloudVolume: openSeaCloudVolume, viewCamera: camera });
  }
  const sky = new Sky();
  sky.scale.setScalar(10000);
  for (const [key, value] of Object.entries(atmosphere.sky)) {
    sky.material.uniforms[key].value = value;
  }
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  suppressSkySunDisk(sky);
  return sky;
}

function tuneDawnWater(water, atmosphere) {
  naturalizeWater(water);
  if (atmosphere !== openSeaAtmospheres.dawn) return;
  water.material.uniforms.size.value = 7.0;
  water.material.uniforms.sunColor.value.multiplyScalar(1.6);
  // Shadow only direct solar illumination. Reflected sky and water scatter
  // remain visible in shade; never add unshadowed glints behind an occluder.
  water.material.fragmentShader = water.material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.02;')
    .replace(
      'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);',
      'float solarVisibility = getShadowMask();\nvec3 albedo = mix( scatter + diffuseLight * 0.3 * solarVisibility, reflectionSample, reflectance);',
    )
    .replace('vec3 outgoingLight = albedo;',
      'vec3 outgoingLight = albedo + specularLight * 0.65 * solarVisibility;');
}

function addBeachStars() {
  const count = 72;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = THREE.MathUtils.randFloatSpread(250);
    positions[index * 3 + 1] = THREE.MathUtils.randFloat(13, 78);
    positions[index * 3 + 2] = THREE.MathUtils.randFloat(-185, -145);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#fff0da',
    size: 0.16,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  stars.renderOrder = 1;
  addToStage(stars);
}

function addButterflyGroundGlow() {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 5.5),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.2 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float glow = 1.0 - smoothstep(0.0, 0.5, distance(vUv, vec2(0.5)));
          gl_FragColor = vec4(1.0, 0.78, 0.72, glow * uOpacity);
        }
      `,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.35;
  glow.userData.butterflyGroundGlow = true;
  glow.renderOrder = 5;
  addToStage(glow);
}

function makeShorelineFoam(offset, phase) {
  const segments = 1800;
  const width = 0.58 + phase * 0.05;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const x = THREE.MathUtils.lerp(-beachHalfWidth, beachHalfWidth, ratio);
    const z = beachShorelineZ(x) + offset + Math.sin(x * 0.045 + phase) * 0.16;
    positions.push(x, -0.43 + phase * 0.004, z - width, x, -0.43 + phase * 0.004, z + width);
    uvs.push(ratio, 0, ratio, 1);
    if (index < segments) {
      const cursor = index * 2;
      indices.push(cursor, cursor + 1, cursor + 2, cursor + 1, cursor + 3, cursor + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const foam = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phase },
      uOpacity: { value: 0.34 + phase * 0.02 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float across = sin(vUv.y * 3.14159265);
        float broken = sin(vUv.x * 91.0 + uPhase * 4.0 + uTime * 0.24) * 0.5 + 0.5;
        broken *= sin(vUv.x * 37.0 - uPhase * 2.0 - uTime * 0.15) * 0.5 + 0.5;
        broken = smoothstep(0.14, 0.62, broken);
        float wisps = 0.55 + sin(vUv.x * 173.0 + uTime * 0.38) * 0.2;
        float alpha = across * mix(wisps, 1.0, broken) * uOpacity;
        gl_FragColor = vec4(0.965, 0.918, 0.949, alpha);
      }
    `,
  }));
  foam.userData.beachFoam = { phase, baseOpacity: 0.34 + phase * 0.02 };
  foam.userData.beachTime = true;
  return foam;
}

function addBeachClouds() {
  const cloudShape = new THREE.Shape();
  cloudShape.moveTo(-3.8, -0.45);
  cloudShape.quadraticCurveTo(-3.2, 0.05, -2.35, 0.02);
  cloudShape.quadraticCurveTo(-1.95, 1.05, -0.85, 0.76);
  cloudShape.quadraticCurveTo(-0.12, 1.78, 1.02, 0.78);
  cloudShape.quadraticCurveTo(2.0, 1.12, 2.48, 0.22);
  cloudShape.quadraticCurveTo(3.35, 0.18, 3.9, -0.45);
  cloudShape.lineTo(-3.8, -0.45);
  const cloudGeometry = new THREE.ShapeGeometry(cloudShape, 5);
  const cloudPositions = [
    [-61, 30, -142, 3.2], [-22, 38, -165, 2.25], [37, 30, -151, 3.0], [69, 24, -133, 2.05],
  ];
  cloudPositions.forEach(([x, y, z, scale], cloudIndex) => {
    const cloud = new THREE.Group();
    const lower = new THREE.Mesh(cloudGeometry, new THREE.MeshBasicMaterial({ color: '#a87972', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    lower.position.set(0, -0.18, 0.08);
    lower.scale.set(1.04, 0.78, 1);
    cloud.add(lower);
    const upper = new THREE.Mesh(cloudGeometry, new THREE.MeshBasicMaterial({ color: '#d9a17e', transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }));
    upper.scale.set(1, 0.72, 1);
    cloud.add(upper);
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(scale);
    cloud.userData.beachCloud = { baseX: x, phase: cloudIndex * 1.4 };
    addToStage(cloud);
  });
}

function addBeachDetails() {
  const shellMaterial = new THREE.MeshStandardMaterial({ color: '#d5a5c1', roughness: 0.78, flatShading: true });
  [[-5, 0.02, 18], [12, -0.03, 34], [-15, 0.01, 39], [4, -0.04, 24]].forEach(([x, y, z], index) => {
    const shell = new THREE.Mesh(new THREE.ConeGeometry(0.28 + index * 0.035, 0.32, 7), shellMaterial.clone());
    shell.position.set(x, y, z);
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = index * 1.2;
    addToStage(shell);
  });
}

function makePalmLeafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1.9, 0.18, 0.58, 4.2, -0.68, 0,
    0, 0, 0, 4.2, -0.68, 0, 1.9, 0.18, -0.58,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addBeachVegetation() {
  const leafGeometry = makePalmLeafGeometry();
  const material = new THREE.MeshBasicMaterial({ color: '#272b69', side: THREE.DoubleSide });
  [[-8.4, -0.18, 6.2, 1.0]].forEach(([x, y, z, scale], groupIndex) => {
    const plant = new THREE.Group();
    for (let index = 0; index < 7; index += 1) {
      const leaf = new THREE.Mesh(leafGeometry, material);
      leaf.rotation.y = (index / 7) * Math.PI * 2 + groupIndex * 0.4;
      leaf.rotation.z = 0.62 + (index % 2) * 0.2;
      leaf.scale.setScalar(scale * THREE.MathUtils.lerp(0.62, 1.0, index / 6));
      plant.add(leaf);
    }
    plant.position.set(x, y, z);
    plant.userData.beachPlant = { phase: groupIndex * 2.1 };
    addToStage(plant);
  });

  const petalMaterial = new THREE.MeshBasicMaterial({ color: '#b65d9d', side: THREE.DoubleSide });
  const petals = new THREE.Group();
  for (let index = 0; index < 10; index += 1) {
    const petal = new THREE.Mesh(leafGeometry, petalMaterial);
    petal.scale.setScalar(0.28 + (index % 4) * 0.075);
    petal.rotation.y = -0.8 + index * 0.27;
    petal.rotation.z = 0.88 + (index % 2) * 0.24;
    petal.position.set((index % 3) * 0.24, index * 0.18, -index * 0.045);
    petals.add(petal);
  }
  petals.position.set(-5.9, 0.42, 6.7);
  petals.userData.beachPlant = { phase: 1.25 };
  addToStage(petals);
}

function buildLuminousScene() {
  luminousBubbleBodies = [];
  world.background.set('#dfd1e7');
  world.fog.color.set('#dfd1e7');
  world.fog.density = 0.005;

  const pearlMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWarm: { value: new THREE.Color('#efd5e1') },
      uLilac: { value: new THREE.Color('#cbbce9') },
      uAqua: { value: new THREE.Color('#badfdd') },
    },
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uWarm;
      uniform vec3 uLilac;
      uniform vec3 uAqua;
      varying vec3 vLocalPosition;

      void main() {
        vec3 direction = normalize(vLocalPosition);
        float vertical = direction.y * 0.5 + 0.5;
        float pearlWave = sin(direction.x * 7.0 + direction.z * 5.0 + uTime * 0.08) * 0.5 + 0.5;
        float softBand = smoothstep(0.1, 0.9, pearlWave) * (1.0 - abs(direction.y) * 0.45);
        vec3 color = mix(uLilac, uWarm, smoothstep(0.12, 0.9, vertical));
        color = mix(color, uAqua, softBand * 0.2);
        color += pow(max(direction.y, 0.0), 5.0) * 0.055;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    toneMapped: false,
  });
  const pearlShell = new THREE.Mesh(new THREE.SphereGeometry(78, 72, 48), pearlMaterial);
  pearlShell.userData.luminousTime = true;
  addToStage(pearlShell);

  addLuminousBubbleField();
  addLuminousCrescent(new THREE.Vector3(-17, 8, -31), new THREE.Euler(0.4, -0.25, 0.72), 1.05, '#ffc06e', 0.4);
  addLuminousCrescent(new THREE.Vector3(20, -6, -30), new THREE.Euler(-0.2, 0.7, -0.45), 0.72, '#79dfde', 2.1);
  addLuminousCrescent(new THREE.Vector3(-24, -9, -44), new THREE.Euler(0.65, 0.35, 1.1), 1.3, '#ee8bd0', 4.2);

  const videoPositions = [
    [-10, 5, -15, 3.4],
    [10, 3, -18, 4.1],
    [0, 13, -29, 5.4],
    [-16, -5, -22, 2.8],
    [16, -4, -27, 3.2],
    [3, -8, -12, 2.25],
  ];
  const shellColors = ['#ff9acb', '#73dfe7', '#b89af4', '#ffd071', '#7fe0b5', '#ee8ff0'];
  videoPositions.forEach(([x, y, z, radius], index) => {
    const bubble = new THREE.Group();
    const videoOrb = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), materialForVideo(THREE.FrontSide, 1));
    bubble.add(videoOrb);

    const membrane = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.035, 48, 32),
      new THREE.MeshPhysicalMaterial({
        color: shellColors[index],
        emissive: shellColors[index],
        emissiveIntensity: 0.12,
        roughness: 0.08,
        metalness: 0,
        transmission: 0.38,
        thickness: 1.25,
        ior: 1.32,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        iridescence: 0.85,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    bubble.add(membrane);

    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: luminousGlowTexture,
      color: shellColors[index],
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    aura.scale.set(radius * 3.3, radius * 3.3, 1);
    bubble.add(aura);

    bubble.position.set(x, y, z);
    bubble.rotation.set(index * 0.18, index * 0.63, index * 0.11);
    luminousBubbleBodies.push({
      kind: 'object',
      object: bubble,
      position: bubble.position.clone(),
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(0.28),
        THREE.MathUtils.randFloatSpread(0.2),
        THREE.MathUtils.randFloatSpread(0.28),
      ),
      radius,
      mass: Math.max(1, radius ** 2.35),
      phase: index * 1.23,
      speed: 0.24 + index * 0.018,
      rotation: bubble.rotation.clone(),
      angularVelocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(0.035),
        THREE.MathUtils.randFloatSpread(0.04),
        THREE.MathUtils.randFloatSpread(0.025),
      ),
    });
    addToStage(bubble);
  });

  addLuminousDust(220);
  [[-18, 12, -18, '#ffacd9'], [17, 8, -22, '#8ee9e5'], [0, -4, -10, '#d8b5ff']].forEach(([x, y, z, color]) => {
    const light = new THREE.PointLight(color, 1.8, 34, 1.8);
    light.position.set(x, y, z);
    addToStage(light);
  });
}

function addLuminousBubbleField() {
  const colors = ['#ff7ebc', '#75dce4', '#8fd8ad', '#ffc45f', '#ad8eea', '#ec87e6'];
  const geometry = new THREE.SphereGeometry(1, 24, 18);
  colors.forEach((color, colorIndex) => {
    const count = 16;
    const material = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.055,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.32,
      sheen: 0.28,
      sheenColor: new THREE.Color('#ffffff'),
    });
    const bubbles = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();

    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radialDistance = THREE.MathUtils.randFloat(9, 39);
      const position = new THREE.Vector3(
        Math.cos(angle) * radialDistance,
        THREE.MathUtils.randFloat(-22, 24),
        THREE.MathUtils.randFloat(-50, 16),
      );
      const scale = THREE.MathUtils.randFloat(0.22, colorIndex % 2 ? 1.8 : 2.45);
      const phase = Math.random() * Math.PI * 2;
      const speed = THREE.MathUtils.randFloat(0.16, 0.34);
      dummy.position.copy(position);
      dummy.scale.setScalar(scale);
      dummy.rotation.set(phase * 0.1, phase, phase * 0.05);
      dummy.updateMatrix();
      bubbles.setMatrixAt(index, dummy.matrix);
      luminousBubbleBodies.push({
        kind: 'instance',
        object: bubbles,
        index,
        position,
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.34),
          THREE.MathUtils.randFloatSpread(0.24),
          THREE.MathUtils.randFloatSpread(0.34),
        ),
        radius: scale,
        mass: Math.max(0.18, scale ** 2.35),
        phase,
        speed,
        rotation: new THREE.Euler(phase * 0.1, phase, phase * 0.05),
        angularVelocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.08),
          THREE.MathUtils.randFloatSpread(0.1),
          THREE.MathUtils.randFloatSpread(0.06),
        ),
      });
    }
    bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    addToStage(bubbles);
  });
}

function addLuminousCrescent(position, rotation, scale, color, phase) {
  const crescent = new THREE.Group();
  const arc = Math.PI * 1.34;
  const radius = 5.6;
  const tube = 1.15;
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.13,
    roughness: 0.09,
    transmission: 0.76,
    thickness: 2.2,
    ior: 1.34,
    clearcoat: 1,
    iridescence: 0.8,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  crescent.add(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 28, 112, arc), material));
  [[radius, 0], [Math.cos(arc) * radius, Math.sin(arc) * radius]].forEach(([x, y]) => {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(tube, 28, 20), material);
    cap.position.set(x, y, 0);
    crescent.add(cap);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: luminousGlowTexture,
    color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.scale.set(18, 18, 1);
  crescent.add(glow);
  crescent.position.copy(position);
  crescent.rotation.copy(rotation);
  crescent.scale.setScalar(scale);
  crescent.userData.luminousFloat = {
    basePosition: position.clone(),
    baseRotation: rotation.clone(),
    phase,
    speed: 0.14,
    amplitude: 0.72,
    spin: 0.012,
  };
  addToStage(crescent);
}

function addLuminousDust(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const amplitudes = new Float32Array(count);
  const palette = ['#ffafd8', '#91e7e1', '#ffe0a1', '#c7a8fa'];
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = THREE.MathUtils.randFloatSpread(68);
    positions[index * 3 + 1] = THREE.MathUtils.randFloat(-24, 26);
    positions[index * 3 + 2] = THREE.MathUtils.randFloat(-52, 18);
    const color = new THREE.Color(palette[index % palette.length]);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    phases[index] = Math.random() * Math.PI * 2;
    speeds[index] = THREE.MathUtils.randFloat(0.18, 0.42);
    amplitudes[index] = THREE.MathUtils.randFloat(0.18, 0.7);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.11,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  }));
  dust.userData.luminousDust = { basePositions: positions.slice(), phases, speeds, amplitudes };
  addToStage(dust);
}

function buildCubeScene() {
  world.background.set('#0c1422');
  world.fog.color.set('#0c1422');
  world.fog.density = 0.008;

  const cubeSize = cubeHalfExtent * 2;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize), materialForVideo(THREE.BackSide, 0.94, true));
  addToStage(cube);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)),
    new THREE.LineBasicMaterial({ color: '#b8dfff', transparent: true, opacity: 0.16 }),
  );
  addToStage(edges);
  addFramedGlow(new THREE.Vector3(0, cubeHalfExtent - 1, 0), '#b8e8ff');
  addGlowParticles(260, '#9dc7ff', cubeHalfExtent * 2 - 8, true);
}

function buildCylinderScene() {
  world.background.set('#10192a');
  world.fog.color.set('#10192a');
  world.fog.density = 0.008;

  const cylinderHeight = cylinderHalfHeight * 2;
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 128, 1, false),
    materialForVideo(THREE.BackSide, 0.94, true),
  );
  addToStage(cylinder);

  addCylinderSeamLights(2, cylinderHeight - 0.4);
  addCylinderBaseLights();
  addFramedGlow(new THREE.Vector3(0, cylinderHalfHeight - 1, 0), '#b8e8ff');
  addGlowParticles(360, '#9dc7ff', cylinderHeight - 8, true, 'cylinder');
}

function buildCinemaScene(useYouTubeScreen = false) {
  world.background.set('#000000');
  world.fog.color.set('#000000');
  world.fog.density = 0.015;

  const room = new THREE.Group();
  const wallMaterial = new THREE.MeshStandardMaterial({ color: '#09070b', roughness: 0.96, metalness: 0.01 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: '#030204', roughness: 0.98 });
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#11070e', roughness: 0.92, metalness: 0.01 });
  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#140b17', roughness: 0.9 });
  const velvetMaterial = new THREE.MeshStandardMaterial({ color: '#260a1a', roughness: 0.98 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#030204', roughness: 0.36, metalness: 0.5 });
  const stairEdgeMaterial = new THREE.MeshStandardMaterial({ color: '#17131b', roughness: 0.32, metalness: 0.58 });

  const addBox = (width, height, depth, x, y, z, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    room.add(mesh);
    return mesh;
  };

  addBox(cinemaHalfWidth * 2 + 0.8, 0.32, cinemaHalfDepth * 2 + 0.8, 0, cinemaFloor - 0.16, 0, floorMaterial);
  addBox(cinemaHalfWidth * 2 + 0.8, 0.36, cinemaHalfDepth * 2 + 0.8, 0, cinemaCeiling + 0.18, 0, ceilingMaterial);
  addBox(0.42, cinemaCeiling - cinemaFloor, cinemaHalfDepth * 2 + 0.8, -cinemaHalfWidth - 0.21, (cinemaCeiling + cinemaFloor) / 2, 0, wallMaterial);
  addBox(0.42, cinemaCeiling - cinemaFloor, cinemaHalfDepth * 2 + 0.8, cinemaHalfWidth + 0.21, (cinemaCeiling + cinemaFloor) / 2, 0, wallMaterial);
  addBox(cinemaHalfWidth * 2 + 0.8, cinemaCeiling - cinemaFloor, 0.42, 0, (cinemaCeiling + cinemaFloor) / 2, -cinemaHalfDepth - 0.21, wallMaterial);
  addBox(cinemaHalfWidth * 2 + 0.8, cinemaCeiling - cinemaFloor, 0.42, 0, (cinemaCeiling + cinemaFloor) / 2, cinemaHalfDepth + 0.21, wallMaterial);

  [-15, -8, -1, 6, 13, 20].forEach((z) => {
    [-1, 1].forEach((side) => {
      const panel = addBox(0.18, 5.6, 4.8, side * (cinemaHalfWidth - 0.08), 4.7, z, panelMaterial);
      panel.rotation.y = side * 0.018;
    });
  });

  const aisleHalfWidth = cinemaAisleWidth / 2;
  const sideMargin = 0.65;
  const seatingPlatformWidth = cinemaHalfWidth - aisleHalfWidth - sideMargin;
  const seatingPlatformX = aisleHalfWidth + seatingPlatformWidth / 2;
  for (let tier = 1; tier < cinemaRowPositions.length; tier += 1) {
    const tierFront = (cinemaRowPositions[tier - 1] + cinemaRowPositions[tier]) / 2;
    const tierDepth = cinemaHalfDepth - tierFront - 0.45;
    const tierHeight = tier * cinemaTierRise;
    [-1, 1].forEach((side) => {
      addBox(
        seatingPlatformWidth,
        tierHeight,
        tierDepth,
        side * seatingPlatformX,
        cinemaFloor + tierHeight / 2,
        tierFront + tierDepth / 2,
        floorMaterial,
      );
    });

    const transitionCenter = tierFront;
    const transitionLength = 3;
    const stepDepth = transitionLength / cinemaStepsPerTier;
    const transitionStart = transitionCenter - transitionLength / 2;
    for (let step = 1; step <= cinemaStepsPerTier; step += 1) {
      const stairFront = transitionStart + (step - 1) * stepDepth;
      const stairHeight = (tier - 1) * cinemaTierRise + step * cinemaTierRise / cinemaStepsPerTier;
      const stairDepth = cinemaHalfDepth - stairFront - 0.45;
      addBox(
        cinemaAisleWidth,
        stairHeight,
        stairDepth,
        0,
        cinemaFloor + stairHeight / 2,
        stairFront + stairDepth / 2,
        velvetMaterial,
      );
      addBox(
        cinemaAisleWidth + 0.12,
        0.035,
        0.12,
        0,
        cinemaFloor + stairHeight + 0.018,
        stairFront + 0.06,
        stairEdgeMaterial,
      );
    }
  }

  const screen = useYouTubeScreen
    ? new THREE.Mesh(new THREE.PlaneGeometry(cinemaScreenWidth, cinemaScreenHeight), new THREE.MeshBasicMaterial({ color: '#020204', toneMapped: false }))
    : videoPlane(cinemaScreenWidth, cinemaScreenHeight);
  screen.material.depthWrite = false;
  screen.position.set(0, cinemaScreenCenterY, -cinemaHalfDepth + 0.28);
  screen.renderOrder = 2;
  room.add(screen);
  const screenFrameThickness = 0.42;
  const screenFrameDepth = 0.3;
  const screenFrameHalfWidth = cinemaScreenWidth / 2 + screenFrameThickness * 0.62;
  const screenFrameHalfHeight = cinemaScreenHeight / 2 + screenFrameThickness * 0.62;
  addBox(cinemaScreenWidth + screenFrameThickness * 2, screenFrameThickness, screenFrameDepth, 0, cinemaScreenCenterY + screenFrameHalfHeight, -cinemaHalfDepth + 0.35, frameMaterial);
  addBox(cinemaScreenWidth + screenFrameThickness * 2, screenFrameThickness, screenFrameDepth, 0, cinemaScreenCenterY - screenFrameHalfHeight, -cinemaHalfDepth + 0.35, frameMaterial);
  addBox(screenFrameThickness, cinemaScreenHeight + screenFrameThickness * 2, screenFrameDepth, -screenFrameHalfWidth, cinemaScreenCenterY, -cinemaHalfDepth + 0.35, frameMaterial);
  addBox(screenFrameThickness, cinemaScreenHeight + screenFrameThickness * 2, screenFrameDepth, screenFrameHalfWidth, cinemaScreenCenterY, -cinemaHalfDepth + 0.35, frameMaterial);

  const curtainX = cinemaScreenWidth / 2 + 1.35;
  const curtainHeight = cinemaScreenHeight + 1.7;
  addBox(2.35, curtainHeight, 0.56, -curtainX, cinemaScreenCenterY, -cinemaHalfDepth + 0.62, velvetMaterial);
  addBox(2.35, curtainHeight, 0.56, curtainX, cinemaScreenCenterY, -cinemaHalfDepth + 0.62, velvetMaterial);
  addBox(cinemaScreenWidth + 5.1, 1.15, 0.62, 0, cinemaScreenCenterY + cinemaScreenHeight / 2 + 1, -cinemaHalfDepth + 0.66, velvetMaterial);
  [-0.66, 0, 0.66].forEach((offset) => {
    [-1, 1].forEach((side) => {
      const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, curtainHeight - 0.35, 14), velvetMaterial);
      fold.position.set(side * curtainX + offset, cinemaScreenCenterY, -cinemaHalfDepth + 0.9);
      room.add(fold);
    });
  });

  const chairMaterial = new THREE.MeshStandardMaterial({ color: '#210816', roughness: 0.9 });
  const chairTrimMaterial = new THREE.MeshStandardMaterial({ color: '#120a12', roughness: 0.58, metalness: 0.28 });
  cinemaRowPositions.forEach((z, rowIndex) => {
    cinemaChairXPositions.forEach((x) => {
      room.add(createCinemaChair(x, cinemaFloor + rowIndex * cinemaTierRise, z, chairMaterial, chairTrimMaterial));
    });
  });

  const projectorMaterial = new THREE.MeshStandardMaterial({ color: '#15121a', roughness: 0.5, metalness: 0.48 });
  const lensMaterial = new THREE.MeshStandardMaterial({ color: '#08080b', roughness: 0.24, metalness: 0.62 });
  const projectorY = cinemaCeiling - 1.55;
  const projectorZ = cinemaHalfDepth - 3.35;
  addBox(2.8, 0.92, 2.1, 0, projectorY, projectorZ, projectorMaterial);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.34, 24), lensMaterial);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, projectorY - 0.03, projectorZ - 1.18);
  room.add(lens);

  const screenAreaLight = new THREE.RectAreaLight('#ffffff', 0, cinemaScreenWidth * 0.94, cinemaScreenHeight * 0.9);
  screenAreaLight.position.set(0, cinemaScreenCenterY, -cinemaHalfDepth + 0.58);
  screenAreaLight.rotation.y = Math.PI;
  screenAreaLight.layers.enable(1);
  screenAreaLight.userData.cinemaProjectionLight = { zone: -1, maximumIntensity: 48 };
  room.add(screenAreaLight);

  [-cinemaScreenWidth * 0.3, 0, cinemaScreenWidth * 0.3].forEach((x, zone) => {
    const screenSpill = new THREE.SpotLight('#ffffff', 0, 58, 0.78, 0.97, 1.35);
    screenSpill.position.set(x, cinemaScreenCenterY, -cinemaHalfDepth + 0.72);
    screenSpill.target.position.set(x * 0.34, 0.45, 10.5);
    screenSpill.castShadow = zone === 1;
    if (screenSpill.castShadow) {
      screenSpill.shadow.mapSize.set(1024, 1024);
      screenSpill.shadow.bias = -0.0004;
    }
    screenSpill.layers.enable(1);
    screenSpill.userData.cinemaProjectionLight = { zone, maximumIntensity: 520 };
    room.add(screenSpill, screenSpill.target);
  });

  addToStage(room);
}

function getCinemaFloorHeightAt(x, z) {
  if (Math.abs(x) > cinemaAisleWidth / 2) {
    let tier = 0;
    for (let index = 1; index < cinemaRowPositions.length; index += 1) {
      const tierFront = (cinemaRowPositions[index - 1] + cinemaRowPositions[index]) / 2;
      if (z >= tierFront) tier = index;
      else break;
    }
    return cinemaFloor + tier * cinemaTierRise;
  }

  let aisleHeight = 0;
  const transitionLength = 3;
  for (let tier = 1; tier < cinemaRowPositions.length; tier += 1) {
    const transitionCenter = (cinemaRowPositions[tier - 1] + cinemaRowPositions[tier]) / 2;
    const transitionStart = transitionCenter - transitionLength / 2;
    if (z <= transitionStart) continue;
    const transitionProgress = THREE.MathUtils.clamp((z - transitionStart) / transitionLength, 0, 1);
    const completedSteps = Math.ceil(transitionProgress * cinemaStepsPerTier);
    aisleHeight = Math.max(
      aisleHeight,
      (tier - 1) * cinemaTierRise + completedSteps * cinemaTierRise / cinemaStepsPerTier,
    );
  }
  return cinemaFloor + aisleHeight;
}

function createCinemaChair(x, floorY, z, upholsteryMaterial, trimMaterial) {
  const chair = new THREE.Group();
  chair.position.set(x, floorY, z);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.42, 1.62), upholsteryMaterial);
  seat.position.set(0, 0.66, 0);
  seat.castShadow = true;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.02, 1.72, 0.44), upholsteryMaterial);
  back.position.set(0, 1.58, 0.6);
  back.rotation.x = -0.08;
  back.castShadow = true;
  chair.add(back);

  [-1.08, 1.08].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 1.68), trimMaterial);
    arm.position.set(side, 0.94, 0.04);
    chair.add(arm);
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.2), trimMaterial);
    support.position.set(side, 0.46, 0.28);
    chair.add(support);
  });

  return chair;
}

function getYouTubeVideos() {
  return videoCatalog.filter((video) => Boolean(video.youtubeUrl));
}

function getCurrentYouTubeVideo() {
  const current = videoCatalog.find((video) => video.id === state.videoId);
  if (current?.youtubeUrl) return current;
  const availableVideos = getYouTubeVideos();
  return availableVideos[Math.floor(Math.random() * availableVideos.length)];
}

function syncSelectedVideoUi(video) {
  state.videoId = video.id;
  dom.miniVideoTitle.textContent = video.title;
  document.querySelectorAll('#video-options [data-id]').forEach((button) => button.classList.toggle('is-selected', button.dataset.id === video.id));
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', () => reject(new Error('Could not load the YouTube player.')), { once: true });
    document.head.append(script);
  });

  return youtubeApiPromise;
}

function mountYouTubeScreen() {
  destroyYouTubeScreen();
  const video = getCurrentYouTubeVideo();
  if (!video) {
    showNotice('No YouTube videos are available in the catalog.');
    return;
  }
  syncSelectedVideoUi(video);

  const mountToken = ++youtubeMountToken;
  const shell = document.createElement('div');
  shell.className = 'youtube-screen';
  shell.setAttribute('aria-label', `YouTube player: ${video.title}`);
  const target = document.createElement('div');
  target.id = `youtube-player-${mountToken}`;
  target.className = 'youtube-screen__target';
  target.textContent = 'Loading YouTube…';
  shell.append(target);

  youtubeScreenObject = new CSS3DObject(shell);
  youtubeScreenObject.position.set(0, cinemaScreenCenterY, youtubeScreenZ);
  youtubeScreenObject.scale.setScalar(cinemaScreenWidth / 960);
  youtubeWorld.add(youtubeScreenObject);
  youtubeRenderer.domElement.classList.add('is-active');

  loadYouTubeIframeApi().then((YT) => {
    if (mountToken !== youtubeMountToken || state.sceneId !== 'youtube-cinema') return;
    youtubePlayer = new YT.Player(target.id, {
      width: 960,
      height: 540,
      videoId: video.id,
      playerVars: {
        autoplay: state.started ? 1 : 0,
        controls: 1,
        fs: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event) => {
          if (mountToken !== youtubeMountToken) return;
          youtubePlayerReady = true;
          event.target.setVolume(85);
          if (state.started && state.sceneId === 'youtube-cinema') event.target.playVideo();
        },
        onStateChange: (event) => {
          syncYouTubeAnalysisVideo();
          if (event.data === YT.PlayerState.ENDED) playRandomVideo();
        },
        onError: (event) => {
          const embeddingBlocked = event.data === 101 || event.data === 150;
          showNotice(embeddingBlocked ? 'This video cannot be played outside YouTube.' : 'YouTube could not play this video.');
        },
      },
    });
  }).catch(() => {
    if (mountToken === youtubeMountToken) showNotice('Could not load the YouTube player.');
  });
}

function updateYouTubeVideo(video) {
  if (youtubePlayerReady && youtubePlayer?.loadVideoById) {
    youtubePlayer.loadVideoById(video.id);
  } else {
    mountYouTubeScreen();
  }
}

function destroyYouTubeScreen() {
  youtubeMountToken += 1;
  youtubePlayerReady = false;
  youtubePlayer?.destroy?.();
  youtubePlayer = null;
  if (youtubeScreenObject) {
    youtubeWorld.remove(youtubeScreenObject);
    youtubeScreenObject.element.remove();
    youtubeScreenObject = null;
  }
  youtubeRenderer.domElement.classList.remove('is-active');
  avatarOverlayRenderer.domElement.classList.remove('is-active');
}

function renderAvatarOverYouTube() {
  if (!youtubeScreenObject || state.sceneId !== 'youtube-cinema') {
    avatarOverlayRenderer.domElement.classList.remove('is-active');
    return;
  }

  youtubeWorld.updateMatrixWorld(true);
  camera.updateMatrixWorld();
  const screenPosition = youtubeScreenObject.getWorldPosition(new THREE.Vector3());
  const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(youtubeScreenObject.getWorldQuaternion(new THREE.Quaternion()));
  const towardCamera = camera.position.clone().sub(screenPosition);
  if (screenNormal.dot(towardCamera) <= 0) {
    avatarOverlayRenderer.domElement.classList.remove('is-active');
    return;
  }

  const halfWidth = 960 / 2;
  const halfHeight = 540 / 2;
  const corners = [
    new THREE.Vector3(-halfWidth, halfHeight, 0),
    new THREE.Vector3(halfWidth, halfHeight, 0),
    new THREE.Vector3(halfWidth, -halfHeight, 0),
    new THREE.Vector3(-halfWidth, -halfHeight, 0),
  ].map((corner) => {
    corner.applyMatrix4(youtubeScreenObject.matrixWorld).project(camera);
    return {
      x: (corner.x * 0.5 + 0.5) * window.innerWidth,
      y: (-corner.y * 0.5 + 0.5) * window.innerHeight,
    };
  });
  if (corners.some((corner) => !Number.isFinite(corner.x) || !Number.isFinite(corner.y))) {
    avatarOverlayRenderer.domElement.classList.remove('is-active');
    return;
  }

  avatarOverlayRenderer.domElement.style.clipPath = `polygon(${corners.map((corner) => `${corner.x}px ${corner.y}px`).join(', ')})`;
  avatarOverlayRenderer.domElement.classList.add('is-active');
  avatarOverlayRenderer.toneMappingExposure = renderer.toneMappingExposure;

  const previousCameraLayerMask = camera.layers.mask;
  const previousBackground = world.background;
  camera.layers.set(1);
  world.background = null;
  avatarOverlayRenderer.render(world, camera);
  world.background = previousBackground;
  camera.layers.mask = previousCameraLayerMask;
}

function addCylinderSeamLights(count, height) {
  const fallbackColor = new THREE.Color('#b8e8ff');
  const initialPalette = getStaticVideoPalette(state.videoId, videoElement.currentTime) ?? [fallbackColor];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const color = makeLuminousPaletteColor(initialPalette[index % initialPalette.length]);
    const seam = new THREE.Group();
    seam.position.set(
      Math.sin(angle) * (cylinderRadius - 0.24),
      0,
      Math.cos(angle) * (cylinderRadius - 0.24),
    );

    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, height, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.userData.paletteResponsive = true;
    halo.userData.paletteTarget = initialPalette;
    halo.userData.paletteIndex = index;
    halo.userData.paletteLightnessFloor = 0.7;
    halo.renderOrder = 5;
    seam.add(halo);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, height, 10),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    core.userData.paletteResponsive = true;
    core.userData.paletteTarget = initialPalette;
    core.userData.paletteIndex = index;
    core.userData.paletteLightnessFloor = 0.76;
    core.renderOrder = 6;
    seam.add(core);
    addToStage(seam);
  }
}

function addCylinderBaseLights() {
  const fallbackColor = new THREE.Color('#b8e8ff');
  const initialPalette = getStaticVideoPalette(state.videoId, videoElement.currentTime) ?? [fallbackColor];
  [-cylinderHalfHeight + 0.18, cylinderHalfHeight - 0.18].forEach((height, index) => {
    const paletteIndex = index + 2;
    const color = makeLuminousPaletteColor(initialPalette[paletteIndex % initialPalette.length]);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(cylinderRadius - 0.28, 0.3, 12, 160),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.position.y = height;
    halo.rotation.x = Math.PI / 2;
    halo.userData.paletteResponsive = true;
    halo.userData.paletteTarget = initialPalette;
    halo.userData.paletteIndex = paletteIndex;
    halo.userData.paletteLightnessFloor = 0.7;
    halo.renderOrder = 5;
    addToStage(halo);

    const core = new THREE.Mesh(
      new THREE.TorusGeometry(cylinderRadius - 0.28, 0.085, 10, 160),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    core.position.y = height;
    core.rotation.x = Math.PI / 2;
    core.userData.paletteResponsive = true;
    core.userData.paletteTarget = initialPalette;
    core.userData.paletteIndex = paletteIndex;
    core.userData.paletteLightnessFloor = 0.76;
    core.renderOrder = 6;
    addToStage(core);
  });
}

function makeLuminousPaletteColor(color, minimumLightness = 0.72) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(minimumLightness, hsl.l));
}

function videoPlane(width, height) {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), materialForVideo(THREE.FrontSide, 0.94));
}

function materialForVideo(side = THREE.FrontSide, opacity = 1, flipX = false) {
  const material = new THREE.MeshBasicMaterial({ map: activeTexture, side, transparent: opacity < 1, opacity, toneMapped: false });
  if (flipX) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\n\t\tvMapUv.x = 1.0 - vMapUv.x;',
      );
    };
    material.customProgramCacheKey = () => 'video-horizontal-flip';
  }
  return material;
}

function doubleHemisphereVideoMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: activeTexture },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPosition;

      void main() {
        vUv = uv;
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vLocalPosition;

      const float PI = 3.14159265359;
      const float TAU = 6.28318530718;

      float wrappedAngle(float angle) {
        return mod(angle + TAU, TAU);
      }

      float localVideoU(float angle) {
        float wrapped = wrappedAngle(angle);
        float hemisphere = step(PI, wrapped);
        float local = mix(wrapped / PI, (wrapped - PI) / PI, hemisphere);
        return local;
      }

      vec4 frameAt(float angle) {
        return texture2D(uMap, vec2(localVideoU(angle), vUv.y));
      }

      void main() {
        float angle = wrappedAngle(atan(vLocalPosition.z, vLocalPosition.x));
        vec4 frame = frameAt(angle);
        gl_FragColor = frame;
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function setVideo(videoId) {
  const video = videoCatalog.find((item) => item.id === videoId) ?? videoCatalog[0];
  if (video.localOnly && videoBaseUrl) {
    showNotice('This video is only available from the local video folder.');
    return;
  }
  if (state.sceneId === 'youtube-cinema' && !video.youtubeUrl) {
    showNotice('This local-only video is not available on YouTube.');
    return;
  }
  state.videoId = video.id;
  lastPaletteUpdate = 0;
  resetMiniVideoControls();
  videoElement.pause();
  videoElement.src = localVideoUrl(video, videoBaseUrl);
  videoElement.load();
  videoTexture = new THREE.VideoTexture(videoElement);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.generateMipmaps = false;
  activeTexture = videoTexture;
  refreshVideoMaterials();
  dom.miniVideoTitle.textContent = video.title;
  document.querySelectorAll('#video-options [data-id]').forEach((button) => button.classList.toggle('is-selected', button.dataset.id === video.id));
  videoElement.addEventListener('error', () => {
    activeTexture = textureFallback;
    refreshVideoMaterials();
    showNotice('Could not load this local file. Check the filename in src/data/catalog.js.');
  }, { once: true });
  if (state.sceneId === 'youtube-cinema') {
    videoElement.pause();
    updateYouTubeVideo(video);
  }
  if (state.started) playVideoWithAudio();
}

function playRandomVideo() {
  if (!state.started || playableVideoCatalog.length < 2) return;
  const candidates = state.sceneId === 'youtube-cinema' ? getYouTubeVideos() : playableVideoCatalog;
  const alternatives = candidates.filter((item) => item.id !== state.videoId);
  const nextVideo = alternatives[Math.floor(Math.random() * alternatives.length)];
  setVideo(nextVideo.id);
}

function getMiniVideoDuration() {
  return Number.isFinite(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : 0;
}

function formatMiniVideoTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes}:${remainingSeconds}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${remainingSeconds}`;
}

function syncMiniVideoControls() {
  const duration = getMiniVideoDuration();
  const currentTime = Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0;
  dom.miniVideoSeek.disabled = !duration;
  dom.miniVideoSeek.value = duration ? String((currentTime / duration) * 100) : '0';
  dom.miniVideoTime.textContent = `${formatMiniVideoTime(currentTime)} / ${formatMiniVideoTime(duration)}`;
  syncMiniVideoMuteControl();
}

function resetMiniVideoControls() {
  dom.miniVideoSeek.disabled = true;
  dom.miniVideoSeek.value = '0';
  dom.miniVideoTime.textContent = '0:00 / 0:00';
  syncMiniVideoMuteControl();
}

function refreshVideoMaterials() {
  stage.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    if (object.material.map) {
      if (object.material.map.isVideoTexture || object.material.map === textureFallback) object.material.map = activeTexture;
      object.material.needsUpdate = true;
    }
    if (object.material.userData.openSeaVideoSurface && object.material.emissiveMap) {
      object.material.emissiveMap = activeTexture;
    }
    if (object.material.uniforms?.uMap) {
      object.material.uniforms.uMap.value = activeTexture;
      object.material.needsUpdate = true;
    }
  });
}

function setAvatar() {
  state.avatarId = 'butterfly';
  clearButterflyDust();
  while (avatarRoot.children.length) {
    const child = avatarRoot.children.pop();
    child.traverse((object) => {
      object.geometry?.dispose();
      if (object.material?.map?.userData?.avatarTexture) object.material.map.dispose();
      object.material?.dispose?.();
    });
  }
  buildButterfly();
  applyButterflySceneStyle();
  avatarRoot.traverse((object) => object.layers.enable(1));
  updateButterflyWingDepthMode();
  document.querySelectorAll('#butterfly-palette [data-id]').forEach((button) => button.classList.toggle('is-selected', button.dataset.id === state.butterflyColorId));
  if (dom.butterflyColorPicker) dom.butterflyColorPicker.value = state.butterflyColor;
  if (dom.butterflyColorValue) dom.butterflyColorValue.textContent = state.butterflyColor.toUpperCase();
}

function setButterflyPalette(paletteId) {
  const palette = butterflyPalettes.find((item) => item.id === paletteId);
  if (palette) setButterflyColor(palette.color);
}

function setButterflyColor(colorValue) {
  const color = normalizeButterflyColor(colorValue);
  if (!color) return;
  const palette = butterflyPalettes.find((item) => item.color.toLowerCase() === color.toLowerCase());
  writeCookie(butterflyColorCookieName, color);
  if (state.butterflyColor === color) return;
  state.butterflyColor = color;
  state.butterflyColorId = palette?.id ?? 'custom';
  setAvatar();
}

function normalizeButterflyColor(colorValue) {
  if (typeof colorValue !== 'string' || !/^#[0-9a-f]{6}$/i.test(colorValue)) return null;
  return `#${colorValue.slice(1).toLowerCase()}`;
}

function readCookie(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(encodedName));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(encodedName.length));
  } catch {
    return null;
  }
}

function writeCookie(name, value) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
}

function getCustomButterflyPalette(colorValue) {
  const base = new THREE.Color(colorValue);
  const white = new THREE.Color('#ffffff');
  const line = base.clone().lerp(white, 0.72);
  const emissive = base.clone().lerp(white, 0.16);
  const bodyEmissive = base.clone().lerp(white, 0.22);
  const aura = base.clone().lerp(white, 0.34);

  return {
    fill: `#${base.getHexString()}`,
    line: `#${line.getHexString()}`,
    emissive: `#${emissive.getHexString()}`,
    body: `#${base.getHexString()}`,
    bodyEmissive: `#${bodyEmissive.getHexString()}`,
    aura: `#${aura.getHexString()}`,
    glow: `#${aura.getHexString()}`,
  };
}

function getActiveButterflyPalette() {
  return butterflyPalettes.find((palette) => palette.color.toLowerCase() === state.butterflyColor.toLowerCase()) ?? getCustomButterflyPalette(state.butterflyColor);
}

function getButterflyWingStyle() {
  const isCinema = ['cinema', 'youtube-cinema'].includes(state.sceneId);
  if (isCinema) {
    return { opacity: 0.92, transmission: 0 };
  }
  if (state.sceneId === 'realistic-beach') {
    return { opacity: 0.88, transmission: 0 };
  }
  return { opacity: 0.34, transmission: 0.32 };
}

function applyButterflySceneStyle() {
  const style = getButterflyWingStyle();
  avatarRoot.traverse((object) => {
    if (!object.material?.userData?.butterflyWingFill) return;
    object.material.opacity = style.opacity;
    object.material.transmission = style.transmission;
    const isDawn = state.sceneId === 'realistic-beach' && state.openSeaMode === 'dawn';
    object.material.emissiveIntensity = isDawn ? 0.18 : 0.58;
    object.material.toneMapped = isDawn;
    object.receiveShadow = isDawn;
    object.material.needsUpdate = true;
  });
}

function updateButterflyWingDepthMode() {
  const prioritizeWings = ['realistic-beach', 'cinema', 'youtube-cinema'].includes(state.sceneId);
  avatarRoot.traverse((object) => {
    if (object.userData.butterflyWingOccluder) {
      // Keep a colorless depth silhouette in front of transparent scene lights.
      // This prevents the beach sun from showing through the translucent wings
      // while preserving the wings' visible fill and glow.
      object.visible = prioritizeWings;
      object.renderOrder = prioritizeWings ? 98 : 0;
      return;
    }
    const material = object.material;
    if (!material?.userData?.butterflyWingPriority) return;
    material.depthTest = !prioritizeWings;
    material.depthWrite = false;
    material.needsUpdate = true;
    object.renderOrder = prioritizeWings ? (object.isLine ? 102 : 100) : (object.isLine ? 22 : 20);
  });
}

function clearButterflyDust() {
  if (!butterflyDustObject) return;
  butterflyDustWorld.remove(butterflyDustObject);
  butterflyDustObject.geometry?.dispose();
  butterflyDustObject.material?.dispose();
  butterflyDustObject = null;
}

function getButterflyDustWorldPosition(localPoint, target) {
  target.copy(localPoint)
    .applyQuaternion(avatarRoot.quaternion)
    .add(avatarRoot.position)
    .applyQuaternion(player.quaternion)
    .add(player.position);
  return target;
}

function respawnButterflyDustParticle(index, dustState, randomAge = false) {
  const spawnPoint = dustState.spawnPoints[Math.floor(Math.random() * dustState.spawnPoints.length)];
  getButterflyDustWorldPosition(spawnPoint, butterflyDustWorldPoint);
  dustState.emissionPositions[index * 3] = butterflyDustWorldPoint.x;
  dustState.emissionPositions[index * 3 + 1] = butterflyDustWorldPoint.y;
  dustState.emissionPositions[index * 3 + 2] = butterflyDustWorldPoint.z;
  if (randomAge) dustState.ages[index] = Math.random() * dustState.lifetimes[index];
}

function resetButterflyDust() {
  if (!butterflyDustObject) return;
  const dustState = butterflyDustObject.userData.butterflyDust;
  for (let index = 0; index < dustState.phases.length; index += 1) {
    respawnButterflyDustParticle(index, dustState, true);
  }
}

function updateButterflyDust(delta) {
  if (!butterflyDustObject || state.avatarId !== 'butterfly') return;
  const dustState = butterflyDustObject.userData.butterflyDust;
  const positions = butterflyDustObject.geometry.attributes.position;
  const alphas = butterflyDustObject.geometry.attributes.dustAlpha;
  const { emissionPositions, phases, ages, lifetimes, fallDistances, drifts } = dustState;

  for (let index = 0; index < phases.length; index += 1) {
    ages[index] += delta;
    if (ages[index] >= lifetimes[index]) {
      ages[index] -= lifetimes[index];
      respawnButterflyDustParticle(index, dustState);
    }
    const progress = ages[index] / lifetimes[index];
    const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.14);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.56, 1);
    const driftWave = Math.sin(progress * Math.PI * 2 + phases[index]);
    positions.setXYZ(
      index,
      emissionPositions[index * 3] + drifts[index * 2] * progress + driftWave * 0.035,
      emissionPositions[index * 3 + 1] - fallDistances[index] * progress,
      emissionPositions[index * 3 + 2] + drifts[index * 2 + 1] * progress + Math.cos(progress * Math.PI * 2 + phases[index]) * 0.035,
    );
    alphas.setX(index, fadeIn * fadeOut);
  }
  positions.needsUpdate = true;
  alphas.needsUpdate = true;
}

function buildButterfly() {
  const palette = getActiveButterflyPalette();
  const wingStyle = getButterflyWingStyle();
  const wingFill = new THREE.MeshPhysicalMaterial({
    color: palette.fill,
    emissive: palette.emissive,
    emissiveIntensity: 0.58,
    transparent: true,
    opacity: wingStyle.opacity,
    transmission: wingStyle.transmission,
    roughness: 0.18,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  wingFill.userData.butterflyWingFill = true;
  const wingLine = new THREE.LineBasicMaterial({
    color: palette.line,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  const wingOccluderMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    colorWrite: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    fog: false,
  });
  const dustPerimeter = [];

  [-1, 1].forEach((side) => {
    const wings = new THREE.Group();
    const upperWing = new THREE.Group();
    const lowerWing = new THREE.Group();
    wings.scale.x = side;
    wings.rotation.y = side * 0.16;
    wings.userData.flutterSide = side;
    wings.userData.baseRotationY = wings.rotation.y;
    wings.userData.baseRotationZ = 0;
    lowerWing.userData.floorFoldSide = 1;
    lowerWing.userData.baseRotationZ = 0;
    wings.userData.lowerWing = lowerWing;

    const upperShape = new THREE.Shape();
    upperShape.moveTo(0.05, 0.08);
    upperShape.bezierCurveTo(0.18, 0.92, 0.72, 1.72, 1.5, 1.62);
    upperShape.bezierCurveTo(2.08, 1.54, 2.08, 0.75, 1.67, 0.22);
    upperShape.bezierCurveTo(1.25, -0.28, 0.5, -0.18, 0.05, 0.08);

    const lowerShape = new THREE.Shape();
    lowerShape.moveTo(0.06, 0.02);
    lowerShape.bezierCurveTo(0.5, -0.14, 1.35, -0.22, 1.55, -0.78);
    lowerShape.bezierCurveTo(1.78, -1.4, 1.18, -1.73, 0.68, -1.44);
    lowerShape.bezierCurveTo(0.22, -1.16, 0.04, -0.5, 0.06, 0.02);

    [upperShape, lowerShape].forEach((shape, index) => {
      const wingMaterial = wingFill.clone();
      wingMaterial.userData.butterflyWingPriority = true;
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), wingMaterial);
      wing.position.z = index === 0 ? 0 : 0.015;
      wing.renderOrder = 20;

      const wingOccluder = new THREE.Mesh(wing.geometry, wingOccluderMaterial);
      wingOccluder.position.copy(wing.position);
      wingOccluder.userData.butterflyWingOccluder = true;
      wingOccluder.visible = false;
      wingOccluder.renderOrder = 98;

      const outlinePoints = shape.getPoints(72).map((point) => new THREE.Vector3(point.x, point.y, 0.035));
      outlinePoints.forEach((point) => {
        const x = point.x * side;
        if (Math.abs(x) > 0.45) dustPerimeter.push(new THREE.Vector3(x, point.y, point.z));
      });
      const outlineMaterial = wingLine.clone();
      outlineMaterial.userData.butterflyWingPriority = true;
      const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePoints), outlineMaterial);
      outline.renderOrder = 22;
      (index === 0 ? upperWing : lowerWing).add(outline);
      (index === 0 ? upperWing : lowerWing).add(wing);
      (index === 0 ? upperWing : lowerWing).add(wingOccluder);
    });

    const veinPaths = [
      [[0.08, 0.08], [0.55, 0.72], [1.5, 1.54]],
      [[0.08, 0.08], [0.92, 0.48], [1.82, 0.58]],
      [[0.08, 0.08], [0.7, 0.12], [1.62, 0.18]],
      [[0.08, 0], [0.72, -0.45], [1.5, -0.78]],
      [[0.08, -0.04], [0.45, -0.88], [0.72, -1.4]],
    ];
    veinPaths.forEach((coordinates, index) => {
      const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, y]) => new THREE.Vector3(x, y, 0.045)));
      const veinMaterial = wingLine.clone();
      veinMaterial.userData.butterflyWingPriority = true;
      const vein = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)), veinMaterial);
      vein.renderOrder = 22;
      (index >= 3 ? lowerWing : upperWing).add(vein);
    });
    wings.add(upperWing, lowerWing);
    avatarRoot.add(wings);
  });

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: palette.body,
    emissive: palette.bodyEmissive,
    emissiveIntensity: 0.72,
    roughness: 0.25,
    clearcoat: 0.8,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.94, 8, 18), bodyMaterial);
  body.position.y = -0.03;
  body.position.z = 0.16;
  avatarRoot.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 14), bodyMaterial.clone());
  head.position.set(0, 0.72, 0.16);
  avatarRoot.add(head);

  const antennaMaterial = new THREE.LineBasicMaterial({ color: palette.line, transparent: true, opacity: 0.92 });
  [-1, 1].forEach((side) => {
    const antenna = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * 0.07, 0.86, 0.16),
      new THREE.Vector3(side * 0.28, 1.18, 0.18),
      new THREE.Vector3(side * 0.43, 1.25, 0.16),
    );
    avatarRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(antenna.getPoints(20)), antennaMaterial.clone()));
  });

  const sparkleTexture = makeButterflySparkleTexture();
  [
    { x: -0.82, y: 0.08, width: 2.75, height: 3.35, opacity: 0.045 },
    { x: 0.82, y: 0.08, width: 2.75, height: 3.35, opacity: 0.045 },
    { x: 0, y: 0.02, width: 2.15, height: 2.75, opacity: 0.028 },
  ].forEach(({ x, y, width, height, opacity }) => {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkleTexture,
      color: palette.aura,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    }));
    aura.position.set(x, y, -0.04);
    aura.scale.set(width, height, 1);
    aura.renderOrder = 18;
    avatarRoot.add(aura);
  });

  const dustCount = 40;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustEmissionPositions = new Float32Array(dustCount * 3);
  const dustAlphas = new Float32Array(dustCount);
  const dustPhases = new Float32Array(dustCount);
  const dustAges = new Float32Array(dustCount);
  const dustLifetimes = new Float32Array(dustCount);
  const dustFallDistances = new Float32Array(dustCount);
  const dustDrifts = new Float32Array(dustCount * 2);
  const dustSpawnPoints = [];
  for (let index = 0; index < dustCount; index += 1) {
    const perimeterPoint = dustPerimeter[Math.floor(Math.random() * dustPerimeter.length)];
    const outward = new THREE.Vector2(perimeterPoint.x, perimeterPoint.y).normalize();
    const edgeOffset = THREE.MathUtils.randFloat(-0.035, 0.16);
    const spawnPoint = new THREE.Vector3(
      perimeterPoint.x + outward.x * edgeOffset + THREE.MathUtils.randFloatSpread(0.055),
      perimeterPoint.y + outward.y * edgeOffset + THREE.MathUtils.randFloatSpread(0.055),
      THREE.MathUtils.randFloat(-0.2, 0.2),
    );
    dustSpawnPoints.push(spawnPoint);
    getButterflyDustWorldPosition(spawnPoint, butterflyDustWorldPoint);
    dustEmissionPositions[index * 3] = butterflyDustWorldPoint.x;
    dustEmissionPositions[index * 3 + 1] = butterflyDustWorldPoint.y;
    dustEmissionPositions[index * 3 + 2] = butterflyDustWorldPoint.z;
    dustPositions[index * 3] = butterflyDustWorldPoint.x;
    dustPositions[index * 3 + 1] = butterflyDustWorldPoint.y;
    dustPositions[index * 3 + 2] = butterflyDustWorldPoint.z;
    dustPhases[index] = Math.random() * Math.PI * 2;
    dustLifetimes[index] = THREE.MathUtils.randFloat(1.7, 3.1) + 1;
    dustAges[index] = Math.random() * dustLifetimes[index];
    dustFallDistances[index] = THREE.MathUtils.randFloat(0.5, 1.15);
    dustDrifts[index * 2] = THREE.MathUtils.randFloatSpread(0.26);
    dustDrifts[index * 2 + 1] = THREE.MathUtils.randFloatSpread(0.18);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('dustAlpha', new THREE.BufferAttribute(dustAlphas, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sparkleTexture },
      uColor: { value: new THREE.Color(palette.fill) },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float dustAlpha;
      varying float vDustAlpha;

      void main() {
        vDustAlpha = dustAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 3.8 * uPixelRatio;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      varying float vDustAlpha;

      void main() {
        float sparkle = texture2D(uMap, gl_PointCoord).a;
        float alpha = sparkle * vDustAlpha * 0.82;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    fog: false,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.renderOrder = 24;
  dust.frustumCulled = false;
  dust.layers.enable(1);
  dust.userData.butterflyDust = {
    emissionPositions: dustEmissionPositions,
    spawnPoints: dustSpawnPoints,
    phases: dustPhases,
    ages: dustAges,
    lifetimes: dustLifetimes,
    fallDistances: dustFallDistances,
    drifts: dustDrifts,
  };
  butterflyDustObject = dust;
  butterflyDustWorld.add(dust);

  const glow = new THREE.PointLight(palette.glow, 2.1, 8);
  glow.position.set(0, 0.18, 0.5);
  avatarRoot.add(glow);
}

function makeButterflySparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.12, 'rgba(255, 248, 224, 0.95)');
  gradient.addColorStop(0.42, 'rgba(239, 220, 255, 0.38)');
  gradient.addColorStop(1, 'rgba(239, 220, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.avatarTexture = true;
  return texture;
}

function buildAnimal() {
  const fur = new THREE.MeshStandardMaterial({ color: '#c5b6dd', emissive: '#2e2951', emissiveIntensity: 0.5, roughness: 0.86 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), fur);
  body.scale.set(0.85, 0.75, 1.15);
  body.position.y = 0.05;
  avatarRoot.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 16), fur);
  head.position.set(0, 0.58, -0.35);
  avatarRoot.add(head);
  [-0.3, 0.3].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.58, 4), fur);
    ear.position.set(x, 1.05, -0.35);
    ear.rotation.z = x > 0 ? -0.2 : 0.2;
    avatarRoot.add(ear);
  });
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.12, 12, 32, Math.PI * 1.45), fur);
  tail.position.set(0.72, 0.2, 0.45);
  tail.rotation.y = Math.PI / 2;
  avatarRoot.add(tail);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#ffedc2' });
  [-0.18, 0.18].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), eyeMaterial);
    eye.position.set(x, 0.65, -0.82);
    avatarRoot.add(eye);
  });
}

function buildLightFigure() {
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#e9f7ff', emissive: '#8fd9ff', emissiveIntensity: 2.6, transparent: true, opacity: 0.82, transmission: 0.55, roughness: 0.12 }));
  avatarRoot.add(core);
  [1.1, 1.45, 1.8].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 8, 72), new THREE.MeshBasicMaterial({ color: index % 2 ? '#f7b8e8' : '#9de9ff', transparent: true, opacity: 0.58 }));
    ring.rotation.set(index * 0.5, index * 0.8, index * 0.25);
    avatarRoot.add(ring);
  });
  const glow = new THREE.PointLight('#a8e9ff', 4, 12);
  avatarRoot.add(glow);
}

function addClouds() {
  const cloudMaterial = new THREE.MeshLambertMaterial({ color: '#f4fbff', transparent: true, opacity: 0.76 });
  [[-11, 1, -6, 3], [10, 3, -9, 4], [-7, 6, -17, 3.5], [11, 8, -22, 4.5]].forEach(([x, y, z, scale]) => {
    const cloud = new THREE.Group();
    for (let index = 0; index < 5; index += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), cloudMaterial);
      puff.position.set((index - 2) * 0.8, Math.sin(index) * 0.22, Math.cos(index) * 0.25);
      puff.scale.setScalar(scale * (0.7 + (index % 3) * 0.12));
      cloud.add(puff);
    }
    cloud.position.set(x, y, z);
    addToStage(cloud);
  });
}

function addGlowParticles(count, color, spread, reactToVideo = false, distribution = 'cube') {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const amplitudes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const initialPalette = reactToVideo ? getStaticVideoPalette(state.videoId, 0) : null;
  const initialColor = makeLuminousPaletteColor(initialPalette?.[0] ?? new THREE.Color(color), floatingParticleLightnessFloor);
  for (let index = 0; index < count; index += 1) {
    if (distribution === 'cylinder') {
      const angle = Math.random() * Math.PI * 2;
      const radialDistance = Math.sqrt(Math.random()) * spread * 0.5;
      positions[index * 3] = Math.cos(angle) * radialDistance;
      positions[index * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[index * 3 + 2] = Math.sin(angle) * radialDistance - 4;
    } else {
      positions[index * 3] = (Math.random() - 0.5) * spread;
      positions[index * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[index * 3 + 2] = (Math.random() - 0.5) * spread - 4;
    }
    phases[index] = Math.random() * Math.PI * 2;
    speeds[index] = 0.35 + Math.random() * 0.45;
    amplitudes[index] = 0.08 + Math.random() * 0.3;
    colors[index * 3] = initialColor.r;
    colors[index * 3 + 1] = initialColor.g;
    colors[index * 3 + 2] = initialColor.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending }));
  particles.userData.floatingParticles = {
    basePositions: positions.slice(),
    phases,
    speeds,
    amplitudes,
  };
  particles.userData.paletteResponsive = reactToVideo;
  particles.userData.paletteTarget = initialPalette ?? [initialColor, initialColor, initialColor, initialColor];
  addToStage(particles);
}

function getStaticVideoPalette(videoId, currentTime = 0) {
  const resource = videoPalettes[videoId];
  if (!resource?.samples?.length) return null;

  const samples = resource.samples;
  const fallbackDuration = samples[samples.length - 1].time + resource.sampleInterval;
  const duration = Number.isFinite(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : fallbackDuration;
  const time = THREE.MathUtils.euclideanModulo(currentTime, duration);
  let previous = samples[0];
  let next = null;

  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index].time > time) {
      next = samples[index];
      break;
    }
    previous = samples[index];
  }

  let nextTime;
  if (!next) {
    next = samples[0];
    nextTime = duration;
  } else {
    nextTime = next.time;
  }
  const span = Math.max(0.001, nextTime - previous.time);
  const blend = THREE.MathUtils.clamp((time - previous.time) / span, 0, 1);

  return previous.colors.map((color, index) => {
    const current = new THREE.Color(color);
    const upcoming = new THREE.Color(next.colors[index] ?? color);
    return current.lerp(upcoming, blend);
  });
}

function srgbByteToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function projectionResponseFromLuminance(averageLuminance, squaredLuminance, pixelCount) {
  if (!pixelCount) return 0;
  const mean = averageLuminance / pixelCount;
  const rootMeanSquare = Math.sqrt(squaredLuminance / pixelCount);
  const effectiveLuminance = mean * 0.88 + rootMeanSquare * 0.12;
  const blackGate = THREE.MathUtils.smoothstep(effectiveLuminance, 0.0015, 0.008);
  const normalized = THREE.MathUtils.clamp((effectiveLuminance - 0.001) / 0.32, 0, 1);
  return blackGate * normalized ** 0.72;
}

function applyProjectionAccumulator(target, accumulator) {
  target.response = projectionResponseFromLuminance(accumulator.luminance, accumulator.squaredLuminance, accumulator.count);
  if (!accumulator.count) {
    target.color.set('#ffffff');
    return;
  }

  const red = accumulator.red / accumulator.count;
  const green = accumulator.green / accumulator.count;
  const blue = accumulator.blue / accumulator.count;
  const maximumChannel = Math.max(red, green, blue);
  if (maximumChannel < 0.0001) {
    target.color.set('#ffffff');
    return;
  }
  target.color.setRGB(red / maximumChannel, green / maximumChannel, blue / maximumChannel);
  target.color.lerp(new THREE.Color(1, 1, 1), 0.1);
}

function sampleCinemaVideoFrame() {
  if (!cinemaLightContext || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  try {
    cinemaLightContext.drawImage(videoElement, 0, 0, cinemaLightCanvas.width, cinemaLightCanvas.height);
    const pixels = cinemaLightContext.getImageData(0, 0, cinemaLightCanvas.width, cinemaLightCanvas.height).data;
    const accumulators = Array.from({ length: 3 }, () => ({
      red: 0,
      green: 0,
      blue: 0,
      luminance: 0,
      squaredLuminance: 0,
      count: 0,
    }));

    for (let y = 0; y < cinemaLightCanvas.height; y += 1) {
      for (let x = 0; x < cinemaLightCanvas.width; x += 1) {
        const offset = (y * cinemaLightCanvas.width + x) * 4;
        const red = srgbByteToLinear(pixels[offset]);
        const green = srgbByteToLinear(pixels[offset + 1]);
        const blue = srgbByteToLinear(pixels[offset + 2]);
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const zone = Math.min(2, Math.floor(x * 3 / cinemaLightCanvas.width));
        const accumulator = accumulators[zone];
        accumulator.red += red;
        accumulator.green += green;
        accumulator.blue += blue;
        accumulator.luminance += luminance;
        accumulator.squaredLuminance += luminance ** 2;
        accumulator.count += 1;
      }
    }

    const averageAccumulator = accumulators.reduce((combined, region) => ({
      red: combined.red + region.red,
      green: combined.green + region.green,
      blue: combined.blue + region.blue,
      luminance: combined.luminance + region.luminance,
      squaredLuminance: combined.squaredLuminance + region.squaredLuminance,
      count: combined.count + region.count,
    }), { red: 0, green: 0, blue: 0, luminance: 0, squaredLuminance: 0, count: 0 });

    applyProjectionAccumulator(cinemaProjectionSample.average, averageAccumulator);
    accumulators.forEach((accumulator, zone) => applyProjectionAccumulator(cinemaProjectionSample.zones[zone], accumulator));
    return true;
  } catch {
    return false;
  }
}

function syncYouTubeAnalysisVideo() {
  if (state.sceneId !== 'youtube-cinema' || !youtubePlayerReady || !youtubePlayer) return;
  const youtubeTime = youtubePlayer.getCurrentTime?.();
  const youtubeState = youtubePlayer.getPlayerState?.();
  if (Number.isFinite(youtubeTime) && videoElement.readyState >= HTMLMediaElement.HAVE_METADATA
    && Math.abs(videoElement.currentTime - youtubeTime) > 0.28) {
    videoElement.currentTime = youtubeTime;
  }
  videoElement.muted = true;
  videoElement.volume = 0;
  if (youtubeState === 1 && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    if (videoElement.paused) videoElement.play().catch(() => {});
  } else if (!videoElement.paused) {
    videoElement.pause();
  }
}

function updateCinemaProjectionLight(delta) {
  if (!['cinema', 'youtube-cinema'].includes(state.sceneId)) return;
  if (clock.elapsedTime - lastCinemaLightSample > 0.08) {
    lastCinemaLightSample = clock.elapsedTime;
    syncYouTubeAnalysisVideo();
    if (!sampleCinemaVideoFrame()) {
      cinemaProjectionSample.average.response = 0;
      cinemaProjectionSample.zones.forEach((zone) => { zone.response = 0; });
    }
  }

  stage.traverse((object) => {
    const projectionLight = object.userData.cinemaProjectionLight;
    if (!projectionLight || !object.isLight) return;
    const sample = projectionLight.zone < 0
      ? cinemaProjectionSample.average
      : cinemaProjectionSample.zones[projectionLight.zone];
    const targetIntensity = projectionLight.maximumIntensity * sample.response;
    const intensityDamping = targetIntensity < object.intensity ? 15 : 6.5;
    object.intensity = THREE.MathUtils.damp(object.intensity, targetIntensity, intensityDamping, delta);
    object.color.lerp(sample.color, 1 - Math.exp(-7 * delta));
  });
}

function updateParticlePalette(delta) {
  if (!['sphere', 'cube', 'cylinder'].includes(state.sceneId)) return;
  if (clock.elapsedTime - lastPaletteUpdate > 0.45) {
    lastPaletteUpdate = clock.elapsedTime;
    const playbackTime = state.sceneId === 'youtube-cinema' && youtubePlayerReady && youtubePlayer?.getCurrentTime
      ? youtubePlayer.getCurrentTime()
      : videoElement.currentTime;
    const palette = getStaticVideoPalette(state.videoId, playbackTime);
    if (palette) {
      stage.traverse((object) => {
        if (object.userData.paletteResponsive) object.userData.paletteTarget = palette;
      });
    }
  }

  stage.traverse((object) => {
    if (!object.userData.paletteResponsive) return;
    const targetPalette = object.userData.paletteTarget;
    const blend = Math.min(1, delta * 2.8);
    if (object.isLight && targetPalette?.length) {
      const target = targetPalette[object.userData.paletteIndex % targetPalette.length];
      const luminousTarget = makeLuminousPaletteColor(target, object.userData.paletteLightnessFloor ?? 0.72);
      object.color.lerp(luminousTarget, blend);
      return;
    }
    if (object.userData.paletteIndex !== undefined && object.material?.color && targetPalette?.length) {
      const target = targetPalette[object.userData.paletteIndex % targetPalette.length];
      const luminousTarget = makeLuminousPaletteColor(target, object.userData.paletteLightnessFloor ?? 0.72);
      object.material.color.lerp(luminousTarget, blend);
      return;
    }
    const colorAttribute = object.geometry.attributes.color;
    if (!targetPalette || !colorAttribute) return;
    const colors = colorAttribute.array;
    for (let index = 0; index < colors.length / 3; index += 1) {
      const target = targetPalette[index % targetPalette.length];
      const luminousTarget = makeLuminousPaletteColor(target, floatingParticleLightnessFloor);
      const offset = index * 3;
      colors[offset] += (luminousTarget.r - colors[offset]) * blend;
      colors[offset + 1] += (luminousTarget.g - colors[offset + 1]) * blend;
      colors[offset + 2] += (luminousTarget.b - colors[offset + 2]) * blend;
    }
    colorAttribute.needsUpdate = true;
  });
}

function addFramedGlow(position, color) {
  const light = new THREE.PointLight(color, 5, 18);
  light.position.copy(position);
  addToStage(light);
}

async function playVideoWithAudio() {
  if (state.sceneId === 'youtube-cinema') {
    videoElement.muted = true;
    videoElement.volume = 0;
    syncMiniVideoMuteControl();
    if (youtubePlayerReady && youtubePlayer?.playVideo) {
      youtubePlayer.setVolume(85);
      youtubePlayer.playVideo();
      syncYouTubeAnalysisVideo();
      dom.audioNotice.classList.remove('is-visible');
    } else {
      showNotice('Use the YouTube player if playback does not start automatically.');
    }
    return;
  }
  videoElement.muted = false;
  syncMiniVideoMuteControl();
  const selectedVolume = Number(dom.miniVideoVolume?.value);
  videoElement.volume = Number.isFinite(selectedVolume) ? THREE.MathUtils.clamp(selectedVolume, 0, 1) : 0.85;
  try {
    await videoElement.play();
    dom.audioNotice.classList.remove('is-visible');
  } catch {
    showNotice("Click again to enable the video's sound.");
  }
}

function toggleMenu(isOpen) {
  dom.menu.classList.toggle('is-open', isOpen);
  dom.menu.setAttribute('aria-hidden', String(!isOpen));
  dom.menuButton.setAttribute('aria-expanded', String(isOpen));
  revealCornerControls(isOpen || menuPointerNear);
}

function revealCornerControls(isVisible) {
  dom.fullscreenButton.classList.toggle('is-revealed', isVisible);
  dom.menuButton.classList.toggle('is-revealed', isVisible);
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showNotice('Fullscreen is not available in this browser.');
  }
}

function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);
  dom.fullscreenButton.textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
  dom.fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
}

function showNotice(message) {
  dom.audioNotice.textContent = message;
  dom.audioNotice.classList.add('is-visible');
  window.setTimeout(() => dom.audioNotice.classList.remove('is-visible'), 5000);
}

function getViewDirection() {
  const horizontal = Math.cos(pitch);
  return new THREE.Vector3(Math.sin(yaw) * horizontal, Math.sin(pitch), -Math.cos(yaw) * horizontal).normalize();
}

function updatePlayer(delta) {
  const forward = getViewDirection();
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const direction = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) direction.add(forward);
  if (keys.has('s') || keys.has('arrowdown')) direction.sub(forward);
  if (keys.has('a') || keys.has('arrowleft')) direction.sub(right);
  if (keys.has('d') || keys.has('arrowright')) direction.add(right);
  if (keys.has(' ') || keys.has('e')) direction.y += 1;
  if (keys.has('alt') || keys.has('shift') || keys.has('q')) direction.y -= 1;
  direction.addScaledVector(forward, -gamepadInput.moveY);
  direction.addScaledVector(right, gamepadInput.moveX);
  direction.y += gamepadInput.ascend - gamepadInput.descend;
  if (forwardBoostActive && keys.has('w') && forwardBoostFlutterRemaining > 0) {
    forwardBoostFlutterRemaining = Math.max(0, forwardBoostFlutterRemaining - delta);
  }
  if (direction.lengthSq()) {
    direction.normalize();
    const isForwardBoosting = forwardBoostActive && keys.has('w');
    const baseMovementSpeed = isForwardBoosting ? 6.5 * forwardBoostSpeedMultiplier : 6.5;
    const movementSpeed = baseMovementSpeed * (highSpeedMode ? highSpeedMultiplier : 1);
    playerVelocity.copy(direction).multiplyScalar(movementSpeed);
    player.position.addScaledVector(playerVelocity, delta);
    if (state.sceneId === 'sphere') {
      const maximumDistance = sphereRadius - sphereAvatarMargin;
      if (player.position.length() > maximumDistance) player.position.setLength(maximumDistance);
  } else if (state.sceneId === 'cube') {
      const maximumDistance = cubeHalfExtent - cubeAvatarMargin;
      player.position.x = THREE.MathUtils.clamp(player.position.x, -maximumDistance, maximumDistance);
      player.position.y = THREE.MathUtils.clamp(player.position.y, -maximumDistance, maximumDistance);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -maximumDistance, maximumDistance);
    } else if (state.sceneId === 'cylinder') {
      const maximumRadius = cylinderRadius - cylinderAvatarMargin;
      const horizontalDistance = Math.hypot(player.position.x, player.position.z);
      if (horizontalDistance > maximumRadius) {
        const scale = maximumRadius / horizontalDistance;
        player.position.x *= scale;
        player.position.z *= scale;
      }
      player.position.y = THREE.MathUtils.clamp(player.position.y, -cylinderHalfHeight + cylinderAvatarMargin, cylinderHalfHeight - cylinderAvatarMargin);
    } else if (state.sceneId === 'realistic-beach') {
      const offsetZ = player.position.z - openSeaWaterCenterZ;
      const radius = openSeaWaterSize / 2 - realisticSeaPrismEdgeRadius - getAvatarCollisionRadius();
      const distance = Math.hypot(player.position.x, offsetZ);
      if (distance > radius) {
        const scale = radius / distance;
        player.position.x *= scale;
        player.position.z = openSeaWaterCenterZ + offsetZ * scale;
      }
    } else if (state.sceneId === 'sky') {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -16, 16);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -24, 24);
    } else if (state.sceneId === 'luminous') {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -38, 38);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -50, 24);
    } else if (['cinema', 'youtube-cinema'].includes(state.sceneId)) {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -cinemaHalfWidth + 1.1, cinemaHalfWidth - 1.1);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -cinemaHalfDepth + 1.1, cinemaHalfDepth - 1.1);
    } else {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -16, 16);
      player.position.y = THREE.MathUtils.clamp(player.position.y, -12, 18);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -24, 24);
    }
  } else {
    playerVelocity.set(0, 0, 0);
  }
  applyPlayerFloorCollision();
  resolveOpenSeaInstallationCollisions();
  resolveCinemaChairCollisions();
  const horizontalForward = new THREE.Vector3(forward.x, 0, forward.z);
  if (horizontalForward.lengthSq() > 0.0001) {
    horizontalForward.normalize();
    const headingQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), horizontalForward);
    player.quaternion.slerp(headingQuaternion, 1 - Math.pow(0.0001, delta));
  }
}

function applyPlayerFloorCollision() {
  if (state.sceneId === 'realistic-beach') {
    const localFloor = getOpenSeaFloorHeightAt(player.position.x, player.position.z);
    player.position.y = THREE.MathUtils.clamp(
      player.position.y,
      localFloor + avatarFloorClearance,
      openSeaInstallationBaseY + (openSeaInstallationHeight - 50) * 2,
    );
  } else if (state.sceneId === 'sky') {
    player.position.y = THREE.MathUtils.clamp(player.position.y, skyFloorHeight + avatarFloorClearance, 18);
  } else if (state.sceneId === 'luminous') {
    player.position.y = THREE.MathUtils.clamp(player.position.y, luminousLowerBoundary + getAvatarCollisionRadius(), 28);
  } else if (['cinema', 'youtube-cinema'].includes(state.sceneId)) {
    const localFloor = getCinemaFloorHeightAt(player.position.x, player.position.z);
    player.position.y = THREE.MathUtils.clamp(player.position.y, localFloor + avatarFloorClearance, cinemaCeiling - 1.1);
  }
}

function resolveCinemaChairCollisions() {
  if (!['cinema', 'youtube-cinema'].includes(state.sceneId)) return;

  const horizontalRadius = Math.min(getAvatarCollisionRadius(), 0.55);
  const verticalRadius = avatarFloorClearance * 0.72;
  const avatarCenterY = player.position.y + avatarRoot.position.y;

  for (let pass = 0; pass < 2; pass += 1) {
    cinemaRowPositions.forEach((z, rowIndex) => {
      const chairFloor = cinemaFloor + rowIndex * cinemaTierRise;
      const chairBottom = chairFloor + 0.04;
      const chairTop = chairFloor + cinemaChairCollisionTop;
      if (avatarCenterY - verticalRadius > chairTop || avatarCenterY + verticalRadius < chairBottom) return;

      cinemaChairXPositions.forEach((x) => {
        const offsetX = player.position.x - x;
        const offsetZ = player.position.z - (z + 0.04);
        const overlapX = cinemaChairCollisionHalfWidth + horizontalRadius - Math.abs(offsetX);
        const overlapZ = cinemaChairCollisionHalfDepth + horizontalRadius - Math.abs(offsetZ);
        if (overlapX <= 0 || overlapZ <= 0) return;

        let normalX = 0;
        let normalZ = 0;
        if (overlapX < overlapZ) {
          normalX = offsetX < 0 ? -1 : 1;
          player.position.x += normalX * overlapX;
        } else {
          normalZ = offsetZ < 0 ? -1 : 1;
          player.position.z += normalZ * overlapZ;
        }

        const normal = new THREE.Vector3(normalX, 0, normalZ);
        const inwardSpeed = playerVelocity.dot(normal);
        if (inwardSpeed < 0) playerVelocity.addScaledVector(normal, -inwardSpeed);
      });
    });
  }
}

function resolveOpenSeaInstallationCollisions() {
  if (state.sceneId !== 'realistic-beach' || !openSeaOrbitGroup) return;
  // Solve against the original stationary geometry in the orbit's frame.
  // Subtract the wall's angular velocity so it can gently push a still avatar.
  const position = player.position.clone();
  position.z -= openSeaInstallationCenterZ;
  const wallVelocity = new THREE.Vector3(position.z, 0, -position.x).multiplyScalar(openSeaOrbitActualSpeed);
  const velocity = playerVelocity.clone().sub(wallVelocity).applyAxisAngle(openSeaOrbitAxis, -openSeaOrbitAngle);
  position.applyAxisAngle(openSeaOrbitAxis, -openSeaOrbitAngle);
  position.z += openSeaInstallationCenterZ;
  resolveOpenSeaLocalInstallationCollisions({ position }, velocity);
  position.z -= openSeaInstallationCenterZ;
  position.applyAxisAngle(openSeaOrbitAxis, openSeaOrbitAngle);
  wallVelocity.set(position.z, 0, -position.x).multiplyScalar(openSeaOrbitActualSpeed);
  position.z += openSeaInstallationCenterZ;
  player.position.copy(position);
  playerVelocity.copy(velocity.applyAxisAngle(openSeaOrbitAxis, openSeaOrbitAngle).add(wallVelocity));
}

function resolveOpenSeaLocalInstallationCollisions(player, playerVelocity) {
  if (state.sceneId !== 'realistic-beach') return;

  const horizontalRadius = getAvatarCollisionRadius();
  const verticalRadius = Math.min(avatarFloorClearance * 0.72, 1.35);
  const avatarCenterY = player.position.y + avatarRoot.position.y;
  const wallBottom = openSeaInstallationBaseY;
  const wallTop = openSeaInstallationBaseY + openSeaInstallationHeight;
  if (avatarCenterY - verticalRadius > wallTop || avatarCenterY + verticalRadius < wallBottom) return;

  // Resolve twice because an avatar can touch an inner/outer curve and an end
  // cap in the same frame, especially while using the forward boost.
  for (let pass = 0; pass < 2; pass += 1) {
    [-1, 1].forEach((sideSign) => {
      const centerX = sideSign * openSeaInstallationCenterX;
      const offsetX = player.position.x - centerX;
      const offsetZ = player.position.z - openSeaInstallationCenterZ;
      const distanceFromCenter = Math.hypot(offsetX, offsetZ);
      const nearThisSemicircle = sideSign * offsetX >= -horizontalRadius;
      const innerLimit = openSeaInstallationInnerRadius - horizontalRadius;
      const outerLimit = openSeaInstallationOuterRadius + horizontalRadius;

      if (nearThisSemicircle
        && distanceFromCenter > 0.0001
        && distanceFromCenter > innerLimit
        && distanceFromCenter < outerLimit) {
        const innerPush = distanceFromCenter - innerLimit;
        const outerPush = outerLimit - distanceFromCenter;
        const pushToInner = innerPush <= outerPush;
        const targetRadius = pushToInner ? innerLimit : outerLimit;
        const normalX = offsetX / distanceFromCenter;
        const normalZ = offsetZ / distanceFromCenter;

        player.position.x = centerX + normalX * targetRadius;
        player.position.z = openSeaInstallationCenterZ + normalZ * targetRadius;

        const normalSpeed = playerVelocity.x * normalX + playerVelocity.z * normalZ;
        const movingIntoWall = pushToInner ? normalSpeed > 0 : normalSpeed < 0;
        if (movingIntoWall) {
          playerVelocity.x -= normalX * normalSpeed;
          playerVelocity.z -= normalZ * normalSpeed;
        }
      }

      // Each semicircle has two straight end caps. They face the central
      // opening, so keep the avatar on that side of the cap plane.
      [-1, 1].forEach((endpointSign) => {
        const endpointInnerZ = openSeaInstallationCenterZ + endpointSign * openSeaInstallationInnerRadius;
        const endpointOuterZ = openSeaInstallationCenterZ + endpointSign * openSeaInstallationOuterRadius;
        const endpointMinZ = Math.min(endpointInnerZ, endpointOuterZ) - horizontalRadius;
        const endpointMaxZ = Math.max(endpointInnerZ, endpointOuterZ) + horizontalRadius;
        if (player.position.z < endpointMinZ || player.position.z > endpointMaxZ) return;

        const distanceFromCap = Math.abs(player.position.x - centerX);
        if (distanceFromCap >= horizontalRadius) return;

        const openingNormalX = -sideSign;
        player.position.x = centerX + openingNormalX * horizontalRadius;
        const velocityIntoCap = playerVelocity.x * sideSign;
        if (velocityIntoCap > 0) playerVelocity.x -= sideSign * velocityIntoCap;
      });
    });
  }
}

function getButterflyFloorFold() {
  let floorHeight = null;
  if (state.sceneId === 'realistic-beach') floorHeight = getOpenSeaFloorHeightAt(player.position.x, player.position.z);
  if (state.sceneId === 'sky') floorHeight = skyFloorHeight;
  if (['cinema', 'youtube-cinema'].includes(state.sceneId)) floorHeight = getCinemaFloorHeightAt(player.position.x, player.position.z);
  if (floorHeight === null) return 0;

  const distanceToFloor = player.position.y + avatarRoot.position.y - floorHeight;
  return 1 - THREE.MathUtils.smoothstep(distanceToFloor, avatarFloorClearance, avatarFloorClearance + 0.82);
}

function getAvatarCollisionRadius() {
  if (state.avatarId === 'butterfly') return 1.65;
  if (state.avatarId === 'light') return 1.25;
  return 1.1;
}

function updateLuminousBubblePhysics(delta) {
  if (state.sceneId !== 'luminous' || luminousBubbleBodies.length === 0) return;

  const elapsed = clock.elapsedTime;
  const boundaryRadius = 70;
  const bubbleRestitution = 0.9;
  const avatarRadius = getAvatarCollisionRadius();
  const avatarCenter = player.position;
  const collisionDelta = new THREE.Vector3();
  const collisionNormal = new THREE.Vector3();
  const relativeVelocity = new THREE.Vector3();
  const touchedInstances = new Set();

  luminousBubbleBodies.forEach((body) => {
    const wanderStrength = body.kind === 'object' ? 0.007 : 0.014;
    body.velocity.x += Math.sin(elapsed * 0.13 + body.phase) * wanderStrength * delta;
    body.velocity.y += Math.cos(elapsed * 0.11 + body.phase * 1.37) * wanderStrength * 0.72 * delta;
    body.velocity.z += Math.sin(elapsed * 0.09 + body.phase * 0.71) * wanderStrength * delta;

    const maximumSpeed = body.kind === 'object' ? 0.24 : 0.38;
    const minimumSpeed = body.kind === 'object' ? 0.055 : 0.085;
    const speed = body.velocity.length();
    if (speed > maximumSpeed) {
      body.velocity.multiplyScalar(maximumSpeed / speed);
    } else if (speed < minimumSpeed) {
      collisionNormal.set(
        Math.sin(body.phase * 1.91 + 0.4),
        Math.cos(body.phase * 1.27 + 1.1) * 0.7,
        Math.sin(body.phase * 0.83 + 2.2),
      ).normalize();
      body.velocity.lerp(collisionNormal.multiplyScalar(minimumSpeed), 1 - Math.exp(-0.42 * delta));
    }

    body.position.addScaledVector(body.velocity, delta);
    body.rotation.x += body.angularVelocity.x * delta;
    body.rotation.y += body.angularVelocity.y * delta;
    body.rotation.z += body.angularVelocity.z * delta;

    collisionDelta.copy(body.position).sub(avatarCenter);
    const avatarCollisionDistance = avatarRadius + body.radius;
    const avatarDistanceSquared = collisionDelta.lengthSq();
    if (avatarDistanceSquared < avatarCollisionDistance ** 2) {
      const avatarDistance = Math.sqrt(avatarDistanceSquared);
      if (avatarDistance > 0.0001) {
        collisionNormal.copy(collisionDelta).multiplyScalar(1 / avatarDistance);
      } else {
        collisionNormal.set(0, 1, 0);
      }
      body.position.addScaledVector(collisionNormal, avatarCollisionDistance - avatarDistance + 0.015);
      const approachSpeed = playerVelocity.dot(collisionNormal) - body.velocity.dot(collisionNormal);
      if (approachSpeed > 0) {
        body.velocity.addScaledVector(collisionNormal, approachSpeed * 1.18 + 0.22);
        body.velocity.addScaledVector(playerVelocity, 0.045 / Math.sqrt(body.mass));
        body.angularVelocity.x += collisionNormal.z * approachSpeed * 0.025;
        body.angularVelocity.z -= collisionNormal.x * approachSpeed * 0.025;
      }
    }

    const maximumDistance = boundaryRadius - body.radius;
    const boundaryDistance = body.position.length();
    if (boundaryDistance > maximumDistance) {
      collisionNormal.copy(body.position).multiplyScalar(1 / boundaryDistance);
      body.position.copy(collisionNormal).multiplyScalar(maximumDistance);
      const outwardSpeed = body.velocity.dot(collisionNormal);
      if (outwardSpeed > 0) {
        body.velocity.addScaledVector(collisionNormal, -(1 + bubbleRestitution) * outwardSpeed);
      }
    }
  });

  for (let firstIndex = 0; firstIndex < luminousBubbleBodies.length - 1; firstIndex += 1) {
    const first = luminousBubbleBodies[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < luminousBubbleBodies.length; secondIndex += 1) {
      const second = luminousBubbleBodies[secondIndex];
      collisionDelta.copy(second.position).sub(first.position);
      const minimumDistance = first.radius + second.radius;
      const distanceSquared = collisionDelta.lengthSq();
      if (distanceSquared >= minimumDistance ** 2) continue;

      const distance = Math.sqrt(distanceSquared);
      if (distance > 0.0001) {
        collisionNormal.copy(collisionDelta).multiplyScalar(1 / distance);
      } else {
        collisionNormal.set(
          Math.sin(first.phase + second.phase),
          Math.cos(first.phase - second.phase),
          Math.sin(first.phase * 0.7 - second.phase),
        ).normalize();
      }

      const inverseFirstMass = 1 / first.mass;
      const inverseSecondMass = 1 / second.mass;
      const inverseMassSum = inverseFirstMass + inverseSecondMass;
      const overlap = minimumDistance - distance + 0.002;
      first.position.addScaledVector(collisionNormal, -overlap * inverseFirstMass / inverseMassSum);
      second.position.addScaledVector(collisionNormal, overlap * inverseSecondMass / inverseMassSum);

      relativeVelocity.copy(second.velocity).sub(first.velocity);
      const approachSpeed = relativeVelocity.dot(collisionNormal);
      if (approachSpeed < 0) {
        const impulse = -(1 + bubbleRestitution) * approachSpeed / inverseMassSum;
        first.velocity.addScaledVector(collisionNormal, -impulse * inverseFirstMass);
        second.velocity.addScaledVector(collisionNormal, impulse * inverseSecondMass);
      }
    }
  }

  luminousBubbleBodies.forEach((body) => {
    if (body.kind === 'object') {
      body.object.position.copy(body.position);
      body.object.rotation.copy(body.rotation);
      return;
    }

    luminousPhysicsDummy.position.copy(body.position);
    luminousPhysicsDummy.rotation.copy(body.rotation);
    luminousPhysicsDummy.scale.setScalar(body.radius);
    luminousPhysicsDummy.updateMatrix();
    body.object.setMatrixAt(body.index, luminousPhysicsDummy.matrix);
    touchedInstances.add(body.object);
  });
  touchedInstances.forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
  });
}

function updateCamera(delta, snap = false) {
  const forward = getViewDirection();
  const cameraLift = state.sceneId === 'realistic-beach' ? 5.5 : 2.2;
  const thirdPersonPosition = player.position.clone().addScaledVector(forward, -cameraDistance).add(new THREE.Vector3(0, cameraLift, 0));
  const firstPersonPosition = player.position.clone().add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(forward, 0.18);
  const firstPersonBlend = 1 - THREE.MathUtils.smoothstep(cameraDistance, firstPersonDistance, firstPersonBlendStart);
  const desiredPosition = thirdPersonPosition.lerp(firstPersonPosition, firstPersonBlend);
  if (state.sceneId === 'sphere') {
    const maximumCameraDistance = sphereRadius - 0.65;
    if (desiredPosition.length() > maximumCameraDistance) desiredPosition.setLength(maximumCameraDistance);
  } else if (state.sceneId === 'cube') {
    const maximumCameraDistance = cubeHalfExtent - 0.65;
    desiredPosition.x = THREE.MathUtils.clamp(desiredPosition.x, -maximumCameraDistance, maximumCameraDistance);
    desiredPosition.y = THREE.MathUtils.clamp(desiredPosition.y, -maximumCameraDistance, maximumCameraDistance);
    desiredPosition.z = THREE.MathUtils.clamp(desiredPosition.z, -maximumCameraDistance, maximumCameraDistance);
  } else if (state.sceneId === 'cylinder') {
    const maximumCameraRadius = cylinderRadius - 0.65;
    const horizontalDistance = Math.hypot(desiredPosition.x, desiredPosition.z);
    if (horizontalDistance > maximumCameraRadius) {
      const scale = maximumCameraRadius / horizontalDistance;
      desiredPosition.x *= scale;
      desiredPosition.z *= scale;
    }
    desiredPosition.y = THREE.MathUtils.clamp(desiredPosition.y, -cylinderHalfHeight + 0.65, cylinderHalfHeight - 0.65);
  } else if (['cinema', 'youtube-cinema'].includes(state.sceneId)) {
    desiredPosition.x = THREE.MathUtils.clamp(desiredPosition.x, -cinemaHalfWidth + 0.55, cinemaHalfWidth - 0.55);
    desiredPosition.z = THREE.MathUtils.clamp(desiredPosition.z, -cinemaHalfDepth + 0.55, cinemaHalfDepth - 0.55);
    const localFloor = getCinemaFloorHeightAt(desiredPosition.x, desiredPosition.z);
    desiredPosition.y = THREE.MathUtils.clamp(desiredPosition.y, localFloor + 0.55, cinemaCeiling - 0.55);
  }
  const desiredFloorHeight = getCameraFloorHeight(desiredPosition.x, desiredPosition.z);
  if (desiredFloorHeight !== null) desiredPosition.y = Math.max(desiredPosition.y, desiredFloorHeight + 0.58);
  const targetHeight = 1;
  const targetDistance = state.sceneId === 'realistic-beach' ? 12 : 5.5;
  const target = player.position.clone().add(new THREE.Vector3(0, targetHeight, 0)).addScaledVector(forward, targetDistance);
  const cameraBlend = snap ? 1 : 1 - Math.pow(0.0005, delta);
  camera.position.lerp(desiredPosition, cameraBlend);
  const cameraFloorHeight = getCameraFloorHeight(camera.position.x, camera.position.z);
  if (cameraFloorHeight !== null) camera.position.y = Math.max(camera.position.y, cameraFloorHeight + 0.58);
  if (firstPersonBlend > 0.999) {
    camera.position.copy(desiredPosition);
    avatarHiddenForFirstPerson = true;
  } else if (avatarHiddenForFirstPerson && firstPersonBlend < 0.9 && camera.position.distanceTo(firstPersonPosition) > 0.65) {
    avatarHiddenForFirstPerson = false;
  }
  avatarRoot.visible = !avatarHiddenForFirstPerson;
  cameraLookMatrix.lookAt(camera.position, target, camera.up);
  cameraDesiredQuaternion.setFromRotationMatrix(cameraLookMatrix);
  camera.quaternion.slerp(cameraDesiredQuaternion, cameraBlend);
  if (snap) camera.updateMatrixWorld();
}

function getCameraFloorHeight(x, z) {
  if (state.sceneId === 'realistic-beach') return getOpenSeaFloorHeightAt(x, z);
  if (state.sceneId === 'sky') return skyFloorHeight;
  if (['cinema', 'youtube-cinema'].includes(state.sceneId)) return getCinemaFloorHeightAt(x, z);
  return null;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (openSeaOrbitGroup) {
    // Keep angles unwrapped: damping across a 2π -> 0 reset would reverse
    // the orbit. A short response softens starts and irregular frame timing.
    openSeaOrbitTargetAngle += openSeaOrbitSpeed * delta;
    const previousAngle = openSeaOrbitAngle;
    openSeaOrbitAngle = THREE.MathUtils.damp(openSeaOrbitAngle, openSeaOrbitTargetAngle, 8, delta);
    openSeaOrbitActualSpeed = delta > 0 ? (openSeaOrbitAngle - previousAngle) / delta : 0;
    openSeaOrbitGroup.rotation.y = openSeaOrbitAngle;
    // The renderer updates the hierarchy before shadows and reflections;
    // collision resolution uses the same angle directly, without a traversal.
  }
  updateGamepadInput(delta);
  updatePlayer(delta);
  updateLuminousBubblePhysics(delta);
  updateCamera(delta);
  updateFlashlight();
  updateParticlePalette(delta);
  updateCinemaProjectionLight(delta);
  openSeaSkyTime.value = clock.elapsedTime;
  openSeaCloudVolume?.update(renderer, camera);
  const realisticWaterTime = realisticBeachWater?.material?.uniforms?.time;
  if (realisticWaterTime) {
    realisticWaterTime.value = clock.elapsedTime;
  }
  updateRealisticSeaPrismTexture(clock.elapsedTime);
  avatarRoot.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.08;
  const avatarPitchTarget = state.avatarId === 'butterfly' ? pitch : 0;
  avatarRoot.rotation.x = THREE.MathUtils.damp(avatarRoot.rotation.x, avatarPitchTarget, 6.5, delta);
  const floorFold = state.avatarId === 'butterfly' ? getButterflyFloorFold() : 0;
  let flightMovement = false;
  for (const key of movementKeys) {
    if (keys.has(key)) {
      flightMovement = true;
      break;
    }
  }
  if (Math.abs(gamepadInput.moveX) > 0.08 || Math.abs(gamepadInput.moveY) > 0.08
    || gamepadInput.ascend > 0.08 || gamepadInput.descend > 0.08) flightMovement = true;
  const flutterTarget = flightMovement && state.avatarId === 'butterfly' ? 1 : 0;
  butterflyFlutterBlend = THREE.MathUtils.damp(butterflyFlutterBlend, flutterTarget, 5, delta);
  const forwardBoostFlutterTarget = forwardBoostActive
    && forwardBoostFlutterRemaining > 0
    && state.avatarId === 'butterfly' ? 1 : 0;
  forwardBoostFlutterBlend = THREE.MathUtils.damp(forwardBoostFlutterBlend, forwardBoostFlutterTarget, 8, delta);
  const flutterSpeed = THREE.MathUtils.lerp(3.1, 7.2, butterflyFlutterBlend) + forwardBoostFlutterBlend * 4.6;
  const flutterAmount = THREE.MathUtils.lerp(0.11, 0.24, butterflyFlutterBlend) + forwardBoostFlutterBlend * 0.16;
  butterflyFlutterPhase += delta * flutterSpeed;
  const flutter = Math.sin(butterflyFlutterPhase) * flutterAmount;
  avatarRoot.children.forEach((part) => {
    if (part.userData.flutterSide) {
      part.rotation.y = part.userData.baseRotationY + flutter * part.userData.flutterSide;
      part.rotation.z = part.userData.baseRotationZ + flutter * 0.35 * part.userData.flutterSide;
      const lowerWing = part.userData.lowerWing;
      if (lowerWing) {
        lowerWing.rotation.z = THREE.MathUtils.damp(
          lowerWing.rotation.z,
          lowerWing.userData.baseRotationZ + floorFold * lowerWing.userData.floorFoldSide * 0.52,
          7.5,
          delta,
        );
      }
    }
  });
  updateButterflyDust(delta);
  stage.traverse((object) => {
    const lunarWindShader = object.material?.userData?.openSeaLunarWind?.shader;
    if (object.material?.userData?.openSeaVideoSurface) {
      // Show the lit structure while remote media is unavailable, rather than
      // a black, unlit video frame that conceals every lighting adjustment.
      object.visible = state.openSeaMode !== 'dawn' || videoElement.readyState >= 2;
    }
    if (lunarWindShader) {
      lunarWindShader.uniforms.uOpenSeaLunarWindTime.value = clock.elapsedTime;
    }
    const timeUniform = object.material?.uniforms?.uTime;
    if (object.userData.beachTime && timeUniform) {
      timeUniform.value = clock.elapsedTime;
    }
    if (object.userData.beachFoam) {
      const { phase, baseOpacity } = object.userData.beachFoam;
      const opacityUniform = object.material?.uniforms?.uOpacity;
      if (opacityUniform) {
        opacityUniform.value = baseOpacity + Math.sin(clock.elapsedTime * 0.8 + phase) * 0.055;
      }
      object.position.z = Math.sin(clock.elapsedTime * 0.34 + phase) * 0.16;
    }
    if (object.userData.realisticTide) {
      const { phase, amplitude, speed, baseZ } = object.userData.realisticTide;
      object.position.z = baseZ + Math.sin(clock.elapsedTime * speed + phase) * amplitude;
    }
    if (object.userData.beachCloud) {
      const { baseX, phase } = object.userData.beachCloud;
      object.position.x = baseX + Math.sin(clock.elapsedTime * 0.045 + phase) * 1.4;
    }
    if (object.userData.beachReflection) {
      const { phase, baseOpacity, baseScaleX } = object.userData.beachReflection;
      const shimmer = Math.sin(clock.elapsedTime * 0.9 + phase);
      object.material.opacity = baseOpacity * (0.72 + shimmer * 0.28);
      object.scale.x = baseScaleX * (0.92 + shimmer * 0.08);
    }
    if (object.userData.beachPlant) {
      object.rotation.z = Math.sin(clock.elapsedTime * 0.24 + object.userData.beachPlant.phase) * 0.018;
    }
    if (object.userData.openSeaStars) {
      const { baseOpacity, phase } = object.userData.openSeaStars;
      object.material.opacity = baseOpacity * (0.78 + Math.sin(clock.elapsedTime * 0.72 + phase) * 0.22);
    }
    if (object.userData.openSeaIslandFoam) {
      const { baseOpacity, phase } = object.userData.openSeaIslandFoam;
      const pulse = Math.sin(clock.elapsedTime * 0.52 + phase);
      object.material.opacity = baseOpacity * (0.72 + pulse * 0.28);
      const scale = 1 + pulse * 0.018;
      object.scale.set(scale, 1, scale);
    }
    if (object.userData.openSeaIslandPalmLeaf) {
      const { baseRotationX, baseRotationZ, phase } = object.userData.openSeaIslandPalmLeaf;
      const sway = Math.sin(clock.elapsedTime * 0.64 + phase) * 0.028;
      object.rotation.x = baseRotationX + sway;
      object.rotation.z = baseRotationZ + sway * 0.5;
    }
    if (object.userData.openSeaLunarFlowerLayer) {
      const { phase, glow, baseGlowOpacity } = object.userData.openSeaLunarFlowerLayer;
      const breeze = clock.elapsedTime * 0.62 + phase;
      glow.material.opacity = baseGlowOpacity * (0.88 + Math.sin(breeze * 1.2) * 0.12);
    }
    if (object.userData.openSeaLunarIslandLight) {
      const { baseIntensity, phase } = object.userData.openSeaLunarIslandLight;
      object.intensity = baseIntensity * (0.94 + Math.sin(clock.elapsedTime * 0.7 + phase) * 0.06);
    }
    if (object.userData.butterflyGroundGlow) {
      object.position.x = player.position.x;
      object.position.z = player.position.z;
      const heightFade = THREE.MathUtils.clamp(1 - Math.max(0, player.position.y) / 9, 0.12, 1);
      const opacityUniform = object.material?.uniforms?.uOpacity;
      if (opacityUniform) {
        opacityUniform.value = state.avatarId === 'butterfly' ? heightFade * 0.11 : 0;
      }
    }
    if (object.userData.floatingParticles) {
      const { basePositions, phases, speeds, amplitudes } = object.userData.floatingParticles;
      const positionAttribute = object.geometry.attributes.position;
      for (let index = 0; index < phases.length; index += 1) {
        const verticalOffset = Math.sin(clock.elapsedTime * speeds[index] + phases[index]) * amplitudes[index];
        positionAttribute.setY(index, basePositions[index * 3 + 1] + verticalOffset);
      }
      positionAttribute.needsUpdate = true;
    }
    if (object.userData.luminousTime && timeUniform) {
      timeUniform.value = clock.elapsedTime;
    }
    if (object.userData.luminousFloat) {
      const { basePosition, baseRotation, phase, speed, amplitude, spin } = object.userData.luminousFloat;
      const motion = clock.elapsedTime * speed + phase;
      object.position.set(
        basePosition.x + Math.cos(motion * 0.73) * amplitude * 0.18,
        basePosition.y + Math.sin(motion) * amplitude,
        basePosition.z + Math.sin(motion * 0.51) * amplitude * 0.14,
      );
      object.rotation.set(
        baseRotation.x + Math.sin(motion * 0.4) * 0.025,
        baseRotation.y + clock.elapsedTime * spin,
        baseRotation.z + Math.cos(motion * 0.37) * 0.025,
      );
    }
    if (object.userData.luminousDust) {
      const { basePositions, phases, speeds, amplitudes } = object.userData.luminousDust;
      const positions = object.geometry.attributes.position;
      for (let index = 0; index < phases.length; index += 1) {
        positions.setY(index, basePositions[index * 3 + 1] + Math.sin(clock.elapsedTime * speeds[index] + phases[index]) * amplitudes[index]);
      }
      positions.needsUpdate = true;
    }
  });
  composer.render();
  if (state.sceneId === 'youtube-cinema') {
    youtubeRenderer.render(youtubeWorld, camera);
    renderAvatarOverYouTube();
  }
}

function makeLuminousGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.18, 'rgba(255, 246, 255, 0.5)');
  gradient.addColorStop(0.48, 'rgba(238, 218, 255, 0.17)');
  gradient.addColorStop(1, 'rgba(238, 218, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 1024, 576);
  gradient.addColorStop(0, '#263c78');
  gradient.addColorStop(0.5, '#d18dbc');
  gradient.addColorStop(1, '#f6c78d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255,255,255,.72)';
  context.font = '32px Georgia';
  context.fillText('belmont girl / liminal room', 42, 510);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  youtubeRenderer.setSize(window.innerWidth, window.innerHeight);
  avatarOverlayRenderer.setSize(window.innerWidth, window.innerHeight);
  avatarOverlayRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
