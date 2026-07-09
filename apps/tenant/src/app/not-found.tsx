export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0d13",
        color: "#e6e9f2",
      }}
    >
      <div>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>404</h1>
        <p>Page not found.</p>
      </div>
    </div>
  );
}
