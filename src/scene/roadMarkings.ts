import * as THREE from 'three';
import {roadBoundary} from './roadBoundary';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Point={x:number;z:number};
type Route={name:string;width:number;points:Point[]};
type Segment={a:Point;b:Point;route:Route;length:number;tx:number;tz:number};
const STEP=.4,DASH=2.4,PERIOD=6,EDGE=.11,CENTRE=.14;

/** One paint specification for every road ribbon, following its actual curved centreline. */
export function createRoadMarkings(campus:THREE.Object3D){
  const group=new THREE.Group();group.name='campus-road-markings';
  const routes:Route[]=[];
  campus.traverse(o=>{
    // This short branch duplicates the existing continuous lecture-front lane.
    if(!o.userData.road||o.name==='hieu-bo-left-branch')return;
    routes.push({name:o.name,width:o.userData.width,points:o.userData.centerline.map(([x,z]:number[])=>({x,z}))});
  });
  const segments:Segment[]=[];
  for(const route of routes)for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
    if(length>.001)segments.push({a,b,route,length,tx:(b.x-a.x)/length,tz:(b.z-a.z)/length});
  }
  function distance(p:Point,s:Segment){
    const t=THREE.MathUtils.clamp(((p.x-s.a.x)*s.tx+(p.z-s.a.z)*s.tz)/s.length,0,1);
    return Math.hypot(p.x-s.a.x-t*s.length*s.tx,p.z-s.a.z-t*s.length*s.tz);
  }
  // Spatial buckets keep paint generation local even on the long outer road.
  const grid=new Map<string,Segment[]>(),cell=16;
  for(const s of segments){const pad=s.route.width/2+3;
    for(let ix=Math.floor((Math.min(s.a.x,s.b.x)-pad)/cell);ix<=Math.floor((Math.max(s.a.x,s.b.x)+pad)/cell);ix++)
      for(let iz=Math.floor((Math.min(s.a.z,s.b.z)-pad)/cell);iz<=Math.floor((Math.max(s.a.z,s.b.z)+pad)/cell);iz++){
        const key=`${ix},${iz}`,bucket=grid.get(key)??[];bucket.push(s);grid.set(key,bucket);
      }
  }
  function neighbours(p:Point){return grid.get(`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`)??[];}
  const white:number[]=[],yellow:number[]=[];
  function stripe(out:number[],a:Point,b:Point,width:number){
    const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)return;
    const nx=-(b.z-a.z)/length*width/2,nz=(b.x-a.x)/length*width/2,y=.174;
    const al=[a.x+nx,y,a.z+nz],ar=[a.x-nx,y,a.z-nz],bl=[b.x+nx,y,b.z+nz],br=[b.x-nx,y,b.z-nz];
    out.push(...al,...bl,...ar,...ar,...bl,...br);
  }
  for(const route of routes){
    const pieces=segments.filter(s=>s.route===route);let station=0;
    for(const s of pieces){
      const n=Math.ceil(s.length/STEP);
      for(let i=0;i<n;i++){
        const t0=i/n,t1=(i+1)/n,tm=(t0+t1)/2;
        const at=(t:number):Point=>({x:s.a.x+s.tx*s.length*t,z:s.a.z+s.tz*s.length*t});
        const a=at(t0),b=at(t1),mid=at(tm),others=neighbours(mid).filter(other=>other.route!==route);
        const crossing=route.name==='gate-to-rear-spine'&&Math.abs(mid.z-29)<3;
        const junction=others.some(other=>Math.abs(other.tx*s.tx+other.tz*s.tz)<.85&&distance(mid,other)<other.route.width/2+2.4);
        const duplicate=others.some(other=>routes.indexOf(other.route)<routes.indexOf(route)&&distance(mid,other)<.25);
        // Access lanes are too narrow for a second visual lane. End before junctions/crossings.
        if(route.width>=6&&!junction&&!duplicate&&!crossing){
          const start=station+s.length*t0,end=station+s.length*t1;
          // Clip to the exact dash interval, independent of sampling resolution.
          for(let cycle=Math.floor(start/PERIOD);cycle<=Math.floor(end/PERIOD);cycle++){
            const lo=Math.max(start,cycle*PERIOD),hi=Math.min(end,cycle*PERIOD+DASH);
            if(hi<=lo)continue;
            const p=(distance:number)=>({x:a.x+(b.x-a.x)*(distance-start)/(end-start),z:a.z+(b.z-a.z)*(distance-start)/(end-start)});
            stripe(yellow,p(lo),p(hi),CENTRE);
          }
        }
      }
      station+=s.length;
    }
  }
  const boundary=roadBoundary(campus);
  // Supersede hand-positioned corner wedges with tangent patches from the same
  // unified boundary as the paint. Old wedges could float off curved road arms.
  let asphalt:THREE.Material|THREE.Material[]|undefined;
  campus.traverse(o=>{if(o.userData.fillet)o.visible=false;if(!asphalt&&o.userData.road&&o instanceof THREE.Mesh)asphalt=o.material;});
  const patchParts:THREE.BufferGeometry[]=[];
  for(const points of boundary.surfacePatches){
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    patchParts.push(geometry);
  }
  if(asphalt&&patchParts.length){const patch=new THREE.Mesh(mergeGeometries(patchParts)!,asphalt);patch.position.y=.15;patch.receiveShadow=true;patch.name='junction-tangent-asphalt';group.add(patch);}
  patchParts.forEach(g=>g.dispose());
  for(const {a,b,corners} of boundary.spans){
    // Leave only the pedestrian threshold opening, cut at exact Z endpoints.
    const vertical=Math.abs(a[0]-80)<.7&&Math.abs(b[0]-80)<.7;
    if(vertical&&Math.min(a[1],b[1])<30.86&&Math.max(a[1],b[1])>27.14){
      const lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);
      const p=(z:number)=>({x:a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]),z});
      if(lo<27.14)stripe(white,p(lo),p(27.14),EDGE);
      if(hi>30.86)stripe(white,p(30.86),p(hi),EDGE);
    }else{
      // Adjacent spans share their mitered vertices: no little gaps on bends.
      for(const i of [0,1,2,2,1,3])white.push(corners[i][0],.174,corners[i][1]);
    }
  }
  // Crossing leads to the short paved entrance, not to a road through the square.
  for(let i=0;i<8;i++)stripe(white,{x:80.55+i*.98,z:27.6},{x:80.55+i*.98,z:30.4},.48);
  function mesh(name:string,positions:number[],color:number){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color,roughness:.98,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const m=new THREE.Mesh(geometry,material);m.name=name;group.add(m);
  }
  mesh('road-edge-and-crossing-paint',white,0xe5e4d9);mesh('road-centre-dash-paint',yellow,0xdcc276);
  group.userData={boundaryContours:boundary.contours.length,footprints:boundary.footprints,routeCount:routes.length,dashLength:DASH,dashGap:PERIOD-DASH,edgeWidth:EDGE,centreWidth:CENTRE};
  return group;
}
