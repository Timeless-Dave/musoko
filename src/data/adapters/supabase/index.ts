import type { Services } from '../../ports';
import { GatewayError } from '../../ports/errors';

const NOT_BUILT = 'Live mode is not built yet. Unset NEXT_PUBLIC_DATA_MODE to run the demo.';

/**
 * Live stub. Every method rejects with a named error. From the step that builds
 * this, the Supabase client may be reached only through `await import()` inside
 * a method, so it never enters the demo bundle. No secret may be read here: this
 * file is importable from the client bundle.
 */
const reject = (): Promise<never> => Promise.reject(new GatewayError('not_configured', NOT_BUILT));

export function createLiveServices(): Services {
  return {
    mode: 'live',
    gateway: {
      getSettings: reject,
      listRegions: reject,
      listCommunities: reject,
      listProductTypes: reject,
      listPublicFarms: reject,
      getPublicFarmBySlug: reject,
      listPublicProducts: reject,
      listPublicMarkets: reject,
      listPublicPickupLocations: reject,
      recordSearch: reject,
      recordPreviewOpen: reject,
      farmerConfirmAvailability: reject,
      submitInquiry: reject,
      getBuyerInquiry: reject,
      listInquiriesForActor: reject,
      replyToInquiry: reject,
      recordInquiryOutcome: reject,
      registerFarmer: reject,
      getOwnFarm: reject,
      updateOwnProfile: reject,
      updateOwnPrivacy: reject,
      setOwnClaims: reject,
      setOwnPickupOptions: reject,
      setOwnPublication: reject,
      approveOwnProfile: reject,
      confirmOwnReview: reject,
      listOwnListings: reject,
      createListing: reject,
      updateListing: reject,
      removeListing: reject,
      farmerSetAvailability: reject,
      getFarmerNumbers: reject,
      listFarmsForAdmin: reject,
      getFarmForAdmin: reject,
      createFarmForFarmer: reject,
      updateFarmAsAdmin: reject,
      recordFarmConsent: reject,
      recordFarmReview: reject,
      approveFarmRegistration: reject,
      declineFarmRegistration: reject,
      listClaimsForAdmin: reject,
      verifyClaim: reject,
      removeClaimVerification: reject,
      listModerationItems: reject,
      setModeration: reject,
      getPilotMetrics: reject,
      listNoResultSearches: reject,
      getRetentionView: reject,
      updateRetentionSettings: reject,
      runRetention: reject,
    },
    auth: { getSession: reject, signOut: reject, subscribe: () => () => undefined },
    notifications: { send: reject },
    map: {
      styleUrl: 'https://tiles.openfreemap.org/styles/positron',
      attribution: 'OpenFreeMap, data from OpenStreetMap contributors',
      defaultCentre: { lat: 34.55, lng: -91.2 },
      defaultZoom: 8,
    },
    images: { save: reject, remove: reject },
    clock: { now: () => new Date() },
    demo: null,
  };
}
