export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(`/api/v1${path}`,{...options,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...options.headers}});
  const body=await response.json().catch(()=>({message:'服务响应异常'}));
  if(!response.ok){const error=new Error(body.message||'请求未完成') as Error&{status:number};error.status=response.status;throw error;}
  return body as T;
}
export function errorMessage(e:unknown){return e instanceof Error?e.message:'操作未完成，请稍后重试';}
