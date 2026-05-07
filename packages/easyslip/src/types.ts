export interface EasySlipBank {
  id: string;
  name: string;
  short: string;
}

export interface EasySlipAccountName {
  th?: string;
  en?: string;
}

export interface EasySlipAccount {
  name: EasySlipAccountName;
  bank: { type: string; account: string };
}

export interface EasySlipParty {
  bank: EasySlipBank;
  account: EasySlipAccount;
}

export interface EasySlipAmount {
  amount: number;
  local: { amount: number; currency: string };
}

export interface EasySlipRawSlip {
  payload: string;
  transRef: string;
  date: string;
  countryCode: string;
  amount: EasySlipAmount;
  fee: number;
  sender: EasySlipParty;
  receiver: EasySlipParty;
}

export interface EasySlipSuccessData {
  isDuplicate: boolean;
  amountInSlip: number;
  amountInOrder: number;
  isAmountMatched: boolean;
  matchedAccount: unknown | null;
  rawSlip: EasySlipRawSlip;
}

export type EasySlipResult =
  | { ok: true; data: EasySlipSuccessData }
  | { ok: false; code: string; message: string };

export interface EasySlipVerifyInput {
  apiKey: string;
  imageBuffer: Buffer;
  imageMime: string;
  imageFilename?: string;
  matchAmount: number;
  checkDuplicate?: boolean;
}
