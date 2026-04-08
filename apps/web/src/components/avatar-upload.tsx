"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@kodhom/ui/components/avatar";
import { Button } from "@kodhom/ui/components/button";
import { Camera } from "lucide-react";

interface AvatarUploadProps {
  currentImage?: string;
  userName: string;
}

export function AvatarUpload({ currentImage, userName }: AvatarUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState(currentImage);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, folder: "avatars" }),
      });
      const { url, key } = await presignRes.json();

      // Upload to R2
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // Update profile
      const updateRes = await fetch("/api/profile/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ r2Key: key }),
      });
      const data = await updateRes.json();

      if (updateRes.ok) {
        setImage(data.image);
        router.refresh();
      }
    } catch {
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="group relative">
        <Avatar className="h-14 w-14 sm:h-18 sm:w-18 ring-2 ring-primary/20 shadow-lg">
          <AvatarImage src={image} alt={userName} />
          <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-smooth flex items-center justify-center">
          <Camera className="h-5 w-5 text-white" />
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-110 transition-smooth disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <p className="text-base font-semibold">{userName}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          {uploading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-primary/30 border-t-primary" />
              กำลังอัปโหลด...
            </span>
          ) : (
            "คลิกไอคอนกล้องเพื่อเปลี่ยนรูป"
          )}
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
