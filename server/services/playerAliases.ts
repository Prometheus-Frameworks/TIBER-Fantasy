/**
 * Player Alias/Nickname Detection System
 * Maps common shortened names and nicknames to full player names
 * for improved VORP detection and chat experience
 */

export const PLAYER_ALIASES: Record<string, string> = {
  // Running Backs
  'cmc': 'Christian McCaffrey',
  'cmac': 'Christian McCaffrey',
  'bijan': 'Bijan Robinson',
  'achane': 'De\'Von Achane',
  'breece': 'Breece Hall',
  'javonte': 'Javonte Williams',
  'kyren': 'Kyren Williams',
  'gibbs': 'Jahmyr Gibbs',
  'rachaad': 'Rachaad White',
  'stevenson': 'Rhamondre Stevenson',
  'najee': 'Najee Harris',
  
  // Wide Receivers
  'tet mcmillan': 'Tetairoa McMillan', // Match full name first (longer alias)
  'tet': 'Tetairoa McMillan', // Full name for reliable lookup
  'amonra': 'Amon-Ra St. Brown',
  'amon ra': 'Amon-Ra St. Brown',
  'amon-ra': 'Amon-Ra St. Brown',
  'sun god': 'Amon-Ra St. Brown',
  'jj': 'Justin Jefferson', // Common in dynasty, but 'jj mccarthy' will match first due to length sorting
  'dk': 'DK Metcalf',
  // 'aj': 'A.J. Brown', // REMOVED: Too ambiguous (AJ Dillon, AJ Brown, etc.)
  'jamarr': 'Ja\'Marr Chase',
  'ceedee': 'CeeDee Lamb',
  'tyreek': 'Tyreek Hill',
  'davante': 'Davante Adams',
  'deebo': 'Deebo Samuel',
  'dhop': 'DeAndre Hopkins',
  'nuk': 'DeAndre Hopkins',
  'mike evans': 'Mike Evans',
  'chris godwin': 'Chris Godwin',
  'tee': 'Tee Higgins',
  'nico': 'Nico Collins',
  'puka': 'Puka Nacua',
  'tank': 'Tank Dell',
  'jamo': 'Jameson Williams',
  'rome': 'Rome Odunze',
  'quentin': 'Quentin Johnston',
  'worthy': 'Xavier Worthy',
  'marv': 'Marvin Harrison Jr',
  'mhj': 'Marvin Harrison Jr',
  'jaxon': 'Jaxon Smith-Njigba',
  'jsn': 'Jaxon Smith-Njigba',
  'garrett': 'Garrett Wilson',
  'dj moore': 'DJ Moore',
  
  // Quarterbacks
  'mahomes': 'Patrick Mahomes',
  'patty': 'Patrick Mahomes',
  'lamar': 'Lamar Jackson',
  'josh allen': 'Josh Allen', // Use full name to avoid ambiguity with Josh Jacobs, Josh Downs, etc.
  'hurts': 'Jalen Hurts',
  'stroud': 'C.J. Stroud',
  'cj stroud': 'C.J. Stroud', // More specific than just 'cj'
  'dak': 'Dak Prescott',
  'tua': 'Tua Tagovailoa',
  'herbert': 'Justin Herbert',
  'burrow': 'Joe Burrow',
  'goff': 'Jared Goff',
  'baker': 'Baker Mayfield',
  'stafford': 'Matthew Stafford',
  'caleb': 'Caleb Williams',
  'jayden': 'Jayden Daniels',
  'bo nix': 'Bo Nix',
  'drake': 'Drake Maye',
  'jj mccarthy': 'J.J. McCarthy',
  // 'josh': 'Josh Allen', // REMOVED: Too ambiguous (Josh Jacobs, Josh Downs, etc.)
  
  // Tight Ends
  'kittle': 'George Kittle',
  'kelce': 'Travis Kelce',
  'laporta': 'Sam LaPorta',
  'trey': 'Trey McBride',
  'bowers': 'Brock Bowers',
  'pitts': 'Kyle Pitts',
  'andrews': 'Mark Andrews',
  'njoku': 'David Njoku',
  'kincaid': 'Dalton Kincaid',
  'hock': 'T.J. Hockenson',
  'hockenson': 'T.J. Hockenson',
};

/**
 * Expand player aliases/nicknames in user message to full names
 * This helps VORP detection recognize common shortened names
 * 
 * @param message User's raw message
 * @returns Message with aliases expanded to full player names
 */
export function expandPlayerAliases(message: string): string {
  let expandedMessage = message;
  
  // CRITICAL: Sort aliases by length (longest first) to prevent premature matches
  // Example: "jj mccarthy" must match before "jj" alone
  const sortedAliases = Object.entries(PLAYER_ALIASES).sort((a, b) => b[0].length - a[0].length);
  
  // Case-insensitive replacement using word boundaries
  sortedAliases.forEach(([alias, fullName]) => {
    // Use \b for word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi');
    expandedMessage = expandedMessage.replace(regex, fullName);
  });
  
  return expandedMessage;
}

/**
 * Escape special regex characters in alias strings
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
