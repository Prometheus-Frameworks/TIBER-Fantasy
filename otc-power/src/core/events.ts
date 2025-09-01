import { db } from '../infra/db.js';

export type OtcEvent = {
  event_type: 'INJURY'|'DEPTH_CHART'|'QB_CHANGE'|'TRANSACTION';
  scope: { player_id?: string; team?: string; position?: string };
};

export async function enqueueEvent(e: OtcEvent) {
  await db.query(`insert into events_queue (event_type, scope) values ($1,$2)`, [e.event_type, e.scope]);
}

export async function nextUnprocessedEvent() {
  const r = await db.query(`select * from events_queue where processed=false order by created_at asc limit 1`);
  return r.rows[0];
}

export async function markProcessed(id: number) {
  await db.query(`update events_queue set processed=true where id=$1`, [id]);
}