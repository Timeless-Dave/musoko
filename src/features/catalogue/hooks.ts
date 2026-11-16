'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { services } from '@/data';
import { distanceKm, kmToMiles } from '@/domain/geo';
import type { Community, CommunityId } from '@/domain/types';
import { usePersistentString } from '@/lib/usePersistentString';

/** Public reads. Every one goes through the gateway's public methods, which return projections only. */
export const usePublicProducts = () =>
  useQuery({ queryKey: ['public', 'products'], queryFn: () => services.gateway.listPublicProducts() });
export const usePublicFarms = () =>
  useQuery({ queryKey: ['public', 'farms'], queryFn: () => services.gateway.listPublicFarms() });
export const usePublicFarm = (slug: string) =>
  useQuery({ queryKey: ['public', 'farm', slug], queryFn: () => services.gateway.getPublicFarmBySlug(slug) });
export const usePublicMarkets = () =>
  useQuery({ queryKey: ['public', 'markets'], queryFn: () => services.gateway.listPublicMarkets() });
export const usePublicPickupLocations = () =>
  useQuery({ queryKey: ['public', 'pickup-locations'], queryFn: () => services.gateway.listPublicPickupLocations() });
export const useCommunities = () =>
  useQuery({ queryKey: ['public', 'communities'], queryFn: () => services.gateway.listCommunities() });
export const useProductTypes = () =>
  useQuery({ queryKey: ['public', 'product-types'], queryFn: () => services.gateway.listProductTypes() });

const DEFAULT_COMMUNITY = 'helena-west-helena';

/**
 * The town the visitor is browsing from. It is their own choice from a list,
 * kept in their browser, never a device location.
 */
export function useSelectedCommunity() {
  const { data: communities } = useCommunities();
  const [slug, setSlug] = usePersistentString('musoko.community', DEFAULT_COMMUNITY);
  const community: Community | null = useMemo(
    () => communities?.find((c) => c.slug === slug) ?? communities?.[0] ?? null,
    [communities, slug],
  );
  return { community, communities: communities ?? [], setCommunitySlug: setSlug };
}

/** Miles from the selected town's centre to another town's centre. Coarse on purpose. */
export function useMilesFrom(community: Community | null) {
  const { data: communities } = useCommunities();
  return useMemo(() => {
    const centres = new Map<CommunityId, Community['centre']>((communities ?? []).map((c) => [c.id, c.centre]));
    return (other: CommunityId): number | null => {
      const to = centres.get(other);
      if (!community || !to) return null;
      return kmToMiles(distanceKm(community.centre, to));
    };
  }, [communities, community]);
}
