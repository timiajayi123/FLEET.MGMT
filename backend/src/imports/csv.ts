export function parseCsv(input:string):Record<string,string>[] {
 const firstLine=input.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]??'',counts={comma:firstLine.match(/,/g)?.length??0,tab:firstLine.match(/\t/g)?.length??0,semicolon:firstLine.match(/;/g)?.length??0},delimiter=counts.tab>=counts.comma&&counts.tab>=counts.semicolon?'\t':counts.semicolon>counts.comma?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 const text=input.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){row.push(cell.trim());cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());cell='';if(row.some(Boolean))rows.push(row);row=[]}else cell+=c}
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)return[];
 const headers=rows[0].map(h=>h.trim());return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]?.trim()??''])));
}
export function required(row:Record<string,string>,fields:string[]){const missing=fields.filter(f=>!row[f]);if(missing.length)throw new Error(`Missing required field(s): ${missing.join(', ')}`)}
