import * as THREE from 'three';

// A handful of low-poly silhouettes; no textures, lights or shadow passes.
function makeGullGeometry() {
  const positions = [], wingWeights = [];
  const triangle = (a, b, c, wing = 0) => {
    positions.push(...a, ...b, ...c);
    wingWeights.push(wing, wing, wing);
  };
  for (const side of [-1, 1]) {
    const edge = (t, back) => [
      side * (0.055 + t),
      Math.sin(t * Math.PI) * 0.16,
      t * t * 0.28 + (back ? 1 : -1) * (1 - t) * 0.13,
    ];
    for (let i = 0; i < 8; i++) {
      const a = i / 8, b = (i + 1) / 8;
      triangle(edge(a, false), edge(a, true), edge(b, false), 1);
      triangle(edge(a, true), edge(b, true), edge(b, false), 1);
    }
  }
  const nose = [0, 0.03, -0.32], tail = [0, 0, 0.28];
  const left = [-0.065, 0, 0], right = [0.065, 0, 0], top = [0, 0.07, 0];
  triangle(nose, left, top); triangle(nose, top, right);
  triangle(tail, top, left); triangle(tail, right, top);
  triangle(nose, right, left); triangle(tail, left, right);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.Float32BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  // Enclose all wing poses, not only the initially spread wings.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
  return { geometry, rest: attribute.array.slice(), wingWeights };
}

export function createDistantSeagulls({ random = Math.random } = {}) {
  const group = new THREE.Group();
  group.name = 'Distant passing seagulls';
  group.visible = false;
  const range = (min, max) => THREE.MathUtils.lerp(min, max, random());
  const birds = Array.from({ length: 6 }, () => {
    const { geometry, rest, wingWeights } = makeGullGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: '#555b63', transparent: true, opacity: 0,
      depthWrite: false, side: THREE.DoubleSide, fog: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Distant gull';
    mesh.renderOrder = 2;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, rest, wingWeights, offset: new THREE.Vector3() };
  });
  const forward = new THREE.Vector3(), right = new THREE.Vector3();
  const centre = new THREE.Vector3(), travel = new THREE.Vector3();
  let waiting = range(8, 14), elapsed = 0, duration = 0, count = 0;

  function beginPass(camera) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    const depth = range(1500, 1900);
    centre.copy(camera.position).addScaledVector(forward, depth);
    centre.y += depth * range(0.3, 0.46);
    travel.copy(right).multiplyScalar(random() < 0.5 ? -1 : 1);
    // An oblique crossing keeps the wings readable instead of edge-on.
    travel.addScaledVector(forward, range(0.5, 0.8) * (random() < 0.5 ? -1 : 1)).normalize();
    const heading = Math.atan2(-travel.x, -travel.z);
    duration = range(32, 42);
    elapsed = 0;
    count = 3 + Math.floor(random() * 4);
    group.visible = true;
    birds.forEach((bird, i) => {
      bird.mesh.visible = i < count;
      bird.mesh.material.opacity = 0;
      bird.offset.copy(right).multiplyScalar(range(-90, 90));
      bird.offset.addScaledVector(forward, range(-110, 110));
      bird.offset.y = range(-45, 45);
      bird.mesh.scale.setScalar(range(12, 16));
      bird.heading = heading + range(-0.15, 0.15);
      bird.phase = range(0, Math.PI * 2);
      bird.flapSpeed = range(4.5, 6.5);
      bird.delay = i * range(0.3, 0.7);
      bird.distance = range(1500, 1800);
    });
  }

  function update(delta, camera, active) {
    // Entry and hidden tabs must not consume the wait or reveal a flock.
    if (!active) { group.visible = false; return; }
    if (duration === 0) {
      waiting -= delta;
      if (waiting > 0) return;
      beginPass(camera);
    }
    group.visible = true;
    elapsed += delta;
    for (let i = 0; i < count; i++) {
      const bird = birds[i], age = elapsed - bird.delay;
      const progress = THREE.MathUtils.clamp(age / duration, 0, 1);
      const fade = THREE.MathUtils.smoothstep(age, 0, 5)
        * (1 - THREE.MathUtils.smoothstep(age, duration - 6, duration));
      bird.mesh.position.copy(centre).add(bird.offset)
        .addScaledVector(travel, (progress - 0.5) * bird.distance);
      bird.mesh.position.y += Math.sin(age * 0.28 + bird.phase) * 12;
      // If the avatar flies towards a passing flock, let it fade into the sky.
      const distanceFade = THREE.MathUtils.smoothstep(
        bird.mesh.position.distanceTo(camera.position), 350, 750,
      );
      bird.mesh.material.opacity = fade * distanceFade * 0.68;
      bird.mesh.rotation.set(0.12, bird.heading, Math.sin(age * 0.3 + bird.phase) * 0.15);
      const flapping = THREE.MathUtils.smoothstep(Math.sin(age * 0.55 + bird.phase), -0.15, 0.65);
      const angle = 0.08 + Math.sin(age * bird.flapSpeed + bird.phase) * 0.48 * flapping;
      const positions = bird.mesh.geometry.attributes.position;
      for (let v = 0; v < positions.count; v++) {
        if (!bird.wingWeights[v]) continue;
        const x = bird.rest[v * 3];
        positions.setX(v, x * Math.cos(angle));
        positions.setY(v, bird.rest[v * 3 + 1] + Math.abs(x) * Math.sin(angle));
      }
      positions.needsUpdate = true;
    }
    if (elapsed >= duration + 4) {
      group.visible = false;
      duration = 0;
      waiting = range(28, 55);
    }
  }

  // The scene owns and disposes the group's geometries/materials on exit.
  return { group, update };
}
