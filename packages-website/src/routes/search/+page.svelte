<script>
  export let data;
</script>

<h1>Search: {data.query}</h1>
{#if data.error}
  <p style="color:#c00">{data.error}</p>
{:else if data.packages.length === 0}
  <p>No packages found for "{data.query}".</p>
{:else}
  {#each data.packages as pkg}
    <div style="border:1px solid #eee;border-radius:6px;padding:1rem;margin-bottom:1rem">
      <a href="/packages/{pkg.name}" style="font-size:1.1rem;font-weight:bold">{pkg.name}</a>
      <span style="margin-left:0.5rem;color:#666">v{pkg.latest_version}</span>
      <p style="margin:0.3rem 0 0;color:#444">{pkg.description || ''}</p>
    </div>
  {/each}
{/if}
