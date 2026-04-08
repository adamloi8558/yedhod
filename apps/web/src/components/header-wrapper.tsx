import { getSession } from "@/lib/auth-server";
import { Header } from "@/components/header";

export async function HeaderWrapper() {
  const session = await getSession();
  return <Header session={session} />;
}
