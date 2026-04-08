"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
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
      const result = await authClient.signUp.email({
        name: email.split("@")[0],
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "สมัครสมาชิกไม่สำเร็จ");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-md animate-slide-up">

        <Card className="rounded-2xl border-border/50 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardHeader className="text-center pt-8 pb-2">
            <CardTitle className="text-xl font-bold">สมัครสมาชิก</CardTitle>
            <CardDescription className="text-muted-foreground/70">สร้างบัญชีเพื่อเข้าถึงคลิปวิดีโอ</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 px-6">
              {error && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  className="rounded-xl bg-accent/30 border-border/50 focus:border-primary/40 focus:ring-primary/20 transition-smooth"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">รหัสผ่าน</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="rounded-xl bg-accent/30 border-border/50 focus:border-primary/40 focus:ring-primary/20 transition-smooth pr-10"
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
                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="flex gap-1.5 pt-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-smooth ${
                          passwordStrength >= level
                            ? level === 1
                              ? "bg-destructive"
                              : level === 2
                                ? "bg-amber-400"
                                : "bg-green-400"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 px-6 pb-8">
              <Button type="submit" className="w-full gradient-primary text-white border-0 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-smooth h-11" disabled={loading}>
                {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
              </Button>
              <p className="text-sm text-muted-foreground">
                มีบัญชีอยู่แล้ว?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline transition-smooth">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
