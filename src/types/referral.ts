// src/types/referral.ts

export interface ReferralCode {
  code: string;
}

export interface ReferralStats {
  referralCode: string;
  isReferred: boolean;
  totalReferred: number;
  totalConverted: number;
  totalVouchersEarned: number;
  currentMilestone: { name: string; referralCount: number } | null;
  nextMilestone: { name: string; referralCount: number; remaining: number } | null;
  referrals: ReferralEntry[];
}

export interface ReferralEntry {
  _id: string;
  refereeName: string;
  refereePhone: string | null;
  status: 'PENDING' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  conversionDate?: string;
  referrerReward?: { voucherCount: number };
}

export interface ShareContent {
  message: string;
  code: string;
}

export interface ValidateCodeResult {
  valid: boolean;
  referrerName?: string;
  reason?: string;
}

export interface ApplyCodeResult {
  applied: boolean;
  referralId?: string;
}
