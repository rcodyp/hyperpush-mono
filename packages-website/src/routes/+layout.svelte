<nav style="padding:1rem;border-bottom:1px solid #eee;font-family:sans-serif">
  <a href="/" style="font-weight:bold;text-decoration:none;color:#222">Mesh Packages</a>
  <form action="/search" method="GET" style="display:inline;margin-left:1rem">
    <input name="q" placeholder="Search packages..." style="padding:0.3rem 0.5rem;border:1px solid #ccc;border-radius:4px"/>
    <button type="submit" style="margin-left:0.3rem;padding:0.3rem 0.7rem">Search</button>
  </form>
</nav>
<main style="max-width:960px;margin:2rem auto;padding:0 1rem;font-family:sans-serif">
  <slot />
</main>
