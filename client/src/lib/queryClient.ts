import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { clearAuthAndRedirect } from "@/lib/auth-utils";

function handleUnauthorized() {
  clearAuthAndRedirect();
}

async function throwIfResNotOk(res: Response) {
  // Treat 304 Not Modified as success (browser cache hit)
  if (res.status === 304) {
    return;
  }
  
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle authentication errors (401 or 403 with token-related messages)
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    
    if (res.status === 403 && text.toLowerCase().includes('token')) {
      console.error('[queryClient] 403 with token error - logging out');
      handleUnauthorized();
      return;
    }
    
    // Provide user-friendly error messages for common status codes
    if (res.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
    }
    if (res.status === 403) {
      throw new Error('Access denied. You do not have permission to access this resource.');
    }
    if (res.status === 404) {
      throw new Error('Resource not found.');
    }
    if (res.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (res.status === 401) {
      handleUnauthorized();
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
