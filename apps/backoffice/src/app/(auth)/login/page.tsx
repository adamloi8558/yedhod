"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="เย็ดโหด.com" className="mx-auto h-14 w-auto" />
          <p className="mt-2 text-xs text-muted-foreground">Backoffice</p>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/20 backdrop-blur-sm overflow-hidden">
          <CardHeader className="px-6 pb-2 pt-6 text-center">
            <CardTitle className="text-base font-semibold text-foreground">เข้าสู่ระบบ</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-6 pb-6 pt-2">
              {error && (
                <div className="animate-slide-up rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  className="h-10 bg-input/50 transition-colors focus:bg-input"
                  placeholder="admin@kodhom.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    className="h-10 bg-input/50 transition-colors focus:bg-input pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="!mt-5 h-10 w-full font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary/20" disabled={loading}>
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
