/** Validate replies before replacing a draft or displaying a receipt. */
export async function readApiResponse(response:Response,path:string):Promise<unknown>{
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new Error('Máy chủ trả về dữ liệu chưa đúng định dạng. Bản nháp vẫn được giữ; hãy thử lại.');
  let value:any;
  try{value=await response.json();}catch{throw new Error('Chưa đọc được phản hồi máy chủ. Bản nháp vẫn được giữ; hãy thử lại.');}
  if(!response.ok)throw new Error(typeof value?.error==='string'?value.error:`Máy chủ trả về lỗi ${response.status}. Vui lòng thử lại.`);
  const object=value&&typeof value==='object'&&!Array.isArray(value);
  let valid=object;
  if(path==='/api/config')valid=object&&value.event&&typeof value.event.acceptingSubmissions==='boolean'&&typeof value.event.effectsEnabled==='boolean'&&typeof value.event.mode==='string'&&(value.event.closingAt===null||typeof value.event.closingAt==='string')&&Array.isArray(value.recipients)&&value.recipients.every((r:any)=>typeof r?.id==='string'&&typeof r?.name==='string');
  if(path==='/api/greetings'&&value?.greetings!==undefined)valid=object&&Array.isArray(value.greetings)&&value.greetings.every((g:any)=>typeof g?.id==='string'&&typeof g?.message==='string');
  if(!valid)throw new Error('Phản hồi máy chủ chưa đầy đủ. Bản nháp vẫn được giữ; hãy thử lại.');
  return value;
}
