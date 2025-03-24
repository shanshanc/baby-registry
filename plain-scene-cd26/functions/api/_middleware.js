export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  console.log(`Debug - Received request for: ${url.pathname}`);

  // Handle API routes
  if (url.pathname.startsWith('/api/')) {
    return new Response('API endpoint not implemented', { status: 501 });
  }

  // For all other requests, serve static files
  return context.env.ASSETS.fetch(request);
}
