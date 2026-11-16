import type {
  Community,
  CommunityId,
  ProductAvailability,
  ProductId,
  ProductType,
  PublicFarm,
  PublicMarket,
  PublicPickupLocation,
  PublicProduct,
  PreviewEvent,
  Region,
  SearchFilters,
  Settings,
} from '@/domain/types';
import type { Actor } from './auth';
import type { InquiryGateway } from './inquiries';

export interface PreviewOpenInput {
  targetKind: PreviewEvent['targetKind'];
  /** The market or pickup location id. */
  targetId: string;
  surface: PreviewEvent['surface'];
}

/**
 * Public methods return projection types or reference rows only. Privileged
 * methods take the acting user and check the role before returning anything.
 */
export interface DataGateway extends InquiryGateway {
  // ----- public -----
  getSettings(): Promise<Settings>;
  listRegions(): Promise<Region[]>;
  listCommunities(): Promise<Community[]>;
  listProductTypes(): Promise<ProductType[]>;
  listPublicFarms(): Promise<PublicFarm[]>;
  getPublicFarmBySlug(slug: string): Promise<PublicFarm | null>;
  /** Default ranking. */
  listPublicProducts(): Promise<PublicProduct[]>;
  listPublicMarkets(): Promise<PublicMarket[]>;
  listPublicPickupLocations(): Promise<PublicPickupLocation[]>;
  /** Anonymous: no session or device id. Terms are scrubbed before storage. */
  recordSearch(input: {
    rawTerms: string;
    filters: SearchFilters;
    communityId: CommunityId | null;
    resultCount: number;
  }): Promise<void>;
  /**
   * Counts one open of a market or pickup location preview, on the map or in a
   * list. Anonymous: the event carries the place, the surface and the day, and
   * nothing about the visitor. Repeat opens on one day add to one count.
   */
  recordPreviewOpen(input: PreviewOpenInput): Promise<void>;

  // ----- privileged -----
  /** Farmer only, and only for a product on the actor's own farm. */
  farmerConfirmAvailability(actor: Actor, productId: ProductId): Promise<ProductAvailability>;
}
