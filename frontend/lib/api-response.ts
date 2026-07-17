export async function readApiJson<T = unknown>(
  response: Response,
  fallback = 'The backend returned an invalid response.',
): Promise<T & { message?: string | string[] }> {
  const text = await response.text();
  if (!text) return {} as T & { message?: string | string[] };
  try {
    return JSON.parse(text) as T & { message?: string | string[] };
  } catch {
    return {
      message:
        response.status >= 500
          ? 'Backend API is unavailable or returned an internal server error. Make sure the backend is running on port 3002.'
          : fallback,
    } as T & { message?: string | string[] };
  }
}

export function apiMessage(message: string | string[] | undefined, fallback: string) {
  return Array.isArray(message) ? message.join(' ') : message || fallback;
}
