import {queryNeo4j, databaseConfigured, GraphError} from './neo4j.js';
import {presets, presetParameters} from './presets.js';

function json(body,status=200) {
 return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
async function admin(request,env) {
 const supplied=request.headers.get('Authorization') || '';
 if(!env.GRAPH_ADMIN_TOKEN || !supplied.startsWith('Bearer ')) return false;
 const digest=value=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 const a=new Uint8Array(await digest(supplied.slice(7))), b=new Uint8Array(await digest(env.GRAPH_ADMIN_TOKEN));
 let diff=0; for(let i=0;i<a.length;i++) diff|=a[i]^b[i]; return diff===0;
}
async function body(request) {
 if(Number(request.headers.get('Content-Length'))>65536) throw new GraphError('Request exceeds 64 KiB.',413,'BODY_TOO_LARGE');
 const reader=request.body?.getReader(); if(!reader) throw new GraphError('Expected a JSON request body.',400);
 const chunks=[]; let size=0;
 for(;;) {const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>65536){await reader.cancel();throw new GraphError('Request exceeds 64 KiB.',413,'BODY_TOO_LARGE');} chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try {const parsed=JSON.parse(new TextDecoder().decode(bytes));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;} catch {throw new GraphError('Expected a JSON object.',400,'INVALID_JSON');}
}
const statsQuery=`CALL () { MATCH (n) RETURN count(n) AS nodes }
CALL () { MATCH ()-[r]->() RETURN count(r) AS relationships }
CALL () { MATCH (a:Alumni) RETURN count(a) AS alumni }
CALL () { MATCH (s:Student) RETURN count(s) AS students }
CALL () { MATCH (e:Event) RETURN count(e) AS events }
CALL () { MATCH (d:Donation) RETURN count(d) AS donations, coalesce(sum(d.Amount),0) AS donationTotal }
RETURN nodes,relationships,alumni,students,events,donations,donationTotal`;

export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname;
  try {
   if(!path.startsWith('/api/')) {
    if(env.ASSETS) {
     const asset=await env.ASSETS.fetch(request);
     const headers=new Headers(asset.headers);
     headers.set('X-Content-Type-Options','nosniff');
     headers.set('Referrer-Policy','same-origin');
     headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
     return new Response(asset.body,{status:asset.status,headers});
    }
    return path==='/' ? json({name:'Alumni Graph Console API',engine:'Neo4j',catalogue:'/api/presets',health:'/api/health'}) : json({error:'Not found'},404);
   }
   if(path==='/api/query') {
    if(request.method!=='POST') return json({error:'Use POST'},405);
    const input=await body(request);
    let cypher,parameters;
    if(input.preset) {
     const preset=presets.find(p=>p.id===input.preset);if(!preset)return json({error:'Unknown preset'},400);
     try {parameters=presetParameters(preset,input.parameters);}catch(error){return json({error:error.message},400);}
     cypher=preset.cypher;
    } else {
     if(!await admin(request,env))return json({error:'Custom Cypher requires an admin bearer token.',code:'ADMIN_REQUIRED'},401);
     if(typeof input.cypher!=='string'||!input.cypher.trim())return json({error:'Provide a Cypher statement.'},400);
     if(input.parameters!==undefined&&(!input.parameters||typeof input.parameters!=='object'||Array.isArray(input.parameters)))return json({error:'Parameters must be a JSON object.'},400);
     cypher=input.cypher.trim();parameters=input.parameters||{};
    }
    return json(await queryNeo4j(env,cypher,parameters,{readOnly:Boolean(input.preset)}));
   }
   if(request.method!=='GET')return json({error:'Use GET'},405);
   if(path==='/api/presets')return json({presets});
   if(path==='/api/health') {
    if(!databaseConfigured(env))return json({ok:false,configured:false,engine:'Neo4j',error:'Neo4j is not configured. Connect an Aura instance to enable live queries.'},503);
    await queryNeo4j(env,'RETURN 1 AS connected',{}, {readOnly:true});
    return json({ok:true,configured:true,engine:'Neo4j',database:env.NEO4J_DATABASE||'neo4j'});
   }
   if(path==='/api/stats') {
    const result=await queryNeo4j(env,statsQuery,{}, {readOnly:true});
    return json({ok:true,engine:'Neo4j',stats:Object.fromEntries(result.columns.map((key,i)=>[key,result.rows[0][i]]))});
   }
   if(path==='/api/schema') {
    const labels=await queryNeo4j(env,'CALL db.labels() YIELD label RETURN label ORDER BY label',{}, {readOnly:true});
    const types=await queryNeo4j(env,'CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType',{}, {readOnly:true});
    const properties=await queryNeo4j(env,'CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey ORDER BY propertyKey',{}, {readOnly:true});
    return json({labels:labels.rows.flat(),relationshipTypes:types.rows.flat(),propertyKeys:properties.rows.flat()});
   }
   return json({error:'Not found'},404);
  }catch(error) {
   if(error instanceof GraphError)return json({ok:false,error:error.message,code:error.code},error.status);
   return json({ok:false,error:'The request could not be processed.',code:'INTERNAL_ERROR'},500);
  }
 }
};
