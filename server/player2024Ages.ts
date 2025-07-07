// Accurate 2024 Player Ages
// Updated for the 2024 NFL season based on birth years

export const PLAYER_2024_AGES: Record<string, number> = {
  // QBs - Known 2024 ages
  "Josh Allen": 28,           // Born Jan 21, 1996
  "Lamar Jackson": 27,        // Born Jan 7, 1997  
  "Patrick Mahomes": 29,      // Born Sep 17, 1995
  "Joe Burrow": 28,           // Born Dec 10, 1996
  "Dak Prescott": 31,         // Born Jul 29, 1993
  "Jalen Hurts": 26,          // Born Aug 7, 1998
  "Justin Herbert": 26,       // Born Mar 10, 1998
  "Tua Tagovailoa": 26,       // Born Mar 2, 1998
  "Kyler Murray": 27,         // Born Aug 7, 1997
  "Russell Wilson": 36,       // Born Nov 29, 1988
  "Aaron Rodgers": 41,        // Born Dec 2, 1983
  "C.J. Stroud": 23,          // Born Oct 3, 2001
  "Jayden Daniels": 24,       // Born Dec 18, 2000
  "Caleb Williams": 23,       // Born Nov 18, 2001
  "Anthony Richardson": 22,   // Born May 22, 2002
  "Bryce Young": 23,          // Born Jul 25, 2001
  "Trevor Lawrence": 25,      // Born Oct 6, 1999
  "Brock Purdy": 25,          // Born Dec 27, 1999
  
  // RBs - Known 2024 ages  
  "Christian McCaffrey": 28,  // Born Jun 7, 1996
  "Austin Ekeler": 29,        // Born May 17, 1995
  "Saquon Barkley": 27,       // Born Feb 9, 1997
  "Derrick Henry": 31,        // Born Jan 4, 1994
  "Jonathan Taylor": 25,      // Born Jan 19, 1999
  "Alvin Kamara": 29,         // Born Jul 25, 1995
  "Dalvin Cook": 29,          // Born Aug 10, 1995
  "Nick Chubb": 28,           // Born Dec 27, 1995
  "Joe Mixon": 28,            // Born Jul 24, 1996
  "Aaron Jones": 30,          // Born Dec 2, 1994
  "Josh Jacobs": 26,          // Born Feb 11, 1998
  "Bijan Robinson": 22,       // Born Jan 25, 2002
  "Jahmyr Gibbs": 22,         // Born Mar 20, 2002
  "Breece Hall": 23,          // Born May 20, 2001
  "Kenneth Walker III": 24,   // Born Oct 20, 2000
  "Tony Pollard": 27,         // Born Apr 30, 1997
  
  // WRs - Known 2024 ages
  "Tyreek Hill": 30,          // Born Mar 1, 1994
  "Davante Adams": 32,        // Born Dec 24, 1992
  "DeAndre Hopkins": 32,      // Born Jun 6, 1992
  "Stefon Diggs": 31,         // Born Nov 29, 1993
  "Keenan Allen": 32,         // Born Apr 27, 1992
  "Mike Evans": 31,           // Born Aug 21, 1993
  "Chris Godwin": 28,         // Born Feb 27, 1996
  "DK Metcalf": 27,           // Born Dec 14, 1997
  "Terry McLaurin": 29,       // Born Sep 15, 1995
  "CeeDee Lamb": 25,          // Born Apr 8, 1999
  "Justin Jefferson": 25,     // Born Jun 16, 1999
  "Ja'Marr Chase": 24,        // Born Mar 1, 2000
  "AJ Brown": 27,             // Born Jun 30, 1997
  "Cooper Kupp": 31,          // Born Jun 15, 1993
  "Amon-Ra St. Brown": 25,    // Born Oct 24, 1999
  "Puka Nacua": 23,           // Born May 29, 2001
  "Garrett Wilson": 24,       // Born Jul 22, 2000
  "Drake London": 23,         // Born Jul 24, 2001
  "Chris Olave": 24,          // Born Jun 27, 2000
  "Jaylen Waddle": 26,        // Born Nov 25, 1998
  
  // 2024 Breakout Rookies
  "Brian Thomas Jr.": 22,     // Born Dec 9, 2002 - LSU rookie
  "Ladd McConkey": 23,        // Born Jan 5, 2001 - Georgia rookie
  "Rome Odunze": 22,          // Born Jun 3, 2002 - Washington rookie
  "Marvin Harrison Jr.": 22,  // Born Aug 19, 2002 - Ohio State rookie
  "Malik Nabers": 22,         // Born Dec 26, 2002 - LSU rookie
  
  // TEs - Known 2024 ages
  "Travis Kelce": 35,         // Born Oct 5, 1989
  "Mark Andrews": 29,         // Born Sep 6, 1995
  "George Kittle": 31,        // Born Oct 9, 1993
  "Darren Waller": 32,        // Born Sep 13, 1992
  "Kyle Pitts": 24,           // Born Oct 6, 2000
  "T.J. Hockenson": 27,       // Born Jul 3, 1997
  "Dallas Goedert": 29,       // Born Jan 3, 1995
  "Sam LaPorta": 23,          // Born Aug 7, 2001
  "Brock Bowers": 22,         // Born Dec 12, 2002
  "Trey McBride": 25,         // Born Nov 13, 1999
  "Evan Engram": 30,          // Born Sep 2, 1994
};

/**
 * Get accurate 2024 age for a player
 */
export function get2024Age(playerName: string): number | null {
  return PLAYER_2024_AGES[playerName] || null;
}

/**
 * Update player with accurate 2024 age
 */
export function updatePlayerWith2024Age(player: any): any {
  const accurate2024Age = get2024Age(player.name);
  if (accurate2024Age) {
    return {
      ...player,
      age: accurate2024Age
    };
  }
  return player;
}