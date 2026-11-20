/** Spoken greetings for campus NPCs. Pure data + selection, no DOM, so it is unit-testable.
 * Japanese lines carry a romaji reading and a Vietnamese meaning; the spoken text is always the original line. */
export type NpcLang='ja'|'vi';
export type OccasionId='teachers'|'christmas'|'yearEnd'|'newYear'|'tet'|'women83'|'women2010';
export type Phrase={lang:NpcLang;text:string;reading?:string;meaning?:string;occasion?:OccasionId;
  /** Optional recorded file id under /assets/audio/npc/<id>.mp3, used instead of device speech when listed in the manifest. */
  audio?:string};
export const OCCASION_LABELS:Record<OccasionId,string>={teachers:'Ngày Nhà giáo 20/11',christmas:'Giáng sinh',yearEnd:'Cuối năm',newYear:'Năm mới',tet:'Tết Nguyên đán',women83:'Quốc tế Phụ nữ 8/3',women2010:'Phụ nữ Việt Nam 20/10'};
/** First day of Tết (Vietnamese lunar new year). Extend when needed. */
export const TET_DAYS=['2026-02-17','2027-02-06','2028-01-26','2029-02-13','2030-02-03'];

const ja=(text:string,reading:string,meaning:string,occasion?:OccasionId):Phrase=>({lang:'ja',text,reading,meaning,occasion});
const vi=(text:string,occasion?:OccasionId):Phrase=>({lang:'vi',text,occasion});

/** Neutral greeting: the campus lighting does not follow the device clock. */
export const GREETINGS:Record<NpcLang,Phrase>={
  ja:ja('こんにちは！','Konnichiwa!','Xin chào!'),
  vi:vi('Xin chào!'),
};
export const PHRASES:Phrase[]=[
  // Everyday
  ja('ようこそ、日越大学へ！','Yōkoso, Nichietsu Daigaku e!','Chào mừng bạn đến Trường Đại học Việt Nhật!'),
  ja('はじめまして。どうぞよろしくお願いします。','Hajimemashite. Dōzo yoroshiku onegaishimasu.','Rất vui được gặp bạn.'),
  ja('良い一日を！','Yoi ichinichi o!','Chúc bạn một ngày tốt lành!'),
  ja('お疲れさまです。','Otsukaresama desu.','Bạn vất vả rồi.'),
  ja('試験、頑張ってください！','Shiken, ganbatte kudasai!','Thi thật tốt nhé!'),
  ja('感謝の気持ちを伝えましょう！','Kansha no kimochi o tsutaemashō!','Hãy gửi lời tri ân nhé!'),
  vi('Chào mừng bạn đến với Trường Đại học Việt Nhật!'),
  vi('Chúc bạn một ngày thật vui!'),
  vi('Bạn ghé Bảng Tri Ân chưa? Gửi một lời cảm ơn nhé!'),
  vi('Học tập tốt, sống thật vui nhé!'),
  // 20/11
  ja('先生、いつもありがとうございます。','Sensei, itsumo arigatō gozaimasu.','Em cảm ơn thầy cô vì tất cả.','teachers'),
  ja('ベトナムの先生の日、おめでとうございます。','Betonamu no sensei no hi, omedetō gozaimasu.','Chúc mừng Ngày Nhà giáo Việt Nam.','teachers'),
  ja('先生のおかげで、毎日成長できます。','Sensei no okage de, mainichi seichō dekimasu.','Nhờ thầy cô, em trưởng thành mỗi ngày.','teachers'),
  ja('これからもどうぞよろしくお願いします。','Kore kara mo dōzo yoroshiku onegaishimasu.','Mong thầy cô tiếp tục chỉ bảo.','teachers'),
  vi('Chúc mừng Ngày Nhà giáo Việt Nam 20/11!','teachers'),
  vi('Kính chúc thầy cô luôn mạnh khỏe và hạnh phúc.','teachers'),
  vi('Một chữ cũng là thầy, nửa chữ cũng là thầy.','teachers'),
  vi('Muốn sang thì bắc cầu kiều, muốn con hay chữ thì yêu lấy thầy.','teachers'),
  // Year end, New Year, Christmas, Tết
  ja('メリークリスマス！','Merī Kurisumasu!','Giáng sinh vui vẻ!','christmas'),
  ja('良いお年を！','Yoi otoshi o!','Chúc bạn đón năm mới tốt lành! (nói trước năm mới)','yearEnd'),
  ja('あけましておめでとうございます。','Akemashite omedetō gozaimasu.','Chúc mừng năm mới.','newYear'),
  ja('今年もよろしくお願いします。','Kotoshi mo yoroshiku onegaishimasu.','Năm nay cũng mong được bạn giúp đỡ.','newYear'),
  ja('旧正月、おめでとうございます。','Kyūshōgatsu, omedetō gozaimasu.','Chúc mừng Tết Nguyên đán.','tet'),
  vi('Giáng sinh an lành!','christmas'),
  vi('Chúc bạn một năm cũ khép lại thật đẹp!','yearEnd'),
  vi('Chúc mừng năm mới!','newYear'),
  vi('Chúc mừng năm mới! An khang thịnh vượng, vạn sự như ý.','tet'),
  // Women's days (Vietnam)
  ja('国際女性デー、おめでとうございます。','Kokusai josei dē, omedetō gozaimasu.','Chúc mừng Ngày Quốc tế Phụ nữ.','women83'),
  vi('Chúc mừng ngày Quốc tế Phụ nữ 8/3!','women83'),
  vi('Chúc mừng ngày Phụ nữ Việt Nam 20/10!','women2010'),
];

const md=(d:Date)=>(d.getMonth()+1)*100+d.getDate();
const dayNumber=(d:Date)=>Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
/** Occasions active on a local calendar date. */
export function occasionsOn(date:Date):OccasionId[]{
  const m=md(date),day=dayNumber(date),out:OccasionId[]=[];
  if(m>=1101&&m<=1125)out.push('teachers');
  if(m>=1215&&m<=1226)out.push('christmas');
  if(m>=1220&&m<=1231)out.push('yearEnd');
  if(m>=101&&m<=110)out.push('newYear');
  if(TET_DAYS.some(s=>{const [y,mo,d]=s.split('-').map(Number),t=Math.floor(Date.UTC(y,mo-1,d)/864e5);return day>=t-10&&day<=t+15;}))out.push('tet');
  if(m>=301&&m<=308)out.push('women83');
  if(m>=1015&&m<=1020)out.push('women2010');
  return out;
}
/** Neutral greeting, wishes for active occasions, then everyday lines.
 * Off-season wishes never enter the dialogue loop. Seed rotates everyday lines per NPC. */
export function npcDeck(lang:NpcLang,date:Date,seed=0):Phrase[]{
  const today=occasionsOn(date),own=PHRASES.filter(p=>p.lang===lang);
  const daily=own.filter(p=>!p.occasion),shift=((seed%daily.length)+daily.length)%daily.length;
  return [GREETINGS[lang],...own.filter(p=>p.occasion&&today.includes(p.occasion)),...daily.slice(shift),...daily.slice(0,shift)];
}
