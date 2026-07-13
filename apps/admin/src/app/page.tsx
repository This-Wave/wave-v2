"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../providers/AdminAuthProvider";

export default function RootPage() {
  const router = useRouter();
  const { accessToken, isLoading } = useAdminAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(accessToken ? "/dashboard" : "/login");
  }, [isLoading, accessToken, router]);

  return null;
}
