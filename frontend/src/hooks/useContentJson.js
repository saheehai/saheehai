import { useEffect, useState } from 'react';

/**
 * Fetches build-generated content JSON (news posts, resource articles).
 *
 * `data` is null while loading, false when the file does not exist, and
 * the parsed JSON otherwise. `error` is a message for a failed request.
 * Nothing here needs an account, and nothing here talks to the API.
 */
export function useContentJson(folder, file, notFoundMessage) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/${folder}/${file}`, { headers: { Accept: 'application/json' } })
      .then((res) => {
        // A missing file comes back as the SPA shell with a 200, so check the
        // type rather than the status.
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.includes('json')) throw new Error('not found');
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.message === 'not found') setData(false);
        else setError(notFoundMessage || 'Could not load this right now. Please try again in a moment.');
      });
    return () => {
      cancelled = true;
    };
  }, [folder, file, notFoundMessage]);

  return { data, error };
}

/** Article slugs are file names; never let a URL reach the fetch as a path of its own making. */
export const isSafeSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '');

export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
