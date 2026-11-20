import * as THREE from 'three';

/** Cosmetic motion only: positions, colliders, interaction targets and base geometry stay fixed. */
export function createFestivalBreeze(root: THREE.Object3D, campus?: THREE.Object3D) {
  const group = new THREE.Group();
  group.name = 'festival-breeze';
  group.visible = false;
  const time = { value: 0 };
  const strength = { value: 0 };

  // Keep the existing relief when paused. Each affected material is dedicated to the
  // two shared entrance flags or the festival canopy. Shared flags retain their
  // static relief in daytime; the existing festival/reduced-motion switch controls wind.
  const patched = new Set<THREE.Material>();
  for(const source of [root,...(campus?[campus]:[])])source.traverse((object) => {
    const flag = ['entrance-vietnam-flag','entrance-japan-flag','courtyard-vietnam-flag','courtyard-japan-flag'].includes(object.name);
    const canopy = object.name === 'clustered-route-canopies';
    const streetCrown=object.name==='campus-tree-crown';
    if ((!flag && !canopy && !streetCrown) || !(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (patched.has(material)) continue;
      patched.add(material);
      const previousCompile = material.onBeforeCompile;
      const materialProgramKey = material.customProgramCacheKey();
      material.customProgramCacheKey = () => materialProgramKey + (flag ? '|breeze-cloth-v1' : streetCrown?'|breeze-street-leaf-v1':'|breeze-leaf-v1');
      material.onBeforeCompile = function (this: THREE.Material, ...[shader, renderer]: Parameters<THREE.Material['onBeforeCompile']>) {
        previousCompile.call(this, shader, renderer);
        shader.uniforms.vjuBreezeTime = time;
        shader.uniforms.vjuBreezeStrength = strength;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float vjuBreezeTime;\nuniform float vjuBreezeStrength;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (flag ? `
            float clothTip = clamp((1.75 - position.x) / 3.5, 0.0, 1.0);
            float clothWave = sin(vjuBreezeTime * 2.4 - clothTip * 5.7 + position.y * 0.45);
            float clothRipple = sin(vjuBreezeTime * 3.7 - clothTip * 10.0 + position.y * 1.2);
            transformed.z += vjuBreezeStrength * clothTip * clothTip * (0.30 * clothWave + 0.07 * clothRipple);
            transformed.y += vjuBreezeStrength * clothTip * 0.08 * sin(vjuBreezeTime * 2.4 - clothTip * 3.1);
          ` : streetCrown ? `
            float phase = modelMatrix[3].x * 0.31 + modelMatrix[3].z * 0.19;
            float tipWeight = smoothstep(2.8, 7.5, position.y);
            transformed.x += sin(vjuBreezeTime * 1.1 + phase + position.y * 0.3) * 0.065 * tipWeight * vjuBreezeStrength;
            transformed.z += sin(vjuBreezeTime * 1.4 + phase + position.x) * 0.035 * tipWeight * vjuBreezeStrength;
          ` : `
            #ifdef USE_INSTANCING
              vec3 leafCentre = instanceMatrix[3].xyz;
              float leafPhase = leafCentre.x * 0.34 + leafCentre.z * 0.29;
              float leafWave = sin(vjuBreezeTime * 1.55 + leafPhase);
              float leafFlutter = sin(vjuBreezeTime * 2.8 + leafPhase * 1.7 + position.y);
              transformed.x += (0.18 * leafWave + 0.045 * leafFlutter) * vjuBreezeStrength;
              transformed.z += 0.13 * leafFlutter * vjuBreezeStrength;
            #endif
          `));
      };
      material.needsUpdate = true;
    }
  });

  // One draw call; independent phases and gentle scale-in/out avoid hard loop cuts.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.045, 0,  -0.12, 0, -0.04,  -0.085, 0.015, 0.08,
    0, 0, 0.15,  0.085, 0.015, 0.08,  0.12, 0, -0.04,
    0, 0, -0.11,
  ], 3));
  geometry.setIndex([0,1,2, 0,2,3, 0,3,4, 0,4,5, 0,5,6, 0,6,1]);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(geometry, material, 18);
  petals.name = 'wish-garden-drifting-petals';
  // Fixed small population; the loop moves each petal beyond its initial bounds.
  petals.frustumCulled = false;
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(petals);
  const stamp = new THREE.Object3D();
  const colours = [new THREE.Color(0xf5b588), new THREE.Color(0xe17b67), new THREE.Color(0xffdbc4)];
  for (let i = 0; i < petals.count; i++) petals.setColorAt(i, colours[i % colours.length]);

  function update(dt: number, enabled: boolean) {
    if (!enabled) {
      if (group.visible) {
        group.visible = false;
        strength.value = 0;
        time.value = 0;
      }
      return;
    }

    strength.value = 1;
    group.visible = true;
    time.value += Math.min(Math.max(dt, 0), 0.1);
    for (let i = 0; i < petals.count; i++) {
      const phase = i * 2.399963;
      const progress = (time.value / (7.6 + (i % 5) * 0.49) + i / petals.count) % 1;
      const wave = Math.sin(phase + progress * 6.28318);
      stamp.position.set(
        46.2 + (i % 6) * 1.08 + progress * 6.2 + 0.65 * wave,
        3.2 + (i % 4) * 0.35 - progress * 2.65 + 0.18 * wave,
        -11.5 + (i % 7) * 1.24 + 1.25 * Math.cos(phase + progress * 6.28318),
      );
      stamp.rotation.set(phase + progress * 4.4, phase - progress * 3.1, wave * 0.65);
      const envelope = Math.min(1, progress * 9, (1 - progress) * 8);
      stamp.scale.setScalar(envelope * (0.68 + (i % 3) * 0.16));
      stamp.updateMatrix();
      petals.setMatrixAt(i, stamp.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  }

  return { group, update };
}
