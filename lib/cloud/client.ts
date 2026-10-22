import type { Employee } from "../team/model";
import type { MonthlyGoal } from "../goals/model";
import type { MappingTemplate } from "../bi/model";
import type { Resource } from "./validation";
export type CloudSession={mode:"local"|"cloud";email?:string;role?:"admin"|"manager"|"viewer"};
export const cloud:{session:CloudSession;data:{employees:Employee[];goals:MonthlyGoal[];templates:MappingTemplate[];users:{email:string;role:string;active:boolean}[]};versions:Record<string,number>}={session:{mode:"local"},data:{employees:[],goals:[],templates:[],users:[]},versions:{}};
export const isCloud=()=>cloud.session.mode==="cloud";
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/${path}`,{...options,credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(30000),headers:{"Content-Type":"application/json",...options.headers}});
  if(!response.headers.get("content-type")?.includes("application/json")) throw new Error("Não foi possível acessar o serviço. Entre novamente ou confira a configuração.");
  const data=await response.json();
  if(!response.ok) throw new Error((data as {error?:string}).error||"Não foi possível salvar. Tente novamente.");
  return data as T;
}
export async function refreshCloud() {
  const state=await api<{data:Partial<typeof cloud.data>;versions:Record<string,number>}>("state");
  // Never move a revision backwards when a refresh overlaps a confirmed write.
  for(const key of ["employees","goals","templates","users"] as const) {
    const version=state.versions[key]||0;
    if(version >= (cloud.versions[key]||0) && state.data[key]) {
      Object.assign(cloud.data,{[key]:state.data[key]}); cloud.versions[key]=version;
    }
  }
  for(const event of ["visao308:employees-changed","visao308:goals-changed","visao308:templates-changed"]) window.dispatchEvent(new Event(event));
}
export async function saveCloud(resource:Resource,data:unknown) {
  const result=await api<{version:number}>(resource,{method:"PUT",body:JSON.stringify({version:cloud.versions[resource]||0,data})});
  Object.assign(cloud.data,{[resource]:data});cloud.versions[resource]=result.version;
}
export async function bootstrapCloud() {
  try { cloud.session=await api<CloudSession>("session"); }
  catch(error) { if(["localhost","127.0.0.1"].includes(location.hostname)){cloud.session={mode:"local"};return;} throw error; }
  if(isCloud()) await refreshCloud();
}
