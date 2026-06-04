import { getPaymentMode } from "@/lib/payment-config";
import { AnyPayForm } from "./anypay-form";
import { EasySlipForm } from "./easyslip-form";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

function sanitizeRedirect(value: string | undefined) {
  if (!value) return undefined;
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; redirect?: string }>;
}) {
  const { planId, redirect: redirectParam } = await searchParams;
  if (!planId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
            <span className="text-2xl opacity-40">⚠️</span>
          </div>
          <p className="text-muted-foreground">ข้อมูลไม่ถูกต้อง</p>
        </div>
      </div>
    );
  }

  const redirect = sanitizeRedirect(redirectParam);
  const provider = await getPaymentMode();
  if (provider === "easyslip") {
    return <EasySlipForm planId={planId} redirect={redirect} />;
  }
  return <AnyPayForm planId={planId} redirect={redirect} />;
}

