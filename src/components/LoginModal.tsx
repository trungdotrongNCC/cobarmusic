"use client";

export default function LoginModal({
  open,
  onClose,
  nextPath = "/",
}: {
  open: boolean;
  onClose: () => void;
  nextPath?: string;
}) {
  if (!open) return null;

  const goLogin = () => {
    // Gọi thẳng API Google
    const url = `/api/auth/google/start?redirect=${encodeURIComponent(
      nextPath
    )}`;
    window.location.assign(url);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "var(--sidebar-w, 0px)" as any,
        top: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-lg"
        style={{
          width: 360,
          background: "#fff",
          color: "#000",
          padding: 24,
          border: "1px solid #262626",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-xl font-semibold mb-2">
          Sign in to Cobar Music
        </h2>
        <p className="text-center text-sm text-gray-600 mb-6">
          Welcome back! Please sign in to continue
        </p>

        <button
          onClick={goLogin}
          className="w-full rounded-lg font-medium text-white"
          style={{
            padding: "12px 16px",
            background:
              "linear-gradient(90deg, rgba(168,85,247,1) 0%, rgba(99,102,241,1) 100%)",
          }}
        >
          Login with Google
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
