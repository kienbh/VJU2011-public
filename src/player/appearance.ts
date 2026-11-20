export type Appearance={body:'male'|'female';hair:'short'|'bob'|'ponytail';outfit:'casual'|'polo'|'vju';palette:number};
export const DEFAULT_APPEARANCE:Appearance={body:'male',hair:'short',outfit:'casual',palette:0};
export function readAppearance(value:unknown):Appearance{
  const v=value&&typeof value==='object'?value as Partial<Appearance>:{};
  return {body:v.body==='female'?'female':'male',hair:v.hair==='bob'||v.hair==='ponytail'?v.hair:'short',outfit:v.outfit==='polo'||v.outfit==='vju'?v.outfit:'casual',palette:Number.isInteger(v.palette)&&v.palette!>=0&&v.palette!<3?v.palette!:0};
}
