"use client";

import { useEffect, useState } from "react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Save } from "lucide-react";

interface Config {
  id: string;
  key: string;
  value: any;
  description: string | null;
}

export default function ConfigPage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfigs)
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig(key: string, value: any, description?: string) {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, description }),
    });
  }

  async function addNew() {
    if (!newKey) return;
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(newValue);
    } catch {
      parsedValue = newValue;
    }
    await saveConfig(newKey, parsedValue, newDesc);
    setNewKey("");
    setNewValue("");
    setNewDesc("");
    // Reload
    const res = await fetch("/api/config");
    setConfigs(await res.json());
  }

  async function updateConfig(config: Config, newVal: string) {
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(newVal);
    } catch {
      parsedValue = newVal;
    }
    await saveConfig(config.key, parsedValue, config.description ?? undefined);
    setConfigs((prev) =>
      prev.map((c) => (c.id === config.id ? { ...c, value: parsedValue } : c))
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">ตั้งค่าระบบ</h1>
        <p className="mt-1 text-sm text-muted-foreground">System Configuration</p>
      </div>

      <Card className="mb-6 border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">เพิ่มค่าคอนฟิก</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full bg-input/50 font-mono text-sm transition-colors focus:bg-input sm:w-40"
            />
            <Input
              placeholder="Value (JSON)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 bg-input/50 font-mono text-sm transition-colors focus:bg-input"
            />
            <Input
              placeholder="คำอธิบาย"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-input/50 transition-colors focus:bg-input sm:w-48"
            />
            <Button onClick={addNew} className="gap-1.5 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20">
              เพิ่ม
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          กำลังโหลด...
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map((config) => (
            <Card key={config.id} className="border-border/40 bg-card/60 transition-colors duration-150 hover:border-border/60">
              <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="w-full flex-shrink-0 sm:w-48">
                  <p className="font-mono text-sm font-semibold text-primary">{config.key}</p>
                  {config.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
                  )}
                </div>
                <Input
                  defaultValue={
                    typeof config.value === "string"
                      ? config.value
                      : JSON.stringify(config.value)
                  }
                  className="flex-1 bg-input/50 font-mono text-sm transition-colors focus:bg-input"
                  onBlur={(e) => updateConfig(config, e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
