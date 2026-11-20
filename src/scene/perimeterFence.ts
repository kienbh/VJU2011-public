import * as THREE from 'three';
import {districtPlaster} from './districtFinishes';
import type { Collider } from '../types';
import {createSecondaryGate} from './secondaryGate';

// Review boundary, not a surveyed land parcel. Follow the inside of the existing
// outer road; leave the main gate, west access and rear approach open.
export function createPerimeterFence(outerRoad: readonly THREE.Vector3[]) {
  const group = new THREE.Group(); group.name = 'campus-perimeter-fence-draft';
  group.userData = { provisional: true, height: 2.3, roadInset: 9 };
  const colliders: Collider[] = [];
  const inner = outerRoad.map((point, i) => {
    const direction = outerRoad[Math.min(i + 1, outerRoad.length - 1)].clone()
      .sub(outerRoad[Math.max(i - 1, 0)]).normalize();
    return new THREE.Vector3(point.x + direction.z * 9, 0, point.z - direction.x * 9);
  });
  const atX = (x: number) => {
    const i = inner.findIndex(p => p.x >= x);
    const a = inner[i - 1], b = inner[i];
    return a.clone().lerp(b, (x - a.x) / (b.x - a.x));
  };
  const front = (a: number, b: number) => [atX(a), ...inner.filter(p => p.x > a && p.x < b), atX(b)];
  const rearIndex = inner.findIndex(p => p.x > 300 && p.z <= -147);
  const rearA = inner[rearIndex - 1], rearB = inner[rearIndex];
  const rearCorner = rearA.clone().lerp(rearB, (-147 - rearA.z) / (rearB.z - rearA.z));
  const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);
  const eastStart = atX(120);
  const entranceCurve = new THREE.CubicBezierCurve3(v(106, 54.8), v(112, 54.8), v(113, eastStart.z), eastStart);
  const westEnd = atX(48);
  const westCurve = new THREE.CubicBezierCurve3(westEnd, v(55, westEnd.z), v(53, 54.8), v(62, 54.8));
  const runs = [
    { name: 'west-side-and-front', points: [v(68, -94), v(-99, -94), atX(-99), ...front(-99, -87).slice(1)] },
    { name: 'front-left-of-gate', points: [...front(-75, 48), ...westCurve.getSpacedPoints(12).slice(1)] },
    // Leave a real opening on the N1 approach; neither rails nor collision cross it.
    { name: 'front-before-secondary-gate', points: [...entranceCurve.getSpacedPoints(14), ...front(120,201).slice(1)] },
    { name: 'front-right-and-dom-curve', points: [atX(213), ...inner.filter(p => p.x > 213 && p.z > -147), rearCorner] },
    // Follow the land side of the two satellite water areas, not a line across the lake.
    { name: 'rear-lake-boundary', points: [rearCorner,v(316,-67),v(265,-70),v(238,-83),v(219,-99),v(190,-125),v(100,-125)] },
  ];

  // Instance colours preserve the rest of the perimeter while matching only the
  // entrance returns to the independent gate photographs (bright metal / beige posts).
  const concrete = districtPlaster(0xffffff); concrete.roughness=.95;
  const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 });
  const pieces: { position: THREE.Vector3; scale: THREE.Vector3; rotation: number; kind: 'base' | 'post' | 'rail' }[] = [];
  const piece = (kind: 'base' | 'post' | 'rail', x: number, y: number, z: number, w: number, h: number, d: number, rotation = 0) =>
    pieces.push({ kind, position: new THREE.Vector3(x, y, z), scale: new THREE.Vector3(w, h, d), rotation });
  group.userData.secondaryGate={x:207,width:12,provisional:true};
  for(const x of [201,213]){
    const p=atX(x);
    piece('post',x,1.95,p.z,1.15,3.9,1.15);
    piece('base',x,3.94,p.z,1.4,.18,1.4);
    colliders.push({minX:x-.6,maxX:x+.6,minZ:p.z-.6,maxZ:p.z+.6,label:'Trụ cổng phụ Dom N1'});
  }
  group.userData.secondaryGate.closed=false;
  group.add(createSecondaryGate(atX(201),atX(213),colliders));
  for (const run of runs) {
    // Carry spacing along the curve, but retain sharp corners as explicit posts.
    const samples: THREE.Vector3[] = [run.points[0]];
    let carried = 0;
    for (let i = 1; i < run.points.length; i++) {
      const a = run.points[i - 1], b = run.points[i], length = a.distanceTo(b);
      if (length < .001) continue;
      for (let d = 4.5 - carried; d < length; d += 4.5) samples.push(a.clone().lerp(b, d / length));
      carried = (carried + length) % 4.5;
      // Explicit sharp corners (west rear) must not be bridged diagonally.
      if (i < run.points.length - 1) {
        const incoming = b.clone().sub(a).normalize(), outgoing = run.points[i + 1].clone().sub(b).normalize();
        if (incoming.dot(outgoing) < .9) { samples.push(b); carried = 0; }
      }
    }
    if (samples[samples.length - 1].distanceTo(run.points[run.points.length - 1]) > .001) samples.push(run.points[run.points.length - 1]);
    group.userData[run.name] = samples.map(p => [p.x, p.z]);
    for (const p of samples) piece('post', p.x, 1.15, p.z, .46, 2.3, .46);
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i], delta = b.clone().sub(a), length = delta.length();
      const mid = a.clone().add(b).multiplyScalar(.5), yaw = -Math.atan2(delta.z, delta.x);
      piece('base', mid.x, .25, mid.z, length, .5, .34, yaw);
      for (const y of [.68, 2.02]) piece('rail', mid.x, y, mid.z, length, .10, .10, yaw);
      const pickets = Math.max(1, Math.round(length / .6));
      for (let j = 1; j < pickets; j++) {
        const p = a.clone().lerp(b, j / pickets);
        piece('rail', p.x, 1.35, p.z, .07, 1.4, .07);
      }
      colliders.push({ minX: Math.min(a.x, b.x) - .23, maxX: Math.max(a.x, b.x) + .23,
        segment:[a.x,a.z,b.x,b.z],thickness:.23,maxY:2.4,
        minZ: Math.min(a.z, b.z) - .23, maxZ: Math.max(a.z, b.z) + .23, label: `Hàng rào — ${run.name}` });
    }
  }
  // Three draw calls keep a long, transparent-looking perimeter inexpensive.
  for (const kind of ['base', 'post', 'rail'] as const) {
    const selected = pieces.filter(p => p.kind === kind);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), kind === 'rail' ? metal : concrete, selected.length);
    mesh.name = `perimeter-fence-${kind}`;
    const instance = new THREE.Object3D();
    selected.forEach((p, i) => {
      instance.position.copy(p.position); instance.scale.copy(p.scale); instance.rotation.y = p.rotation;
      instance.updateMatrix(); mesh.setMatrixAt(i, instance.matrix);
      const entranceReturn=p.position.z>45&&((p.position.x>=25&&p.position.x<=62)||(p.position.x>=106&&p.position.x<=138));
      const color=entranceReturn?(kind==='rail'?0xc2cacb:kind==='post'?0xb99c80:0xeee6ce):(kind==='rail'?0x455650:0xc4c6b8);
      mesh.setColorAt(i,new THREE.Color(color));
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  // A low curb follows the EXISTING street edge on its grass side. No road is
  // moved/covered, and no collider is added. Stop before the sign and entrance.
  // Independent photo 10d8 shows this pale grass edging; its profile is approximate.
  for(const [start,end] of [[25,58],[110,138]]){
    const points=outerRoad.map((p,i)=>{
      const tangent=outerRoad[Math.min(i+1,outerRoad.length-1)].clone().sub(outerRoad[Math.max(0,i-1)]).normalize();
      const normal=new THREE.Vector3(tangent.z,0,-tangent.x);
      return {p,normal};
    }).filter(({p})=>p.x>=start&&p.x<=end);
    const vertices:number[]=[],indices:number[]=[];
    for(const {p,normal} of points){
      // Street half width is 6; both sides of this edging stay outside it.
      for(const [offset,y] of [[6.03,.15],[6.13,.3],[6.36,.3],[6.44,.04]]){
        const v=p.clone().addScaledVector(normal,offset);vertices.push(v.x,y,v.z);
      }
    }
    for(let i=0;i<points.length-1;i++)for(let j=0;j<3;j++){
      const k=i*4+j;indices.push(k,k+4,k+1,k+1,k+4,k+5);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const edging=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xcac7b9,roughness:.92,side:THREE.DoubleSide}));
    edging.name=`gate-grass-curb-${start}`;edging.receiveShadow=true;edging.userData={visualOnly:true,provisional:true,source:'10d8e061 independent photo; follows existing road geometry'};group.add(edging);
  }
  return { group, colliders };
}
