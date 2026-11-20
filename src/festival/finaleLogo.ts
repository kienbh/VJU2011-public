import * as T from 'three';
import {FINALE_SECONDS,FINALE_LOGO,finaleHash} from './finalePlan';

/** Original public-project mark written by sparks in a corner of the sky.
 * The mark is composed on a canvas from the 20.11 badge with an outer ring and
 * "LEARN BUILD SHARE / OPEN CAMPUS" set on arcs, then sampled into coloured sparks.
 * Flight, hold and twinkle are evaluated in the vertex shader from the finale clock; nothing per frame on the CPU.
 * If the logo image cannot load, the emblem is simply absent. */
const SIZE=360,C=SIZE/2;
function compose(image:HTMLImageElement){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const g=canvas.getContext('2d',{willReadFrequently:true})!;
  g.strokeStyle='#c8282e';g.lineWidth=6;g.beginPath();g.arc(C,C,173,0,Math.PI*2);g.stroke();
  g.lineWidth=2.5;g.beginPath();g.arc(C,C,131,0,Math.PI*2);g.stroke();
  // Original square project mark, fitted inside the spark ring.
  g.save();g.beginPath();g.arc(C,C,127,0,Math.PI*2);g.clip();g.fillStyle='#ffffff';g.fillRect(C-127,C-127,254,254);// Neutral background for the original project mark
  const side=image.naturalHeight;g.drawImage(image,0,0,side,side,C-127,C-127,254,254);g.restore();
  g.fillStyle='#2fae5a';g.font='900 27px "Segoe UI", Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';
  const arc=(text:string,mid:number,span:number,top:boolean)=>{const chars=[...text];chars.forEach((ch,i)=>{const a=mid+(top?1:-1)*(-span/2+span*(i+.5)/chars.length);
    g.save();g.translate(C+Math.cos(a)*152,C+Math.sin(a)*152);g.rotate(top?a+Math.PI/2:a-Math.PI/2);g.fillText(ch,0,0);g.restore();});};
  arc('LEARN BUILD SHARE',-Math.PI/2,Math.PI*1.18,true);arc('OPEN CAMPUS',Math.PI/2,Math.PI*.62,false);
  g.fillStyle='#c8282e';g.beginPath();g.arc(C+152,C,8,0,Math.PI*2);g.fill();
  g.beginPath();for(let i=0;i<10;i++){const r=i%2?4:10,a=-Math.PI/2+i*Math.PI/5;g.lineTo(C-152+Math.cos(a)*r,C+Math.sin(a)*r);}g.closePath();g.fill();
  return g.getImageData(0,0,SIZE,SIZE).data;
}
export function createFinaleLogo(){
  const points=new T.Points(new T.BufferGeometry(),undefined);points.name='finale-vju-emblem';points.visible=false;points.frustumCulled=false;points.renderOrder=10;
  const uniforms={uTime:{value:0},uStart:{value:FINALE_LOGO.burst},uOpacity:{value:1},uPixel:{value:1},uHeight:{value:800},uTwinkle:{value:1}};
  points.material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime,uStart,uPixel,uHeight,uTwinkle;attribute vec3 aBulge,aColor;attribute vec4 aSeed;varying vec3 vColor;varying float vA;
      void main(){float phase=uTime-uStart,u=clamp((phase-aSeed.x)/aSeed.y,0.,1.),e=1.-pow(1.-u,3.),arc=sin(3.14159*u)*(1.-.4*u);
        vec3 p=position*e+aBulge*arc-vec3(0.,1.2*arc*u,0.);vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        float s=sin(uTime*(4.+aSeed.w*6.)+aSeed.w*50.);vA=phase<0.?0.:mix(1.,.85+.15*s+.4*pow(max(0.,s),24.),uTwinkle)*(phase<.3?1.5-phase*1.6:1.);
        vColor=mix(vec3(1.,.96,.86),aColor,smoothstep(.1,.6,phase));
        gl_PointSize=clamp(uHeight*projectionMatrix[1][1]*.15*aSeed.z/max(1.,-view.z),1.4*uPixel,4.*uPixel);if(vA<=0.)gl_Position=vec4(2.,2.,2.,1.);}`,
    fragmentShader:`uniform float uOpacity;varying vec3 vColor;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>=1.)discard;
      float a=(1.-smoothstep(.05,1.,d))*vA*uOpacity;if(a<.003)discard;gl_FragColor=vec4(mix(vColor,vec3(1.),(1.-smoothstep(0.,.45,d))*.3),a);
      #include <colorspace_fragment>
    }`});
  const viewport=new T.Vector4();
  points.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);uniforms.uHeight.value=viewport.w;uniforms.uPixel.value=renderer.getPixelRatio();};
  let count=0;
  const image=new Image();image.decoding='async';
  image.onload=()=>{
    const data=compose(image),target:number[]=[],colour:number[]=[],seed:number[]=[],bulge:number[]=[];
    const k=FINALE_LOGO.radius*2/SIZE,red=new T.Color('#ff3b3b'),white=new T.Color('#fff8ee'),green=new T.Color('#5dff8e');
    const disc=new T.Color('#b4141c');const take=(x:number,y:number,c:T.Color,i:number,scale=1)=>{const a=finaleHash(i,31),b=finaleHash(i,32),d=finaleHash(i,33);
      target.push((x-C)*k,(C-y)*k,0);colour.push(c.r,c.g,c.b);seed.push(a*.25,.9+b*.5,(d>.95?1.8+a*.6:1+b*.5)*scale,d);bulge.push((b-.5)*8,(d-.3)*6,(a-.5)*4);};
    let i=0;
    for(const [step,kind] of [[1.6,'green'],[2.1,'white'],[2.6,'ring'],[6.2,'red']] as const)for(let y=step;y<SIZE-1;y+=step)for(let x=step;x<SIZE-1;x+=step){
      const jit=kind==='green'?.4:.8,jx=Math.round(x+(finaleHash(x,y+step)-.5)*step*jit),jy=Math.round(y+(finaleHash(y,x+step)-.5)*step*jit),o=(jy*SIZE+jx)*4;
      const r=data[o],g=data[o+1],b=data[o+2],al=data[o+3],dist=Math.hypot(jx-C,jy-C);if(al<160)continue;
      const isRed=r>140&&r>g+60,isGreen=g>r+40,isWhite=r>200&&g>200&&b>200;
      if(kind==='green'&&isGreen)take(jx,jy,green,i++,.8);
      else if(kind==='white'&&isWhite&&dist<127)take(jx,jy,white,i++,1.35);
      else if(kind==='ring'&&isRed&&(dist>128||Math.abs(dist-152)<10))take(jx,jy,red,i++);
      else if(kind==='red'&&isRed&&dist<=126)take(jx,jy,disc,i++,.8);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(target,3));geometry.setAttribute('aColor',new T.Float32BufferAttribute(colour,3));
    geometry.setAttribute('aSeed',new T.Float32BufferAttribute(seed,4));geometry.setAttribute('aBulge',new T.Float32BufferAttribute(bulge,3));
    points.geometry.dispose();points.geometry=geometry;count=i;
  };
  image.src='/assets/brand/project-mark.svg';
  function setProgress(progress:number|null,reduced:boolean,aspect=1){
    points.visible=progress!==null&&count>0;if(!points.visible)return;
    const time=T.MathUtils.clamp(Number.isFinite(progress)?progress!:0,0,1)*FINALE_SECONDS,tall=aspect<.85;
    const [x,y]=tall?FINALE_LOGO.tall:FINALE_LOGO.wide;points.position.set(x+1,y,FINALE_LOGO.z);points.scale.setScalar(tall?.8:1);points.lookAt(1,9,90);// face the fixed finale viewpoint
    // Reduced motion: the emblem simply rests in place, without flight or twinkle.
    uniforms.uTime.value=reduced?FINALE_LOGO.burst+3:time;uniforms.uTwinkle.value=reduced?0:1;
  }
  return {points,setProgress,state:()=>({visible:points.visible,sparks:count})};
}
