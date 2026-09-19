import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { useForum } from '../context';
import { ME } from '../seed';
import { MarketImage } from '../market/Market';
import { priceLabel } from '../market/model';
import { startConversation, sendChat } from './model';
import { readingScrollY } from '../scroll';

export function ConversationList(){
 const {state}=useForum();
 const conversations=[...(state.conversations??[])].sort((a,b)=>(b.messages.at(-1)?.createdAt??0)-(a.messages.at(-1)?.createdAt??0));
 return <section className="market-conversations"><h2><MessageCircle size={19}/>私聊 <small>本地演示</small></h2>{conversations.length?conversations.map(c=>{const seller=state.users.find(u=>u.id===c.sellerId);const unread=c.messages.filter(m=>m.authorId!==ME&&m.createdAt>c.readAt).length;return <Link key={c.topicId} to={'/messages/chat/'+c.topicId}><strong>{seller?.name??'卖家'}{unread>0&&<span className="chat-unread">{unread}</span>}</strong><span>{state.topics.find(t=>t.id===c.topicId)?.title??c.title}</span><p>{c.draft?'[草稿] '+c.draft:c.messages.at(-1)?.body??'还没有发送消息'}</p></Link>}):<p>在商品详情点击「聊一聊」，即可开始一段会话。</p>}</section>;
}
export function ChatPage(){
 const {id=''}=useParams();const {state,update,login,storageWarning}=useForum();const location=useLocation();const navigate=useNavigate();
 const topic=state.topics.find(t=>t.id===id),chat=state.conversations?.find(c=>c.topicId===id);
 const history=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
 useEffect(()=>{if(state.loggedIn&&topic&&topic.authorId!==ME&&!chat)update(s=>startConversation(s,topic))},[id,state.loggedIn,!!chat]);
 useEffect(()=>{if(chat&&state.loggedIn&&chat.messages.some(m=>m.createdAt>chat.readAt))update(s=>({...s,conversations:s.conversations?.map(c=>c.topicId===id?{...c,readAt:Date.now()}:c)}))},[id,chat?.messages.length,state.loggedIn]);
 useEffect(()=>{const element=history.current;if(!element)return;let position:number|undefined;try{const stored=sessionStorage.getItem('market-chat-position:'+id);if(stored!==null)position=Number(stored)}catch{}element.scrollTop=position??element.scrollHeight;},[id,!!chat]);
 function send(simulate=false){setError('');try{
   const body=simulate?'【演示回复】你好，物品还在，具体情况可以继续询问。':chat?.draft??'';
   let success=false;const ok=update(s=>{const next=sendChat(s,id,body,crypto.randomUUID(),simulate);success=true;return next},{requirePersistence:true});
   if(ok&&success)requestAnimationFrame(()=>{if(history.current)history.current.scrollTop=history.current.scrollHeight});else setError('未能保存，请检查存储后重试，输入内容已保留。');
 }catch(e){setError(e instanceof Error?e.message:'发送失败，请重试')}}
 if(!state.loggedIn)return <section className="content-panel chat-login"><h1>聊一聊</h1><p>登录演示账号后查看本机聊天记录。</p><button className="primary" onClick={login}>演示登录</button></section>;
 if(topic?.authorId===ME)return <section className="content-panel chat-login"><p>这是你发布的商品，无需与自己聊天。</p><Link to={'/topic/'+id}>返回商品</Link></section>;
 if(!chat)return <section className="content-panel chat-login"><p>{topic?'正在打开会话…':'商品已不可查看，无法创建会话。'}</p><Link to="/messages">返回消息</Link></section>;
 const seller=state.users.find(u=>u.id===chat.sellerId);
 return <><Link className="breadcrumb" to="/messages"><ArrowLeft size={14}/>消息</Link><section className="content-panel market-chat"><header className="chat-heading"><h1>{seller?.name??'卖家'}</h1><p>私聊演示 · 消息仅保存在本浏览器，不会发送给对方</p></header>
 {topic?<Link className="chat-product" to={'/topic/'+id} onClick={e=>{if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate('/topic/'+id,{state:{chatReturn:{path:location.pathname,y:readingScrollY()},restoreScroll:location.state?.restoreTopicY??0}})}}}><div><MarketImage topic={topic}/></div><span><strong>{topic.title}</strong><small>{priceLabel(topic)} · {topic.market?.status==='sold'?'已售出':topic.market?.status==='withdrawn'?'已下架':'查看商品详情'} ↗</small></span></Link>:<div className="chat-product unavailable"><span><strong>{chat.title}</strong><small>商品已不可查看，已有聊天记录仍保留。</small></span></div>}
 <div className="chat-history" ref={history} role="log" tabIndex={0} aria-label="聊天记录" onScroll={e=>{try{sessionStorage.setItem('market-chat-position:'+id,String(e.currentTarget.scrollTop))}catch{}}}>{!chat.messages.length&&<p className="chat-empty">先和卖家打个招呼吧。</p>}{chat.messages.map(m=><div className={`chat-message ${m.authorId===ME?'mine':''}`} key={m.id}><span>{m.authorId===ME?'我':seller?.name??'卖家'} · {new Date(m.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span><p>{m.body}</p><small>本机已保存</small></div>)}</div>
 <form className="chat-composer" onSubmit={e=>{e.preventDefault();send()}}><label htmlFor="chat-input">消息</label><textarea id="chat-input" placeholder="输入消息…" maxLength={3000} disabled={!topic} value={chat.draft} onChange={e=>{setError('');const draft=e.target.value;update(s=>({...s,conversations:s.conversations?.map(c=>c.topicId===id?{...c,draft}:c)}))}}/>{(error||storageWarning)&&<p className="form-error" role="alert">{error||storageWarning}</p>}<div><button type="button" className="text-button" disabled={!topic} onClick={()=>send(true)}>模拟卖家回复</button><button className="primary" disabled={!topic||!chat.draft.trim()}><Send size={15}/>发送</button></div></form></section></>;
}
