import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { phoneScreen } from '../mobile';

/**
 * Planting along the lake edge: grass tufts and wildflowers on the bank, reeds at the waterline,
 * lily pads and a few lotus blooms in the shallows, and scattered stones.
 *
 * Purely visual: nothing here changes the shoreline, the walkable area or any collider.
 * Everything is instanced (six draw calls) and placed deterministically, denser around the
 * places people actually visit and sparse along the far banks.
 */
const BANK_Y = 0.04, WATER_Y = 0.064;
/** Places near the water that visitors reach; planting is densest around them. */
const FOCUS: ReadonlyArray<readonly [number, number]> = [[137, -133], [129, -118], [110, -122], [160, -126], [147, -168], [105, -176], [60, -104], [0, -102]];

const sway = { value: 0 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function inside(x: number, z: number, polygon: THREE.Vector3[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

/** Adds a per-vertex colour attribute so several parts can be merged into one instanced mesh. */
function tint(geometry: THREE.BufferGeometry, color: (y: number) => THREE.ColorRepresentation) {
  const position = geometry.getAttribute('position'), colors = new Float32Array(position.count * 3), c = new THREE.Color();
  for (let i = 0; i < position.count; i++) { c.set(color(position.getY(i))); colors.set([c.r, c.g, c.b], i * 3); }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

function grassTuft() {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const height = 0.3 + (i % 3) * 0.09, width = 0.035, lean = 0.1 + (i % 2) * 0.1;
    const blade = new THREE.BufferGeometry();
    // A bent, tapering blade: two quads and a tip.
    blade.setAttribute('position', new THREE.Float32BufferAttribute([
      -width, 0, 0, width, 0, 0, -width * 0.7, height * 0.5, lean * 0.4,
      width, 0, 0, width * 0.7, height * 0.5, lean * 0.4, -width * 0.7, height * 0.5, lean * 0.4,
      -width * 0.7, height * 0.5, lean * 0.4, width * 0.7, height * 0.5, lean * 0.4, 0, height, lean,
    ], 3));
    blade.rotateY(i * 1.05 + 0.3); blade.translate(Math.cos(i * 2.4) * 0.06, 0, Math.sin(i * 2.4) * 0.06);
    blade.computeVertexNormals();
    blades.push(tint(blade, y => new THREE.Color('#4f7a3c').lerp(new THREE.Color('#a9c66a'), Math.min(1, y / 0.45))));
  }
  return mergeGeometries(blades)!;
}

function reed() {
  const stalk = tint(new THREE.CylinderGeometry(0.01, 0.024, 1.5, 5, 3).translate(0, 0.75, 0), y => new THREE.Color('#5d7f45').lerp(new THREE.Color('#9db86a'), y / 1.5));
  const head = tint(new THREE.CylinderGeometry(0.036, 0.04, 0.26, 6).translate(0, 1.36, 0), () => '#6b4a2f');
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0.12, 1.05, 0.05], 3));
  leaf.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  leaf.computeVertexNormals();
  const merged = mergeGeometries([stalk, head, tint(leaf, y => new THREE.Color('#58803f').lerp(new THREE.Color('#a4c06c'), y))])!;
  return merged;
}

function lotus() {
  const petals: THREE.BufferGeometry[] = [];
  for (const [n, tilt, reach, lift] of [[8, 1.0, 0.11, 0.03], [5, 0.45, 0.055, 0.06]] as const) {
    for (let i = 0; i < n; i++) {
      const petal = new THREE.SphereGeometry(1, 5, 4).scale(0.045, 0.012, 0.11);
      petal.translate(0, 0, reach); petal.rotateX(-tilt); petal.translate(0, lift, 0); petal.rotateY(i / n * Math.PI * 2 + (n === 5 ? 0.3 : 0));
      petals.push(tint(petal, () => '#ffffff'));
    }
  }
  petals.push(tint(new THREE.SphereGeometry(0.035, 6, 4).translate(0, 0.07, 0), () => '#f2c94c'));
  return mergeGeometries(petals)!;
}

