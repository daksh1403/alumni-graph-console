export const entities={DEPARTMENT:['Department',['DeptID']],BATCH:['Batch',['BatchID']],COMPANY:['Company',['CompanyID']],SKILL:['Skill',['SkillID']],ALUMNI:['Alumni',['AlumniID']],STUDENT:['Student',['StudentID']],EVENT:['Event',['EventID']],DONATION:['Donation',['DonationID']],JOB:['Job',['JobID']],MENTORSHIP:['Mentorship',['AlumniID','MentorshipID']]};
const extra=['ALUMNI_PHONE','STUDENT_EMAIL','ALUMNI_SKILL','ALUMNI_EVENT'];
export function buildGraph(tables) {
 const nodes=[],relationships=[],byLabel=new Map();
 for(const table of [...Object.keys(entities),...extra]) if(!Array.isArray(tables[table]))throw new Error(`Missing table ${table} in export.`);
 for(const [table,[label,keys]] of Object.entries(entities)) {
  const indexed=new Map();byLabel.set(label,indexed);
  for(const row of tables[table]) {
   const key=Object.fromEntries(keys.map(k=>{if(row[k]===null||row[k]===undefined)throw new Error(`Missing ${table}.${k}`);return [k,row[k]];}));
   const id=JSON.stringify(key);if(indexed.has(id))throw new Error(`Duplicate ${table} identity.`);
   const properties=Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null));
   if(label==='Alumni'&&(!properties.FirstName||!properties.Email))throw new Error('Alumni requires FirstName and Email.');
   if(label==='Donation'&&row.Amount!==null&&(!Number.isFinite(row.Amount)||row.Amount<=0))throw new Error('Invalid Donation.Amount');
   if(label==='Student'&&row.CGPA!=null&&(row.CGPA<0||row.CGPA>10))throw new Error('Invalid Student.CGPA');
   if(label==='Student'&&row.CurrentSemester!=null&&(row.CurrentSemester<1||row.CurrentSemester>12))throw new Error('Invalid Student.CurrentSemester');
   if(label==='Alumni'&&row.IsActive!=null&&![0,1].includes(row.IsActive))throw new Error('Invalid Alumni.IsActive');
   if(label==='Batch'&&row.BatchYear!=null&&(row.BatchYear<1990||row.BatchYear>2100))throw new Error('Invalid Batch.BatchYear');
   if(label==='Batch'&&row.TotalStudent!=null&&row.TotalStudent<0)throw new Error('Invalid Batch.TotalStudent');
   if(label==='Mentorship'&&row.Status!=null&&!['Active','Completed','Terminated'].includes(row.Status))throw new Error('Invalid Mentorship.Status');
   const n={label,key,properties};nodes.push(n);indexed.set(id,n);
  }
 }
 function find(label,key){const n=byLabel.get(label)?.get(JSON.stringify(key));if(!n)throw new Error(`Missing referenced ${label} record.`);return n;}
 function link(from,type,label,key){const to=find(label,key);relationships.push({from:{label:from.label,key:from.key},type,to:{label:to.label,key:to.key}});}
 const refs={Alumni:[['DeptID','IN_DEPARTMENT','Department'],['BatchID','IN_BATCH','Batch'],['CompanyID','WORKS_AT','Company']],Student:[['DeptID','IN_DEPARTMENT','Department'],['BatchID','IN_BATCH','Batch']],Batch:[['DeptID','PART_OF','Department']],Event:[['OrganizerID','ORGANIZED_BY','Alumni','AlumniID']],Donation:[['DonorID','DONATED_BY','Alumni','AlumniID']],Job:[['CompanyID','AT_COMPANY','Company'],['PostedBy','POSTED_BY','Alumni','AlumniID']],Mentorship:[['AlumniID','PROVIDED_BY','Alumni'],['StudentID','FOR_STUDENT','Student']]};
 for(const node of nodes)for(const [field,type,target,idField] of refs[node.label]||[])if(node.properties[field]!=null){
  const key={[idField||field]:node.properties[field]};
  if(['ORGANIZED_BY','DONATED_BY','POSTED_BY','PROVIDED_BY'].includes(type)) {const parent=find(target,key);link(parent,{ORGANIZED_BY:'ORGANIZES',DONATED_BY:'MADE',POSTED_BY:'POSTED',PROVIDED_BY:'PROVIDES'}[type],node.label,node.key);}
  else link(node,type,target,key);
 }
 for(const [table,owner,idField,valueField,prop] of [['ALUMNI_PHONE','Alumni','AlumniID','PhoneNumber','PhoneNumbers'],['STUDENT_EMAIL','Student','StudentID','Email','Emails']]) {
  for(const n of byLabel.get(owner).values())n.properties[prop]=[];
  const seen=new Set();for(const row of tables[table]) {const id=JSON.stringify([row[idField],row[valueField]]);if(seen.has(id))throw new Error(`Duplicate ${table} identity.`);seen.add(id);if(typeof row[valueField]!=='string'||!row[valueField])throw new Error(`Invalid ${table}.${valueField}`);find(owner,{[idField]:row[idField]}).properties[prop].push(row[valueField]);}
  for(const n of byLabel.get(owner).values())n.properties[prop].sort();
 }
 for(const [table,type,label,idField] of [['ALUMNI_SKILL','HAS_SKILL','Skill','SkillID'],['ALUMNI_EVENT','ATTENDED','Event','EventID']]) {
  const seen=new Set();for(const row of tables[table]){const id=JSON.stringify([row.AlumniID,row[idField]]);if(seen.has(id))throw new Error(`Duplicate ${table} identity.`);seen.add(id);link(find('Alumni',{AlumniID:row.AlumniID}),type,label,{[idField]:row[idField]});}
 }
 for(const [label,field] of [['Alumni','Email'],['Department','DeptName'],['Department','DeptCode'],['Company','CompanyName'],['Skill','SkillName']]) {
  const seen=new Set();for(const n of byLabel.get(label).values()){const value=n.properties[field];if(value==null)continue;if(seen.has(value))throw new Error(`Duplicate ${label}.${field}`);seen.add(value);}
 }
 return {nodes,relationships,expected:{nodes:nodes.length,relationships:relationships.length,labels:Object.fromEntries(Object.entries(entities).map(([table,[label]])=>[label,tables[table].length])),sourceCounts:Object.fromEntries([...Object.keys(entities),...extra].map(k=>[k,tables[k].length])),donationTotal:tables.DONATION.reduce((sum,row)=>sum+(row.Amount||0),0)}};
}

