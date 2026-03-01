<script>
  export let data;
</script>

{#if data.notFound}
  <h1>Package not found</h1>
  <p><a href="/">Browse all packages</a></p>
{:else if data.error}
  <p style="color:#c00">{data.error}</p>
{:else if data.pkg}
  <h1>{data.pkg.name}</h1>
  <p style="color:#666;font-size:0.95rem">{data.pkg.description || ''}</p>

  <div style="background:#f5f5f5;padding:0.8rem 1rem;border-radius:6px;margin:1rem 0">
    <strong>Install:</strong>
    <code style="margin-left:0.5rem">meshpkg install {data.pkg.name}</code>
  </div>

  {#if data.pkg.readme}
    <h2>README</h2>
    <div style="white-space:pre-wrap;background:#fafafa;padding:1rem;border-radius:4px;border:1px solid #eee">{data.pkg.readme}</div>
  {/if}

  <h2>Versions</h2>
  {#each (data.pkg.versions || []) as ver}
    <div style="padding:0.4rem 0;border-bottom:1px solid #eee">
      <strong>v{ver.version}</strong>
      <span style="margin-left:0.5rem;color:#888">{new Date(ver.published_at).toLocaleDateString()}</span>
      <span style="margin-left:0.5rem;color:#888">{ver.download_count} downloads</span>
    </div>
  {/each}
{/if}
