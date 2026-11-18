'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/data';
import type { Actor } from '@/data/ports';
import type {
  AvailabilityChange,
  FarmProfileInput,
  FarmerClaimsInput,
  ListingCreateInput,
  ListingUpdateInput,
  OwnFarm,
  PickupOptionsInput,
  PrivacyInput,
} from '@/domain/farmer';
import type { ReplyInput } from '@/domain/inquiry';
import type { InquiryFolder, InquiryId, OutcomeKind, ProductId } from '@/domain/types';
import { useActor } from '@/features/auth';

/**
 * Everything here is the signed-in farmer's own. The actor goes with every call;
 * the gateway checks it again. A saved change refreshes both the farmer's own
 * queries and the public ones, so a listing edited here is what buyers see.
 */
const OWN = ['own'] as const;

/** The moment the screen was opened, from the app's clock. Stable between renders. */
export function useNow(): Date {
  const [now] = useState(() => services.clock.now());
  return now;
}

function useFarmerActor(): Actor | null {
  const actor = useActor();
  return actor && actor.role === 'farmer' && actor.farmerProfileId ? actor : null;
}

const scope = (actor: Actor | null) => [...OWN, actor?.farmerProfileId ?? 'none'] as const;

export function useOwnFarm() {
  const actor = useFarmerActor();
  return useQuery({
    queryKey: [...scope(actor), 'farm'],
    queryFn: () => services.gateway.getOwnFarm(actor!),
    enabled: actor !== null,
  });
}
export function useOwnListings() {
  const actor = useFarmerActor();
  return useQuery({
    queryKey: [...scope(actor), 'listings'],
    queryFn: () => services.gateway.listOwnListings(actor!),
    enabled: actor !== null,
  });
}
export function useOwnInquiries() {
  const actor = useFarmerActor();
  return useQuery({
    queryKey: [...scope(actor), 'inquiries'],
    queryFn: () => services.gateway.listInquiriesForActor(actor!),
    enabled: actor !== null,
  });
}
export function useFarmerNumbers() {
  const actor = useFarmerActor();
  return useQuery({
    queryKey: [...scope(actor), 'numbers'],
    queryFn: () => services.gateway.getFarmerNumbers(actor!),
    enabled: actor !== null,
  });
}
export const useSettings = () => useQuery({ queryKey: ['public', 'settings'], queryFn: () => services.gateway.getSettings() });
export const usePickupChoices = () => ({
  markets: useQuery({ queryKey: ['public', 'markets'], queryFn: () => services.gateway.listPublicMarkets() }),
  places: useQuery({ queryKey: ['public', 'pickup-locations'], queryFn: () => services.gateway.listPublicPickupLocations() }),
});

function useWrite<TInput, TResult>(run: (actor: Actor, input: TInput) => Promise<TResult>) {
  const actor = useFarmerActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => {
      if (!actor) throw new Error('Not signed in as a farmer.');
      return run(actor, input);
    },
    // Only after the write has returned: refresh what this farmer and buyers read.
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: OWN }), queryClient.invalidateQueries({ queryKey: ['public'] })]),
  });
}

export const useUpdateProfile = () => useWrite((a, input: FarmProfileInput) => services.gateway.updateOwnProfile(a, input));
export const useUpdatePrivacy = () => useWrite((a, input: PrivacyInput) => services.gateway.updateOwnPrivacy(a, input));
export const useSetClaims = () => useWrite((a, input: FarmerClaimsInput) => services.gateway.setOwnClaims(a, input));
export const useSetPickupOptions = () => useWrite((a, input: PickupOptionsInput) => services.gateway.setOwnPickupOptions(a, input));
export const useSetPublication = () => useWrite((a, published: boolean) => services.gateway.setOwnPublication(a, published));
export const useApproveProfile = () => useWrite<void, OwnFarm>((a) => services.gateway.approveOwnProfile(a));
export const useConfirmReview = () => useWrite<void, OwnFarm>((a) => services.gateway.confirmOwnReview(a));
export const useCreateListing = () => useWrite((a, input: ListingCreateInput) => services.gateway.createListing(a, input));
export const useUpdateListing = () =>
  useWrite((a, input: { productId: ProductId; values: ListingUpdateInput }) => services.gateway.updateListing(a, input.productId, input.values));
export const useRemoveListing = () => useWrite((a, productId: ProductId) => services.gateway.removeListing(a, productId));
export const useSetAvailability = () =>
  useWrite((a, input: { productId: ProductId; change: AvailabilityChange }) =>
    services.gateway.farmerSetAvailability(a, input.productId, input.change),
  );
export const useReply = () =>
  useWrite((a, input: { inquiryId: InquiryId; reply: ReplyInput }) => services.gateway.replyToInquiry(a, input.inquiryId, input.reply));
export const useFileInquiry = () =>
  useWrite((a, input: { inquiryId: InquiryId; folder: InquiryFolder }) => services.gateway.fileInquiry(a, input.inquiryId, input.folder));
export const useRecordOutcome = () =>
  useWrite((a, input: { inquiryId: InquiryId; outcome: OutcomeKind }) => services.gateway.recordInquiryOutcome(a, input.inquiryId, input.outcome));
