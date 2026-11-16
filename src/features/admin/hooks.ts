'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/data';
import type { Actor, RetentionRunResult } from '@/data/ports';
import type { ConsentRecordInput, ModerationInput, RetentionSettingsInput } from '@/domain/admin';
import type { VerifyClaimInput } from '@/domain/claims';
import type { FarmProfileInput } from '@/domain/farmer';
import type { ClaimId, FarmerProfileId } from '@/domain/types';
import { useActor } from '@/features/auth';

/**
 * Everything here is an administrator's. The actor goes with every call and the
 * gateway checks it again. A saved change refreshes the administrator's own
 * queries and the public ones, so what is listed or hidden here is what buyers see.
 */
const ADMIN = ['admin'] as const;

function useAdminActor(): Actor | null {
  const actor = useActor();
  return actor && actor.role === 'administrator' ? actor : null;
}

const scope = (actor: Actor | null) => [...ADMIN, actor?.userId ?? 'none'] as const;

/** The moment the screen was opened, from the app's clock. Stable between renders. */
export function useNow(): Date {
  const [now] = useState(() => services.clock.now());
  return now;
}

export function useAdminFarms() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'farms'], queryFn: () => services.gateway.listFarmsForAdmin(actor!), enabled: actor !== null });
}
export function useAdminFarm(farmId: FarmerProfileId | null) {
  const actor = useAdminActor();
  return useQuery({
    queryKey: [...scope(actor), 'farm', farmId],
    queryFn: () => services.gateway.getFarmForAdmin(actor!, farmId!),
    enabled: actor !== null && farmId !== null,
    retry: false,
  });
}
export function useAdminInquiries() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'inquiries'], queryFn: () => services.gateway.listInquiriesForActor(actor!), enabled: actor !== null });
}
export function useAdminClaims() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'claims'], queryFn: () => services.gateway.listClaimsForAdmin(actor!), enabled: actor !== null });
}
export function useModerationItems() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'moderation'], queryFn: () => services.gateway.listModerationItems(actor!), enabled: actor !== null });
}
export function usePilotMetrics() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'metrics'], queryFn: () => services.gateway.getPilotMetrics(actor!), enabled: actor !== null });
}
export function useNoResultSearches() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'no-results'], queryFn: () => services.gateway.listNoResultSearches(actor!), enabled: actor !== null });
}
export function useRetentionView() {
  const actor = useAdminActor();
  return useQuery({ queryKey: [...scope(actor), 'retention'], queryFn: () => services.gateway.getRetentionView(actor!), enabled: actor !== null });
}
export const useSettings = () => useQuery({ queryKey: ['public', 'settings'], queryFn: () => services.gateway.getSettings() });

function useWrite<TInput, TResult>(run: (actor: Actor, input: TInput) => Promise<TResult>) {
  const actor = useAdminActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      if (!actor) throw new Error('Not signed in as an administrator.');
      return run(actor, input);
    },
    // Only after the write has returned: refresh what administrators, farmers and buyers read.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN }),
        queryClient.invalidateQueries({ queryKey: ['own'] }),
        queryClient.invalidateQueries({ queryKey: ['public'] }),
      ]),
  });
}

const g = () => services.gateway;
export const useCreateFarm = () => useWrite((a, input: FarmProfileInput) => g().createFarmForFarmer(a, input));
export const useUpdateFarm = () =>
  useWrite((a, input: { farmId: FarmerProfileId; values: FarmProfileInput }) => g().updateFarmAsAdmin(a, input.farmId, input.values));
export const useRecordConsent = () =>
  useWrite((a, input: { farmId: FarmerProfileId; record: ConsentRecordInput }) => g().recordFarmConsent(a, input.farmId, input.record));
export const useRecordReview = () =>
  useWrite((a, input: { farmId: FarmerProfileId; record: ConsentRecordInput }) => g().recordFarmReview(a, input.farmId, input.record));
export const useApproveFarm = () => useWrite((a, farmId: FarmerProfileId) => g().approveFarmRegistration(a, farmId));
export const useDeclineFarm = () => useWrite((a, farmId: FarmerProfileId) => g().declineFarmRegistration(a, farmId));
export const useVerifyClaim = () =>
  useWrite((a, input: { claimId: ClaimId; values: VerifyClaimInput }) => g().verifyClaim(a, input.claimId, input.values));
export const useRemoveVerification = () => useWrite((a, claimId: ClaimId) => g().removeClaimVerification(a, claimId));
export const useSetModeration = () => useWrite((a, input: ModerationInput) => g().setModeration(a, input));
export const useUpdateRetention = () => useWrite((a, input: RetentionSettingsInput) => g().updateRetentionSettings(a, input));
export const useRunRetention = () => useWrite<void, RetentionRunResult>((a) => g().runRetention(a));
