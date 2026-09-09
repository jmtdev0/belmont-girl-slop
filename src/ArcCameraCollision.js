// Intersect the camera boom with expanded, solid half-annuli. Analytic boundary
// crossings catch thin end caps even when both segment endpoints are outside.
export function clampArcCamera(anchor, desired, arcs, padding = 0.35) {
  const cosine = Math.cos(arcs.angle), sine = Math.sin(arcs.angle);
  const local = p => {
    const z = p.z - arcs.centerZ;
    return {x: cosine * p.x - sine * z, y: p.y, z: sine * p.x + cosine * z};
  };
  const a = local(anchor), b = local(desired);
  const d = {x: b.x - a.x, y: b.y - a.y, z: b.z - a.z};
  let first = 1;
  for (const side of [-1, 1]) {
    const x = a.x - side * arcs.centerX;
    const inner = arcs.innerRadius - padding, outer = arcs.outerRadius + padding;
    const bottom = arcs.bottom - padding, top = arcs.top + padding;
    const inside = t => {
      const px = x + d.x * t, pz = a.z + d.z * t, py = a.y + d.y * t;
      const r2 = px * px + pz * pz;
      return side * px >= -padding && py >= bottom && py <= top
        && r2 >= inner * inner && r2 <= outer * outer;
    };
    if (inside(0)) { first = 0; break; }
    const boundaries = [0, 1];
    if (Math.abs(d.y) > 1e-12) boundaries.push((bottom - a.y) / d.y, (top - a.y) / d.y);
    if (Math.abs(d.x) > 1e-12) boundaries.push((-side * padding - x) / d.x);
    const aa = d.x * d.x + d.z * d.z;
    const bb = 2 * (x * d.x + a.z * d.z);
    if (aa > 1e-12) for (const radius of [inner, outer]) {
      const discriminant = bb * bb - 4 * aa * (x * x + a.z * a.z - radius * radius);
      if (discriminant < 0) continue;
      const root = Math.sqrt(discriminant);
      boundaries.push((-bb - root) / (2 * aa), (-bb + root) / (2 * aa));
    }
    const sorted = boundaries.filter(t => t >= 0 && t <= 1).sort((u, v) => u - v);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (inside((sorted[i] + sorted[i + 1]) / 2)) { first = Math.min(first, sorted[i]); break; }
    }
  }
  if (first < 1) {
    const distance = anchor.distanceTo(desired);
    desired.lerpVectors(anchor, desired, Math.max(0, first - 0.01 / Math.max(distance, 0.01)));
  }
  return first < 1;
}
