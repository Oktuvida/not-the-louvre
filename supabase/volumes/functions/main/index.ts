import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

console.log('main function started')

const JWT_SECRET = Deno.env.get('JWT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const VERIFY_JWT = Deno.env.get('VERIFY_JWT') === 'true'

let supabaseJwtKeys: ReturnType<typeof jose.createRemoteJWKSet> | null = null
if (SUPABASE_URL) {
  try {
    supabaseJwtKeys = jose.createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', SUPABASE_URL))
  } catch (error) {
    console.error('Failed to fetch JWKS from SUPABASE_URL:', error)
  }
}

function getAuthToken(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) throw new Error('Missing authorization header')
  const [bearer, token] = authHeader.split(' ')
  if (bearer !== 'Bearer') throw new Error("Auth header is not 'Bearer {token}'")
  return token
}

async function isValidLegacyJwt(jwt: string) {
  if (!JWT_SECRET) return false

  try {
    await jose.jwtVerify(jwt, new TextEncoder().encode(JWT_SECRET))
    return true
  } catch (error) {
    console.error('Symmetric legacy JWT verification error', error)
    return false
  }
}

async function isValidAsymmetricJwt(jwt: string) {
  if (!supabaseJwtKeys) return false

  try {
    await jose.jwtVerify(jwt, supabaseJwtKeys)
    return true
  } catch (error) {
    console.error('Asymmetric JWT verification error', error)
    return false
  }
}

async function isValidHybridJwt(jwt: string) {
  const { alg } = jose.decodeProtectedHeader(jwt)

  if (alg === 'HS256') return isValidLegacyJwt(jwt)
  if (alg === 'ES256' || alg === 'RS256') return isValidAsymmetricJwt(jwt)
  return false
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'OPTIONS' && VERIFY_JWT) {
    try {
      const token = getAuthToken(req)
      const valid = await isValidHybridJwt(token)
      if (!valid) {
        return new Response(JSON.stringify({ msg: 'Invalid JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    } catch (error) {
      return new Response(JSON.stringify({ msg: String(error) }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  const url = new URL(req.url)
  const serviceName = url.pathname.split('/')[1]

  if (!serviceName) {
    return new Response(JSON.stringify({ msg: 'missing function name in request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const worker = await EdgeRuntime.userWorkers.create({
    servicePath: `/home/deno/functions/${serviceName}`,
    memoryLimitMb: 150,
    workerTimeoutMs: 60 * 1000,
    noModuleCache: false,
    importMapPath: null,
    envVars: Object.entries(Deno.env.toObject())
  })

  return worker.fetch(req)
})
