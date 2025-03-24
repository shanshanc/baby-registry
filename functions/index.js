export default {
  async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/api/claim' && request.method === 'POST') {
          const { item, claimer } = await request.json();
          await env.CLAIMS.put(item, claimer);
          return new Response(JSON.stringify({ item, claimer }), { status: 200 });
      }
      if (url.pathname === '/api/get-claims') {
          const claims = await env.CLAIMS.list();
          const result = {};
          for (const { name } of claims.keys) {
              result[name] = await env.CLAIMS.get(name);
          }
          return new Response(JSON.stringify(result), { status: 200 });
      }
      return env.ASSETS.fetch(request); // Serve static files from public/
  }
};
