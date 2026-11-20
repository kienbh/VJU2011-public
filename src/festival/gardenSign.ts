import * as THREE from 'three';

/** Match canvas and world proportions so Vietnamese letters keep their shape. */
export function createGardenSign(title:string,subtitle:string,width:number,height:number){
  const canvas=document.createElement('canvas');
  canvas.width=width>4?2048:1024;canvas.height=Math.round(canvas.width*height/width);
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  ctx.fillStyle='#fff4dc';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#806047';ctx.lineWidth=4;ctx.strokeRect(8,8,w-16,h-16);
  ctx.textAlign='center';ctx.textBaseline='middle';
  function line(text:string,y:number,size:number,color:string){
    ctx.font=`700 ${size}px "Segoe UI", Arial, sans-serif`;
    // Reduce font size uniformly, never squeeze a long name horizontally.
    const fitted=Math.min(size,size*(w*.9)/Math.max(1,ctx.measureText(text).width));
    ctx.font=`700 ${fitted}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle=color;ctx.fillText(text,w/2,y);
  }
  line(title,h*.34,h*.42,'#302019');
  line(subtitle,h*.76,h*.25,'#51392b');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  // These interaction labels need stable contrast in fog and at night.
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,fog:false,side:THREE.DoubleSide});
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
}
