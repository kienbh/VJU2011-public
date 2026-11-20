import * as T from 'three';
import {FINALE_SECONDS,finaleHash} from './finalePlan';

/** Clear starry night for the finale only: deep blue dome with a low warm horizon glow and faint sky texture,
 * plus a dense twinkling star field. No clouds, no moon, no bright Milky Way streak (reviewed: read as a white smear).
 * The dome texture is baked once on first use (one 1024×512 canvas); everything is driven by the finale clock.
 * Visible only while the finale runs; hidden (not disposed) afterwards so replays reuse it. */
const VIEW=new T.Vector3(1,9,90);
/** Band normal: the galaxy crosses the view diagonally, low right to high left. */
const BAND=new T.Vector3(.53,.66,.535).normalize();
const TW=1024,TH=512;
function noiseGrid(w:number,h:number,seed:number){const g=new Float32Array(w*h);for(let i=0;i<g.length;i++)g[i]=finaleHash(i,seed);
  return (x:number,y:number)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const at=(a:number,b:number)=>g[((b%h+h)%h)*w+((a%w+w)%w)];
    return (at(xi,yi)*(1-sx)+at(xi+1,yi)*sx)*(1-sy)+(at(xi,yi+1)*(1-sx)+at(xi+1,yi+1)*sx)*sy;};}
function bakeSky(){
  const canvas=document.createElement('canvas');canvas.width=TW;canvas.height=TH;const g=canvas.getContext('2d')!,img=g.createImageData(TW,TH);
  const n1=noiseGrid(64,32,41),n2=noiseGrid(64,32,42);
  const fbm=(x:number,y:number,n:typeof n1)=>n(x,y)*.5+n(x*2.03,y*2.03)*.27+n(x*4.1,y*4.1)*.15+n(x*8.3,y*8.3)*.08;
  for(let y=0;y<TH;y++){
    const v=1-(y+.5)/TH,el=(v-.5)*Math.PI,ce=Math.cos(el),se=Math.sin(el),h=Math.max(0,se);
    // Zenith navy to a lighter blue near the horizon.
    const k=Math.pow(1-h,3);let r=.003+.014*k,gg=.007+.038*k,b=.022+.1*k;
    const glow=se>-.05?Math.exp(-Math.max(0,se)/.03)*.9:0;r+=.3*glow;gg+=.13*glow;b+=.04*glow;
    for(let x=0;x<TW;x++){
      const u=(x+.5)/TW,az=(u-.5)*Math.PI*2,dx=Math.sin(az)*ce,dz=-Math.cos(az)*ce;
      const off=dx*BAND.x+se*BAND.y+dz*BAND.z,band=Math.exp(-off*off/(2*.085*.085)),coreB=Math.exp(-off*off/(2*.035*.035));
      const f=fbm(u*28,v*14,n1),lane=fbm(u*40+3,v*20,n2);
      const dust=band*(.12+1.1*f*f*f)*(1-.65*coreB*Math.max(0,Math.min(1,(lane-.42)*4)))*Math.min(1,h*12);
      const o=(y*TW+x)*4,sr=r+dust*.012,sg=gg+dust*.025,sb=b+dust*.05;// faint texture only: no bright Milky Way streak
      img.data[o]=Math.min(255,Math.pow(sr,1/2.2)*255);img.data[o+1]=Math.min(255,Math.pow(sg,1/2.2)*255);img.data[o+2]=Math.min(255,Math.pow(sb,1/2.2)*255);img.data[o+3]=255;
    }
  }
  g.putImageData(img,0,0);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;return texture;
}
export function createFinaleSky(){
  const group=new T.Group();group.name='finale-sky';group.visible=false;group.position.copy(VIEW);
  const uniforms={uTime:{value:0},uNight:{value:0},uPixel:{value:1},uTwinkle:{value:1},uMap:{value:null as T.Texture|null}};
  const dome=new T.Mesh(new T.SphereGeometry(800,48,24),new T.ShaderMaterial({uniforms,side:T.BackSide,transparent:true,depthWrite:false,fog:false,toneMapped:false,
    vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D uMap;uniform float uNight;varying vec3 vDir;void main(){vec3 d=normalize(vDir);
      vec2 uv=vec2(atan(d.x,-d.z)/6.28318+.5,asin(clamp(d.y,-1.,1.))/3.14159+.5);gl_FragColor=vec4(texture2D(uMap,uv).rgb,uNight);
      #include <colorspace_fragment>
    }`}));
  dome.renderOrder=-15;dome.frustumCulled=false;group.add(dome);
  // Stars: a uniform field plus a denser population hugging the band, mostly tiny with a few bright ones.
  const STARS=2600,pos=new Float32Array(STARS*3),seed=new Float32Array(STARS*3),dir=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
  a.set(0,0,-1).projectOnPlane(BAND).normalize();b.crossVectors(BAND,a);
  for(let i=0;i<STARS;i++){
    const h1=finaleHash(i,21),h2=finaleHash(i,22),h3=finaleHash(i,23);
    if(i%9===0){const t=(h1-.5)*Math.PI*1.6,spread=(h2+h3-1)*.16;dir.copy(a).multiplyScalar(Math.cos(t)).addScaledVector(b,Math.sin(t)).addScaledVector(BAND,spread).normalize();}
    else{const az=(h1-.5)*Math.PI*1.7,el=Math.asin(.02+h2*.98);dir.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el));}
    if(dir.y<.015)dir.y=.015+h3*.05;dir.normalize().multiplyScalar(700);pos.set([dir.x,dir.y,dir.z],i*3);
    const m=finaleHash(i,24);seed.set([m<.86?.55+m*.9:m<.97?1.6+m:2.8+m,finaleHash(i,25),finaleHash(i,26)],i*3);
  }
  const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aSeed',new T.BufferAttribute(seed,3));
  const stars=new T.Points(starGeo,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:false,toneMapped:false,blending:T.AdditiveBlending,
    vertexShader:`uniform float uTime,uPixel,uTwinkle;attribute vec3 aSeed;varying float vA;varying vec3 vC;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      float s=sin(uTime*(1.1+aSeed.y*2.6)+aSeed.y*60.);vA=mix(1.,.72+.28*s,uTwinkle)*min(1.,.35+aSeed.x*.5);
      vC=mix(vec3(.78,.86,1.),vec3(1.,.93,.82),step(.8,aSeed.z));gl_PointSize=clamp(aSeed.x,.9,3.6)*uPixel;}`,
    fragmentShader:`uniform float uNight;varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>=1.)discard;float a=(1.-smoothstep(0.,1.,d))*vA*uNight;if(a<.004)discard;gl_FragColor=vec4(vC,a);
      #include <colorspace_fragment>
    }`}));
  stars.renderOrder=-10;stars.frustumCulled=false;group.add(stars);
  stars.onBeforeRender=renderer=>{uniforms.uPixel.value=renderer.getPixelRatio();};
  function setProgress(progress:number|null,reduced:boolean){
    group.visible=progress!==null;if(progress===null)return;
    uniforms.uMap.value??=bakeSky();
    const time=T.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1)*FINALE_SECONDS;
    uniforms.uTime.value=time;uniforms.uNight.value=reduced?1:T.MathUtils.smoothstep(time,.9,4.2);uniforms.uTwinkle.value=reduced?0:1;
  }
  return {group,setProgress,state:()=>({visible:group.visible,stars:STARS,clouds:0,milkyWay:!!uniforms.uMap.value,night:uniforms.uNight.value})};
}
