/** Local review only: never writes a runtime artifact or promotes source evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { inspectWeeklyCandidate } from '../server/modules/externalModels/weeklyBoxscore/weeklyBoxscore';
const [path, sha, season, week, output] = process.argv.slice(2);
if (!path || !sha || !season || !week || !output) throw new Error('Usage: tsx scripts/inspectWeeklyBoxscoreCandidate.ts INPUT SHA256 SEASON WEEK OUTPUT');
const result=inspectWeeklyCandidate(readFileSync(path),sha,Number(season),Number(week));
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,players:result.players.length,coverage:result.coverage}));
