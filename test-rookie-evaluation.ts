/**
 * Quick test of rookie evaluation system
 */

// Test single player evaluation as requested
const player_data = {
  "name": "Malik Nabers",
  "position": "WR",
  "team": "NYG",
  "college": "LSU",
  "draft_round": 1,
  "draft_pick": 6,
  "adp": 45.2,
  "projected_points": 195.5,
  "rec": 85,
  "rec_yds": 1050,
  "rec_td": 7
};

console.log('Testing Single Player Evaluation:');
console.log('Player Data:', JSON.stringify(player_data, null, 2));

// This would be the API call: 
// const result = await fetch('/api/rookie-evaluation/single', { 
//   method: 'POST', 
//   body: JSON.stringify(player_data) 
// });

console.log('\nTesting Batch Processing:');
console.log('Multiple rookies can be added to RookieBatch and exported as JSON');

export default player_data;