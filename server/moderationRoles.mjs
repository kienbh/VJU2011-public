import {existsSync,readFileSync} from 'node:fs';

// Server-owned, app-local grants. Never trust names, guest input or browser roles.
export function readModerationRoles(file){
 if(!existsSync(file))return [];
 const roles=JSON.parse(readFileSync(file,'utf8'));
 if(!Array.isArray(roles)||roles.some(r=>!r||typeof r.issuer!=='string'||typeof r.subject!=='string'||!r.subject||!['admin','moderator'].includes(r.role)))throw Error('Invalid moderation grants');
 return roles;
}
export function moderationRole(identity,grants){
 if(!identity)return null;
 const matches=grants.filter(r=>r.issuer===identity.issuer&&r.subject===identity.subject);
 return matches.some(r=>r.role==='admin')?'admin':matches.some(r=>r.role==='moderator')?'moderator':null;
}
