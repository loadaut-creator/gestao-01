export type CloudEnv = { DB:D1Database; ACCESS_TEAM_DOMAIN:string; ACCESS_AUD:string; ADMIN_EMAIL:string; STORE_ID?:string; CLOUD_ENABLED?:string };
let keys: {host:string;expires:number;keys:(JsonWebKey & {kid?:string})[]} | undefined;
const decode=(part:string)=>Uint8Array.from(atob(part.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
export async function authenticate(request:Request,env:CloudEnv) {
  if(!env.DB || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) throw new Response("Configure o banco e o login na Cloudflare.",{status:503});
  const host=env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//,"").replace(/\/$/,"");
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(host)) throw new Response("Configuração de login inválida.",{status:503});
  const token=request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token) throw new Response("Entre com seu e-mail autorizado.",{status:401});
  try {
    const parts=token.split("."); if(parts.length!==3) throw Error();
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if(header.alg!=="RS256" || typeof header.kid!=="string") throw Error();
    if(!keys || keys.host!==host || keys.expires<Date.now() || !keys.keys.some(key=>key.kid===header.kid)) {
      const response=await fetch(`https://${host}/cdn-cgi/access/certs`);
      if(!response.ok) throw Error();
      const jwks=await response.json() as {keys:(JsonWebKey & {kid?:string})[]};
      keys={host,keys:jwks.keys,expires:Date.now()+300000};
    }
    const jwk=keys.keys.find(key=>key.kid===header.kid); if(!jwk) throw Error();
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw Error();
    const now=Date.now()/1000;
    if(claims.iss!==`https://${host}` || !Number.isFinite(claims.exp) || claims.exp<=now || !Number.isFinite(claims.iat) || claims.iat>now+60 || (claims.nbf && claims.nbf>now+60) || !(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD) || typeof claims.email!=="string") throw Error();
    return claims.email.toLowerCase() as string;
  } catch { throw new Response("Sessão inválida ou expirada. Entre novamente.",{status:401}); }
}
