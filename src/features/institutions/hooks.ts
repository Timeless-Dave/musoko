'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/data';
import type { BulkRequestInput, InstitutionInput, NeedInput } from '@/domain/institutions';
import type { InstitutionNeedId } from '@/domain/types';
import { usePersistentString } from '@/lib/usePersistentString';
import { getTabKey } from '@/features/inquiry';

const TOKEN_KEY = 'musoko.institution';
const ORDERS_KEY = 'musoko.institution-orders';

export const usePublicInstitutions = () =>
  useQuery({ queryKey: ['public', 'institutions'], queryFn: () => services.gateway.listPublicInstitutions() });

/** The organisation profile this device made. Its edit token is the only key. */
export function useInstitutionToken() {
  return usePersistentString(TOKEN_KEY, '');
}

export function useOwnInstitution(token: string) {
  return useQuery({
    queryKey: ['institution', 'own', token],
    queryFn: () => services.gateway.getOwnInstitution(token),
    enabled: token !== '',
  });
}

export interface SavedOrder {
  group: string;
  food: string;
  sentAt: string;
  tokens: string[];
}

/** Orders sent from this device: only the private status links, kept so the buyer can follow replies. */
export function useSavedOrders(): [SavedOrder[], (order: SavedOrder) => void] {
  const [raw, setRaw] = usePersistentString(ORDERS_KEY, '[]');
  let orders: SavedOrder[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) orders = parsed as SavedOrder[];
  } catch {
    orders = [];
  }
  const add = useCallback(
    (order: SavedOrder) => {
      let current: SavedOrder[] = [];
      try {
        current = JSON.parse(raw) as SavedOrder[];
      } catch {
        current = [];
      }
      setRaw(JSON.stringify([order, ...current].slice(0, 30)));
    },
    [raw, setRaw],
  );
  return [orders, add];
}

export function useInstitutionMutations(token: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['institution'] });
    void qc.invalidateQueries({ queryKey: ['public', 'institutions'] });
  };
  return {
    register: useMutation({ mutationFn: (input: InstitutionInput) => services.gateway.registerInstitution(input), onSuccess: refresh }),
    update: useMutation({ mutationFn: (input: InstitutionInput) => services.gateway.updateOwnInstitution(token, input), onSuccess: refresh }),
    addNeed: useMutation({ mutationFn: (need: NeedInput) => services.gateway.addInstitutionNeed(token, need), onSuccess: refresh }),
    removeNeed: useMutation({ mutationFn: (id: InstitutionNeedId) => services.gateway.removeInstitutionNeed(token, id), onSuccess: refresh }),
  };
}

export function useSendOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, openedAt, honeypot }: { input: BulkRequestInput; openedAt: string; honeypot: string }) =>
      services.gateway.submitBulkRequest(input, { honeypot, openedAt, sessionKey: getTabKey() }),
    onSuccess: () => void qc.invalidateQueries(),
  });
}

export const useBuyerInquiry = (token: string) =>
  useQuery({ queryKey: ['inquiry', 'buyer', token], queryFn: () => services.gateway.getBuyerInquiry(token) });
