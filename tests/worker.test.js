import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/worker.js').catch(() => ({}));
const request=(path,body,token)=>new Request('https://site.example'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
test('health reports missing database honestly', async()=>{
 assert.ok(module.default); const r=await module.default.fetch(request('/api/health'),{});
 assert.equal(r.status,503); assert.equal((await r.json()).configured,false);
});
test('public catalogue contains Cypher graph queries',async()=>{
 assert.ok(module.default); const r=await module.default.fetch(request('/api/presets'),{}); const j=await r.json();
 assert.equal(r.status,200); assert.ok(j.presets.length>=10); assert.ok(j.presets.every(p=>p.cypher&&!p.cypher.includes('SELECT ')));
});
test('unauthenticated custom Cypher never reaches the database',async()=>{
 assert.ok(module.default); const r=await module.default.fetch(request('/api/query',{cypher:'MATCH (n) DETACH DELETE n'}),{GRAPH_ADMIN_TOKEN:'secret'});
 assert.equal(r.status,401);
});
test('unknown public preset is rejected',async()=>{
 assert.ok(module.default); const r=await module.default.fetch(request('/api/query',{preset:'missing'}),{}); assert.equal(r.status,400);
});
test('malformed JSON and oversized requests return client errors',async()=>{
 assert.ok(module.default); const r=await module.default.fetch(new Request('https://site.example/api/query',{method:'POST',body:'{'}),{}); assert.equal(r.status,400);
 const s=await module.default.fetch(request('/api/query',{cypher:'x'.repeat(70000)}),{}); assert.equal(s.status,413);
});
test('API-only repository responds clearly without frontend binding',async()=>{
 assert.ok(module.default); const r=await module.default.fetch(request('/'),{}); assert.equal(r.status,200); assert.match(await r.text(),/Alumni Graph/);
});
