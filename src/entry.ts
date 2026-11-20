import {tr} from './i18n/index.ts';
import {showStartup,hideStartup,failStartup,paintStartup,type StartupFailure} from './startup';
let route=location.pathname.replace(/\/+$/,'');
// Retired public reading pages return to the campus reader and its approved playlist.
// Keep the editorial CMS route separate.
if(route==='/suy-ngam'||route==='/suy-ngam/thu-vien'){
 const url=new URL(location.href);url.pathname='/';url.searchParams.delete('id');url.searchParams.delete('page');url.searchParams.delete('view');url.searchParams.set('panel','reflections');
 history.replaceState(null,'',url);route='';
}
const pages:Record<string,()=>Promise<unknown>>={
 '/suy-ngam/quan-tri':()=>import('./reflections/admin'),
};
let stage:StartupFailure='ADMIN_LOAD_FAILED';
const campus=async()=>{
 stage='PARTICIPATION_LOAD_FAILED';const auth=await import('./greetings/participation');hideStartup();
 stage='PARTICIPATION_INIT_FAILED';await auth.chooseParticipation();showStartup();await paintStartup();
 stage='CAMPUS_LOAD_FAILED';const main=await import('./main');
 stage='ACCOUNT_MENU_FAILED';auth.mountParticipantMenu(main.pauseForAccount);await paintStartup();
};
void (pages[route]||campus)().then(hideStartup).catch(error=>{
 console.error('[VJU STARTUP_FAILED]',stage,error);
 failStartup(stage);
 const root=document.querySelector('#app')!;root.replaceChildren();
 const message=document.createElement('p');message.textContent=tr('Chưa thể tải ứng dụng. Vui lòng tải lại trang.');
 const retry=document.createElement('button');retry.textContent=tr('Tải lại');retry.onclick=()=>location.reload();root.append(message,retry);
});
