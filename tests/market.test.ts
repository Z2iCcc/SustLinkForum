import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed,ME } from '../src/seed.ts';
import { addReply,validState } from '../src/store.ts';
import { addMarketExamples,setMarketPolicy,canComment } from '../src/market/model.ts';
import { startConversation,sendChat } from '../src/messaging/model.ts';
test('market fixtures preserve old content, are idempotent and round-trip',()=>{
 const base=createSeed(),state=addMarketExamples(base);
 assert.equal(state.topics.length,base.topics.length+24);
 assert.deepEqual(state.topics.slice(0,base.topics.length),base.topics);
 assert.equal(addMarketExamples(state).topics.length,state.topics.length);
 assert.ok(validState(JSON.parse(JSON.stringify(state))));
});
test('public comment policy applies to direct writes, seller may change only own product',()=>{
 let state={...addMarketExamples(createSeed()),loggedIn:true};
 const closed=state.topics.find(t=>t.id==='market-demo-1')!;
 assert.equal(canComment(closed,ME),false);
 assert.throws(()=>addReply(state,closed.id,'测试留言'),/关闭公开留言/);
 assert.throws(()=>setMarketPolicy(state,closed.id,'everyone'),/只有卖家/);
 state=setMarketPolicy(state,'market-demo-6','seller');
 assert.equal(addReply(state,'market-demo-6','卖家补充说明').replies.length,state.replies.length+1);
 assert.ok(validState(state));
});
test('conversations do not auto-send; duplicate sends are idempotent; draft and history persist',()=>{
 let state={...addMarketExamples(createSeed()),loggedIn:true};
 const topic=state.topics.find(t=>t.id==='market-demo-0')!;
 state=startConversation(state,topic);
 assert.equal(state.conversations![0].messages.length,0);
 assert.equal(startConversation(state,topic).conversations!.length,1);
 assert.throws(()=>startConversation(state,state.topics.find(t=>t.id==='market-demo-6')!),/自己/);
 state=sendChat(state,topic.id,'还在吗','one');
 assert.equal(sendChat(state,topic.id,'还在吗','one').conversations![0].messages.length,1);
 assert.ok(validState(JSON.parse(JSON.stringify(state))));
 const removed={...state,topics:state.topics.filter(t=>t.id!==topic.id)};
 assert.equal(removed.conversations![0].messages[0].body,'还在吗');
 assert.throws(()=>sendChat(removed,topic.id,'测试','two'),/不可查看/);
});
