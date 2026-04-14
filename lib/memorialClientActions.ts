async function parseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload?.error || 'Request failed.';
}

export async function updateMemorialTrashState(
  memorialId: string,
  action: 'delete' | 'restore'
) {
  const response = await fetch(`/api/memorials/${memorialId}/soft-delete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function permanentlyDeleteMemorial(memorialId: string) {
  const response = await fetch(`/api/memorials/${memorialId}/permanent-delete`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}
