/**
 * releaseExpiredHolds.js
 * Background job to automatically release expired holds.
 * Runs periodically (default every 2 minutes).
 *
 * Logic:
 * - Find slots where status='held' AND held_expires_at < now()
 * - For each, set slot.status='available', slot.held_expires_at=NULL
 * - Set related bookings (status='held') to 'cancelled' with reason='expired'
 * - Perform updates in a transaction to avoid race conditions
 */

function startReleaseExpiredHoldsJob(ctx, intervalMs = 2 * 60 * 1000) {
  const { knex } = ctx;

  async function tick() {
    const start = Date.now();
    try {
      const releasedCount = await knex.transaction(async (trx) => {
        // Fetch expired held slots
        const expiredSlots = await trx('slots')
          .where({ status: 'held' })
          .where('held_expires_at', '<', trx.fn.now())
          .select('id');

        if (expiredSlots.length === 0) return 0;

        const slotIds = expiredSlots.map(s => s.id);

        // Cancel related held bookings
        await trx('bookings')
          .whereIn('slot_id', slotIds)
          .andWhere('status', 'held')
          .update({ status: 'cancelled', cancellation_reason: 'expired', updated_at: trx.fn.now() });

        // Free slots back to available
        await trx('slots')
          .whereIn('id', slotIds)
          .update({ status: 'available', held_expires_at: null, updated_at: trx.fn.now() });

        return slotIds.length;
      });

      if (releasedCount > 0) {
        console.log(`[releaseExpiredHolds] Released ${releasedCount} expired holds in ${Date.now() - start}ms`);
      }
    } catch (err) {
      console.error('[releaseExpiredHolds] error:', err);
    }
  }

  // Kick off interval
  const handle = setInterval(tick, intervalMs);
  // Optionally run once at startup after short delay
  setTimeout(tick, 5 * 1000);

  // Expose a stop method via ctx if needed
  ctx.releaseExpiredHoldsHandle = handle;

  console.log(`[releaseExpiredHolds] Job started, interval ${intervalMs / 1000}s`);
}

module.exports = { startReleaseExpiredHoldsJob };
