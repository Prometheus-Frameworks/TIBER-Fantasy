/** A selection change invalidates both late source reads and clipboard feedback. */
export function revisionGuard() {
  let revision = 0;
  return {
    invalidate() { revision++; },
    begin() { return ++revision; },
    isCurrent(token: number) { return token === revision; },
  };
}
