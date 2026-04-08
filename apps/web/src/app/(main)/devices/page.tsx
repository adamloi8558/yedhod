"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@kodhom/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Badge } from "@kodhom/ui/components/badge";
import { Monitor, Smartphone, Trash2, AlertTriangle } from "lucide-react";

interface DeviceSession {
  id: string;
  createdAt: string;
  lastUsedAt?: string;
  device?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface DeviceLimit {
  allowed: boolean;
  current: number;
  max: number;
}

export default function DevicesPage() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceLimit, setDeviceLimit] = useState<DeviceLimit | null>(null);

  async function loadData() {
    try {
      const [sessionsRes, limitRes] = await Promise.all([
        authClient.multiSession.listDeviceSessions({}),
        fetch("/api/devices/check").then((r) => r.json()),
      ]);
      const rawData = sessionsRes.data as unknown;
      if (Array.isArray(rawData)) {
        setSessions(rawData as DeviceSession[]);
      } else if (rawData && typeof rawData === "object" && "sessions" in rawData) {
        setSessions((rawData as { sessions: DeviceSession[] }).sessions);
      } else {
        setSessions([]);
      }
      setDeviceLimit(limitRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function revokeSession(sessionId: string) {
    try {
      await authClient.revokeSession({ token: sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      // Refresh device limit
      const limitRes = await fetch("/api/devices/check").then((r) => r.json());
      setDeviceLimit(limitRes);
    } catch {
      // ignore
    }
  }

  function getDeviceIcon(userAgent?: string) {
    if (userAgent?.toLowerCase().includes("mobile")) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold gradient-text">จัดการอุปกรณ์</h1>

      {/* Device limit info */}
      {deviceLimit && (
        <Card className="mb-6 rounded-2xl border-border/50 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สถานะอุปกรณ์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                อุปกรณ์ที่ใช้งาน / สูงสุด
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {deviceLimit.current} / {deviceLimit.max}
                </span>
                {!deviceLimit.allowed && (
                  <Badge variant="destructive" className="gap-1 rounded-lg">
                    <AlertTriangle className="h-3 w-3" />
                    เต็มแล้ว
                  </Badge>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-smooth ${deviceLimit.allowed ? 'gradient-primary' : 'bg-destructive'}`}
                style={{ width: `${Math.min((deviceLimit.current / deviceLimit.max) * 100, 100)}%` }}
              />
            </div>
            {!deviceLimit.allowed && (
              <p className="text-sm text-destructive/80">
                คุณใช้อุปกรณ์เต็มจำนวนแล้ว กรุณายกเลิกเซสชันที่ไม่ใช้งานเพื่อเข้าสู่ระบบบนอุปกรณ์ใหม่
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-10 text-center animate-slide-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
            <Monitor className="h-6 w-6 opacity-40" />
          </div>
          <p className="text-muted-foreground">ไม่พบเซสชัน</p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up">
          {sessions.map((session) => (
            <Card key={session.id} className="rounded-2xl border-border/50 transition-smooth hover:border-border hover:shadow-md">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {getDeviceIcon(session.userAgent)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {session.userAgent
                      ? session.userAgent.substring(0, 60)
                      : "ไม่ทราบอุปกรณ์"}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {session.ipAddress ?? "ไม่ทราบ IP"} •{" "}
                    {new Date(session.createdAt).toLocaleDateString("th-TH")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeSession(session.id)}
                  title="ยกเลิกเซสชัน"
                  className="rounded-xl hover:bg-destructive/10 transition-smooth"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
