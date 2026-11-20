import * as T from 'three';
import {FINALE_SECONDS,FINALE_WORDS,FINALE_WORD_BURSTS,finaleWord,finaleHash} from './finalePlan';
import {drawFinaleJapanese} from './finaleJapanese';

/** Reference sequence from Dat's video, ending on the original 20.11 composition.
 * Each word is written by firework sparks: one burst at the word's start (FINALE_WORD_BURSTS, shared with audio),
 * sparks fly out on drag-shaped arcs, settle into the glyph and twinkle; at the change they fall away as embers.
 * Sampling is jittered and sparse with varied spark sizes, so the word reads as sparkles, not a dot matrix.
 * Simulation owns every transform: reflected lake cameras may only set pixel-size uniforms. */
export function createFinaleLettering(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=280;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.font='700 190px "Segoe UI", "Yu Gothic", "Meiryo", "Hiragino Sans", Arial, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  // Full-width Japanese and missing-glyph boxes can have identical advances on phones.
  // Use the two bundled outlines so system fonts never hide or replace this stage.
  const words=FINALE_WORDS;
  const STEP=4;
  const glyphs=words.map((word,w)=>{
    ctx.clearRect(0,0,1024,280);ctx.fillStyle='#fff';
    if(word==='幸せ')drawFinaleJapanese(ctx);else ctx.fillText(word,512,140);
    const pixels=ctx.getImageData(0,0,1024,280).data,samples:T.Vector2[]=[];
    // Seeded jitter inside each cell removes the grid; samples stay on the stroke.
    for(let y=STEP;y<280-STEP;y+=STEP)for(let x=STEP;x<1024-STEP;x+=STEP){
      const jx=Math.round(x+(finaleHash(x+w*7,y)-.5)*STEP*.55),jy=Math.round(y+(finaleHash(y,x+w*7)-.5)*STEP*.55);
      if(pixels[(jy*1024+jx)*4+3]>150)samples.push(new T.Vector2(jx,jy));
    }
    const bounds=new T.Box2().setFromPoints(samples),centre=bounds.getCenter(new T.Vector2());
    const scale=Math.min(50/Math.max(1,bounds.max.x-bounds.min.x),24/Math.max(1,bounds.max.y-bounds.min.y));
    return samples.map(p=>new T.Vector2((p.x-centre.x)*scale,(centre.y-p.y)*scale));
  });
  const max=Math.max(...glyphs.map(g=>g.length));
  const positions=new Float32Array(max*3),colors=new Float32Array(max*3),spark=new Float32Array(max*2);
  // Per-spark constants: flight delay/duration, arc bulge, size, colour; fixed at creation, never re-rolled.
  const delay=new Float32Array(max),duration=new Float32Array(max),bulge=new Float32Array(max*3),fall=new Float32Array(max);
  const pearl=new T.Color('#fff6e4'),gold=new T.Color('#ffcf72'),ice=new T.Color('#d8f4ff'),color=new T.Color();
  for(let i=0;i<max;i++){
    const a=finaleHash(i,11),b=finaleHash(i,12),c=finaleHash(i,13),d=finaleHash(i,14);
    delay[i]=a*.22;duration[i]=.85+b*.5;fall[i]=.6+c*.8;
    bulge.set([(c-.5)*14,(d-.2)*9,(a-.5)*6],i*3);
    // Mostly warm white, some gold, a few cool glints; a few large glints like real stars of the burst.
    const big=d>.96;spark.set([big?1.7+a*.6:1+b*.45,i*.7311%1],i*2);
    color.copy(c<.62?pearl:c<.9?gold:ice);colors.set([color.r,color.g,color.b],i*3);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setAttribute('aSpark',new T.BufferAttribute(spark,2));
  const uniforms={uOpacity:{value:0},uHeight:{value:800},uPixel:{value:1},uHalo:{value:0},uTime:{value:0},uTwinkle:{value:1}};
  function material(halo:boolean){return new T.ShaderMaterial({uniforms:{...uniforms,uHalo:{value:halo?1:0}},vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,blending:halo?T.AdditiveBlending:T.AdditiveBlending,
    vertexShader:`uniform float uHeight,uPixel,uHalo,uTime,uTwinkle;attribute vec2 aSpark;varying vec3 c;varying float tw;
      void main(){c=color;vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;
        // Smooth per-spark shimmer plus brief glints; seeded phase, so no frame-to-frame noise.
        float s=sin(uTime*(5.+aSpark.y*6.)+aSpark.y*40.);tw=mix(1.,.82+.18*s+.45*pow(max(0.,s),24.),uTwinkle);
        float px=clamp(uHeight*projectionMatrix[1][1]*.14*aSpark.x/max(1.,-view.z),1.2*uPixel,3.4*uPixel);
        gl_PointSize=px*mix(1.,3.,uHalo)*(uHalo>.5?step(1.8,aSpark.x)+.35:1.);}`,
    fragmentShader:`uniform float uOpacity,uHalo;varying vec3 c;varying float tw;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>=1.)discard;
      float a=(uHalo>.5?exp(-d*d*5.)*.22:1.-smoothstep(.05,1.,d))*uOpacity*tw;if(a<.003)discard;
      gl_FragColor=vec4(mix(c,vec3(1.),(1.-smoothstep(0.,.45,d))*.6),a);
      #include <colorspace_fragment>
    }`});}
  const points=new T.Points(geometry,material(false));points.name='finale-20-11-particles';points.position.set(1,35,-24);points.visible=false;points.frustumCulled=false;points.renderOrder=10;
  const halo=new T.Points(geometry,material(true));halo.frustumCulled=false;halo.renderOrder=9;points.add(halo);
  const viewport=new T.Vector4();
  const before=(renderer:T.WebGLRenderer)=>{renderer.getCurrentViewport(viewport);uniforms.uHeight.value=viewport.w;uniforms.uPixel.value=renderer.getPixelRatio();};points.onBeforeRender=before;halo.onBeforeRender=before;
  const ORIGIN=[0,4,-3];
  let wordIndex=0;
  function setProgress(progress:number|null,reduced:boolean,aspect=1,budget=11500){
    points.visible=progress!==null;if(progress===null)return;
    const time=T.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1)*FINALE_SECONDS;
    wordIndex=reduced?4:finaleWord(time);
    const samples=glyphs[wordIndex],phase=reduced?6:time-FINALE_WORD_BURSTS[wordIndex];
    const ending=wordIndex<4&&!reduced?Math.max(0,time-(wordIndex*6+5.15)):0;
    points.scale.setScalar(aspect>.85?1.6:1);
    halo.visible=budget>4800&&!reduced;uniforms.uTime.value=time;uniforms.uTwinkle.value=reduced?0:1;
    for(let i=0;i<samples.length;i++){
      const p=samples[i],u=T.MathUtils.clamp((phase-delay[i])/duration[i],0,1),e=1-Math.pow(1-u,3),arc=Math.sin(Math.PI*u)*(1-u*.4);
      // Drag-shaped flight from the burst point into the stroke, bowed outwards and sagging slightly.
      let x=ORIGIN[0]+(p.x-ORIGIN[0])*e+bulge[i*3]*arc,y=ORIGIN[1]+(p.y-ORIGIN[1])*e+bulge[i*3+1]*arc-1.5*arc*u,z=ORIGIN[2]*(1-e)+bulge[i*3+2]*arc;
      // Hold, then fall away as embers before the next word is written.
      if(ending>0){y-=fall[i]*9*ending*ending;x+=bulge[i*3]*.08*ending;}
      positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=z;
    }
    geometry.setDrawRange(0,samples.length);geometry.attributes.position.needsUpdate=true;
    const burst=reduced?1:T.MathUtils.smoothstep(phase,0,.08),out=ending>0?1-T.MathUtils.smoothstep(ending,.3,.85):1;
    uniforms.uOpacity.value=reduced?1:burst*out*(phase<.35?1.4-phase:1);
  }
  return {points,setProgress,state:()=>({word:words[wordIndex],count:geometry.drawRange.count,japanese:true,sparks:true})};
}
