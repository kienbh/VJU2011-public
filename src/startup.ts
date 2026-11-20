export type StartupFailure='ENTRY_LOAD_FAILED'|'PARTICIPATION_LOAD_FAILED'|'PARTICIPATION_INIT_FAILED'|'CAMPUS_LOAD_FAILED'|'ACCOUNT_MENU_FAILED'|'ADMIN_LOAD_FAILED';
declare global {interface Window {__VJU_BOOT__?:{show():void;hide():void;fail(code?:StartupFailure):void}}}
export const showStartup=()=>window.__VJU_BOOT__?.show();
export const hideStartup=()=>window.__VJU_BOOT__?.hide();
export const failStartup=(code?:StartupFailure)=>window.__VJU_BOOT__?.fail(code);
// Let the bilingual loading message paint before synchronous scene construction.
export const paintStartup=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
