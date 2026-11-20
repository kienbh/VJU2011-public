import {tr} from '../i18n/index.ts';
/** Souvenir photo: copies the rendered scene, adds a caption strip and saves a JPEG.
 * Everything stays on the visitor's device; nothing is uploaded. */
/** Souvenir photo: copies the rendered scene, adds a caption strip and saves a JPEG.
 * Everything stays on the visitor's device; nothing is uploaded. */
export async function savePhoto(source:HTMLCanvasElement,name:string):Promise<string>{
  const scale=Math.min(1,1920/Math.max(source.width,source.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)return tr('Thiết bị chưa chụp được ảnh.');
  // Must run in the same task as the WebGL render that filled `source`.
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const w=canvas.width,h=canvas.height,unit=Math.max(w,h)/100,strip=unit*(w<h?9:7.2);
  const shade=ctx.createLinearGradient(0,h-strip*1.6,0,h);shade.addColorStop(0,'rgba(20,24,34,0)');shade.addColorStop(.45,'rgba(20,24,34,.62)');shade.addColorStop(1,'rgba(20,24,34,.86)');
  ctx.fillStyle=shade;ctx.fillRect(0,h-strip*1.6,w,strip*1.6);
  const font=(size:number,weight=700)=>`${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#ffe2a6';ctx.font=font(unit*2.5);
  ctx.fillText(tr('Chúc mừng ngày 20/11/2026'),unit*2.4,h-strip*.52,w*.62);
  ctx.fillStyle='#fff6e6';ctx.font=font(unit*1.7,600);ctx.fillText(tr('Trường Đại học Việt Nhật, VNU'),unit*2.4,h-strip*.18,w*.62);
  const label=name.trim().slice(0,24);
  if(label){ctx.textAlign='right';ctx.fillStyle='#fff6e6';ctx.font=font(unit*2,600);ctx.fillText(label,w-unit*2.4,h-strip*.3,w*.32);}
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
  if(!blob)return tr('Thiết bị chưa lưu được ảnh.');
  const stamp=new Date(),two=(n:number)=>String(n).padStart(2,'0');
  const fileName=`vju-20-11-2026-${two(stamp.getHours())}${two(stamp.getMinutes())}${two(stamp.getSeconds())}.jpg`;
  // Phones: offer the share sheet (save to photos, send to a friend). Otherwise download the file.
  if(matchMedia('(pointer: coarse)').matches&&typeof navigator.canShare==='function'){
    const file=new File([blob],fileName,{type:'image/jpeg'});
    if(navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:'VJU · 20/11/2026'});return tr('Đã chụp ảnh.');}
      catch(error){if((error as DOMException)?.name==='AbortError')return tr('Đã hủy chia sẻ ảnh.');}
    }
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=fileName;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  return tr('Đã chụp · ảnh {0} được lưu về máy.',{0:fileName});
}
