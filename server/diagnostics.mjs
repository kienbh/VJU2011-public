import {randomUUID} from 'node:crypto';

// Never log bodies, headers, query strings, receipt IDs or raw exception messages.
export function createDiagnostics(logger = record => console.info(JSON.stringify(record))) {
  let totals = {requests: 0, rateLimited: 0, serverErrors: 0};
  const emit = record => { try { logger({time: new Date().toISOString(), ...record}); } catch { /* Logging cannot break requests. */ } };
  const flush = () => { if(totals.requests) emit({event:'request_summary',...totals}); totals={requests:0,rateLimited:0,serverErrors:0}; };
  const timer=setInterval(flush,60000);timer.unref();
  return {
    begin(req,res) {
      const id=randomUUID();
      res.once('finish',()=>{totals.requests++;if(res.statusCode===429)totals.rateLimited++;if(res.statusCode>=500)totals.serverErrors++;});
      return id;
    },
    error(req,error,id) {
      const pathname=(req.url||'/').split('?')[0];
      const route=/^\/api\/(?:config|health|greetings|admin\/(?:greetings|settings))$/.test(pathname)?pathname:pathname.startsWith('/api/receipts/')?'/api/receipts/:id':/^\/api\/admin\/greetings\/[^/]+\/moderate$/.test(pathname)?'/api/admin/greetings/:id/moderate':pathname.startsWith('/api/')?'/api/:unknown':'/static';
      const locations=String(error?.stack||'').match(/(?:app|diagnostics)\.mjs:\d+:\d+/g)||[];
      emit({event:'server_error',id,method:['GET','POST','HEAD','OPTIONS'].includes(req.method)?req.method:'OTHER',route,errorType:['Error','TypeError','RangeError','SyntaxError'].includes(error?.name)?error.name:'Error',locations:[...new Set(locations)].slice(0,5)});
    },
    close(){clearInterval(timer);flush();}
  };
}
