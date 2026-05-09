export interface EasySlipBank {
  id: string;
  name: string;
  short: string;
}

export interface EasySlipAccountName {
  th?: string;
  en?: string;
}

export type EasySlipAccountType = "BANKAC" | "TOKEN" | "DUMMY";
export type EasySlipProxyType =
  | "NATID"
  | "MSISDN"
  | "EWALLETID"
  | "EMAIL"
  | "BILLERID";

export interface EasySlipAccount {
  name: EasySlipAccountName;
  // bank and proxy are alternatives; PromptPay slips often have only proxy.
  bank?: { type: EasySlipAccountType; account: string };
  proxy?: { type: EasySlipProxyType; account: string };
}

export interface EasySlipParty {
  bank: EasySlipBank;
  account: EasySlipAccount;
}

export type EasySlipReceiver = EasySlipParty & {
  merchantId?: string | null;
};

export interface EasySlipAmount {
  amount: number;
  local?: { amount: number; currency: string };
}

export interface EasySlipRawSlip {
  payload: string;
  transRef: string;
  date: string;
  countryCode?: string;
  amount: EasySlipAmount;
  fee?: number;
  ref1?: string;
  ref2?: string;
  ref3?: string;
  sender: EasySlipParty;
  receiver: EasySlipReceiver;
}

export interface EasySlipSuccessData {
  isDuplicate: boolean;
  amountInSlip: number;
  amountInOrder?: number;
  isAmountMatched?: boolean;
  matchedAccount: unknown | null;
  remark?: string;
  rawSlip: EasySlipRawSlip;
}

export type EasySlipErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "IP_NOT_ALLOWED"
  | "BRANCH_INACTIVE"
  | "SERVICE_BANNED"
  | "USER_BANNED"
  | "QUOTA_EXCEEDED"
  | "VALIDATION_ERROR"
  | "SLIP_NOT_FOUND"
  | "SLIP_PENDING"
  | "IMAGE_SIZE_TOO_LARGE"
  | "INVALID_IMAGE_FORMAT"
  | "API_SERVER_ERROR"
  | "NETWORK"
  | "TIMEOUT"
  | "UNKNOWN";

export type EasySlipResult =
  | { ok: true; data: EasySlipSuccessData }
  | { ok: false; code: EasySlipErrorCode; message: string };

export interface EasySlipVerifyInput {
  apiKey: string;
  imageBuffer: Buffer;
  imageMime: string;
  imageFilename?: string;
  matchAmount: number;
  // Always true in this codebase — duplicate detection is mandatory.
  // Typed as a literal to prevent a caller from silently disabling it.
  checkDuplicate: true;
}
