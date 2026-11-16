/**
 * Constrained wording, written once. The fixed strings below come from the
 * brief and the architect's work order; do not paraphrase them in components.
 */
export const copy = {
  brand: {
    name: 'Musoko',
    tagline: 'Connecting Local Farmers and Communities.',
    initiative: 'An initiative of ReMix Ideas',
  },
  demo: {
    watermark: 'DEMO DATA',
    strip: 'Demonstration data. Farms, prices and availability are fictional.',
    mark: 'Demo',
    roleLabel: 'Viewing as',
    roles: { buyer: 'Buyer', farmer: 'Farmer', administrator: 'Administrator' },
    reset: 'Reset demo data',
    resetConfirm: 'This clears every change made in this demo and restores the original data.',
    resetDone: 'Demo data was restored.',
    reseeded: 'The demo data was updated, so earlier demo changes were cleared.',
    settings: 'Demo settings',
    roleFailed: 'The role could not be changed. Try again.',
    resetFailed: 'The demo data could not be reset. Try again.',
  },
  availability: {
    available_now: 'Available now',
    coming_soon: 'Coming soon',
    unconfirmed: 'Availability unconfirmed',
  },
  claims: { listed: 'Listed', farmer_reported: 'farmer-reported', verified: 'verified' },
  transaction: {
    statement: 'Payment and pickup are arranged directly with the farmer. Musoko is not a party to the sale.',
  },
  response: { noPromise: 'The farmer will reply when they can.' },

  common: {
    cancel: 'Cancel',
    close: 'Close',
    dismiss: 'Dismiss',
    loading: 'Loading',
    saving: 'Saving',
    skip: 'Skip to content',
  },
  theme: {
    toGreen: 'Switch to the green theme',
    toYellow: 'Switch to the yellow theme',
  },
  home: {
    interim: 'Musoko is being built. This page will become the place to find fresh food from farms near you.',
    styleguideLink: 'Open the styleguide',
  },
  listing: {
    stillAvailable: 'Still available',
    confirmedNow: 'Confirmed just now',
    neverConfirmed: 'Never confirmed',
    lastConfirmed: 'Last confirmed',
    confirmForbidden: 'Only the farmer who owns this listing can confirm it.',
    confirmNotFound: 'This listing no longer exists.',
    confirmFailed: 'That did not save. Try again.',
  },
  notFound: { title: 'This page is not here.', home: 'Go to the homepage' },
} as const;
