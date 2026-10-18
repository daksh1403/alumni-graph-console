import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {queryNeo4j} from '../src/neo4j.js';
import {buildGraph,entities} from '../src/model.js';
import {presets} from '../src/presets.js';
const tables=JSON.parse(readFileSync('private/d1-data.json','utf8')), graph=buildGraph(tables);
const q=async(statement,parameters={})=>queryNeo4j(process.env,statement,parameters,{readOnly:true,maxRows:2000});
const actualNodes=[];
for(const [,[label,keys]] of Object.entries(entities)) {
 const result=await q(`MATCH (n:${label}) RETURN properties(n) AS properties`);
 assert.equal(result.rows.length,graph.expected.labels[label],label+' count');
 for(const [properties] of result.rows){const expected=graph.nodes.find(n=>n.label===label&&keys.every(k=>n.key[k]===properties[k]));assert.ok(expected,label+' identity');assert.deepEqual(properties,expected.properties,label+' properties');actualNodes.push({label,properties});}
}
const r=await q('MATCH (a)-[r]->(b) RETURN labels(a)[0] AS fromLabel,properties(a) AS a,type(r) AS type,labels(b)[0] AS toLabel,properties(b) AS b');
assert.equal(r.rows.length,graph.relationships.length,'relationship count');
for(const rel of graph.relationships)assert.ok(r.rows.some(([fl,a,type,tl,b])=>fl===rel.from.label&&tl===rel.to.label&&type===rel.type&&Object.entries(rel.from.key).every(([k,v])=>a[k]===v)&&Object.entries(rel.to.key).every(([k,v])=>b[k]===v)),'relationship '+rel.type);
const total=await q('MATCH (d:Donation) RETURN coalesce(sum(d.Amount),0) AS total');
assert.ok(Math.abs(total.rows[0][0]-graph.expected.donationTotal)<0.001,'donation total');
for(const p of presets){await q(p.cypher,p.parameters);console.log('PASS preset '+p.id);}
console.log(`Verified ${actualNodes.length} nodes, ${r.rows.length} relationships, all properties, donation totals, and ${presets.length} presets.`);
