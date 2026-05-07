import { mapEasySlipError } from "./errors";
import type {
  EasySlipResult,
  EasySlipSuccessData,
  EasySlipVerifyInput,
} from "./types";

const BASE_URL = "https://api.easyslip.com/v2";
const TIMEOUT_MS = 15_000;

/**
 * Verify a Thai bank-transfer slip via EasySlip /verify/bank.
 *
 * Always returns a result object (never throws). Network/timeout/parse
 * errors are mapped to the same shape as API errors.
 */
export async function verifyBankSlip(
  input: EasySlipVerifyInput
): Promise<EasySlipResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.imageBuffer)], {
    type: input.imageMime,
  });
  form.append("image", blob, input.imageFilename ?? "slip");
  form.append("matchAmount", String(input.matchAmount));
  // checkDuplicate is typed as literal `true` to prevent silent disabling.
  form.append("checkDuplicate", "true");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/verify/bank`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}` },
      body: form,
      signal: ctrl.signal,
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return mapToResult({ code: "API_SERVER_ERROR" });
    }

    const data = json as {
      success?: boolean;
      data?: unknown;
      error?: { code?: string; message?: string };
    };

    if (data.success === true && data.data) {
      return { ok: true, data: data.data as EasySlipSuccessData };
    }
    return mapToResult({ code: data.error?.code });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return mapToResult({ code: "TIMEOUT" });
    }
    return mapToResult({ code: "NETWORK" });
  } finally {
    clearTimeout(timer);
  }
}

function mapToResult(opts: { code: string | undefined }): EasySlipResult {
  const m = mapEasySlipError(opts.code);
  return { ok: false, code: m.code, message: m.message };
}