export function cypherLiteral(value) {
 if(value===null)return 'null';
 if(Array.isArray(value))return '['+value.map(cypherLiteral).join(',')+']';
 if(typeof value==='object')return '{'+Object.entries(value).map(([k,v])=>'`'+k.replaceAll('`','``')+'`: '+cypherLiteral(v)).join(',')+'}';
 return JSON.stringify(value);
}

export function importStatements(graph) {
 const statements=[];
 for(const [, [label,keys]] of Object.entries(entities)) {
  const rows=graph.nodes.filter(n=>n.label===label);if(!rows.length)continue;
  const match=keys.map(k=>`${k}:row.key.${k}`).join(',');
  statements.push(`UNWIND ${cypherLiteral(rows)} AS row MERGE (n:${label} {${match}}) SET n = row.properties`);
 }
 const grouped=new Map();for(const rel of graph.relationships){const type=[rel.from.label,rel.type,rel.to.label].join(':');if(!grouped.has(type))grouped.set(type,[]);grouped.get(type).push(rel);}
 for(const rows of grouped.values()) {
  const r=rows[0],fromKeys=Object.keys(r.from.key).map(k=>`${k}:row.from.key.${k}`).join(','),toKeys=Object.keys(r.to.key).map(k=>`${k}:row.to.key.${k}`).join(',');
  statements.push(`UNWIND ${cypherLiteral(rows)} AS row MATCH (a:${r.from.label} {${fromKeys}}),(b:${r.to.label} {${toKeys}}) MERGE (a)-[:${r.type}]->(b)`);
 }
 return statements;
}

export function constraintStatements() {
 const statements=Object.values(entities).map(([label,keys])=>`CREATE CONSTRAINT ${label.toLowerCase()}_identity IF NOT EXISTS FOR (n:${label}) REQUIRE (${keys.map(k=>'n.'+k).join(',')}) IS UNIQUE`);
 for(const [label,field] of [['Alumni','Email'],['Department','DeptName'],['Department','DeptCode'],['Company','CompanyName'],['Skill','SkillName']])statements.push(`CREATE CONSTRAINT ${label.toLowerCase()}_${field.toLowerCase()} IF NOT EXISTS FOR (n:${label}) REQUIRE n.${field} IS UNIQUE`);
 return statements;
}
