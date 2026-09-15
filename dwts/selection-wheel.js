
'use strict';
const SELECTION_KEY='dwts-bux-selection-v1';
const selectionColors={jackson:'#f7f3ea',colton:'#ef5750',payton:'#f5a623',mattie:'#7fa8ff',jessica:'#42b883',squid:'#c783f4'};
const q=id=>document.getElementById(id),escapeSelection=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let participants=[],tickets=[],rotation=0,busy=false,session={order:[],pending:false},ready=false;
function randomBelow(n){
 if(!Number.isSafeInteger(n)||n<1||n>4294967296)throw Error('Invalid ticket count.');
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure randomness is unavailable in this browser.');
 const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;
 do{crypto.getRandomValues(a)}while(a[0]>=limit);
 return a[0]%n;
}
function makeTickets(owners,order,random=randomBelow){
 const excluded=new Set(order.map(x=>x.ownerId)),list=[];
 for(const owner of owners){
  if(!Number.isSafeInteger(owner.bux)||owner.bux<0)throw Error('Every Bux balance must be a nonnegative whole number.');
  if(!excluded.has(owner.id))for(let i=0;i<owner.bux;i++)list.push(owner.id);
 }
 if(list.length>100000)throw Error('Too many tickets to display safely.');
 for(let i=list.length-1;i>0;i--){const j=random(i+1);[list[i],list[j]]=[list[j],list[i]];}
 return list;
}
function saveSession(){localStorage.setItem(SELECTION_KEY,JSON.stringify(session));}
async function refreshBalances(){
 const response=await fetch('league-data.json',{cache:'no-store'});
 if(!response.ok)throw Error('Could not refresh official balances. No spin was made.');
 const data=await response.json();
 participants=data.owners.map(o=>({id:o.id,name:o.name,bux:Number(o.bux)}));
 if(new Set(participants.map(o=>o.id)).size!==participants.length)throw Error('Duplicate participant IDs.');
 tickets=makeTickets(participants,session.order);
}
function draw(){
 const canvas=q('selectionCanvas'),ctx=canvas.getContext('2d'),size=canvas.width,c=size/2,r=c-12,n=tickets.length;
 ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);ctx.rotate(rotation*Math.PI/180);
 if(n){for(let i=0;i<n;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*2*Math.PI/n-Math.PI/2,(i+1)*2*Math.PI/n-Math.PI/2);ctx.closePath();ctx.fillStyle=selectionColors[tickets[i]]||'#aaa';ctx.fill();}}
 else{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#261b31';ctx.fill();}
 ctx.restore();ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.strokeStyle='#fff0bd';ctx.lineWidth=5;ctx.stroke();
}
function render(){
 const selected=new Set(session.order.map(x=>x.ownerId)),total=tickets.length;
 q('ticketTotal').textContent=total+' tickets remaining';
 q('selectionChances').innerHTML=participants.map(o=>'<div class="chance-row'+(selected.has(o.id)?' selected':'')+'" style="--participant-color:'+selectionColors[o.id]+'"><div><strong>'+escapeSelection(o.name)+'</strong><small>'+o.bux+' Bux'+(selected.has(o.id)?' · already selected':o.bux===0?' · no tickets':'')+'</small></div><b>'+(selected.has(o.id)?'Removed':((total?o.bux/total*100:0).toFixed(2))+'%')+'</b></div>').join('');
 q('selectionOrder').innerHTML=session.order.map((p,i)=>'<li><strong>'+escapeSelection(p.name)+'</strong> — pick '+(i+1)+'<br><small>'+p.tickets+' of '+p.total+' tickets at selection</small></li>').join('');
 q('selectionSpin').disabled=busy||session.pending||!total||!ready;
 q('selectionSpin').textContent=busy?'SPINNING':!total?'DONE':'CLICK TO SPIN';
 q('nextSelection').hidden=!session.pending||busy;
}
function showPending(){
 const winner=session.order[session.order.length-1];
 q('selectionResult').textContent=winner.name+' gets pick #'+session.order.length+'!';
 q('selectionStatus').textContent='All '+winner.tickets+' of '+winner.name+'’s tickets are removed. Make the dancer selection, then continue.';
}
async function spinSelection(){
 if(busy||session.pending||!ready)return;
 busy=true;render();q('selectionResult').textContent='';q('selectionStatus').textContent='Refreshing official balances…';
 try{
  await refreshBalances();rotation=0;draw();
  if(!tickets.length){busy=false;render();q('selectionStatus').textContent='No eligible tickets remain.';return;}
  const index=randomBelow(tickets.length),owner=participants.find(o=>o.id===tickets[index]),target=360*7+(360-(index+.5)*360/tickets.length);
  const previous=session;
  session={...session,order:[...session.order,{ownerId:owner.id,name:owner.name,tickets:owner.bux,total:tickets.length,createdAt:new Date().toISOString()}],pending:true};
  try{saveSession();}catch(error){session=previous;throw Error('Could not save this result. Enable browser storage before spinning.');}
  q('selectionStatus').textContent='The wheel is spinning…';
  const start=performance.now(),duration=6500;
  function animate(now){const t=Math.min(1,(now-start)/duration);rotation=target*(1-Math.pow(1-t,5));draw();if(t<1)requestAnimationFrame(animate);else{q('selectionResult').textContent=owner.name+'!';setTimeout(()=>{tickets=makeTickets(participants,session.order);rotation=0;busy=false;draw();render();showPending();},1000);}}
  requestAnimationFrame(animate);
 }catch(error){busy=false;ready=false;render();q('selectionStatus').textContent=error.message+' Reload to retry.';}
}
async function continueSelection(){
 if(busy)return;
 try{session.pending=false;saveSession();await refreshBalances();rotation=0;draw();render();q('selectionResult').textContent='';q('selectionStatus').textContent=tickets.length?'Ready for the next selection.':'Selection complete for everyone with tickets. Zero-Bux participants have no wheel chances.';}
 catch(error){ready=false;render();q('selectionStatus').textContent=error.message;}
}
async function initSelection(){
 try{
 const saved=localStorage.getItem(SELECTION_KEY);
 if(saved){session=JSON.parse(saved);if(!Array.isArray(session.order)||new Set(session.order.map(x=>x.ownerId)).size!==session.order.length)throw Error('Saved selection data is invalid. Use Commissioner controls to start a new round.');}
 await refreshBalances();ready=true;draw();render();
 if(session.pending)showPending();else q('selectionStatus').textContent='Each colored sliver is one ticket. The pointer chooses one uniformly at random.';
 }catch(error){q('selectionStatus').textContent=error.message;q('selectionSpin').disabled=true;}
}
q('selectionSpin').addEventListener('click',spinSelection);q('nextSelection').addEventListener('click',continueSelection);initSelection();
