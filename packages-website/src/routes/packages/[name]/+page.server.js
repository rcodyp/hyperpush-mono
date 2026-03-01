export async function load({ fetch, params }) {
  try {
    const res = await fetch(`https://api.packages.meshlang.dev/api/v1/packages/${params.name}`);
    if (res.status === 404) return { pkg: null, notFound: true };
    if (!res.ok) return { pkg: null, error: 'Registry unavailable' };
    const pkg = await res.json();
    return { pkg };
  } catch {
    return { pkg: null, error: 'Failed to fetch package' };
  }
}
