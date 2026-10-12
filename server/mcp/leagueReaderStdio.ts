import './stdioSafety';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildLeagueReaderServer } from './leagueReaderServer';
import { publicReaders } from '../modules/leagueMcp/tools';
const server = buildLeagueReaderServer(process.env.TIBER_LEAGUE_SOURCE === 'public-sleeper' ? publicReaders : null);
server.connect(new StdioServerTransport()).catch(() => { process.stderr.write('League reader connection unavailable.\n'); process.exitCode = 1; });
