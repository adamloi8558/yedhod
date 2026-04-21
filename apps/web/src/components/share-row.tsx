"use client";

import { useState } from "react";
import { Link2, Check, Send, Facebook } from "lucide-react";

interface ShareRowProps {
  url: string;
  title: string;
}

const btnBase =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ShareRow({ url, title }: ShareRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareUrls = {
    x: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encoded}`,
    telegram: `https://t.me/share/url?url=${encoded}&text=${encodedTitle}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
  };

  return (
    <div
      role="group"
      aria-label="แชร์คลิปนี้"
      className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-card/40 p-2 backdrop-blur"
    >
      <span className="px-2 text-xs font-medium text-muted-foreground">
        แชร์
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        title={copied ? "คัดลอกแล้ว!" : "คัดลอกลิงก์"}
        className={`${btnBase} hover:bg-muted hover:text-foreground`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </button>

      <a
        href={shareUrls.x}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="แชร์บน X"
        className={`${btnBase} hover:bg-foreground/10 hover:text-foreground`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      <a
        href={shareUrls.line}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="แชร์บน LINE"
        className={`${btnBase} hover:bg-[#06C755]/15 hover:text-[#06C755]`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
      </a>

      <a
        href={shareUrls.telegram}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="แชร์บน Telegram"
        className={`${btnBase} hover:bg-[#229ED9]/15 hover:text-[#229ED9]`}
      >
        <Send className="h-4 w-4" />
      </a>

      <a
        href={shareUrls.facebook}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="แชร์บน Facebook"
        className={`${btnBase} hover:bg-[#1877F2]/15 hover:text-[#1877F2]`}
      >
        <Facebook className="h-4 w-4" />
      </a>
    </div>
  );
}
