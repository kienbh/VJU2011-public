import * as T from 'three';
import {SHOW_WORDS,SHOW_PALETTES,showPhase,advanceShow,particleBudget,sideBurst} from './fireworksShow';
export function createFireworksMode(){
 const root=new T.Group();root.name='optional-fireworks-show';root.position.set(0,63,-35);root.visible=false;
 const max=11500,positions=new Float32Array(max*3),colors=new Float32Array(max*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));g.setDrawRange(0,0);
 function material(glow:boolean){return new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:glow?T.AdditiveBlending:T.NormalBlending,uniforms:{ratio:{value:1},size:{value:glow?7:3.5}},vertexShader:'uniform float ratio; uniform float size; varying vec3 c; void main(){c=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*ratio*100./max(30.,-p.z),1.,24.);}',fragmentShader:`varying vec3 c; void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(c,pow(1.-r,${glow?'2.':'0.8'})*${glow?'.22':'.95'});}`});}
 const core=material(false),halo=material(true);for(const m of [core,halo]){const points=new T.Points(g,m);points.frustumCulled=false;root.add(points);}
 // Cache glyph sampling once; never read canvas pixels per frame.
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=150;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 ctx.font='bold 112px Arial, sans-serif';const missing=ctx.measureText('\uFFFF\uFFFF').width,japanese=ctx.measureText('幸せ').width;
 const words=SHOW_WORDS.filter(w=>w!=='幸せ'||Math.abs(japanese-missing)>.5);
 const glyphs=words.map(word=>{ctx.clearRect(0,0,720,150);ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(word,360,75);const pixels=ctx.getImageData(0,0,720,150).data,out:number[][]=[];for(let y=0;y<150;y+=3)for(let x=0;x<720;x+=3)if(pixels[(y*720+x)*4+3]>150)out.push([(x-360)*.16,(75-y)*.16,0]);return out;});
 let time=0,budget=11500,lastCount=0;
 const color=new T.Color();
 return {root,update(dt:number,allowed:boolean,reduced:boolean,ratio:number,limit:number,aspect:number){
  time=advanceShow(time,dt,allowed,reduced);const s=showPhase(time);root.visible=allowed&&(reduced||s.active);if(!root.visible)return;
  budget=particleBudget(limit);core.uniforms.ratio.value=halo.uniforms.ratio.value=ratio;
  const palette=SHOW_PALETTES[s.cycle%SHOW_PALETTES.length],glyph=glyphs[s.word%glyphs.length];let count=0;
  function point(x:number,y:number,z:number,c:string){if(count>=budget)return;color.set(c);const i=count++*3;positions[i]=x;positions[i+1]=y;positions[i+2]=z;colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
  // Letters remain stationary and bright; bursts never occupy their central region.
  for(const p of glyph)point(p[0],p[1],p[2],'#fff1c9');
  const remaining=budget-count,per=Math.floor(remaining/4);
  for(let b=0;b<4;b++){
   const age=reduced?1.5:(s.phase+b*.72)%3.4,spread=1-Math.exp(-age*1.5),fade=Math.max(0,1-age/3.4);if(fade<.08)continue;
   for(let i=0;i<per;i++){const u=(i+.5)/per,a=i*2.39996323+b,sy=1-2*u,rad=Math.sqrt(1-sy*sy),r=(9+(i%9)*.5)*spread;
    let x=rad*Math.cos(a)*r,y=sy*r,z=rad*Math.sin(a)*r*.55;
    if(b===0&&i%3===0){const t=u*Math.PI*2;x=Math.pow(Math.sin(t),3)*r;y=(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*r/16;}
    point((aspect<.8?sideBurst(b)*.28:sideBurst(b))+x*(aspect<.8?.65:1),(aspect<.8?(b%2?28:-28):(b%2?17:-12))+y*(aspect<.8?.65:1)-age*age*.7,z,palette[(i%11===0?2:b)%palette.length]);
   }
  }
  lastCount=count;g.setDrawRange(0,count);g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;
 },state:()=>({time,...showPhase(time),visible:root.visible,budget,count:lastCount,words}),dispose(){g.dispose();core.dispose();halo.dispose();root.removeFromParent();}};
}
