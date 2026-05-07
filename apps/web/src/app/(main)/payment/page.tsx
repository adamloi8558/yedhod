import { getPaymentMode } from "@/lib/payment-config";
import { AnyPayForm } from "./anypay-form";
import { EasySlipForm } from "./easyslip-form";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const { planId } = await searchParams;
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

  const provider = await getPaymentMode();
  if (provider === "easyslip") {
    return <EasySlipForm planId={planId} />;
  }
  return <AnyPayForm planId={planId} />;
}

