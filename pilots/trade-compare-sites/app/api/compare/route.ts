import { comparisonGet } from '../../../lib/railway-read.ts';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return comparisonGet(request); }
