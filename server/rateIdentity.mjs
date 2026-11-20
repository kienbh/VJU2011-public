import {isIP} from 'node:net';
export function clientAddress(req,trustedHeader=''){
 const socket=req.socket.remoteAddress||'unknown';
 if(trustedHeader&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(socket)){
  const value=req.headers[trustedHeader];if(typeof value==='string'&&isIP(value))return value;
 }
 return socket;
}
