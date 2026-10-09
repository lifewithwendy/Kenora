"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 0, retry: false, refetchOnWindowFocus: true } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
