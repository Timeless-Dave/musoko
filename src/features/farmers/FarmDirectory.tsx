'use client';

import { useMemo } from 'react';
import { copy } from '@/content/copy';
import { EmptyState, PageHeader } from '@/design-system/patterns';
import { Section } from '@/design-system/primitives';
import { FarmCard, useDirectoryFarms, useMilesFrom, usePublicFarms, usePublicProducts, useSelectedCommunity } from '@/features/catalogue';
import { DirectoryCard } from './Directory';

export function FarmDirectory() {
  const { community } = useSelectedCommunity();
  const milesFrom = useMilesFrom(community);
  const { data: farms } = usePublicFarms();
  const { data: products } = usePublicProducts();
  const { data: directory } = useDirectoryFarms();
  const listed = useMemo(
    () => [...(directory ?? [])].sort((a, b) => (milesFrom(a.communityId) ?? Number.MAX_SAFE_INTEGER) - (milesFrom(b.communityId) ?? Number.MAX_SAFE_INTEGER) || a.farmName.localeCompare(b.farmName)),
    [directory, milesFrom],
  );

  const sorted = useMemo(
    () =>
      [...(farms ?? [])].sort(
        (a, b) =>
          (milesFrom(a.location.communityId) ?? Number.MAX_SAFE_INTEGER) -
            (milesFrom(b.location.communityId) ?? Number.MAX_SAFE_INTEGER) || a.farmName.localeCompare(b.farmName),
      ),
    [farms, milesFrom],
  );

  return (
    <>
    <Section pad="tight">
      <PageHeader title={copy.farms.title} lead={copy.farms.lead} />
      {farms && sorted.length === 0 ? (
        <EmptyState sentence={copy.farms.none} />
      ) : (
        <ul className="farm-grid">
          {sorted.map((farm) => (
            <li key={farm.id}>
              <FarmCard
                farm={farm}
                listings={(products ?? []).filter((p) => p.farm.id === farm.id).length}
                miles={milesFrom(farm.location.communityId)}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
    {listed.length ? (
      <Section pad="tight" aria-labelledby="directory-title">
        <h2 id="directory-title" className="display-s">
          {copy.directory.title}
        </h2>
        <p className="inst-lead">{copy.directory.lead}</p>
        <ul className="farm-grid">
          {listed.map((farm) => (
            <li key={farm.id}>
              <DirectoryCard farm={farm} miles={milesFrom(farm.communityId)} />
            </li>
          ))}
        </ul>
      </Section>
    ) : null}
    </>
  );
}
