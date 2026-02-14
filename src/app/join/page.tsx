"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    if (code) {
      router.replace(`/?code=${code}`);
    } else {
      router.replace("/");
    }
  }, [code, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
      <p className="text-sm text-[#323338]/60">Redirecting...</p>
    </div>
  );
}
