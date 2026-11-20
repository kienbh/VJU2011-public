// Shared by browser and server. The first six entries preserve pre-v2 runs.
export const RUBBISH = [
 {name:'Vỏ chuối',bin:'organic',shape:'banana',why:'Vỏ trái cây phù hợp với mô hình ủ hữu cơ trong trò chơi.'},
 {name:'Lon nhôm sạch',bin:'recycle',shape:'can',why:'Lon sạch được đưa tới nhóm vật liệu tái chế.'},
 {name:'Khăn giấy đã dùng',bin:'residual',shape:'tissue',why:'Khăn giấy đã dùng không bỏ chung giấy sạch tái chế.'},
 {name:'Lá khô',bin:'organic',shape:'leaf',why:'Lá khô có thể tham gia quá trình ủ hữu cơ.'},
 {name:'Chai PET sạch',bin:'recycle',shape:'bottle',why:'Chai đã làm rỗng và sạch đi vào nhóm thu hồi vật liệu.'},
 {name:'Giấy sạch, khô',bin:'recycle',shape:'paper',why:'Giấy sạch, khô được tách khỏi rác bẩn để tái chế.'},
 {name:'Vỏ cam',bin:'organic',shape:'orange',why:'Vỏ cam thuộc nhóm hữu cơ để ủ trong trò chơi.'},
 {name:'Lõi táo',bin:'organic',shape:'apple',why:'Lõi trái cây được gom cùng rác hữu cơ.'},
 {name:'Bìa carton sạch',bin:'recycle',shape:'cardboard',why:'Bìa sạch, khô có thể thu hồi cùng giấy.'},
 {name:'Hộp giấy dính dầu',bin:'residual',shape:'greasy-box',why:'Giấy dính dầu không bỏ chung với giấy sạch để tái chế.'},
 {name:'Vỏ bánh nhiều lớp',bin:'residual',shape:'wrapper',why:'Bao bì ghép nhiều lớp không thuộc nhóm tái chế của trạm trong trò chơi.'},
 {name:'Bút nhựa hỏng',bin:'residual',shape:'pen',why:'Bút hỏng gồm nhiều vật liệu, không bỏ cùng chai PET sạch.'},
];
export function seededRandom(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function greenConfig(state){return state?.version===2?{total:24,initial:12,interval:4,capacity:6}:{total:12,initial:3,interval:10,capacity:6};}
export function greenItems(state){
 if(state?.version!==2)return Array.from({length:12},(_,i)=>i%6);
 const ids=Array.from({length:24},(_,i)=>i%RUBBISH.length),rng=seededRandom(state.seed);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;
}
export function greenUnlockSeconds(state,index){const c=greenConfig(state);return Math.max(0,index-c.initial+1)*c.interval;}
