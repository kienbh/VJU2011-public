export const JOURNEY_STEPS=['board','flowers','plant','greeting','finale'] as const;
export type JourneyStep=typeof JOURNEY_STEPS[number];
export function readJourney(value:unknown):JourneyStep[]{return Array.isArray(value)?JOURNEY_STEPS.filter(s=>value.includes(s)):[];}
export function createJourney(owner:string,storage:Pick<Storage,'getItem'|'setItem'>|null){const key='vju2011-journey-v1:'+owner;let done:JourneyStep[]=[];try{done=readJourney(JSON.parse(storage?.getItem(key)||'null'));}catch{}
 return {mark(step:JourneyStep){if(done.includes(step))return;done.push(step);try{storage?.setItem(key,JSON.stringify(done));}catch{}},has:(s:JourneyStep)=>done.includes(s),state:()=>[...done]};}
