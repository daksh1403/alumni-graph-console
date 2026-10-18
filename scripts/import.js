import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {buildGraph,importStatements,constraintStatements} from '../src/model.js';

const input=process.argv.find(a=>a.endsWith('.json'))||'private/d1-data.json';
const graph=buildGraph(JSON.parse(readFileSync(input,'utf8')));
mkdirSync('private',{recursive:true});mkdirSync('cypher',{recursive:true});
writeFileSync('private/import.cypher',importStatements(graph).join(';\n')+';\n',{mode:0o600});
writeFileSync('private/expected.json',JSON.stringify(graph.expected,null,2),{mode:0o600});
writeFileSync('cypher/constraints.cypher',constraintStatements().join(';\n')+';\n');
console.log(JSON.stringify(graph.expected,null,2));
if(process.argv.includes('--generate-only'))process.exit(0);
if(!process.env.NEO4J_PASSWORD)throw new Error('Configure .dev.vars before importing.');
for(const [path,atomic] of [['cypher/constraints.cypher',false],['private/import.cypher',true]]) {
 const result=spawnSync('neo4j-cli',['query','--env','.dev.vars','--rw',...(atomic?['--atomic']:[]),'--format','json'],{input:readFileSync(path),encoding:'utf8',maxBuffer:16*1024*1024});
 if(result.status!==0){console.error(result.stderr||result.error?.message);process.exit(result.status||1);}
 console.log(`Applied ${path} with neo4j-cli.`);
}
