import { asId, type FarmerProfileId, type User, type UserId, type UserRole, type UserRoleAssignment } from '@/domain/types';
import { daysAgo } from './time';

export const DEMO_FARMER_USER_ID = asId<UserId>('user-demo-farmer');
export const DEMO_BUYER_USER_ID = asId<UserId>('user-demo-buyer');
export const DEMO_ADMIN_USER_ID = asId<UserId>('user-demo-admin');
export const DEMO_FARM_ID = asId<FarmerProfileId>('farm-01');

export const DEMO_ACCOUNTS: Record<UserRole, { userId: UserId; farmerProfileId: FarmerProfileId | null }> = {
  buyer: { userId: DEMO_BUYER_USER_ID, farmerProfileId: null },
  farmer: { userId: DEMO_FARMER_USER_ID, farmerProfileId: DEMO_FARM_ID },
  administrator: { userId: DEMO_ADMIN_USER_ID, farmerProfileId: null },
};

export function buildUsers(now: Date): { users: User[]; roles: UserRoleAssignment[] } {
  return {
    users: [
      { id: DEMO_FARMER_USER_ID, displayName: 'Odell Fairweather', createdAt: daysAgo(now, 140) },
      { id: DEMO_BUYER_USER_ID, displayName: 'Renata Voss', createdAt: daysAgo(now, 90) },
      { id: DEMO_ADMIN_USER_ID, displayName: 'Demo Administrator', createdAt: daysAgo(now, 200) },
    ],
    roles: [
      { userId: DEMO_FARMER_USER_ID, role: 'farmer' },
      { userId: DEMO_BUYER_USER_ID, role: 'buyer' },
      { userId: DEMO_ADMIN_USER_ID, role: 'administrator' },
    ],
  };
}
