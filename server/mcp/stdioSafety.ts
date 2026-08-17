/**
 * stdout protection for stdio-transport MCP servers.
 *
 * On stdio transport, stdout *is* the JSON-RPC channel. A single stray
 * `console.log` from anywhere in the imported graph corrupts the stream and
 * the client drops the connection — and this repo does log to stdout from
 * imported infrastructure (the database pool prints pool statistics on a timer
 * outside production).
 *
 * Importing this module first redirects console output to stderr, where the
 * MCP client shows it as server logs. Import it before anything that touches
 * application code; ES module evaluation order makes "first import wins" a
 * real guarantee.
 */

const stderrWrite = (chunk: string) => {
  process.stderr.write(chunk);
};

function toLine(args: unknown[]): string {
  return `${args
    .map((arg) => (typeof arg === 'string' ? arg : safeInspect(arg)))
    .join(' ')}\n`;
}

function safeInspect(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

console.log = (...args: unknown[]) => stderrWrite(toLine(args));
console.info = (...args: unknown[]) => stderrWrite(toLine(args));
console.debug = (...args: unknown[]) => stderrWrite(toLine(args));

export {};
