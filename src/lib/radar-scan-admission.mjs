/**
 * Reserve before any network/provider work. Reservations are never released
 * on failure because a timed-out provider request may already have been billed.
 * @template T
 * @param {{
 *   reserve: () => Promise<{status: string, reservationId?: string}>,
 *   execute: () => Promise<T>,
 *   settle: (reservationId: string, status: "completed" | "failed") => Promise<unknown>
 * }} options
 * @returns {Promise<{admitted: false, status: string} | {admitted: true, value: T}>}
 */
export async function runReservedRadarScan({ reserve, execute, settle }) {
  const admission = await reserve();
  if (admission?.status !== "reserved" || !admission.reservationId) {
    return { admitted: false, status: admission?.status ?? "unavailable" };
  }

  try {
    const value = await execute();
    await settle(admission.reservationId, "completed");
    return { admitted: true, value };
  } catch (error) {
    try {
      await settle(admission.reservationId, "failed");
    } catch {
      // Leave the durable reservation charged if settlement itself is unavailable.
    }
    throw error;
  }
}
