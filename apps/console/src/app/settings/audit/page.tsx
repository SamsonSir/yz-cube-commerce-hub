"use client";
import {useEffect,useState} from 'react';
import {Shell} from '@/components/shell';
import {api,errorMessage} from '@/lib/api';
type Log={id:string;action:string;target:string;result:string;createdAt:string};
const names:Record<string,string>={AUTH_START:'发起店铺授权',AUTH_COMPLETE:'处理授权回调',SHOP_VERIFY:'读取店铺信息',TOKEN_REFRESH:'续期访问凭据'};
export default function Audit(){const [email,setEmail]=useState(''),[rows,setRows]=useState<Log[]>([]),[error,setError]=useState('');useEffect(()=>{(async()=>{try{const me=await api<{email:string}>('/auth/me');setEmail(me.email);setRows(await api<Log[]>('/audit-logs'));}catch(e){if((e as {status?:number}).status===401)window.location.replace('/login');else setError(errorMessage(e));}})();},[]);return <Shell email={email} active="audit"><section className="card query-card"><h1>授权操作记录</h1><p className="muted">最近50条授权、验证及续期记录。不包含授权码、密钥或Token。</p></section>{error&&<p className="error" role="alert">{error}</p>}<section className="card table-scroll"><table><thead><tr><th>时间</th><th>操作</th><th>对象</th><th>结果</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString('zh-CN')}</td><td>{names[r.action]||r.action}</td><td className="mono">{r.target}</td><td>{r.result}</td></tr>)}</tbody></table>{!rows.length&&<div className="empty">暂无授权操作记录</div>}</section></Shell>}
