import * as T from 'three';
import { phoneScreen } from '../mobile';
import { lakeOutline, SATELLITE_LAKES } from '../scene/rearBackdrop';
import { createFishFood } from './fishFood';

/**
 * Koi school in the lake behind the dormitories. Original procedural fish: no external assets.
 *
 * Each fish steers on its own (wander + loose schooling + staying inside the pond), its body
 * bends in the vertex shader in time with its speed, and now and then one leaps along its
 * heading on a ballistic arc with rings and droplets where it leaves and re-enters the water.
 * The water material is opaque, so fish ride at the surface with only their backs showing.
 */
const POND = { x: 150, z: -148, rx: 47, rz: 16 };
const SURFACE = 0.064;
const GRAVITY = 9.8;
const DIVE_SECONDS = 2.6;

type Fish = {
  group: T.Group; tail: T.Group; finL: T.Mesh; finR: T.Mesh;
  swim: { value: number }; amp: { value: number };
  x: number; z: number; heading: number; speed: number; cruise: number; size: number;
  p1: number; p2: number; p3: number; w1: number; w2: number; w3: number;
  jump: { vy: number; y: number; forward: number } | null; dive: number;
};

/** Deterministic generator so the school looks the same on every visit. */
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Tapered fish body along z (head at -0.5, tail at +0.5), slightly flattened. */
function bodyGeometry() {
  const profile: T.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const s = i / 14;
    const radius = 0.16 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.62)), 0.75) + 0.012;
    profile.push(new T.Vector2(radius, s - 0.5));
  }
  const geometry = new T.LatheGeometry(profile, 14);
  geometry.rotateX(Math.PI / 2); // lathe axis (y) becomes the swimming axis (z)
  geometry.scale(1, 0.82, 1);
  geometry.computeVertexNormals();
  return geometry;
}

function koiTexture(variant: number, random: () => number) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const base = ['#f4efe4', '#f4efe4', '#eeb24c', '#f2e9da'][variant % 4];
  const patch = [['#d9502a', '#c8431f'], ['#d9502a', '#2c3331'], ['#f4efe4', '#d9502a'], ['#e8862e', '#d9502a']][variant % 4];
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = patch[i % 2];
    ctx.beginPath();
    // u wraps around the body, v runs head to tail: wide, soft-edged saddles read as koi markings.
    ctx.ellipse(random() * 256, 20 + random() * 215, 26 + random() * 46, 14 + random() * 26, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping;
  return texture;
}

