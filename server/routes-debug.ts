// DEBUG - Test exact Sleeper values
import { sleeperDynastyADPService } from './sleeperDynastyADP';

console.log('🔍 DEBUGGING SLEEPER ADP SERVICE');
const result = sleeperDynastyADPService.getSleeperDynastyADP();
console.log('Players count:', result.players.length);
console.log('First 3 players:');
result.players.slice(0, 3).forEach((p, i) => {
  console.log(`${i+1}. ${p.name} ${p.position} ADP: ${p.adp}`);
});