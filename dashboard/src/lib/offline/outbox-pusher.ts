/**
 * Push orchestration for the NPPOS offline outbox — the dedicated logic that
 * takes queued (pending/failed) entries and attempts a sync_push for each one,
 * updating local sync status on success/rejection/failure.
 *
 * Extracted from syncEngine so the engine owns only state/network lifecycle.
 */
import { pendingRepo, redemptionRepo } from "./repository";
import type { OfflinePending } from "./db";

export const MAX_RETRIES = 5;

/** The wire signature used by the push callback (compatible with sync_push). */
export type PushCall = (params: Record<string, any>) => Promise<any>;

/**
 * Attempt to push a single outbox entry via the provided push call.
 *
 * On `accepted` the pending + (if a redemption) redemption rows are marked
 * synced with the server doc name. On `rejected` or a thrown error both rows
 * are marked failed with the reason.
 *
 * @param entry - the outbox entry to push
 * @param push - the backend push call
 * @returns {Promise<void>} resolves once the local rows are updated
 */
export async function pushEntry(
  entry: OfflinePending,
  push: PushCall,
): Promise<void> {
  try {
    const res: any = await push({
      client_ref: entry.clientRef,
      payload: JSON.stringify(entry.payload),
    });
    const msg = res?.message ?? res ?? {};
    if (msg?.status === "accepted") {
      await pendingRepo.markSynced(entry.id, msg.server_name || "");
      if (entry.kind === "cash_payment" || entry.kind === "goods_issue") {
        await redemptionRepo.markSynced(entry.clientRef, msg.server_name || "");
      }
    } else if (msg?.status === "rejected") {
      const reason = msg.reason || "Rejected by server";
      await pendingRepo.markFailed(entry.id, reason);
      if (entry.kind === "cash_payment" || entry.kind === "goods_issue") {
        await redemptionRepo.markFailed(entry.clientRef, reason);
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Push failed";
    await pendingRepo.markFailed(entry.id, errMsg);
    if (entry.kind === "cash_payment" || entry.kind === "goods_issue") {
      await redemptionRepo.markFailed(entry.clientRef, errMsg);
    }
  }
}

/**
 * Push every eligible outbox entry (pending + failed, under the retry cap).
 *
 * @param push - the backend push call
 * @returns {Promise<number>} the number of entries processed
 */
export async function flushOutbox(push: PushCall): Promise<number> {
  const pending = await pendingRepo.getAll("pending");
  const failed = await pendingRepo.getAll("failed");
  const toSync = [...pending, ...failed].filter(
    (e) => e.retryCount < MAX_RETRIES,
  );
  for (const entry of toSync) {
    await pushEntry(entry, push);
  }
  return toSync.length;
}