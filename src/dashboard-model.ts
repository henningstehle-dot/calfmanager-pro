export function healthPercentages(statuses: string[]): Record<'green'|'yellow'|'red',number> {
 const keys=['green','yellow','red'] as const;
 const result={green:0,yellow:0,red:0};
 if (!statuses.length) return result;
 const values=keys.map(key=>({key,raw:statuses.filter(s=>s===key).length*100/statuses.length}));
 for(const v of values) result[v.key]=Math.floor(v.raw);
 const remaining=100-Object.values(result).reduce((a,b)=>a+b,0);
 values.sort((a,b)=>(b.raw%1)-(a.raw%1));
 for(let i=0;i<Math.min(remaining,values.length);i++) result[values[i].key]++;
 return result;
}
