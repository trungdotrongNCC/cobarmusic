import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in – Cobar Music",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; redirect?: string };
}) {
  const back =
    (searchParams?.next && searchParams.next.startsWith("/") && searchParams.next) ||
    (searchParams?.redirect && searchParams.redirect.startsWith("/") && searchParams.redirect) ||
    "/";

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-full max-w-sm rounded-2xl shadow-lg p-8 bg-white text-black">
        <h1 className="text-center text-2xl font-semibold mb-2">Sign in to Cobar Music</h1>
        <p className="text-center text-sm text-gray-600 mb-8">
          Welcome back! Please sign in to continue
        </p>

        <a
          href={`/api/auth/google/start?redirect=${encodeURIComponent(back)}`}
          className="block w-full text-center py-3 rounded-lg text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-medium"
        >
          Login with Google
        </a>
      </div>
    </div>
  );
}
