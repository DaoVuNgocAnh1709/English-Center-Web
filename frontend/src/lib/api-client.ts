const api = process.env.NEXT_PUBLIC_API_URL || "/api";

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${api}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function apiFetch(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const url = pathOrUrl.startsWith("http") || pathOrUrl.startsWith("/")
    ? (pathOrUrl.startsWith(api) || pathOrUrl.startsWith("http") ? pathOrUrl : `${api}${pathOrUrl}`)
    : `${api}/${pathOrUrl}`;

  const options: RequestInit = {
    ...init,
    credentials: init?.credentials ?? "include",
  };

  let response = await fetch(url, options);

  if (
    response.status === 401 &&
    !url.endsWith("/auth/login") &&
    !url.endsWith("/auth/refresh") &&
    !url.endsWith("/auth/logout")
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await fetch(url, options);
    }
  }

  return response;
}
