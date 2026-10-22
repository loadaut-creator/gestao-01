interface CanonicalEnv { CANONICAL_HOST?:string }
export const onRequest:PagesFunction<CanonicalEnv> = async ({request,env,next})=>{
  const url=new URL(request.url);
  if(env.CANONICAL_HOST && url.hostname===`www.${env.CANONICAL_HOST}`) {
    url.hostname=env.CANONICAL_HOST;url.protocol="https:";return Response.redirect(url.toString(),308);
  }
  const response=await next();
  if(url.pathname.startsWith("/api/"))response.headers.set("Cache-Control","no-store");
  return response;
};
