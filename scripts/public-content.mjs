// Original replacement copy for the public edition; no private quotations are inputs.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const rows=JSON.parse(readFileSync(new URL('../content/reflections/original-public.json',import.meta.url),'utf8'));
const overlay={};
const blocks=rows.map((row,i)=>{
 const id='NT-'+String(i+1).padStart(3,'0');
 overlay[id]={title:row.jaTitle,content:row.jaContent,question:row.jaQuestion,author:'VJU2011',source:'公開版のために作成した独自の文章 · MIT',type:'独自の文章（日本語はAI訳）'};
 return `## ${id} — ${row.title}\n\n**Trạng thái:** ${i===0?'Đã duyệt nội dung':'Bản nháp — công bố theo ảnh chụp bản public'}\n**Loại nội dung:** Nội dung gốc cho bản public, có hỗ trợ AI\n**Tác giả:** VJU2011\n**Nguồn:** Nội dung gốc của dự án · MIT · 20/11/2026\n\n### Tư tưởng giáo dục\n\n${row.content.split('\n').map(s=>'> '+s).join('\n')}\n\n### Suy ngẫm hôm nay\n\n**Câu hỏi suy ngẫm:** ${row.question}\n`;
});
const markdown='# Suy ngẫm về việc dạy và học — bản public\n\nMười một nội dung gốc được viết mới cho bản mã nguồn công khai. Không trích dẫn hoặc gán lời cho tác giả bên ngoài. Bản Nhật là bản dịch có hỗ trợ AI, chưa được người bản ngữ nghiệm thu.\n\n'+blocks.join('\n---\n\n');
writeFileSync(new URL('../content/reflections/goc-suy-ngam-nghe-thay.md',import.meta.url),markdown);
writeFileSync(new URL('../content/reflections/board-publication.json',import.meta.url),JSON.stringify({date:'2026-11-20',authorization:'Owner requested an independent public edition with original replacement content; this is its generated snapshot.',sha256:createHash('sha256').update(markdown).digest('hex'),ids:Object.keys(overlay)},null,2)+'\n');
writeFileSync(new URL('../src/reflections/board-content-ja.ts',import.meta.url),'// Generated from original-public.json; Japanese is AI-assisted.\nexport type ReflectionOverlay={title:string;content:string;source:string;type:string;question:string;author?:string};\nexport const REFLECTIONS_JA:Record<string,ReflectionOverlay>='+JSON.stringify(overlay,null,2)+';\n');
execFileSync(process.execPath,[new URL('./reflection-content.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],{stdio:'inherit'});
