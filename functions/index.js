export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  if (url.pathname === '/api/claim' && request.method === 'POST') {
    const { item, claimer } = await request.json();
    await env.CLAIMS.put(item, claimer);
    return new Response(JSON.stringify({ item, claimer }), { 
      headers: { 'content-type': 'application/json' },
      status: 200 
    });
  }
  
  if (url.pathname === '/api/get-claims') {
    const claims = await env.CLAIMS.list();
    const result = {};
    for (const { name } of claims.keys) {
      result[name] = await env.CLAIMS.get(name);
    }
    return new Response(JSON.stringify(result), { 
      headers: { 'content-type': 'application/json' },
      status: 200 
    });
  }
  
  // For Pages Functions, you typically don't need to handle static assets manually
  // Pages will do this automatically for files in your /public directory
  return new Response("Not found", { status: 404 });
}
