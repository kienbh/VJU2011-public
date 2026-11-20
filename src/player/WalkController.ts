import * as THREE from 'three';
import type { Collider } from '../types';
import { isWalkable, moveWithCollisions, type WalkBounds } from './collision';
import './controls.css';
import type {StageSeat} from '../festival/stageLayout';

type Options = { colliders: Collider[]; bounds: WalkBounds; spawn: THREE.Vector3; touchRoot: HTMLElement; heightAt?: (x: number, z: number) => number };
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class WalkController {
  readonly position = new THREE.Vector3();
  view: 'first' | 'third' | 'overview' = 'first';
  private lastDelta = new THREE.Vector3();
  private seat: {spec:StageSeat;returnPosition:THREE.Vector3;floorY:number}|null=null;
  get seated() { return this.seat?.spec.id??null; }
  get heading() { return this.seat?.spec.heading??this.yaw; }
  sitDown(spec:StageSeat){
    if(!this.enabled||this.seat||this.view==='overview'||Math.hypot(spec.x-this.position.x,spec.z-this.position.z)>2.1)return false;
    if(!isWalkable(this.position,this.options.colliders,this.options.bounds))return false;
    this.seat={spec,returnPosition:this.position.clone(),floorY:this.floorY};
    this.clearInput();this.lastDelta.set(0,0,0);this.position.set(spec.x,spec.eyeY,spec.z);
    this.yaw=spec.heading;this.pitch=0;this.orient();return true;
  }
  standUp(){
    if(!this.seat)return false;
    const saved=this.seat;
    if(!isWalkable(saved.returnPosition,this.options.colliders,this.options.bounds))return false;
    this.seat=null;this.position.copy(saved.returnPosition);this.floorY=saved.floorY;
    this.clearInput();this.lastDelta.set(0,0,0);this.orient();return true;
  }
  get velocity() { return this.lastDelta; }
  diagnostics(){return {enabled:this.enabled,seated:!!this.seat,view:this.view,stickActive:this.stickPointer!==null,stickMagnitude:Math.round(Math.hypot(this.stick.x,this.stick.z)*100)/100,keysHeld:this.keys.size,movedLastFrame:Math.round(this.lastDelta.length()*1000)/1000};}
  get moving() { return this.enabled&&!this.seat&&this.lastDelta.lengthSq()>.000001; }
  setView(view: 'first' | 'third' | 'overview') { this.view=view;this.clearInput();this.pad.hidden=!this.enabled||view==='overview';this.orient(); }
  private enabled = false;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private overviewYaw = 0;
  private overviewElevation = Math.atan2(65,40);
  private floorY = 0;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private stickPointer: number | null = null;
  private stick = { x: 0, z: 0 };
  private abort = new AbortController();
  private pad: HTMLDivElement;
  private knob: HTMLSpanElement;
  private hint: HTMLSpanElement;
  private originalTouchAction: string;

  constructor(private camera: THREE.PerspectiveCamera, private domElement: HTMLElement, private options: Options) {
    this.originalTouchAction = domElement.style.touchAction;
    options.touchRoot.classList.add('walk-touch-root');
    this.pad = document.createElement('div');
    this.pad.className = 'walk-joystick';
    this.pad.setAttribute('role', 'group');
    this.pad.setAttribute('aria-label', 'Cần di chuyển: kéo để đi lại');
    this.knob = document.createElement('span');
    this.knob.className = 'walk-joystick-knob';
    this.knob.textContent = '↕';
    this.pad.append(this.knob);
    this.hint = document.createElement('span');
    this.hint.className = 'walk-look-hint';
    this.hint.textContent = 'Kéo trên cảnh để nhìn';
    options.touchRoot.append(this.pad, this.hint);
    const signal = this.abort.signal;
    window.addEventListener('keydown', this.onKeyDown, { signal });
    window.addEventListener('keyup', this.onKeyUp, { signal });
    window.addEventListener('blur', this.clearInput, { signal });
    document.addEventListener('visibilitychange', this.clearInput, { signal });
    domElement.addEventListener('pointerdown', this.onLookStart, { signal });
    domElement.addEventListener('pointermove', this.onLookMove, { signal });
    domElement.addEventListener('pointerup', this.onLookEnd, { signal });
    domElement.addEventListener('pointercancel', this.onLookEnd, { signal });
    domElement.addEventListener('lostpointercapture', this.onLookEnd, { signal });
    this.pad.addEventListener('pointerdown', this.onStickStart, { signal });
    this.pad.addEventListener('pointermove', this.onStickMove, { signal });
    this.pad.addEventListener('pointerup', this.onStickEnd, { signal });
    this.pad.addEventListener('pointercancel', this.onStickEnd, { signal });
    this.pad.addEventListener('lostpointercapture', this.onStickEnd, { signal });
    this.reset();
    this.setEnabled(false);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (event.code === 'Escape') { this.clearInput(); return; }
    if (movementKeys.has(event.code)) { event.preventDefault(); this.keys.add(event.code); }
  };
  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private clearInput = () => {
    this.keys.clear();
    this.lookPointer = null;
    this.stickPointer = null;
    this.stick = { x: 0, z: 0 };
    this.knob.style.transform = 'translate(0px, 0px)';
  };
  private onLookStart = (event: PointerEvent) => {
    if (!this.enabled || this.lookPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    this.lookPointer = event.pointerId;
    this.lookX = event.clientX;
    this.lookY = event.clientY;
    this.domElement.setPointerCapture(event.pointerId);
  };
  private onLookMove = (event: PointerEvent) => {
    if (!this.enabled || event.pointerId !== this.lookPointer) return;
    const sensitivity=event.pointerType==='touch'?0.0075:0.003;
    if(this.view==='overview'){
      this.overviewYaw -= (event.clientX-this.lookX)*sensitivity;
      this.overviewElevation=THREE.MathUtils.clamp(this.overviewElevation+(event.clientY-this.lookY)*sensitivity,.6,1.45);
    }else{
      this.yaw -= (event.clientX - this.lookX) * sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - this.lookY) * sensitivity, -1.3, 1.3);
    }
    this.lookX = event.clientX;
    this.lookY = event.clientY;
    // Only accumulate input here. Collision-aware camera placement runs once per
    // animation frame, rather than repeating its ray queries for every pointer event.
  };
  private onLookEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
    if (this.domElement.hasPointerCapture(event.pointerId)) this.domElement.releasePointerCapture(event.pointerId);
  };
  private onStickStart = (event: PointerEvent) => {
    if (!this.enabled || this.stickPointer !== null) return;
    event.preventDefault();
    event.stopPropagation();
    this.stickPointer = event.pointerId;
    this.pad.setPointerCapture(event.pointerId);
    this.onStickMove(event);
  };
  private onStickMove = (event: PointerEvent) => {
    if (!this.enabled || event.pointerId !== this.stickPointer) return;
    event.preventDefault();
    const rect = this.pad.getBoundingClientRect();
    const limit = rect.width * 0.28;
    let x = (event.clientX - rect.left - rect.width / 2) / limit;
    let z = (event.clientY - rect.top - rect.height / 2) / limit;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    this.stick = { x, z };
    this.knob.style.transform = `translate(${x * limit}px, ${z * limit}px)`;
  };
  private onStickEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.stick = { x: 0, z: 0 };
    this.knob.style.transform = 'translate(0px, 0px)';
    if (this.pad.hasPointerCapture(event.pointerId)) this.pad.releasePointerCapture(event.pointerId);
  };
  private orient() {
    if(this.view==='first'){this.camera.position.copy(this.position);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');return;}
    if(this.view==='overview'){
      const radius=Math.hypot(65,40),horizontal=radius*Math.cos(this.overviewElevation);
      this.camera.position.copy(this.position).add(new THREE.Vector3(Math.sin(this.overviewYaw)*horizontal,radius*Math.sin(this.overviewElevation),Math.cos(this.overviewYaw)*horizontal));this.camera.lookAt(this.position);return;
    }
    const offset=new THREE.Vector3(Math.sin(this.yaw)*6.2,2.4-this.pitch*4,Math.cos(this.yaw)*6.2);
    const ray=new THREE.Ray(this.position.clone(),offset.clone().normalize());
    let distance=offset.length();const hit=new THREE.Vector3();
    for(const box of this.options.colliders){
      if(box.segment){
        const [ax,az,bx,bz]=box.segment,centre=new THREE.Vector3((ax+bx)/2,0,(az+bz)/2),yaw=Math.atan2(bz-az,bx-ax);
        const localRay=ray.clone();localRay.origin.sub(centre).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);localRay.direction.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
        const length=Math.hypot(bx-ax,bz-az),localBox=new THREE.Box3(new THREE.Vector3(-length/2-.18,0,-.35),new THREE.Vector3(length/2+.18,box.maxY??2.5,.35));
        if(localRay.intersectBox(localBox,hit))distance=Math.min(distance,Math.max(.35,hit.distanceTo(localRay.origin)-.2));
        continue;
      }
      const bounds=new THREE.Box3(new THREE.Vector3(box.minX-.18,0,box.minZ-.18),new THREE.Vector3(box.maxX+.18,box.maxY??28,box.maxZ+.18));
      if(ray.intersectBox(bounds,hit))distance=Math.min(distance,Math.max(.35,hit.distanceTo(this.position)-.2));
    }
    this.camera.position.copy(this.position).addScaledVector(ray.direction,distance);
    this.camera.lookAt(this.position.x,this.position.y+.2,this.position.z);
  }

  update(dt: number) {
    this.lastDelta.set(0,0,0);
    if (!this.enabled || !Number.isFinite(dt) || dt <= 0) return;
    if(this.view==='overview'){this.orient();return;}
    if(this.seat){this.orient();return;}
    const down = (...codes: string[]) => codes.some(code => this.keys.has(code)) ? 1 : 0;
    let x = down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft') + this.stick.x;
    let z = down('KeyS', 'ArrowDown') - down('KeyW', 'ArrowUp') + this.stick.z;
    const magnitude = Math.hypot(x, z);
    if (magnitude > 1) { x /= magnitude; z /= magnitude; }
    const distance = Math.min(dt, 0.1) * 9;
    const next = moveWithCollisions(this.position, {
      x: (x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) * distance,
      z: (-x * Math.sin(this.yaw) + z * Math.cos(this.yaw)) * distance,
    }, this.options.colliders, this.options.bounds);
    this.lastDelta.set(next.x-this.position.x,0,next.z-this.position.z);
    // Raised floors (flag dais and its steps) come from the scene; flat ground elsewhere.
    if (this.options.heightAt) this.floorY = this.options.heightAt(next.x, next.z);
    this.position.set(next.x, this.floorY + 1.7, next.z);
    this.orient();
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    this.clearInput();
    this.pad.hidden = !value||this.view==='overview';
    this.hint.hidden = !value;
    this.domElement.style.touchAction = value ? 'none' : this.originalTouchAction;
    if (value) this.orient();
  }

  reset(position = this.options.spawn, target?: THREE.Vector3) {
    this.seat=null;
    this.clearInput();
    const safe = isWalkable(position, this.options.colliders, this.options.bounds) ? position : this.options.spawn;
    this.floorY = safe.y;
    this.position.set(safe.x, safe.y + 1.7, safe.z);
    this.pitch = 0;
    if (target) {
      const direction = target.clone().sub(this.position);
      this.yaw = Math.atan2(-direction.x, -direction.z);
      this.pitch = THREE.MathUtils.clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), -1.3, 1.3);
    } else this.yaw = 0;
    this.orient();
  }

  /** Adopt a restored cinematic pose without resetting spawn or moving the player. */
  syncCameraPose(){
    if(this.seat){this.clearInput();this.orient();return;}
    if(this.view!=='first'){this.clearInput();this.orient();return;}
    this.position.copy(this.camera.position);
    const angles=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
    this.yaw=angles.y;this.pitch=angles.x;this.floorY=this.camera.position.y-1.7;this.clearInput();
  }

  dispose() {
    this.clearInput();
    this.abort.abort();
    this.pad.remove();
    this.hint.remove();
    this.options.touchRoot.classList.remove('walk-touch-root');
    this.domElement.style.touchAction = this.originalTouchAction;
  }
}
