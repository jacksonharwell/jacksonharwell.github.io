'use strict';
const SELECTION_KEY='dwts-bux-selection-v1';
const selectionColors={jackson:'#f7f3ea',colton:'#ef5750',payton:'#f5a623',mattie:'#7fa8ff',jessica:'#42b883',squid:'#c783f4'};
const q=id=>document.getElementById(id),escapeSelection=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let participants=[],dancers=[],tickets=[],rotation=0,busy=false,session={order:[],pending:false,round:1},ready=false;

function randomBelow(n){
 if(!Number.isSafeInteger(n)||n<1||n>4294967296)throw Error('Invalid ticket count.');
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure randomness is unavailable in this browser.');
 const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;
 do{crypto.getRandomValues(a)}while(a[0]>=limit);
 return a[0]%n;
}
function activeDancers(){return dancers.filter(d=>d.status!=='eliminated'&&d.status!=='withdrawn');}
function chosenDancerIds(){return new Set(session.order.map(x=>x.dancerId).filter(Boolean));}
function availableDancers(){const chosen=chosenDancerIds();return activeDancers().filter(d=>!chosen.has(d.id));}
function selectedOwners(round=session.round){return new Set(session.order.filter(x=>Number(x.round||1)===round).map(x=>x.ownerId));}
function makeTickets(owners,order,round,random=randomBelow){
 const excluded=new Set(order.filter(x=>Number(x.round||1)===round).map(x=>x.ownerId)),list=[];
 for(const owner of owners){
  if(!Number.isSafeInteger(owner.bux)||owner.bux<0)throw Error('Every Bux balance must be a nonnegative whole number.');
  if(!excluded.has(owner.id))for(let i=0;i<owner.bux;i++)list.push(owner.id);
 }
 if(list.length>100000)throw Error('Too many tickets to display safely.');
 for(let i=list.length-1;i>0;i--){const j=random(i+1);[list[i],list[j]]=[list[j],list[i]];}
 return list;
}
function normalizeSession(raw){
 const order=Array.isArray(raw?.order)?raw.order.map((x,i)=>({
  ownerId:String(x.ownerId||''),
  name:String(x.name||''),
  tickets:Number(x.tickets)||0,
  total:Number(x.total)||0,
  round:Number.isInteger(Number(x.round))&&Number(x.round)>0?Number(x.round):1,
  dancerId:x.dancerId?String(x.dancerId):null,
  dancerName:x.dancerName?String(x.dancerName):null,
  proName:x.proName?String(x.proName):null,
  createdAt:x.createdAt||new Date().toISOString(),
  selectedAt:x.selectedAt||null,
  pickNumber:Number(x.pickNumber)||i+1
 })): [];
 return {order,pending:!!raw?.pending,round:Number.isInteger(Number(raw?.round))&&Number(raw.round)>0?Number(raw.round):1};
}
function saveSession(){localStorage.setItem(SELECTION_KEY,JSON.stringify(session));}
async function refreshBalances(){
 const response=await fetch('league-data.json',{cache:'no-store'});
 if(!response.ok)throw Error('Could not refresh official balances. No spin was made.');
 const data=await response.json();
 participants=data.owners.map(o=>({id:o.id,name:o.name,bux:Number(o.bux)}));
 dancers=data.dancers.map(d=>({...d}));
 if(new Set(participants.map(o=>o.id)).size!==participants.length)throw Error('Duplicate participant IDs.');
 if(new Set(activeDancers().map(d=>d.id)).size!==activeDancers().length)throw Error('Duplicate dancer IDs.');
 tickets=makeTickets(participants,session.order,session.round);
}
function advanceRoundIfNeeded(){
 if(session.pending)return false;
 session.round=1;
 tickets=makeTickets(participants,session.order,1);
 return false;
}
function draw(){
 const canvas=q('selectionCanvas'),ctx=canvas.getContext('2d'),size=canvas.width,c=size/2,r=c-12,n=tickets.length;
 ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);ctx.rotate(rotation*Math.PI/180);
 if(n){for(let i=0;i<n;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*2*Math.PI/n-Math.PI/2,(i+1)*2*Math.PI/n-Math.PI/2);ctx.closePath();ctx.fillStyle=selectionColors[tickets[i]]||'#aaa';ctx.fill();}}
 else{ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#261b31';ctx.fill();}
 ctx.restore();ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.strokeStyle='#fff0bd';ctx.lineWidth=5;ctx.stroke();
}
function render(){
 const selected=selectedOwners(),total=tickets.length,remaining=availableDancers().length;
 q('ticketTotal').textContent=total+' tickets remaining · one dancer each';
 q('selectionChances').innerHTML=participants.map(o=>'<div class="chance-row'+(selected.has(o.id)?' selected':'')+'" style="--participant-color:'+selectionColors[o.id]+'"><div><strong>'+escapeSelection(o.name)+'</strong><small>'+o.bux+' Bux'+(selected.has(o.id)?' · dancer selected':o.bux===0?' · no tickets':'')+'</small></div><b>'+(selected.has(o.id)?'Removed':((total?o.bux/total*100:0).toFixed(2))+'%')+'</b></div>').join('');
 q('selectionOrder').innerHTML=session.order.map((p,i)=>'<li><span class="pick-round">Pick '+(i+1)+'</span><strong>'+escapeSelection(p.name)+'</strong>'+(p.dancerName?'<span class="chosen-dancer">selected '+escapeSelection(p.dancerName)+(p.proName?' & '+escapeSelection(p.proName):'')+'</span>':'<span class="chosen-dancer waiting">choosing now…</span>')+'<small>'+p.tickets+' of '+p.total+' tickets at selection</small></li>').join('');
 q('selectionSpin').disabled=busy||session.pending||!total||!ready||!remaining;
 q('selectionSpin').textContent=busy?'SPINNING':session.pending?'PICK DANCER':!remaining||!total?'DONE':'CLICK TO SPIN';
 const lastOwner=!busy&&!session.pending&&ready&&remaining&&new Set(tickets).size===1?participants.find(o=>o.id===tickets[0]):null;
 const wheel=q('selectionSpin').closest('.selection-wheel');
 wheel.classList.toggle('last-pick-mode',!!lastOwner);
 if(lastOwner){
  wheel.style.setProperty('--last-owner-color',selectionColors[lastOwner.id]||'#fff0bd');
  q('selectionSpin').innerHTML='<span class="last-pick-eyebrow">LAST PICK</span><strong>'+escapeSelection(lastOwner.name)+'</strong><span class="last-pick-action">Choose your dancer →</span>';
 }
 const remainingNode=q('dancersRemaining');
 if(remainingNode)remainingNode.textContent=remaining+' dancer'+(remaining===1?'':'s')+' available';
}
function celebrate(name){
 const layer=q('confettiLayer');
 if(!layer)return;
 layer.innerHTML='';
 const nameBanner=document.createElement('div');
 nameBanner.className='confetti-name';
 nameBanner.setAttribute('aria-hidden','true');
 Array.from(name||'').forEach((letter,index)=>{
  const glyph=document.createElement('span');glyph.textContent=letter===' '?'\u00a0':letter;
  glyph.style.animationDelay=(index*.09)+'s';nameBanner.appendChild(glyph);
 });
 layer.appendChild(nameBanner);
 const colors=['#fff0bd','#ef5750','#f5a623','#7fa8ff','#42b883','#c783f4','#ffffff'];
 for(let i=0;i<90;i++){
  const bit=document.createElement('i');
  bit.style.left=(Math.random()*100)+'vw';
  bit.style.background=colors[i%colors.length];
  bit.style.animationDelay=(Math.random()*.55)+'s';
  bit.style.animationDuration=(2.1+Math.random()*1.7)+'s';
  bit.style.setProperty('--confetti-turn',(360+Math.floor(Math.random()*900))+'deg');
  bit.style.width=(6+Math.random()*8)+'px';
  bit.style.height=(9+Math.random()*13)+'px';
  layer.appendChild(bit);
 }
 window.setTimeout(()=>{layer.innerHTML='';},5200);
}
function renderDancerPicker(winner){
 const pool=availableDancers();
 q('pickerOwner').textContent=winner.name;
 q('pickerMeta').textContent='Pick #'+winner.pickNumber+' · '+pool.length+' dancers still available';
 q('pickerError').textContent='';
 q('dancerOptions').innerHTML=pool.map(d=>'<label class="dancer-option"><input type="radio" name="shakeupDancer" value="'+escapeSelection(d.id)+'"><span><strong>'+escapeSelection(d.name)+'</strong><small>'+escapeSelection(d.pro||'Pro TBD')+' · '+Number(d.seasonPoints||0)+' season pts · '+(d.avgScore==null?'—':Number(d.avgScore).toFixed(2))+' avg</small></span></label>').join('');
 q('recordDancerPick').disabled=true;
 q('dancerOptions').querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{q('recordDancerPick').disabled=false;q('pickerError').textContent='';}));
 q('dancerPicker').hidden=false;
 document.body.classList.add('modal-open');
}
function showPending(){
 const winner=session.order[session.order.length-1];
 if(!winner)return;
 q('selectionResult').textContent=winner.name+' gets pick #'+session.order.length+'!';
 q('selectionStatus').textContent='All '+winner.tickets+' of '+winner.name+'’s tickets are removed. Record the dancer choice to continue.';
 renderDancerPicker(winner);
}
async function spinSelection(){
 if(busy||session.pending||!ready||!availableDancers().length)return;
 busy=true;render();q('selectionResult').textContent='';q('selectionStatus').textContent='Refreshing official balances…';
 try{
  await refreshBalances();advanceRoundIfNeeded();rotation=0;draw();
  if(!tickets.length){busy=false;render();q('selectionStatus').textContent='No eligible tickets remain.';return;}
  const lastPick=new Set(tickets).size===1;
  const index=lastPick?0:randomBelow(tickets.length),owner=participants.find(o=>o.id===tickets[index]),target=360*10+(360-(index+.5)*360/tickets.length);
  const previous=structuredClone(session);
  session={...session,order:[...session.order,{ownerId:owner.id,name:owner.name,tickets:owner.bux,total:tickets.length,round:1,dancerId:null,dancerName:null,proName:null,pickNumber:session.order.length+1,createdAt:new Date().toISOString(),selectedAt:null}],pending:true};
  try{saveSession();}catch(error){session=previous;throw Error('Could not save this result. Enable browser storage before spinning.');}
  if(lastPick){
   busy=false;tickets=makeTickets(participants,session.order,session.round);
   rotation=0;draw();render();showPending();return;
  }
  q('selectionStatus').textContent='The wheel is spinning…';
  const start=performance.now(),duration=10500;
  function animate(now){
   const t=Math.min(1,(now-start)/duration);rotation=target*(1-Math.pow(1-t,3));draw();
   if(t<1)requestAnimationFrame(animate);
   else{
    q('selectionResult').textContent=owner.name+'!';
    celebrate(owner.name);
    window.setTimeout(()=>{busy=false;tickets=makeTickets(participants,session.order,session.round);rotation=0;draw();render();showPending();},3000);
   }
  }
  requestAnimationFrame(animate);
 }catch(error){busy=false;ready=false;render();q('selectionStatus').textContent=error.message+' Reload to retry.';}
}
async function recordDancerSelection(){
 if(busy||!session.pending)return;
 const checked=document.querySelector('input[name="shakeupDancer"]:checked');
 if(!checked){q('pickerError').textContent='Choose a dancer before recording the pick.';return;}
 const dancer=availableDancers().find(d=>d.id===checked.value),winner=session.order[session.order.length-1];
 if(!dancer||!winner){q('pickerError').textContent='That dancer is no longer available. Reload the menu and try again.';return;}
 const previous=structuredClone(session);
 winner.dancerId=dancer.id;winner.dancerName=dancer.name;winner.proName=dancer.pro||'';winner.selectedAt=new Date().toISOString();session.pending=false;
 try{saveSession();}catch(error){session=previous;q('pickerError').textContent='Could not save this pick. Enable browser storage and try again.';return;}
 q('dancerPicker').hidden=true;document.body.classList.remove('modal-open');
 q('selectionResult').textContent=winner.name+' selected '+dancer.name+'!';
 try{
  await refreshBalances();
  advanceRoundIfNeeded();
  rotation=0;draw();render();
  if(!tickets.length)q('selectionStatus').textContent='Shakeup selection complete. Every participant has one dancer; '+availableDancers().length+' surviving dancers remain unselected.';
  else q('selectionStatus').textContent=dancer.name+' is off the board. Ready for the next Bux-weighted spin.';
 }catch(error){ready=false;render();q('selectionStatus').textContent=error.message;}
}
function validateSession(){
 const ownerRound=new Set(),dancerIds=new Set();
 for(const entry of session.order){
  const key=Number(entry.round||1)+':'+entry.ownerId;
  if(ownerRound.has(key))throw Error('Saved selection data has the same participant twice in one round.');
  ownerRound.add(key);
  if(entry.dancerId){if(dancerIds.has(entry.dancerId))throw Error('Saved selection data contains a duplicate dancer.');dancerIds.add(entry.dancerId);}
 }
 if(session.pending){
  const last=session.order[session.order.length-1];
  if(!last||last.dancerId)throw Error('Saved pending selection data is invalid.');
 }
}
async function initSelection(){
 try{
  const saved=localStorage.getItem(SELECTION_KEY);
  let legacyReset=false;
  if(saved){
   const raw=JSON.parse(saved);
   if(Array.isArray(raw.order)&&raw.order.some(x=>!Object.prototype.hasOwnProperty.call(x,'dancerId')||Number(x.round||1)>1)){
    localStorage.setItem('dwts-bux-selection-backup-'+Date.now(),saved);
    session={order:[],pending:false,round:1};saveSession();legacyReset=true;
   }else session=normalizeSession(raw);
  }
  await refreshBalances();validateSession();advanceRoundIfNeeded();ready=true;draw();render();
  if(session.pending)showPending();
  else if(!tickets.length)q('selectionStatus').textContent='Shakeup selection complete. Every participant has one dancer; '+availableDancers().length+' surviving dancers remain unselected.';
  else q('selectionStatus').textContent=(legacyReset?'The earlier practice order was backed up and reset for dancer selection. ':'')+'Each colored sliver is one ticket. The pointer chooses one uniformly at random.';
 }catch(error){q('selectionStatus').textContent=error.message;q('selectionSpin').disabled=true;}
}
q('selectionSpin').addEventListener('click',spinSelection);
q('recordDancerPick').addEventListener('click',recordDancerSelection);
initSelection();
