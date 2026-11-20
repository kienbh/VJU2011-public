import * as THREE from 'three';

/** Shared entrance flags, visible in both day and festival; no colliders. */
export function createGateFlags(pierTop:number){
  const group=new THREE.Group();group.name='entrance-flags';
  const brass=new THREE.MeshStandardMaterial({color:0x987749,roughness:.48,metalness:.65});
  // Ceremonial flags mounted on the existing gate pillars; HQ flags stay in place.
  function flag(x:number,japan:boolean){
    // Approved piers are 5.6 high: mount in the centre of each top, not inside
    // the older 3.2-high pier. Owner requested a shorter pole; cloth clears by .83.
    const poleHeight=3.3;
    const socket=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,.12,16),brass);socket.name='entrance-flagpole-socket';socket.position.set(x,pierTop+.06,54.8);group.add(socket);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,poleHeight,12),brass);pole.name='entrance-flagpole';pole.position.set(x,pierTop+poleHeight/2,54.8);group.add(pole);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),brass);ball.position.set(x,pierTop+poleHeight+.05,54.8);group.add(ball);
    const c=document.createElement('canvas');c.width=600;c.height=400;const g=c.getContext('2d')!;g.fillStyle=japan?'#fff8e9':'#d92332';g.fillRect(0,0,600,400);
    g.fillStyle=japan?'#c31d35':'#ffdc4b';g.beginPath();if(japan)g.arc(300,200,112,0,Math.PI*2);else for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?47:122;g.lineTo(300+Math.cos(a)*r,200+Math.sin(a)*r);}g.closePath();g.fill();
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    const geometry=new THREE.PlaneGeometry(3.5,2.3,24,8);const pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){const px=pos.getX(i);pos.setZ(i,.15*Math.sin(px*2+pos.getY(i)*.55)+.07*Math.sin(px*4));}geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,side:THREE.DoubleSide,roughness:.93,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.24}));
    mesh.name=japan?'entrance-japan-flag':'entrance-vietnam-flag';mesh.position.set(x-1.8,pierTop+1.98,54.8);group.add(mesh);
  }
  flag(77,false);flag(91,true);

  return group;
}
