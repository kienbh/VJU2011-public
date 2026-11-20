import * as THREE from 'three';
export type RoadPoint = readonly [number, number];
export const ROAD_WIDTH = { outer: 12, spine: 8, branch: 6, access: 5 } as const;

/** Fill only the inside corners of an axis-aligned junction, tangent to both edges.
 * Arm values are road widths; absent arms stay grass. No collision or raised curb.
 */
export function roundedJunction(name: string, x: number, z: number,
  arms: { north?: number; south?: number; east?: number; west?: number },
  material: THREE.Material, radius = 2.5) {
  const group = new THREE.Group(); group.name = name;
  for (const [sx, horizontal] of [[-1, arms.west], [1, arms.east]] as const) {
    for (const [sz, vertical] of [[-1, arms.north], [1, arms.south]] as const) {
      if (!horizontal || !vertical) continue;
      const cx = x + sx * vertical / 2, cz = z + sz * horizontal / 2;
      const shape = new THREE.Shape();
      shape.moveTo(cx, cz);
      shape.lineTo(cx + sx * radius, cz);
      shape.quadraticCurveTo(cx, cz, cx, cz + sz * radius);
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape, 12);
      // Shape XY -> world XZ, with normals facing up.
      geometry.rotateX(-Math.PI / 2); geometry.scale(1, 1, -1);
      const index = geometry.index!;
      for (let i = 0; i < index.count; i += 3) {
        const second = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, second);
      }
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = .15; mesh.receiveShadow = true;
      // Read by roadMarkings to carry the edge line around the fillet.
      mesh.userData.fillet = { cx, cz, sx, sz, radius };
      group.add(mesh);
    }
  }
  return group;
}
export function roadRibbon(name: string, points: THREE.Vector3[], width: number, material: THREE.Material) {
  const positions: number[] = [], indices: number[] = [];
  points.forEach((p,i) => {
    const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
    const normal=new THREE.Vector3(tangent.z,0,-tangent.x).normalize().multiplyScalar(width/2);
    positions.push(p.x+normal.x,.15,p.z+normal.z,p.x-normal.x,.15,p.z-normal.z);
    if(i<points.length-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;
  mesh.userData={road:true,width,centerline:points.map(p=>[p.x,p.z])};
  return mesh;
}
export function roundedRoad(name: string, coordinates: readonly RoadPoint[], width: number, material: THREE.Material, radius=8) {
  const points=coordinates.map(([x,z])=>new THREE.Vector3(x,0,z));
  const path=new THREE.CurvePath<THREE.Vector3>();let cursor=points[0];
  for(let i=1;i<points.length-1;i++){
    const p=points[i], previous=points[i-1], next=points[i+1];
    const inset=Math.min(radius,p.distanceTo(previous)*.4,p.distanceTo(next)*.4);
    const entry=p.clone().add(previous.clone().sub(p).normalize().multiplyScalar(inset));
    const exit=p.clone().add(next.clone().sub(p).normalize().multiplyScalar(inset));
    path.add(new THREE.LineCurve3(cursor,entry));path.add(new THREE.QuadraticBezierCurve3(entry,p,exit));cursor=exit;
  }
  path.add(new THREE.LineCurve3(cursor,points[points.length-1]));
  return roadRibbon(name,path.getSpacedPoints(Math.max(24,Math.ceil(path.getLength()))),width,material);
}
