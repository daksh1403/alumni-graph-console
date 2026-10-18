export const presets = [
 {id:'network',title:'Explore the alumni network',category:'Graph',description:'People, skills, companies and events connected by relationships.',cypher:'MATCH (a:Alumni)-[r]-(n) RETURN a, r, n LIMIT 100',parameters:{}},
 {id:'alumni',title:'Browse alumni',category:'People',description:'Alumni profiles and current positions.',cypher:'MATCH (a:Alumni) RETURN a.AlumniID AS id, a.FirstName AS firstName, a.LastName AS lastName, a.CurrentPosition AS position ORDER BY id LIMIT 100',parameters:{}},
 {id:'companies',title:'Alumni and employers',category:'Careers',description:'Follow employment connections.',cypher:'MATCH (a:Alumni)-[r:WORKS_AT]->(c:Company) RETURN a,r,c LIMIT 100',parameters:{}},
 {id:'skills',title:'Who has this skill?',category:'Skills',description:'Find alumni with a chosen skill.',cypher:'MATCH (a:Alumni)-[r:HAS_SKILL]->(s:Skill) WHERE toLower(s.SkillName)=toLower($skill) RETURN a,r,s LIMIT 100',parameters:{skill:'Python'}},
 {id:'shared-skills',title:'Alumni with shared skills',category:'Skills',description:'Discover connections through a shared skill.',cypher:'MATCH (a:Alumni)-[r:HAS_SKILL]->(s:Skill)<-[t:HAS_SKILL]-(b:Alumni) WHERE a.AlumniID < b.AlumniID RETURN a,r,s,t,b LIMIT 100',parameters:{}},
 {id:'mentorships',title:'Mentors and students',category:'Mentorship',description:'Mentorships retain their dates, status, area and goals.',cypher:'MATCH (a:Alumni)-[r:PROVIDES]->(m:Mentorship)-[t:FOR_STUDENT]->(s:Student) RETURN a,r,m,t,s LIMIT 100',parameters:{}},
 {id:'mentor-discovery',title:'Find mentors in a department',category:'Mentorship',description:'Find alumni in the same department as a student.',cypher:'MATCH (s:Student {StudentID:$student})-[r:IN_DEPARTMENT]->(d:Department)<-[t:IN_DEPARTMENT]-(a:Alumni) RETURN s,r,d,t,a LIMIT 100',parameters:{student:'S1001'}},
 {id:'events',title:'Event attendance',category:'Events',description:'See which alumni attended each event.',cypher:'MATCH (a:Alumni)-[r:ATTENDED]->(e:Event) RETURN a,r,e LIMIT 100',parameters:{}},
 {id:'shared-events',title:'Connections through events',category:'Events',description:'Find alumni who attended the same event.',cypher:'MATCH (a:Alumni)-[r:ATTENDED]->(e:Event)<-[t:ATTENDED]-(b:Alumni) WHERE a.AlumniID < b.AlumniID RETURN a,r,e,t,b LIMIT 100',parameters:{}},
 {id:'donations',title:'Donations by alumnus',category:'Giving',description:'Aggregate contributions without losing individual donations.',cypher:'MATCH (a:Alumni)-[:MADE]->(d:Donation) RETURN a.FirstName AS firstName,a.LastName AS lastName,count(d) AS donations,sum(d.Amount) AS total ORDER BY total DESC LIMIT 100',parameters:{}},
 {id:'jobs',title:'Jobs and company connections',category:'Careers',description:'Connect job postings to their company and alumni poster.',cypher:'MATCH (a:Alumni)-[r:POSTED]->(j:Job)-[t:AT_COMPANY]->(c:Company) RETURN a,r,j,t,c LIMIT 100',parameters:{}},
 {id:'departments',title:'Department communities',category:'People',description:'Explore alumni and students grouped by department.',cypher:'MATCH (p)-[r:IN_DEPARTMENT]->(d:Department) WHERE p:Alumni OR p:Student RETURN p,r,d LIMIT 100',parameters:{}},
 {id:'batches',title:'Graduation batches',category:'People',description:'Explore alumni connections through their batch.',cypher:'MATCH (a:Alumni)-[r:IN_BATCH]->(b:Batch) RETURN a,r,b LIMIT 100',parameters:{}},
 {id:'paths',title:'Find a connection path',category:'Graph',description:'Find a shortest connection between two alumni, within six hops.',cypher:'MATCH (a:Alumni {AlumniID:$from}),(b:Alumni {AlumniID:$to}),p=shortestPath((a)-[*1..6]-(b)) RETURN p LIMIT 1',parameters:{from:1,to:2}},
 {id:'skill-popularity',title:'Most common skills',category:'Skills',description:'Count the alumni connected to each skill.',cypher:'MATCH (s:Skill) OPTIONAL MATCH (a:Alumni)-[:HAS_SKILL]->(s) RETURN s.SkillName AS skill,count(a) AS alumni ORDER BY alumni DESC,skill LIMIT 100',parameters:{}}
];

export function presetParameters(preset, input = {}) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Parameters must be a JSON object.');
 if (Object.keys(input).some(k=>!Object.hasOwn(preset.parameters,k))) throw new Error('Unknown preset parameter.');
 const values={...preset.parameters,...input};
 for(const [key,value] of Object.entries(values)) {
  if(typeof preset.parameters[key] === 'number' ? !Number.isSafeInteger(value) || value<1 : typeof value!=='string' || !value.trim() || value.length>200) throw new Error(`Invalid parameter: ${key}`);
 }
 return values;
}
