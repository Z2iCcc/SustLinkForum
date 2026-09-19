const fs=require('node:fs');
function edit(file,fn){const old=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fn(old));}
function rep(text,a,b){if(!text.includes(a))throw new Error('Missing source: '+a.slice(0,100));return text.replace(a,b)}
edit('src/types.ts',s=>{
 s='import type { MarketData } from "./market/model";\nimport type { Conversation } from "./messaging/model";\n'+s;
 s=rep(s,'export interface Topic {','export interface Topic {\n  market?: MarketData;');
 return rep(s,'export interface ForumState {','export interface ForumState {\n  conversations?: Conversation[];');
});
edit('src/publishing/model.ts',s=>rep(s,'export interface PublishingData {','export interface PublishingData {\n  commentPolicy?: "everyone" | "seller";'));
edit('src/store.ts',s=>{
 s='import { canComment } from "./market/model.ts";\nimport { validConversations } from "./messaging/model.ts";\n'+s;
 s=rep(s,'s.version !== 1 ||','!validConversations(s.conversations) ||\n    s.version !== 1 ||');
 s=rep(s,'validPublishing(t.publishing, t.boardId),',`validPublishing(t.publishing, t.boardId) &&
        (!t.market || (
          (!t.market.commentPolicy || ["everyone", "seller"].includes(t.market.commentPolicy)) &&
          (!t.market.status || ["active", "withdrawn", "sold"].includes(t.market.status)) &&
          (t.market.demoImage === undefined || /^\\/market-demo\\/[a-z]+\\.jpg$/.test(t.market.demoImage)) &&
          (t.market.baseSaves === undefined || (num(t.market.baseSaves) && t.market.baseSaves >= 0))
        )),`);
 s=rep(s,'if (!topic) throw new Error("帖子不存在");','if (!topic) throw new Error("帖子不存在");\n  if (!canComment(topic, ME)) throw new Error("卖家已关闭公开留言，可通过聊一聊咨询");');
 return s;
});
edit('src/main.tsx',s=>{
 s='import { ChatPage } from "./messaging/Messaging";\nimport "./market/market.css";\n'+s;
 // Load scoped market styles after existing forum styles.
 s=s.replace('import "./market/market.css";\n','');
 s=rep(s,'import "./refinements.css";','import "./refinements.css";\nimport "./market/market.css";');
 return rep(s,'<Route path="/messages" element={<Messages />} />','<Route path="/messages" element={<Messages />} />\n            <Route path="/messages/chat/:id" element={<ChatPage />} />');
});
edit('src/pages.tsx',s=>{
 s='import { MarketHome, MarketDetailContent, MarketActions } from "./market/Market";\nimport { canComment } from "./market/model";\nimport { ConversationList } from "./messaging/Messaging";\n'+s;
 s=rep(s,'if (boardId && !board) return <NotFound />;','if (boardId && !board) return <NotFound />;\n  if (boardId === "market") return <MarketHome />;');
 s=rep(s,'const replies = state.replies.filter((r) => r.topicId === topic.id);','const isMarket = topic.boardId === "market";\n  const replyAllowed = canComment(topic, ME);\n  const chatReturn = location.state?.chatReturn;\n  const replies = state.replies.filter((r) => r.topicId === topic.id);');
 s=rep(s,'function quote(target: string) {\r\n    if (!requireLogin()) return;','function quote(target: string) {\r\n    if (!requireLogin() || !replyAllowed) return;');
 s=rep(s,'{hasOrigin ? (',`{chatReturn && typeof chatReturn.path === 'string' && /^\\/messages\\/chat\\/[^/]+$/.test(chatReturn.path) ? <Link className="breadcrumb compose-back" to={chatReturn.path} state={{restoreScroll:chatReturn.y??0}}><ArrowLeft size={14}/>返回聊天</Link> : hasOrigin ? (`);
 s=rep(s,'<article className="content-panel topic-detail">','<article className={`content-panel topic-detail ${isMarket ? "market-detail" : ""}`}>');
 s=rep(s,'<span className="author-badge">楼主</span>','<span className="author-badge">{isMarket ? "卖家" : "楼主"}</span>');
 s=rep(s,`<div className="post-body">{topic.body}</div>
          <Attachments items={topic.attachments} />`.replace(/\n/g,'\r\n'),`{isMarket ? <MarketDetailContent topic={topic}/> : <><div className="post-body">{topic.body}</div><Attachments items={topic.attachments} /></>}
          {isMarket && <MarketActions topic={topic}/>}`);
 s=rep(s,'className="post-actions">\r\n            <button','className="post-actions">\r\n            {!isMarket && <><button');
 s=rep(s,'{state.loggedIn && topic.authorId === ME && (','</>}\n            {state.loggedIn && topic.authorId === ME && (');
 s=rep(s,'回复 <span>{replies.length}</span>','{isMarket ? "留言" : "回复"} <span>{replies.length}</span>');
 s=rep(s,'只看楼主\r\n','{isMarket ? "只看卖家" : "只看楼主"}\r\n');
 s=rep(s,'onClick={() => quote(r.id)}','disabled={!replyAllowed}\n                  onClick={() => quote(r.id)}');
 s=rep(s,'<form className="reply-editor" onSubmit={submit}>','{replyAllowed ? <form className="reply-editor" onSubmit={submit}>');
 s=rep(s,'{topic.boardId === "tree" ? "留下一条匿名回复" : "加入这场讨论"}','{isMarket ? "向卖家留言" : topic.boardId === "tree" ? "留下一条匿名回复" : "加入这场讨论"}');
 s=rep(s,'</form>\r\n        <dialog\r\n          ref={deleteDialog}',`</form> : <p className="market-comments-closed">卖家已关闭公开留言，可通过「聊一聊」咨询。</p>}
        <dialog
          ref={deleteDialog}`);
 const start=s.indexOf('export function Messages()');
 s=s.slice(0,start)+rep(s.slice(start),'<section className="content-panel">','<section className="content-panel">\n      <ConversationList />');
 return s;
});
edit('src/publishing/BoardPublisher.tsx',s=>rep(s,'{p.board === "market" && (\r\n            <>','{p.board === "market" && (\r\n            <>\n              <fieldset className="market-publish-policy"><legend>留言权限</legend>{(["everyone", "seller"] as const).map(value=><label key={value}><input type="radio" name="publish-comment-policy" checked={(p.commentPolicy??"everyone")===value} onChange={()=>change({}, {commentPolicy:value})}/>{value==="everyone"?"所有人可留言":"仅卖家可留言"}</label>)}</fieldset>'));
edit('src/Shell.tsx',s=>{
 s=s.replace('useState, useRef, type FormEvent','useState, useRef, useEffect, type FormEvent');
 s=rep(s,'const unread = state.notices.filter((n) => !n.read).length;',`const unread = state.notices.filter((n) => !n.read).length + (state.conversations??[]).reduce((sum,c)=>sum+c.messages.filter(m=>m.authorId!==ME&&m.createdAt>c.readAt).length,0);`);
 s=rep(s,'function search(e: FormEvent) {',`const detailTopic = state.topics.find(t=>location.pathname==='/topic/'+t.id);
  const isMarket = board?.id==='market' || detailTopic?.boardId==='market' || location.pathname.startsWith('/messages/chat/');
  const shellRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!isMarket)return;
    const sidebars=shellRef.current?.querySelectorAll<HTMLElement>('.left-sidebar,.right-sidebar');
    const measure=()=>sidebars?.forEach(el=>el.style.setProperty('--sidebar-top',Math.min(104,window.innerHeight-el.offsetHeight-20)+'px'));
    const observer=new ResizeObserver(measure);sidebars?.forEach(el=>observer.observe(el));window.addEventListener('resize',measure);measure();
    return ()=>{observer.disconnect();window.removeEventListener('resize',measure)};
  },[isMarket]);
  function search(e: FormEvent) {`);
 s=rep(s,'<div className="forum-app">','<div className={`forum-app ${isMarket?"market-shell":""}`} ref={shellRef}>');
 s=rep(s,'const selectedBoard = board?.id ?? params.get("board") ?? "";','const selectedBoard = board?.id ?? detailTopic?.boardId ?? (isMarket?"market":null) ?? params.get("board") ?? "";');
 return rep(s,'发布新笔记\r\n          </button>','{isMarket ? "发布闲置" : "发布新笔记"}\r\n          </button>');
});
console.log('Integrated market routes, shared replies, permissions and messaging.');
