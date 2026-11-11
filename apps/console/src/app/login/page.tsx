"use client";
import {useState,type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {api,errorMessage} from '@/lib/api';
export default function Login(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);try{const result=await api<{home?:string}>('/auth/login',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});window.location.assign(result.home==='/developer'?'/developer':'/channels/shops');}catch(e){setError(errorMessage(e));setBusy(false);}}
 return <main className="login"><section className="login-brand"><img src="/brand/yz_cube_logo.png" alt="颜值立方"/><p>YZ GROUP · OPERATIONS</p><h1>连接店铺，<br/>从真实数据开始。</h1><p>跨境电商运营中台</p></section><section className="login-form card"><span className="eyebrow">颜值立方 · 运营中台</span><h2>登录运营中台</h2><p className="muted">使用中台账号登录。虾皮密码只在虾皮页面输入。</p><form onSubmit={submit}><label>邮箱<input name="email" type="email" autoComplete="username" required placeholder="管理员邮箱"/></label><label>密码<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>{error&&<p role="alert" className="error">{error}</p>}<Button type="submit" disabled={busy}>{busy?'正在登录…':'登录'}</Button></form></section></main>;
}
