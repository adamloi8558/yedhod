const BASE = process.env.COOLIFY_API_URL ?? "";
const TOKEN = process.env.COOLIFY_API_TOKEN ?? "";
const TENANT_APP_UUID = process.env.COOLIFY_TENANT_APP_UUID ?? "";

function assertConfigured() {
  if (!BASE || !TOKEN || !TENANT_APP_UUID) {
    throw new Error(
      "Coolify integration not configured. Set COOLIFY_API_URL, COOLIFY_API_TOKEN, COOLIFY_TENANT_APP_UUID."
    );
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertConfigured();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Coolify ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

type TenantApp = {
  uuid: string;
  fqdn: string | null;
};

async function getTenantApp(): Promise<TenantApp> {
  return api(`/api/v1/applications/${TENANT_APP_UUID}`);
}

function normalizeDomain(d: string): string {
  const trimmed = d.trim().toLowerCase();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseDomains(fqdn: string | null): string[] {
  if (!fqdn) return [];
  return fqdn
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }
}

async function updateFqdn(fqdn: string): Promise<void> {
  await api(`/api/v1/applications/${TENANT_APP_UUID}`, {
    method: "PATCH",
    body: JSON.stringify({ domains: fqdn }),
  });
}

async function triggerDeploy(): Promise<{ deployment_uuid: string } | null> {
  const res = await api<{ deployments: Array<{ deployment_uuid: string }> }>(
    `/api/v1/deploy?uuid=${TENANT_APP_UUID}`,
    { method: "POST" }
  );
  return res.deployments?.[0] ?? null;
}

export async function syncTenantDomain(domain: string): Promise<{
  attached: boolean;
  alreadyPresent: boolean;
  deploymentUuid: string | null;
  domains: string[];
}> {
  const clean = normalizeDomain(domain);
  const host = hostOf(clean);

  const app = await getTenantApp();
  const current = parseDomains(app.fqdn);
  const alreadyPresent = current.some((d) => hostOf(d) === host);

  if (alreadyPresent) {
    return {
      attached: false,
      alreadyPresent: true,
      deploymentUuid: null,
      domains: current,
    };
  }

  const next = [...current, clean].join(",");
  await updateFqdn(next);
  const dep = await triggerDeploy();

  return {
    attached: true,
    alreadyPresent: false,
    deploymentUuid: dep?.deployment_uuid ?? null,
    domains: [...current, clean],
  };
}

export async function unsyncTenantDomain(domain: string): Promise<{
  removed: boolean;
  domains: string[];
}> {
  const host = hostOf(domain);
  const app = await getTenantApp();
  const current = parseDomains(app.fqdn);
  const next = current.filter((d) => hostOf(d) !== host);
  if (next.length === current.length) {
    return { removed: false, domains: current };
  }
  await updateFqdn(next.join(","));
  await triggerDeploy();
  return { removed: true, domains: next };
}

export function isCoolifyConfigured(): boolean {
  return Boolean(BASE && TOKEN && TENANT_APP_UUID);
}
