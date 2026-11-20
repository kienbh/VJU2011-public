import {tr} from '../i18n/index.ts';
/** Courtyard orientation, with large direct labels instead of campus-wide numbered pins. */
/** Courtyard orientation, with large direct labels instead of campus-wide numbered pins. */
export function welcomeMap(){return `<svg viewBox="0 0 680 490" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${tr('Sân lễ hội: cổng dưới phải, sân khấu trên trái, bảng tri ân giữa sân, vườn hoa bên phải, góc suy ngẫm và vườn cắm hoa bên trái.')}">
<defs><linearGradient id="wm-sky" x2="0" y2="1"><stop stop-color="#294b56"/><stop offset="1" stop-color="#6a8b7d"/></linearGradient>
<g id="wm-tree"><ellipse cy="26" rx="25" ry="9" fill="#436650"/><path d="M0 26V-12" stroke="#8e7852" stroke-width="5"/><circle cy="-17" r="22" fill="#679b78"/><circle cx="-13" cy="-10" r="17" fill="#4d805f"/></g>
<g id="wm-flower"><path d="M0 14V-9m0 18 8-7" stroke="#5a8051" stroke-width="3"/><circle cy="-12" r="9" fill="currentColor"/><circle cy="-12" r="3" fill="#f8e8a2"/></g>
<g id="wm-board"><path d="M-28 14v19m56-19v19" stroke="#876343" stroke-width="6"/><rect x="-39" y="-28" width="78" height="48" rx="3" fill="#80553d"/><rect x="-33" y="-22" width="66" height="36" fill="#efddb6"/><path d="M-24-13h12v19h-12m18-19H6V6H-6m18-19h12V6H12" fill="#bf756a"/></g></defs>
<rect width="680" height="490" rx="22" fill="url(#wm-sky)"/>
<g font-family="Segoe UI,Arial,sans-serif" fill="#fff3d6">
<text x="28" y="38" font-size="15" letter-spacing="2">${tr('MỘT VÒNG SÂN LỄ HỘI')}</text>
<path d="M26 106 568 77 651 369 124 421 26 330Z" fill="#a8b79a"/>
<path d="M24 105 568 76" stroke="#d2d4bc" stroke-width="13"/>
<g fill="#d6d0b6" stroke="#50696a" stroke-width="3"><path d="M187 71V50h70v17m52-3V38h89v21m53-3V31h83v20"/></g>
<path d="M599 449V375Q599 343 562 343H329Q305 343 305 307V266" fill="none" stroke="#f3e3bf" stroke-width="30" stroke-linejoin="round"/>
<path d="M599 449V375Q599 343 562 343H329Q305 343 305 307V266" fill="none" stroke="#a37940" stroke-width="3" stroke-dasharray="5 8"/>
<use href="#wm-tree" x="570" y="124"/><use href="#wm-tree" x="651" y="274"/>
<g transform="translate(240 165)"><path d="M-59 12 53 8 68 26-48 32Z" fill="#8b5f3f"/><path d="M-49 10V-38H49V7" fill="#f5e7c9" stroke="#a74d48" stroke-width="9"/><text y="-10" text-anchor="middle" font-size="18" fill="#8c443c">20.11</text><g fill="#3b6260"><path d="M-42 47h15v9h-15m24-9h15v9h-15m24-9h15v9H6m24-9h15v9H30m-72 10h15v9h-15m24-9h15v9h-15m24-9h15v9H6m24-9h15v9H30"/></g></g>
<use href="#wm-board" x="330" y="237"/>
<g transform="translate(70 229)"><path d="M-20 15v20m40-20v20" stroke="#80623f" stroke-width="5"/><rect x="-28" y="-26" width="56" height="47" fill="#f7eacd" stroke="#80623f" stroke-width="5"/><path d="M-17-11h34m-34 9h34m-34 9h24" stroke="#a88b64" stroke-width="3"/></g>
<g transform="translate(472 205)"><ellipse cy="14" rx="55" ry="23" fill="#6b865a" stroke="#dedbbf" stroke-width="6"/><use href="#wm-flower" x="-32" y="-1" color="#e6b959"/><use href="#wm-flower" x="-10" y="-12" color="#d98989"/><use href="#wm-flower" x="13" y="-8" color="#fff1cd"/><use href="#wm-flower" x="34" y="3" color="#b094ba"/><use href="#wm-flower" x="2" y="12" color="#e5b551"/></g>
<g transform="translate(187 338)"><path d="M-54-14 39-22 57 20-39 30Z" fill="#6a865b" stroke="#e0dbc4" stroke-width="4"/><g fill="#aa7854"><ellipse cx="-27" cy="-1" rx="11" ry="6"/><ellipse cx="3" cy="-6" rx="11" ry="6"/><ellipse cx="30" cy="-9" rx="11" ry="6"/></g><use href="#wm-flower" x="-27" y="-7" color="#d9a0a2"/><use href="#wm-flower" x="3" y="-12" color="#ead073"/><use href="#wm-flower" x="30" y="-15" color="#faf0d1"/></g>
<g transform="translate(598 415)"><path d="M-26 24v-54m52 54v-54m-56 0h60" fill="none" stroke="#334f50" stroke-width="9"/><path d="M-26-46h25v17h-25" fill="#bd3d46"/><text x="-14" y="-33" text-anchor="middle" font-size="13" fill="#f5d879">★</text><path d="M26-46h25v17H26" fill="#fff7e4"/><circle cx="38" cy="-37" r="5" fill="#b93945"/></g>
<g font-size="22" font-weight="650" fill="#213f3e" text-anchor="middle"><text x="240" y="110">${tr('Sân khấu')}</text><text x="333" y="298">${tr('Bảng Tri Ân')}</text><text x="473" y="164">${tr('Vườn Hoa Tri Ân')}</text><text x="187" y="390">${tr('Vườn cắm hoa')}</text></g>
<g font-size="21" font-weight="650"><text x="24" y="165" fill="#213f3e">${tr('Góc suy ngẫm')}</text><text x="24" y="189" fill="#213f3e">${tr('“Nghề thầy”')}</text><text x="554" y="475">${tr('Cổng vào')}</text></g>
<text x="29" y="459" font-size="17">${tr('Qua cổng → rẽ trái vào sân')}</text></g></svg>`;}
