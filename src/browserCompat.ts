/** Keep network timeouts on browsers without AbortSignal.timeout. */
export function requestTimeout(ms:number):AbortSignal {
  if(typeof AbortSignal.timeout==='function')return AbortSignal.timeout(ms);
  const controller=new AbortController();
  // The fallback uses wall-clock time. Browsers may defer timers in background tabs.
  setTimeout(()=>controller.abort(),ms);
  return controller.signal;
}

/** App labels use a single circular radius and positive dimensions only. */
export function roundedRectPath(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number):void {
  if(typeof ctx.roundRect==='function'){ctx.roundRect(x,y,w,h,r);return;}
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
