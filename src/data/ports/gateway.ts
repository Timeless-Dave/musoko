import type {
  Community,
  ProductAvailability,
  ProductId,
  ProductType,
  PublicFarm,
  PublicMarket,
  PublicPickupLocation,
  PublicProduct,
  Region,
  Settings,
} from '@/domain/types';
import type { Actor } from './auth';

/**
 * Public methods return projection types or reference rows only. Privileged
 * methods take the acting user and check the role before returning anything.
 */
export interface DataGateway {
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
  // ----- privileged -----
  /** Farmer only, and only for a product on the actor's own farm. */
  farmerConfirmAvailability(actor: Actor, productId: ProductId): Promise<ProductAvailability>;
}
