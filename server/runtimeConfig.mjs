import path from 'node:path';
export function runtimeConfig(env,root){
 const flag=(key,fallback)=>{const v=env[key];if(v===undefined)return fallback;if(!['0','1'].includes(v))throw Error(`${key} must be 0 or 1.`);return v==='1';};
 const integer=(key,fallback)=>{const n=Number(env[key]??fallback);if(!Number.isSafeInteger(n)||n<1||n>65535)throw Error(`${key} must be 1..65535.`);return n;};
 const publicOrigin=env.PUBLIC_ORIGIN||null;
 if(publicOrigin){const u=new URL(publicOrigin);if(u.origin!==publicOrigin||u.protocol!=='https:'||u.username||u.password)throw Error('PUBLIC_ORIGIN must be an exact HTTPS origin.');}
 const dataDir=env.DATA_DIR||path.join(root,'.local');if(!path.isAbsolute(dataDir))throw Error('DATA_DIR must be absolute.');
 const trustedClientIpHeader=env.TRUSTED_CLIENT_IP_HEADER||'';
 if(!['','cf-connecting-ip','x-real-ip'].includes(trustedClientIpHeader))throw Error('Invalid TRUSTED_CLIENT_IP_HEADER.');
 return {campusCapacity:integer('CAMPUS_CAPACITY',50),campusQueueLimit:integer('CAMPUS_QUEUE_LIMIT',200),writeRateLimit:integer('WRITE_RATE_LIMIT',120),globalWriteRateLimit:integer('GLOBAL_WRITE_RATE_LIMIT',6000),loginRateLimit:integer('PARTICIPANT_LOGIN_RATE_LIMIT',600),trustedClientIpHeader,playEnabled:flag('CAMPUS_PLAY',true),dataDir,port:integer('PORT',8787),publicOrigin,devOrigin:env.DEV_ORIGIN||null,trialAccounts:flag('TRIAL_ACCOUNTS',false),submissionsEnabled:flag('ALLOW_SUBMISSIONS',false),seedSamples:flag('SEED_SAMPLES',false),publicOnly:flag('PUBLIC_ONLY',true),submissionRateLimit:integer('SUBMISSION_RATE_LIMIT',300),readRateLimit:integer('READ_RATE_LIMIT',12000)};
}
