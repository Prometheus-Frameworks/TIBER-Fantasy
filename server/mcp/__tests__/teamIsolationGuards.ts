/** Test-only preload: installed before dynamically loading any application graph. */
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

const forbidden = (): never => {
  // Exit even if application code catches the error: an attempted operation
  // must fail the child-process test, not merely turn into an unavailable result.
  process.stderr.write('TEAM_ISOLATION_VIOLATION\n');
  process.exit(97);
};
globalThis.fetch = forbidden;
net.Socket.prototype.connect = forbidden;
net.Server.prototype.listen = forbidden;
http.request = forbidden; https.request = forbidden;
http.get = forbidden; https.get = forbidden;
syncBuiltinESMExports();