/** Wind sway for upright plants: displacement grows with height, phase varies with position. */
function swaying(material: THREE.MeshLambertMaterial, strength: number, key: string) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uSway = sway;
    shader.vertexShader = 'uniform float uSway;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float swayPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
      #else
        float swayPhase = 0.0;
      #endif
      float swayAmount = position.y * position.y * ${strength.toFixed(3)};
      transformed.x += (sin(uSway * 1.5 + swayPhase) + 0.4 * sin(uSway * 3.1 + swayPhase * 1.7)) * swayAmount;
      transformed.z += cos(uSway * 1.1 + swayPhase) * swayAmount * 0.5;`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function createLakeShore(outlines: THREE.Vector3[][]) {
  const group = new THREE.Group(); group.name = 'lake-shore-planting';
  let seed = 20261120;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const budget = phoneScreen.matches ? 0.45 : 1;

  type Item = { x: number; y: number; z: number; yaw: number; scale: number; tilt?: number; color: THREE.Color; sy?: number };
  const grass: Item[] = [], flowers: Item[] = [], reeds: Item[] = [], pads: Item[] = [], blooms: Item[] = [], stones: Item[] = [];
  const grassColors = ['#ffffff', '#e9f3d2', '#d6e8b4', '#f3efc9'].map(c => new THREE.Color(c));
  const flowerColors = ['#ffffff', '#ffe27a', '#f6a6c1', '#c9a3ee', '#ff9d6b'].map(c => new THREE.Color(c));
  const padColors = ['#4f8a4a', '#5f9a52', '#467c47', '#6aa558'].map(c => new THREE.Color(c));
  const stoneColors = ['#9a9a90', '#86877f', '#aaa89b'].map(c => new THREE.Color(c));
  const pick = <V,>(list: V[]) => list[Math.floor(random() * list.length) % list.length];

  for (const outline of outlines) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 0.01) continue;
      const tx = (b.x - a.x) / length, tz = (b.z - a.z) / length;
      // Outward normal: the side of the segment that is not water.
      let nx = tz, nz = -tx;
      if (inside((a.x + b.x) / 2 + nx * 0.6, (a.z + b.z) / 2 + nz * 0.6, outline)) { nx = -nx; nz = -nz; }
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const nearness = Math.max(...FOCUS.map(([fx, fz]) => Math.exp(-(((mx - fx) ** 2 + (mz - fz) ** 2) / (34 * 34)))));
      const density = (0.16 + 0.84 * nearness) * budget;
      const at = (along: number, out: number) => ({ x: a.x + tx * along * length + nx * out, z: a.z + tz * along * length + nz * out });

      for (let n = Math.round(length * 2.4 * density + random()); n > 0; n--) {
        const p = at(random(), 0.15 + random() * random() * 2.6);
        if (inside(p.x, p.z, outline)) continue;
        grass.push({ ...p, y: BANK_Y, yaw: random() * 6.28, scale: 0.7 + random() * 1.1, color: pick(grassColors) });
        if (random() < 0.24) flowers.push({ x: p.x + (random() - 0.5) * 0.2, z: p.z + (random() - 0.5) * 0.2, y: BANK_Y + 0.2 + random() * 0.2, yaw: random() * 6.28, scale: 0.7 + random() * 0.7, color: pick(flowerColors) });
      }
      if (random() < 0.42 * density) { // a clump of reeds standing in the shallows
        const along = random(), size = 4 + Math.floor(random() * 6);
        for (let n = 0; n < size; n++) {
          const p = at(along + (random() - 0.5) * 0.25, -0.75 + random() * 1.1);
          reeds.push({ ...p, y: 0, yaw: random() * 6.28, scale: 0.75 + random() * 0.7, tilt: (random() - 0.5) * 0.16, color: pick(grassColors) });
        }
      }
      if (random() < 0.36 * density) { // lily pads drifting just off the bank
        const along = random(), size = 2 + Math.floor(random() * 5), off = 1.2 + random() * 2.2;
        for (let n = 0; n < size; n++) {
          const p = at(along + (random() - 0.5) * 0.5, -(off + (random() - 0.5) * 1.6));
          if (!inside(p.x, p.z, outline) || !inside(p.x - nx * 0.7, p.z - nz * 0.7, outline)) continue;
          const scale = 0.55 + random() * 0.75;
          pads.push({ ...p, y: WATER_Y + 0.012 + random() * 0.004, yaw: random() * 6.28, scale, color: pick(padColors) });
          if (random() < 0.28) blooms.push({ ...p, y: WATER_Y + 0.02, yaw: random() * 6.28, scale: 0.9 + random() * 0.6, color: random() < 0.6 ? new THREE.Color('#f7b3cf') : new THREE.Color('#fff6f0') });
        }
      }
      if (random() < 0.16 * density) {
        const p = at(random(), -0.3 + random() * 0.9), scale = 0.3 + random() * 0.5;
        stones.push({ ...p, y: 0.02, yaw: random() * 6.28, scale, sy: 0.45 + random() * 0.3, color: pick(stoneColors) });
      }
    }
  }

  const dummy = new THREE.Object3D();
  function build(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, items: Item[], stretch: (item: Item) => [number, number, number]) {
    if (!items.length) { geometry.dispose(); material.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    mesh.name = name;
    items.forEach((item, i) => {
      dummy.position.set(item.x, item.y, item.z); dummy.rotation.set(item.tilt ?? 0, item.yaw, 0);
      dummy.scale.set(...stretch(item)); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, item.color);
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = false; mesh.castShadow = false;
    group.add(mesh);
    return mesh;
  }

  const uniform = (item: Item): [number, number, number] => [item.scale, item.scale, item.scale];
  const grassMesh = build('shore-grass', grassTuft(), swaying(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.55, 'vju-shore-grass'), grass, item => [item.scale, item.scale * (0.8 + (item.scale % 0.37)), item.scale]);
  build('shore-reeds', reed(), swaying(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.05, 'vju-shore-reeds'), reeds, uniform);
  build('shore-flowers', new THREE.IcosahedronGeometry(0.055, 0).scale(1, 0.55, 1), new THREE.MeshLambertMaterial(), flowers, uniform);
  build('shore-lily-pads', new THREE.CircleGeometry(0.5, 16, 0.22, Math.PI * 2 - 0.44).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), pads, uniform);
  build('shore-lotus', lotus(), new THREE.MeshLambertMaterial({ vertexColors: true }), blooms, uniform);
  build('shore-stones', new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ flatShading: true }), stones, item => [item.scale, item.scale * (item.sy ?? 0.5), item.scale * 0.8]);

  // One clock for all sway, advanced once per rendered frame and frozen for reduced motion.
  let last = performance.now();
  if (grassMesh) grassMesh.onBeforeRender = () => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!document.hidden && !reducedMotion.matches && !document.body.classList.contains('reduced-motion')) sway.value += dt;
  };

  group.userData = { counts: { grass: grass.length, flowers: flowers.length, reeds: reeds.length, pads: pads.length, blooms: blooms.length, stones: stones.length } };
  return group;
}
