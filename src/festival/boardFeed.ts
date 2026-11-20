import {requestTimeout} from '../browserCompat';
export interface BoardCard {id:string;message:string;recipientName:string;signature:string;isSample?:boolean}
export interface BoardPage {greetings:BoardCard[];page:number;pageSize:number;total:number;pages:number}
export const BOARD_INTERVAL_MS=10_000;
export const BOARD_PAGE_SIZE=24;

export async function loadPublicBoardPage(page:number):Promise<BoardPage>{
  let response:Response;try{response=await fetch(`/api/greetings/board?page=${page}`,{signal:requestTimeout(8000)});}catch{throw Error('Mất kết nối với bảng lời chúc. Bảng sẽ thử lại.');}
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Chưa tải được lời chúc. Bảng sẽ thử lại.');
  let data;try{data=await response.json();}catch{throw Error('Dữ liệu lời chúc chưa đúng định dạng.');}
  if(!data||!Array.isArray(data.greetings)||data.greetings.length>BOARD_PAGE_SIZE||data.pageSize!==BOARD_PAGE_SIZE||![data.page,data.total,data.pages].every(Number.isSafeInteger)||data.page<0||data.total<0||data.pages<1||data.page>=data.pages||!data.greetings.every((c:BoardCard)=>c&&typeof c.id==='string'&&typeof c.message==='string'&&typeof c.recipientName==='string'&&typeof c.signature==='string'))throw Error('Dữ liệu lời chúc chưa đúng định dạng.');
  return data as BoardPage;
}

/** One request at a time. Manual advance resets 10s; inactive views never catch up. */
/** One request at a time. Manual advance resets 10s; inactive views never catch up. */
/** Stays free of imports (its test runs it from a data: URL); the caller passes the UI translator. */
export function createBoardPager(options:{load(page:number):Promise<BoardPage>;change(page:BoardPage):void;status(message:string):void;now():number;tr?(text:string,vars?:Record<string|number,unknown>):string}){
 const tr=options.tr??((text:string,vars?:Record<string|number,unknown>)=>text.replace(/\{(\w+)\}/g,(m,k)=>vars&&k in vars?String(vars[k]):m));
  let data:BoardPage|null=null,busy=false,deadline=0,paused=true,revision=0,error='';
  async function request(advance:boolean){
    if(busy)return;busy=true;error='';deadline=options.now()+BOARD_INTERVAL_MS;
    const page=data&&advance?(data.page+1)%data.pages:data?.page??0;
    try{const next=await options.load(page);data=next;revision++;options.change(next);options.status(next.total?tr('Lượt {0}/{1} · {2} lời chúc{3}',{0:next.page+1,1:next.pages,2:next.total,3:next.greetings.every(c=>c.isSample)?tr(' mẫu'):''}):tr('Chưa có lời chúc công khai.'));}
    catch(e){error=e instanceof Error?tr(e.message):tr('Chưa kết nối được bảng.');options.status(error+(data?tr(' Đang giữ lượt đã tải.'):''));}
    finally{busy=false;deadline=options.now()+BOARD_INTERVAL_MS;}
  }
  return {
    next:()=>request(true),
    tick(now:number,active:boolean){if(!active){paused=true;return;}if(paused){paused=false;deadline=now+BOARD_INTERVAL_MS;if(!data&&!busy)void request(false);return;}if(!busy&&now>=deadline)void request(!!data);},
    state:()=>({page:data?.page??0,pages:data?.pages??1,total:data?.total??0,ids:data?.greetings.map(c=>c.id)??[],busy,revision,error,remaining:Math.max(0,Math.ceil((deadline-options.now())/1000))}),
  };
}
