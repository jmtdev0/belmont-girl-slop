import * as THREE from 'three';

// One surface function drives the mesh, planting and walking height.
export function gardenHeight(x, z) {
  const angle = Math.atan2(z / 122, x / 158);
  const shore = 1 + 0.13 * Math.sin(3 * angle + 0.8) + 0.07 * Math.sin(7 * angle - 1.4);
  const radius = Math.hypot(x / 158, z / 122) / shore;
  const land = 1 - THREE.MathUtils.smoothstep(radius, 0.62, 1.05);
  const hills = 5 + 7 * Math.exp(-((x + 48) ** 2 + (z + 22) ** 2) / 2300)
    + 4 * Math.exp(-((x - 65) ** 2 + (z + 40) ** 2) / 1500);
  return -3 + land * (hills + 1.1 * Math.sin(x * 0.047) * Math.cos(z * 0.052));
}

function pathDistance(x, z) {
  const spine = 13 * Math.sin(z * 0.032) + 6 * Math.sin(z * 0.071);
  return Math.min(Math.abs(x - spine), Math.hypot(x - 6, z + 12) - 12);
}

function petalGeometry(rows = 8, columns = 4) {
  const positions = [], colors = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = 0.68 * Math.pow(Math.sin(Math.PI * t), 0.85) + 0.018;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns * 2 - 1;
      positions.push(u * width, 0.18 * Math.sin(Math.PI * t) + 0.32 * t * t
        + 0.17 * u * u * Math.sin(Math.PI * t), 0.12 + 2.15 * t);
      const c = new THREE.Color().lerpColors(new THREE.Color('#a6c9bc'), new THREE.Color('#fffef4'), Math.min(1, t * 4));
      c.multiplyScalar(1 - 0.08 * Math.abs(u));
      colors.push(c.r, c.g, c.b);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
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

export function makeLunarGarden() {
  let seed = 0x174be;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const garden = new THREE.Group();
  garden.name = 'Lunar Tear garden';
  const ground = new THREE.PlaneGeometry(400, 340, 160, 136);
  ground.rotateX(-Math.PI / 2);
  const positions = ground.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = gardenHeight(x, z);
    positions.setY(i, y);
    const path = 1 - THREE.MathUtils.smoothstep(pathDistance(x, z), 4, 10);
    const c = new THREE.Color('#314b43').lerp(new THREE.Color('#686b62'), path * 0.7);
    c.lerp(new THREE.Color('#293d41'), 1 - THREE.MathUtils.smoothstep(y, -1, 2));
    c.multiplyScalar(0.9 + 0.16 * Math.sin(x * 0.37 + Math.sin(z * 0.2)));
    colors.push(c.r, c.g, c.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const terrain = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({vertexColors: true,
    roughness: 0.94, emissive: '#152329', emissiveIntensity: 0.28}));
  terrain.receiveShadow = true;
  terrain.name = 'Sculpted moss and stone shore';
  garden.add(terrain);

  const flowers = [];
  for (let attempt = 0; attempt < 18000 && flowers.length < 1100; attempt++) {
    const x = (random() - 0.5) * 350, z = (random() - 0.5) * 285;
    const y = gardenHeight(x, z);
    const patch = 0.5 + 0.26 * Math.sin(x * 0.065 + Math.sin(z * 0.043) * 2)
      + 0.24 * Math.cos(z * 0.091 - x * 0.024);
    if (y < 0.9 || pathDistance(x, z) < 7 || random() > patch * 0.9) continue;
    if (flowers.some(f => (f.x - x) ** 2 + (f.z - z) ** 2 < 12)) continue;
    flowers.push({x, z, y, height: 2.1 + random() * 2.8, size: 0.65 + random() * 0.65,
      turn: random() * Math.PI * 2, tilt: (random() - 0.5) * 0.4});
  }
  const petalMaterial = new THREE.MeshStandardMaterial({color: '#ffffff', vertexColors: true,
    emissive: '#d4f7ec', emissiveIntensity: 0.65, roughness: 0.55, side: THREE.DoubleSide});
  const green = new THREE.MeshStandardMaterial({color: '#416557', roughness: 0.9,
    emissive: '#152e26', emissiveIntensity: 0.3, side: THREE.DoubleSide});
  const petals = new THREE.InstancedMesh(petalGeometry(), petalMaterial, flowers.length * 5);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.09, 1, 5), green, flowers.length);
  const leaves = new THREE.InstancedMesh(petalGeometry(5, 2), green, flowers.length * 3);
  const hearts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({color: '#d9e7ab', emissive: '#e5f6bd', emissiveIntensity: 0.5}), flowers.length);
  const dummy = new THREE.Object3D();
  const put = (mesh, index, x, y, z, rx, ry, rz, sx, sy, sz) => {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
  };
  flowers.forEach((f, i) => {
    put(stems, i, f.x, f.y + f.height / 2, f.z, 0, 0, 0, 1, f.height, 1);
    for (let p = 0; p < 5; p++) {
      put(petals, i * 5 + p, f.x, f.y + f.height, f.z, f.tilt, f.turn + p * Math.PI * 2 / 5,
        0, f.size, f.size, f.size);
    }
    for (let l = 0; l < 3; l++) {
      put(leaves, i * 3 + l, f.x, f.y + f.height * (0.18 + l * 0.17), f.z,
        -0.4, f.turn + l * 2.4, 0, 0.32, 0.7, 0.7);
    }
    put(hearts, i, f.x, f.y + f.height + 0.1, f.z, 0, 0, 0, f.size, f.size, f.size);
  });
  const colliders = flowers.map(f => ({
    x: f.x, z: f.z, bottom: f.y + 0.6, top: f.y + f.height,
    radius: f.size * 0.85, kind: 'flower',
  }));
  // Bend weights keep each blossom and its leaves attached to its rooted stem.
  for (const mesh of [petals, stems, leaves, hearts]) {
    const weights = new Float32Array(mesh.count * 2);
    for (let i = 0; i < mesh.count; i++) {
      weights[i * 2] = mesh === stems ? 0 : mesh === leaves ? 0.18 + (i % 3) * 0.17 : 1;
      weights[i * 2 + 1] = mesh === stems ? 1 : 0;
    }
    mesh.geometry.setAttribute('aLunarBend', new THREE.InstancedBufferAttribute(weights, 2));
  }
  // Smooth spatial fields create moving gusts: nearby flowers sway together,
  // while different patches vary in strength, phase and direction.
  for (const material of [petalMaterial, green, hearts.material]) {
    material.userData.openSeaLunarWind = {shader: null};
    material.onBeforeCompile = shader => {
      shader.uniforms.uOpenSeaLunarWindTime = {value: 0};
      material.userData.openSeaLunarWind.shader = shader;
      shader.vertexShader = 'uniform float uOpenSeaLunarWindTime;\nattribute vec2 aLunarBend;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 lunarWindPosition = instanceMatrix[3].xz;
          float time = uOpenSeaLunarWindTime;
          float phase = lunarWindPosition.x * 0.045 + lunarWindPosition.y * 0.032
            + 1.2 * sin(lunarWindPosition.y * 0.025 - lunarWindPosition.x * 0.018);
          float gust = 0.65 + 0.35 * sin(time * 0.43 - lunarWindPosition.x * 0.024 + lunarWindPosition.y * 0.037);
          float wave = sin(time * 1.25 + phase)
            + 0.22 * sin(time * 2.1 + lunarWindPosition.x * 0.11 - lunarWindPosition.y * 0.085);
          float bend = clamp(aLunarBend.x + aLunarBend.y * (position.y + 0.5), 0.0, 1.0);
          vec3 breeze = vec3(wave * 0.7 * gust, 0.0,
            sin(time * 0.95 + phase + 0.9) * 0.3 * gust) * bend * bend;
          // Undo the orthogonal instance rotation/scale for a common wind direction.
          transformed += vec3(
            dot(instanceMatrix[0].xyz, breeze) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
            dot(instanceMatrix[1].xyz, breeze) / dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz),
            dot(instanceMatrix[2].xyz, breeze) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'lunar-garden-patch-gusts-v3';
  }
  for (const mesh of [petals, stems, leaves, hearts]) {
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 1; // Include the maximum shader wind displacement.
    garden.add(mesh);
  }
  petals.name = 'Five pointed cupped ivory petals';

  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({color: '#566b69', roughness: 0.8, emissive: '#132327', emissiveIntensity: 0.25}), 24);
  let count = 0;
  for (let attempt = 0; attempt < 5000 && count < rocks.count; attempt++) {
    const x = (random() - 0.5) * 370, z = (random() - 0.5) * 310, y = gardenHeight(x, z);
    if (y < -1.8 || y > 1.3 || pathDistance(x, z) < 10) continue;
    const size = 1.4 + random() ** 2 * 6;
    put(rocks, count++, x, y + size * 0.12, z, random(), random() * 6, random(), size * 1.4, size * 0.6, size);
    colliders.push({x, z, bottom: y + size * 0.12, top: y + size * 0.12,
      radius: size * 0.9, kind: 'rock'});
  }
  rocks.count = count; rocks.instanceMatrix.needsUpdate = true; rocks.computeBoundingSphere();
  rocks.receiveShadow = true; garden.add(rocks);
  const fill = new THREE.PointLight('#c6e8df', 65, 210, 2);
  fill.position.set(0, 22, 0); garden.add(fill);
  garden.userData.flowerCount = flowers.length;
  garden.userData.lunarColliders = colliders;
  return garden;
}

