import { useState } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, SlidersHorizontal, MessageCircle } from 'lucide-react';
import { useForum } from '../context';
import { ME } from '../seed';
import type { Topic } from '../types';
import { useAssetUrl, Attachments } from '../Media';
import { Avatar, PostBody } from '../components';
import { TopicLink } from '../TopicLink';
import { marketCategories } from '../publishing/model';
import { addMarketExamples, marketPrice, priceLabel, setMarketPolicy } from './model';
import campus from '../illustrations/campus.svg';
import { readingScrollY } from '../scroll';
import { listOriginFrom } from '../navigation';
import { TopicReactions } from '../DetailActions';

export function MarketImage({topic}: {topic:Topic}) {
  const attachment=topic.attachments?.find(a=>a.kind==='image');
  const asset=useAssetUrl(attachment?.id);
  const src=attachment?asset.url:topic.market?.demoImage;
  return src?<img src={src} alt={topic.title} />:<span className="market-no-image"><ShoppingBag size={32}/><span>{asset.error?'图片暂不可用':topic.publishing?.mode==='wanted'?'求购':'暂无图片'}</span></span>;
}
export function MarketHome() {
  const {state,update}=useForum();
  const [params,setParams]=useSearchParams();
  const [open,setOpen]=useState(false);
  const mode=params.get('mode')==='wanted'?'wanted':'sale',category=params.get('category')||'',sort=params.get('price')||'',query=params.get('q')||'';
  function filter(key:string,value:string){const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);setParams(next,{replace:true,state:{restoreScroll:readingScrollY()}})}
  const topics=state.topics.filter(t=>t.boardId==='market'&&(!t.market?.status||t.market.status==='active')&&(t.publishing?.mode??'sale')===mode&&(!category||t.publishing?.category===category)&&(!query||`${t.title} ${t.body}`.includes(query)));
  if(sort)topics.sort((a,b)=>{const x=marketPrice(a),y=marketPrice(b);return x===undefined?y===undefined?0:1:y===undefined?-1:sort==='asc'?x-y:y-x});
  return <div className="market-page">
    <div className="forum-banner board-banner"><div><p className="eyebrow">FIND YOUR PEOPLE</p><h1>跳蚤市场</h1><p>让闲置继续有用，也找到刚好需要的东西。</p></div><img src={campus} alt=""/></div>
    <section className="market-filters" aria-label="商品筛选"><div className="market-toolbar"><div className="market-tabs">{[['sale','在售'],['wanted','求购']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>filter('mode',id)}>{label}</button>)}</div><button className="market-category-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><SlidersHorizontal size={14}/>分类</button></div>
      {open&&<div className="market-category-row"><div>{['',...marketCategories].map(c=><button key={c} aria-pressed={category===c} onClick={()=>filter('category',c)}>{c||'全部'}</button>)}</div><button className="market-price-sort" data-sort={sort} aria-label={`价格${sort==='asc'?'升序':sort==='desc'?'降序':'未排序'}，点击${sort==='asc'?'降序':sort==='desc'?'取消排序':'升序'}`} onClick={()=>filter('price',sort===''?'asc':sort==='asc'?'desc':'')}>价格<svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path className="up" d="m3 7 4-4 4 4"/><path className="down" d="m3 11 4 4 4-4"/></svg></button></div>}
      <label className="market-search"><span>搜索商品</span><input aria-label="搜索商品" placeholder="搜索你需要的闲置…" value={query} onChange={e=>filter('q',e.target.value)}/></label>
    </section>
    <div className={mode==='wanted'?'market-wanted-list':'market-grid'}>{topics.map(topic=>{const author=state.users.find(u=>u.id===topic.authorId)!;return <article className="market-card" key={topic.id} data-product={topic.id}><TopicLink className="market-product-link" to={'/topic/'+topic.id}>{mode!=='wanted'&&<div className="market-photo"><MarketImage topic={topic}/></div>}<h2>{topic.title}</h2>{mode!=='wanted'&&<div className="market-price-row"><strong>{priceLabel(topic)}</strong></div>}</TopicLink><div className="market-byline">{mode!=='wanted'&&<Avatar name={author.name} color={author.color} avatarId={author.avatarId}/>}<span className="market-author-name">{author.name}</span><span className="market-save-count">{(topic.market?.baseSaves??0)+Number(state.saves.includes(topic.id))} 已收藏</span></div></article>})}</div>
    {!topics.length&&<p className="market-empty">暂时没有符合条件的商品，可以换个分类或关键词。</p>}
    <div className="market-preview-note"><span>当前为本浏览器演示，私聊不会发送给其他人。</span>{!state.topics.some(t=>t.id==='market-demo-0')&&<button onClick={()=>update(addMarketExamples)}>加载 24 件示例商品</button>}</div>
  </div>;
}
export function MarketDetailContent({topic}:{topic:Topic}) {
  return <><div className="market-detail-price">{priceLabel(topic)}{topic.market?.status&&topic.market.status!=='active'&&<small>{topic.market.status==='sold'?'已售出':'已下架'}</small>}</div>{topic.market?.demoImage&&<div className="market-detail-photo"><MarketImage topic={topic}/></div>}<Attachments items={topic.attachments}/><PostBody body={topic.body}/><p className="market-handover">{[topic.publishing?.place,topic.publishing?.handover,topic.publishing?.negotiable?'可议价':''].filter(Boolean).join(' · ')}</p></>;
}
export function MarketActions({topic}:{topic:Topic}) {
  const {state,update,requireLogin}=useForum();const location=useLocation();const navigate=useNavigate();
  return <div className="market-detail-actions"><div className="post-actions detail-reactions"><TopicReactions topic={topic}/></div>{topic.authorId!==ME?<Link className="market-chat-link" to={'/messages/chat/'+topic.id} onClick={e=>{if(!requireLogin()){e.preventDefault();return}if(e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate('/messages/chat/'+topic.id,{state:{listOrigin:listOriginFrom(location),restoreTopicY:readingScrollY()}})}}}><MessageCircle size={16}/>聊一聊</Link>:state.loggedIn&&<fieldset className="market-policy" aria-label="留言权限">{[['everyone','所有人可留言'],['seller','仅卖家可留言']].map(([value,label])=><label key={value}><input type="radio" name="market-policy" checked={(topic.market?.commentPolicy??topic.publishing?.commentPolicy??'everyone')===value} onChange={()=>update(s=>setMarketPolicy(s,topic.id,value as 'everyone'|'seller'))}/>{label}</label>)}</fieldset>}</div>;
}