export function createKoi(camera?:T.Camera) {
  const root = new T.Group(); root.name = 'lake-koi';
  const random = seeded(2011);
  const count = phoneScreen.matches ? 18 : 28;
  const outline=lakeOutline(SATELLITE_LAKES[1].points);
  function waterAt(x:number,z:number){
    let inside=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const a=outline[i],b=outline[j];
      if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
    }
    return inside;
  }
  function bankDistance(x:number,z:number){
    let best=Infinity;
    for(let i=1;i<outline.length;i++){
      const a=outline[i-1],b=outline[i],dx=b.x-a.x,dz=b.z-a.z;
      const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
      best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return best;
  }
  const food=createFishFood();

  const body = bodyGeometry();
  const tailShape = new T.Shape();
  tailShape.moveTo(0, 0); tailShape.quadraticCurveTo(0.16, 0.05, 0.3, 0.17); tailShape.quadraticCurveTo(0.2, 0, 0.3, -0.17); tailShape.quadraticCurveTo(0.16, -0.05, 0, 0);
  const tailGeometry = new T.ShapeGeometry(tailShape, 6); tailGeometry.rotateY(-Math.PI / 2); // fan in the y/z plane, trailing toward +z
  const finGeometry = new T.CircleGeometry(1, 10); finGeometry.rotateX(-Math.PI / 2); finGeometry.scale(0.11, 1, 0.06);
  const eyeGeometry = new T.SphereGeometry(0.016, 6, 5);
  const finMaterial = new T.MeshStandardMaterial({ color: '#f6e7d2', roughness: 0.5, transparent: true, opacity: 0.86, side: T.DoubleSide });
  const eyeMaterial = new T.MeshBasicMaterial({ color: '#16211f' });
  const textures = [0, 1, 2, 3].map(variant => koiTexture(variant, random));

  const fish: Fish[] = Array.from({ length: count }, (_, i) => {
    const group = new T.Group(); group.name = 'koi-' + i; group.rotation.order = 'YXZ'; root.add(group);
    const swim = { value: random() * 6 }, amp = { value: 0.05 };
    const material = new T.MeshStandardMaterial({ map: textures[i % textures.length], roughness: 0.32, metalness: 0.05 });
    material.onBeforeCompile = shader => {
      shader.uniforms.uSwim = swim; shader.uniforms.uAmp = amp;
      shader.vertexShader = 'uniform float uSwim;\nuniform float uAmp;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
        float koiS = clamp(position.z + 0.5, 0.0, 1.0);
        transformed.x += sin(uSwim - koiS * 4.2) * uAmp * (0.15 + koiS * koiS);`);
    };
    material.customProgramCacheKey = () => 'vju-koi-body';
    group.add(new T.Mesh(body, material));

    const tail = new T.Group(); tail.position.z = 0.47; group.add(tail);
    tail.add(new T.Mesh(tailGeometry, finMaterial));
    const fins = [-1, 1].map(side => {
      const fin = new T.Mesh(finGeometry, finMaterial);
      fin.position.set(side * 0.13, -0.02, -0.14); fin.rotation.y = side * 0.5; group.add(fin);
      const eye = new T.Mesh(eyeGeometry, eyeMaterial); eye.position.set(side * 0.075, 0.045, -0.4); group.add(eye);
      return fin;
    });

    const size = 0.75 + random() * 0.65;
    group.scale.setScalar(size);
    let x=POND.x,z=POND.z;
    for(let tries=0;tries<100;tries++){
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.9;
      x=POND.x+Math.cos(angle)*POND.rx*radius;z=POND.z+Math.sin(angle)*POND.rz*radius;
      if(waterAt(x,z)&&bankDistance(x,z)>1.5)break;
    }
    return {
      group, tail, finL: fins[0], finR: fins[1], swim, amp, size,
      x,z,
      heading: random() * Math.PI * 2, cruise: 0.65 + random() * 0.4, speed: 0.7,
      p1: random() * 9, p2: random() * 9, p3: random() * 9, w1: 0.23 + random() * 0.2, w2: 0.61 + random() * 0.3, w3: 0.13 + random() * 0.15,
      jump: null, dive: 0,
    };
  });

  // Rings on the surface: a small pool reused for leaps, landings and quiet "kisses".
  const ringGeometry = new T.RingGeometry(0.9, 1, 40); ringGeometry.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 12 }, () => {
    const mesh = new T.Mesh(ringGeometry, new T.MeshBasicMaterial({ color: '#e4f2ee', transparent: true, opacity: 0, depthWrite: false }));
    mesh.visible = false; mesh.position.y = SURFACE + 0.012; mesh.renderOrder = 2; root.add(mesh);
    return { mesh, age: 0, life: 0, radius: 1, strength: 0 };
  });
  function ring(x: number, z: number, radius: number, life: number, strength: number, delay = 0) {
    const free = rings.find(r => r.life === 0) ?? rings[0];
    free.mesh.visible = false;
    free.mesh.position.x = x; free.mesh.position.z = z; free.age = -delay; free.life = life; free.radius = radius; free.strength = strength;
  }

  // Droplets thrown up by a leap.
  const DROPS = 54;
  const drops = new T.InstancedMesh(new T.SphereGeometry(0.028, 5, 4), new T.MeshBasicMaterial({ color: '#f0f8f6', transparent: true, opacity: 0.85 }), DROPS);
  drops.frustumCulled = false; drops.name = 'koi-splash-drops'; root.add(drops);
  const drop = Array.from({ length: DROPS }, () => ({ x: 0, y: -1, z: 0, vx: 0, vy: 0, vz: 0, live: false }));
  const dummy = new T.Object3D();
  let dropCursor = 0;
  function spray(x: number, z: number, n: number, power: number, dirX: number, dirZ: number) {
    for (let i = 0; i < n; i++) {
      const d = drop[dropCursor = (dropCursor + 1) % DROPS], a = random() * Math.PI * 2, out = 0.4 + random() * 1.1;
      d.x = x; d.y = SURFACE; d.z = z; d.live = true;
      d.vx = Math.cos(a) * out + dirX * 0.7; d.vz = Math.sin(a) * out + dirZ * 0.7; d.vy = power * (0.55 + random() * 0.6);
    }
  }

  // A bounded pool: small bubbles rise through the opaque water, briefly catch
  // the light at the surface, then pop into a faint ring. No per-frame meshes.
  const BUBBLES = 24;
  const bubbleMesh = new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:'#e0f2ed',roughness:.18,transparent:true,opacity:.65,depthWrite:false}),BUBBLES);
  bubbleMesh.name='koi-dive-bubbles';bubbleMesh.frustumCulled=false;root.add(bubbleMesh);
  const bubbles=Array.from({length:BUBBLES},()=>({x:0,z:0,age:0,life:0,size:.06}));
  let bubbleCursor=0;
  function startDive(f:Fish){
    f.dive=DIVE_SECONDS;
    for(let i=0;i<6;i++){
      const b=bubbles[bubbleCursor++%BUBBLES],a=random()*Math.PI*2;
      b.x=f.x+Math.cos(a)*.25;b.z=f.z+Math.sin(a)*.25;
      b.age=-.18-i*.17;b.life=.85+random()*.3;b.size=.045+random()*.035;
    }
  }

  const bait=new T.InstancedMesh(new T.SphereGeometry(.065,5,4),new T.MeshBasicMaterial({color:'#c7954d'}),36);
  bait.name='koi-food';bait.frustumCulled=false;bait.count=0;root.add(bait);
  const launches=new Map<number,T.Vector3>();
  function renderFood(reduced:boolean){
    let n=0;
    for(const p of food.patches){
      const origin=launches.get(p.id)||new T.Vector3(p.x,1,p.z),u=reduced?1:T.MathUtils.clamp((clock-p.born)/.65,0,1);
      const remaining=Math.max(0,12-Math.floor(p.eaten.size*12/5));
      for(let i=0;i<remaining;i++){
        const angle=i*2.399,spread=.15+(i%4)*.16;
        dummy.position.set(T.MathUtils.lerp(origin.x,p.x+Math.cos(angle)*spread,u),T.MathUtils.lerp(origin.y,SURFACE+.07,u)+Math.sin(u*Math.PI)*1.8,T.MathUtils.lerp(origin.z,p.z+Math.sin(angle)*spread,u));
        dummy.scale.setScalar(1);dummy.updateMatrix();bait.setMatrixAt(n++,dummy.matrix);
      }
    }
    bait.count=n;bait.instanceMatrix.needsUpdate=true;
    for(const id of launches.keys())if(!food.patches.some(p=>p.id===id))launches.delete(id);
  }
  let last = -1, nextJump = 5, nextDive = 9, nextKiss = 2, clock = 0, placed = false;
  const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  // Steering is soft; this inner boundary also bounds leaps and low-frame-rate steps.
  function keepInPond(f: Fish) {
    const dx = f.x - POND.x, dz = f.z - POND.z;
    const radius = Math.hypot(dx / POND.rx, dz / POND.rz);
    if (radius > 0.94) {
      f.x = POND.x + dx * 0.94 / radius; f.z = POND.z + dz * 0.94 / radius;
      f.heading = Math.atan2(dx, dz);
    }
    // The rendered lake is curved; an ellipse alone can put a fish onto a bank.
    if(!waterAt(f.x,f.z)||bankDistance(f.x,f.z)<.9){
      for(let i=0;i<40&&(!waterAt(f.x,f.z)||bankDistance(f.x,f.z)<.9);i++){
        f.x=T.MathUtils.lerp(f.x,POND.x,.08);f.z=T.MathUtils.lerp(f.z,POND.z,.08);
      }
      f.heading=Math.atan2(f.x-POND.x,f.z-POND.z);
    }
  }

  function place(f: Fish, y: number, pitch: number, roll: number) {
    f.group.position.set(f.x, SURFACE - 0.035 * f.size + y, f.z);
    f.group.rotation.set(pitch, f.heading, roll);
  }

  function update(t: number, reduced: boolean, at?: T.Vector3) {
    const dt = last < 0 ? 0 : Math.min(Math.max(t - last, 0), 0.05); last = t;
    // Far from the lake nothing is visible: skip all work.
    const distance = at ? Math.hypot(at.x - POND.x, at.z - POND.z) : 0;
    root.visible = distance < 150;
    if (!root.visible || document.hidden) return;
    clock+=dt;food.update(clock,fish);renderFood(reduced);
    if(reduced){
      // Also honour reduced motion while a user-triggered meal is active.
      fish.forEach(f=>{f.jump=null;f.dive=0;});
      bubbles.forEach(b=>b.life=0);bubbleMesh.visible=false;
      drop.forEach(d=>d.live=false);rings.forEach(r=>{r.life=0;r.mesh.visible=false;});
    }else bubbleMesh.visible=true;
    if (reduced && !food.patches.length) { // User-triggered feeding can move fish; ambient motion stays frozen.
      if (!placed) {
        fish.forEach(f => { f.jump = null; f.dive = 0; f.amp.value = 0; f.tail.position.x = 0; f.tail.rotation.y = 0; f.finL.rotation.z = 0; f.finR.rotation.z = 0; place(f, 0, 0, 0); });
        drop.forEach(d => { d.live = false; }); nextJump = 6; placed = true;
      }
      rings.forEach(r => { r.mesh.visible = false; r.life = 0; }); drops.visible = false;
      return;
    }
    placed = false; drops.visible = !reduced;

    for (const f of fish) {
      const dirX = -Math.sin(f.heading), dirZ = -Math.cos(f.heading);
      if (f.jump) {
        const j = f.jump;
        j.vy -= GRAVITY * dt; j.y += j.vy * dt; f.x += dirX * j.forward * dt; f.z += dirZ * j.forward * dt;
        keepInPond(f);
        f.swim.value += dt * 26; f.amp.value = 0.09;
        if (j.y <= 0 && j.vy < 0) { // back into the water
          ring(f.x, f.z, 1.5 * f.size, 1.5, 0.6); ring(f.x, f.z, 2.4 * f.size, 2.3, 0.35, 0.22);
          spray(f.x, f.z, 12, 2.4, dirX, dirZ);
          f.jump = null; startDive(f); f.speed = 1.3;
          place(f, -0.05, -0.5, 0);
        } else place(f, j.y, Math.atan2(j.vy, j.forward) * 0.9, Math.sin(clock * 9 + f.p1) * 0.12);
        continue;
      }

      // Steering: keep going, drift toward the school, stay inside the pond, avoid neighbours.
      let wantX = dirX, wantZ = dirZ;
      const meal=food.target(fish.indexOf(f));
      const homeX=POND.x+Math.sin(clock*.025+f.p1)*POND.rx*.8,homeZ=POND.z+Math.cos(clock*.035+f.p2)*POND.rz*.65;
      const toX = (meal?.x??homeX) - f.x, toZ = (meal?.z??homeZ) - f.z, toLength = Math.hypot(toX, toZ) || 1;
      const edge = ((f.x - POND.x) / POND.rx) ** 2 + ((f.z - POND.z) / POND.rz) ** 2;
      const pull = meal?4:0.35 + Math.max(0, toLength - 8) * 0.07 + Math.max(0, edge - 0.65) * 4;
      wantX += toX / toLength * pull; wantZ += toZ / toLength * pull;
      for (const other of fish) {
        if (other === f || other.jump) continue;
        const ox = f.x - other.x, oz = f.z - other.z, gap = Math.hypot(ox, oz);
        if (gap > 0.001 && gap < 1.1) { const push = (1.1 - gap) / gap * 1.4; wantX += ox * push; wantZ += oz * push; }
      }
      const wander = meal?0:Math.sin(clock * f.w1 + f.p1) * 0.35 + Math.sin(clock * f.w2 + f.p2) * 0.2;
      const turn = T.MathUtils.clamp(angleDelta(f.heading, Math.atan2(-wantX, -wantZ)), -1.5 * dt, 1.5 * dt) + wander * dt;
      f.heading += turn;
      const turnRate = turn / Math.max(dt, 0.001);

      // Burst-and-glide: speed breathes slowly, quickens in turns, and keeps a kick after a landing.
      const target = meal?Math.min(3.2,1+toLength*.3):f.cruise * (0.7 + 0.45 * (0.5 + 0.5 * Math.sin(clock * f.w3 + f.p3))) + Math.min(0.5, Math.abs(turnRate) * 0.12);
      f.speed += (target - f.speed) * Math.min(1, dt * 1.4);
      f.x += dirX * f.speed * dt; f.z += dirZ * f.speed * dt;
      keepInPond(f);
      f.dive = Math.max(0, f.dive - dt);

      f.swim.value += dt * (3.2 + f.speed * 9);
      f.amp.value += ((0.035 + f.speed * 0.06) - f.amp.value) * Math.min(1, dt * 4);
      const divePhase=f.dive>0?1-f.dive/DIVE_SECONDS:0;
      const depth=Math.sin(divePhase*Math.PI)*.48;
      place(f, -depth + Math.sin(clock * 0.7 + f.p2) * 0.008, f.dive>0?-.2*Math.cos(divePhase*Math.PI):0, T.MathUtils.clamp(-turnRate * 0.12, -0.25, 0.25));
    }

    for (const f of fish) { // fins follow the body wave
      f.tail.position.x = Math.sin(f.swim.value - 4.2) * f.amp.value * 1.15;
      f.tail.rotation.y = Math.cos(f.swim.value - 4.2) * f.amp.value * 5.5;
      const paddle = Math.sin(f.swim.value * 0.5) * 0.25;
      f.finL.rotation.z = 0.25 + paddle; f.finR.rotation.z = -0.25 - paddle;
    }

    const reserved=(i:number)=>food.patches.some(p=>p.diners.has(i)&&!p.eaten.has(i));
    function nearbyReady(){
      const nearby=fish.filter((f,i)=>!reserved(i)&&!f.jump&&f.dive===0&&bankDistance(f.x,f.z)>2&&(!at||Math.hypot(f.x-at.x,f.z-at.z)<38))
        .sort((a,b)=>at?Math.hypot(a.x-at.x,a.z-at.z)-Math.hypot(b.x-at.x,b.z-at.z):0)
      if(camera){
        camera.updateWorldMatrix(true,false);
        const projected=new T.Vector3(),visible=nearby.filter(f=>{
          projected.set(f.x,SURFACE+.3,f.z).project(camera);
          return Math.abs(projected.x)<.75&&Math.abs(projected.y)<.75&&projected.z>=-1&&projected.z<=1;
        });
        if(visible.length)return visible.slice(0,6);
      }
      return nearby.slice(0,6);
    }
    if(!reduced)nextJump -= dt;
    if (nextJump <= 0 && !reduced) {
      const vy=3.5+random()*.7,forward=1.5+random()*.7,flight=2*vy/GRAVITY;
      const ready = nearbyReady().filter(f=>[.25,.5,.75,1].every(u=>{
        const x=f.x-Math.sin(f.heading)*forward*flight*u,z=f.z-Math.cos(f.heading)*forward*flight*u;
        return waterAt(x,z)&&bankDistance(x,z)>1.5&&Math.hypot((x-POND.x)/POND.rx,(z-POND.z)/POND.rz)<.93;
      }));
      const f = ready[Math.floor(random() * ready.length)];
      nextJump=f?8+random()*6:2;
      if (f) {
        f.jump = { vy, y: 0, forward };
        ring(f.x, f.z, 0.9 * f.size, 1.1, 0.5);
        spray(f.x, f.z, 6, 1.6, -Math.sin(f.heading), -Math.cos(f.heading));
      }
    }
    if(!reduced)nextDive-=dt;
    if(nextDive<=0&&!reduced){
      const ready=nearbyReady(),f=ready[Math.floor(random()*ready.length)];
      nextDive=f?10+random()*7:2;
      // One ambient dive at a time; landing dives can complete naturally.
      if(f&&!fish.some(other=>other.dive>0||other.jump)){ring(f.x,f.z,.5,1.2,.25);startDive(f);}
    }
    nextKiss -= dt;
    if (nextKiss <= 0 && !reduced) { // a fish touches the surface: one faint ring
      nextKiss = 1.8 + random() * 3.5;
      const f = fish[Math.floor(random() * fish.length)];
      if (!f.jump&&!f.dive) ring(f.x - Math.sin(f.heading) * 0.4 * f.size, f.z - Math.cos(f.heading) * 0.4 * f.size, 0.55, 1.6, 0.22);
    }

    for(let i=0;i<BUBBLES;i++){
      const b=bubbles[i];let scale=0;
      if(b.life>0){
        b.age+=dt;
        if(b.age>=b.life){ring(b.x,b.z,.22,.65,.25);b.life=0;}
        else if(b.age>=0){
          const u=b.age/b.life;scale=b.size*Math.min(1,u*5);
          dummy.position.set(b.x,SURFACE-.2+Math.min(1,u*2.5)*(.2+b.size*.65),b.z);
        }
      }
      dummy.scale.setScalar(scale);dummy.updateMatrix();bubbleMesh.setMatrixAt(i,dummy.matrix);
    }
    bubbleMesh.instanceMatrix.needsUpdate=true;

    for (const r of rings) {
      if (r.life === 0) continue;
      r.age += dt;
      if (r.age < 0) continue;
      const k = r.age / r.life;
      if (k >= 1) { r.mesh.visible = false; r.life = 0; continue; }
      r.mesh.visible = true; r.mesh.scale.setScalar(0.12 + (1 - (1 - k) * (1 - k)) * r.radius);
      (r.mesh.material as T.MeshBasicMaterial).opacity = (1 - k) * (1 - k) * r.strength;
    }
    for (let i = 0; i < DROPS; i++) {
      const d = drop[i];
      if (d.live) { d.vy -= GRAVITY * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < SURFACE - 0.02) d.live = false; }
      dummy.position.set(d.x, d.y, d.z); dummy.scale.setScalar(d.live ? 1 : 0); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
  }

  return {
    root, update,
    foodState:food.state,
    nearBank:(at:T.Vector3)=>Math.abs(at.x-POND.x)<POND.rx+10&&bankDistance(at.x,at.z)<9,
    validTarget:(point:T.Vector3,at:T.Vector3)=>waterAt(point.x,point.z)&&bankDistance(point.x,point.z)>1.4&&Math.hypot(point.x-at.x,point.z-at.z)<=30&&Math.hypot((point.x-POND.x)/POND.rx,(point.z-POND.z)/POND.rz)<.94,
    feed(point:T.Vector3,at:T.Vector3){
      if(!this.validTarget(point,at)||!this.nearBank(at))return false;
      const p=food.throwAt(point,fish,clock);if(!p)return false;
      launches.set(p.id,at.clone().add(new T.Vector3(0,1.3,0)));ring(point.x,point.z,1,1.2,.5,.65);return true;
    },
    /** Read-only numbers for local QA. */
    debug: () => ({ fish: fish.map((f,i) => ({ x: f.x, z: f.z, y: f.group.position.y, jumping: !!f.jump,diving:f.dive>0,following:food.target(i)?.id,inWater:waterAt(f.x,f.z) })), food:food.patches.map(p=>({x:p.x,z:p.z,id:p.id,eaten:p.eaten.size,diners:[...p.diners]})),...food.state(), rings: rings.filter(r => r.mesh.visible).length, drops: drop.filter(d => d.live).length,bubbles:bubbles.filter(b=>b.life>0&&b.age>=0).length }),
    /** Local QA only: make one fish leap on the next frame. */
    forceJump: () => { nextJump = 0; },
    forceDive: () => { nextDive = 0; },
    pond: POND,
  };
}
