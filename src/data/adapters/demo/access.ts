import type { Database, FarmerProfile } from '@/domain/types';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';

/**
 * The farm an actor may act on: their own, and only if they are a farmer whose
 * account owns it. Every privileged farmer method starts here, on the latest state.
 */
export function requireOwnFarm(db: Database, actor: Actor): FarmerProfile {
  if (actor.role !== 'farmer' || actor.farmerProfileId === null) {
    throw new GatewayError('forbidden', 'Only a farmer can do this.');
  }
  const farm = db.farmer_profiles.find((f) => f.id === actor.farmerProfileId);
  if (!farm || farm.userId !== actor.userId) throw new GatewayError('forbidden', 'That is not your farm.');
  return farm;
}

/** The invalid-input error, with the codes the form turns into words. */
export function invalid(message: string, fields: Record<string, string>): GatewayError {
  return new GatewayError('invalid', message, { fields });
}

/**
 * The administrator behind an actor: the role the caller claims must also be on
 * record for that user. Every privileged administrator method starts here, on the
 * latest state, so a farmer or buyer cannot reach private data by naming a role.
 */
export function requireAdmin(db: Database, actor: Actor): void {
  const recorded = db.user_roles.some((r) => r.userId === actor.userId && r.role === 'administrator');
  if (actor.role !== 'administrator' || !recorded) {
    throw new GatewayError('forbidden', 'Only an administrator can do this.');
  }
}
