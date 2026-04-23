"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const handleContinue = () => {
    login();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-[--dark-navy]">Prelegal</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome to Prelegal
              </h2>
              <p className="text-gray-600 mt-2 text-sm">
                AI-powered legal document creation
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="w-full bg-[--purple-secondary] text-white py-3 px-4 rounded-md font-medium hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[--purple-secondary] focus:ring-offset-2"
            >
              Continue without signing in
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}