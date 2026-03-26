Deno.serve(async () => {
  return new Response('"Hello from Edge Functions!"', {
    headers: { 'Content-Type': 'application/json' }
  })
})
