import type { InquirySignals } from '@/domain/inquiry';
import type { BulkRequestInput, InstitutionInput, NeedInput } from '@/domain/institutions';
import type {
  Institution,
  InstitutionContact,
  InstitutionId,
  InstitutionNeed,
  InstitutionNeedId,
  PublicInstitution,
} from '@/domain/types';

export interface InstitutionReceipt {
  institutionId: InstitutionId;
  slug: string;
  /** The private key to this profile. The demo keeps it in the browser that made it. */
  editToken: string;
}

/** The buyer's own view, with their contact. Only the edit token opens it. */
export interface OwnInstitution {
  institution: Institution;
  contact: InstitutionContact;
  needs: InstitutionNeed[];
}

export interface BulkRequestReceipt {
  requestGroup: string;
  /** One private status link per farm the order went to, in the order of the lines. */
  statusTokens: string[];
}

/**
 * Institutional buyers. They are not signed in: a profile's edit token is its
 * key, as an inquiry's status token is. Contacts are private and never leave
 * through a public method.
 *
 * Rejects with GatewayError: `invalid` (fields in `detail.fields`), `not_found`,
 * `rate_limited`, `spam_suspected`.
 */
export interface InstitutionGateway {
  listPublicInstitutions(): Promise<PublicInstitution[]>;
  registerInstitution(input: InstitutionInput): Promise<InstitutionReceipt>;
  getOwnInstitution(editToken: string): Promise<OwnInstitution | null>;
  updateOwnInstitution(editToken: string, input: InstitutionInput): Promise<OwnInstitution>;
  addInstitutionNeed(editToken: string, need: NeedInput): Promise<OwnInstitution>;
  removeInstitutionNeed(editToken: string, needId: InstitutionNeedId): Promise<OwnInstitution>;
  /**
   * One order split across farms. Each line becomes an ordinary inquiry to that
   * farm, marked as from an institution and sharing one request group. All lines
   * are checked before any is stored, and the abuse checks count the order once.
   */
  submitBulkRequest(input: BulkRequestInput, signals: InquirySignals): Promise<BulkRequestReceipt>;
}
