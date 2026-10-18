import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/neo4j.js').catch(() => ({}));
const env = { NEO4J_HTTP_URL: 'https://example.databases.neo4j.io', NEO4J_USERNAME: 'neo4j', NEO4J_PASSWORD: 'test-password', NEO4J_DATABASE: 'neo4j' };
test('forwards parameters and server credentials without putting them in results', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  let request;
  const result = await module.queryNeo4j(env, 'RETURN $name AS name', {name: 'Ada'}, {fetch: async (url, options) => {
    request = {url, options};
    return Response.json({data: {fields:['name'], values:[['Ada']]}}, {status:202});
  }});
  assert.equal(request.url, 'https://example.databases.neo4j.io/db/neo4j/query/v2');
  assert.deepEqual(JSON.parse(request.options.body).parameters, {name:'Ada'});
  assert.match(request.options.headers.Authorization, /^Basic /);
  assert.equal(request.options.redirect, 'manual', 'Workers supports manual redirect handling');
  assert.deepEqual(result.rows, [['Ada']]);
  assert.ok(!JSON.stringify(result).includes('test-password'));
});
test('Neo4j errors in an HTTP 202 response fail the query', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  await assert.rejects(module.queryNeo4j(env, 'BAD', {}, {fetch:async()=>Response.json({errors:[{code:'Neo.ClientError.Statement.SyntaxError', message:'Invalid input'}]}, {status:202})}), /Invalid input/);
});
test('Neo4j errors returned with HTTP 400 retain their Cypher message',async()=>{
  await assert.rejects(module.queryNeo4j(env,'CREATE',{}, {fetch:async()=>Response.json({errors:[{code:'Neo.ClientError.Schema.ConstraintValidationFailed',message:'Duplicate identity'}]},{status:400})}),error=>error.status===400&&error.message==='Duplicate identity');
});
test('extracts deduplicated graph entities from nested results', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  const node = {elementId:'1', labels:['Alumni'], properties:{FirstName:'Ada'}};
  const edge = {elementId:'3', type:'HAS_SKILL', startNodeElementId:'1', endNodeElementId:'2', properties:{}};
  const r = await module.queryNeo4j(env, 'RETURN p', {}, {fetch:async()=>Response.json({data:{fields:['p'],values:[[[node,edge,node]]]}})});
  assert.equal(r.graph.nodes.length, 1);
  assert.equal(r.graph.relationships.length, 1);
});
test('missing configuration produces a clear error before fetching', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  await assert.rejects(module.queryNeo4j({}, 'RETURN 1'), /not configured/i);
});
test('rejects nonlocal plain HTTP and database credentials embedded in URLs', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  await assert.rejects(module.queryNeo4j({...env,NEO4J_HTTP_URL:'http://remote.example'}, 'RETURN 1'), /HTTPS/);
  await assert.rejects(module.queryNeo4j({...env,NEO4J_HTTP_URL:'https://user:pass@remote.example'}, 'RETURN 1'), /URL/);
});
test('bounds returned rows and reports truncation', async () => {
  assert.equal(typeof module.queryNeo4j, 'function');
  const r=await module.queryNeo4j(env,'RETURN 1',{}, {maxRows:2, fetch:async()=>Response.json({data:{fields:['n'],values:[[1],[2],[3]]}})});
  assert.equal(r.rows.length,2); assert.equal(r.truncated,true);
});
test('rejects redirects without following them to another server', async()=>{
  await assert.rejects(module.queryNeo4j(env,'RETURN 1',{}, {fetch:async(url,options)=>{
    assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://another.example'}});
  }}), /unsuccessful response/);
});
