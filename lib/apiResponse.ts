interface ParsedApiPayload<T> {
  data: T | null;
  isJson: boolean;
  contentType: string | null;
  rawText: string | null;
}

export async function parseApiPayload<T = any>(
  response: Response
): Promise<ParsedApiPayload<T>> {
  const contentType = response.headers.get('content-type');

  if (contentType?.toLowerCase().includes('application/json')) {
    try {
      return {
        data: (await response.json()) as T,
        isJson: true,
        contentType,
        rawText: null,
      };
    } catch {
      return {
        data: null,
        isJson: true,
        contentType,
        rawText: null,
      };
    }
  }

  let rawText: string | null = null;
  try {
    rawText = await response.text();
  } catch {
    rawText = null;
  }

  return {
    data: null,
    isJson: false,
    contentType,
    rawText,
  };
}

export function getApiErrorMessage(
  response: Response,
  payload: { error?: unknown } | null | undefined,
  fallback: string
) {
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (!response.ok && response.status === 404) {
    return 'The requested API endpoint could not be reached.';
  }

  if (!response.ok && response.status === 401) {
    return 'You need to sign in again to continue.';
  }

  if (!response.ok && response.status === 403) {
    return 'You do not have permission to access this resource.';
  }

  return fallback;
}
