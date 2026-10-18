import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../src/model.js').catch(()=>({}));
function fixture(){return {DEPARTMENT:[{DeptID:10,DeptName:'CSE'}],BATCH:[],COMPANY:[],SKILL:[{SkillID:1,SkillName:'Python'}],ALUMNI:[{AlumniID:1,FirstName:'Ada',Email:'ada@example.test',DeptID:10}],STUDENT:[],EVENT:[],DONATION:[{DonationID:1,DonorID:1,Amount:100},{DonationID:2,DonorID:1,Amount:150}],JOB:[],MENTORSHIP:[{AlumniID:1,MentorshipID:'M1',StudentID:null}],ALUMNI_PHONE:[{AlumniID:1,PhoneNumber:'0123456789'}],STUDENT_EMAIL:[],ALUMNI_SKILL:[{AlumniID:1,SkillID:1}],ALUMNI_EVENT:[]};}
test('graph conversion preserves donation identity, lists and nullable mentorships',()=>{
 assert.equal(typeof module.buildGraph,'function');const g=module.buildGraph(fixture());
 assert.equal(g.nodes.filter(n=>n.label==='Donation').length,2);
 assert.deepEqual(g.nodes.find(n=>n.label==='Alumni').properties.PhoneNumbers,['0123456789']);
 assert.equal(g.nodes.filter(n=>n.label==='Mentorship').length,1);
 assert.equal(g.relationships.filter(r=>r.type==='FOR_STUDENT').length,0);
 assert.equal(g.relationships.filter(r=>r.type==='HAS_SKILL').length,1);
 assert.equal(g.expected.donationTotal,250);
});
test('rejects dangling foreign keys before import',()=>{
 assert.equal(typeof module.buildGraph,'function'); const f=fixture(); f.ALUMNI_SKILL[0].SkillID=404;
 assert.throws(()=>module.buildGraph(f),/missing.*Skill/i);
});
test('rejects duplicate identities and invalid amounts',()=>{
 assert.equal(typeof module.buildGraph,'function');const f=fixture();f.ALUMNI.push({...f.ALUMNI[0]}); assert.throws(()=>module.buildGraph(f),/duplicate/i);
 const b=fixture();b.DONATION[0].Amount=-1;assert.throws(()=>module.buildGraph(b),/Amount/);
});
test('rejects incomplete exports rather than silently dropping tables',()=>{
 assert.equal(typeof module.buildGraph,'function');const f=fixture();delete f.ALUMNI_EVENT;assert.throws(()=>module.buildGraph(f),/ALUMNI_EVENT/);
});
