"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Kanit, system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#fff",
          padding: "1rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            ระบบขัดข้อง
          </h1>
          <p style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
            เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 20px",
              borderRadius: 12,
              background: "#ff3d7f",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
