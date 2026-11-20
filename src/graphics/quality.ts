import * as THREE from 'three';
import {phoneScreen} from '../mobile';
import {setLakeQuality} from '../scene/lakeWater';
import {setSurfaceAnisotropy} from '../scene/surfaceMaterials';
import {createQualityPolicy,type Quality} from './policy';
import {loadQuality,saveQuality,mountQualityChoice} from './settings';
import {thinGroup} from './thinGroup';
import './quality.css';

export function createGraphicsQuality(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  let policy=createQualityPolicy(phoneScreen.matches,devicePixelRatio,loadQuality());
  const groups:ReturnType<typeof thinGroup>[]=[];
  const registered=new WeakSet<THREE.Object3D>();
  function register(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.InstancedMesh&&!registered.has(o)&&(o.name==='forest-behind-main-campus'||o.userData.qualityDecoration===true)){registered.add(o);const thin=thinGroup(o);groups.push(thin);thin(policy.state().density);}});}
  // Only scenery with no interaction/colliders. Never thin avatars, collectible flowers or signs.
  register(scene);
  const originalShadows=renderer.shadowMap.enabled;
  const samples:number[]=[];
  let density=-1;
  function apply(){
    const s=policy.state();
    if(density!==s.density){density=s.density;groups.forEach(thin=>thin(density));}
    renderer.shadowMap.enabled=originalShadows&&s.shadows;
    setLakeQuality(s.reflection,s.reflectionInterval);
    if(camera.far!==s.far){camera.far=s.far;camera.updateProjectionMatrix();}
    if(renderer.getPixelRatio()!==s.ratio)renderer.setPixelRatio(s.ratio);
    setSurfaceAnisotropy(Math.min(renderer.capabilities.getMaxAnisotropy(),phoneScreen.matches?4:8));
  }
  function select(value:Quality){policy.select(value,performance.now());saveQuality(value);apply();}
  function reset(){policy=createQualityPolicy(phoneScreen.matches,devicePixelRatio,policy.state().mode);apply();}
  phoneScreen.addEventListener('change',reset);
  document.addEventListener('visibilitychange',()=>policy.sample(performance.now(),0,true));
  apply();
  return {register,
    update(ms:number){if(!document.hidden&&ms>0&&ms<250){samples.push(ms);if(samples.length>120)samples.shift();}if(policy.sample(performance.now(),ms,document.hidden))apply();},
    mount(root:HTMLElement){mountQualityChoice(root,select,policy.state().mode);},
    state(){return {...policy.state(),frameMs:samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:null,decorationGroups:groups.length,shadowEnhancement:false};},
  };
}