// Approximate flowers with vertical capsules and rocks with spheres. Small
// movement steps prevent boosted flight from skipping these narrow obstacles.
export function resolveLunarGardenCollisions(garden, previous, position, velocity, radius) {
  const colliders = garden.userData.lunarColliders;
  if (!colliders?.length) return;
  const start = previous.clone().sub(garden.position);
  const target = position.clone().sub(garden.position);
  if (Math.min(start.x, target.x) > 215 || Math.max(start.x, target.x) < -215
    || Math.min(start.z, target.z) > 185 || Math.max(start.z, target.z) < -185
    || Math.min(start.y, target.y) > 35) return;
  const steps = Math.max(1, Math.ceil(start.distanceTo(target) / 0.75));
  const step = target.sub(start).divideScalar(steps);
  const normal = new THREE.Vector3();
  for (let s = 0; s < steps; s++) {
    start.add(step);
    for (let pass = 0; pass < 3; pass++) {
      let touched = false;
      for (const obstacle of colliders) {
        const limit = radius + obstacle.radius;
        if (Math.abs(start.x - obstacle.x) > limit || Math.abs(start.z - obstacle.z) > limit
          || start.y < obstacle.bottom - limit || start.y > obstacle.top + limit) continue;
        normal.set(start.x - obstacle.x,
          start.y - THREE.MathUtils.clamp(start.y, obstacle.bottom, obstacle.top), start.z - obstacle.z);
        const distance = normal.length();
        if (distance >= limit) continue;
        if (distance > 1e-6) normal.divideScalar(distance);
        else if (step.lengthSq() > 1e-8) normal.copy(step).normalize().negate();
        else normal.set(1, 0, 0);
        start.addScaledVector(normal, limit - distance + 0.001);
        const inward = velocity.dot(normal);
        if (inward < 0) velocity.addScaledVector(normal, -inward);
        touched = true;
      }
      if (!touched) break;
    }
  }
  position.copy(start).add(garden.position);
}
