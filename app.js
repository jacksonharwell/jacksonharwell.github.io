const views=[...document.querySelectorAll('[data-view]')];
const drawer=document.querySelector('.drawer');
const toggle=document.querySelector('.menu-toggle');
function showView(name){
  const target=views.find(v=>v.dataset.view===name)||views[0];
  views.forEach(v=>v.classList.toggle('active',v===target));
  drawer.classList.remove('open');toggle.setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'instant'});
  document.title=(name==='home'?'The Wonky Donkey Drink Trailer':`${target.querySelector('h1')?.textContent.trim()||'Wonky Donkey'} | The Wonky Donkey`);
}
function route(){showView(location.hash.slice(1)||'home')}
window.addEventListener('hashchange',route);route();
toggle.addEventListener('click',()=>{const open=drawer.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open))});
document.addEventListener('click',e=>{if(drawer.classList.contains('open')&&!drawer.contains(e.target)&&!toggle.contains(e.target)){drawer.classList.remove('open');toggle.setAttribute('aria-expanded','false')}});
document.querySelectorAll('[data-vote]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-vote]').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');localStorage.setItem('wonky-flavor-vote',btn.dataset.vote);document.querySelector('#poll-result').textContent=`You voted for ${btn.dataset.vote}. Good pick.`}));
const savedVote=localStorage.getItem('wonky-flavor-vote');if(savedVote){const b=document.querySelector(`[data-vote="${savedVote}"]`);if(b){b.classList.add('selected');document.querySelector('#poll-result').textContent=`Your vote: ${savedVote}`}}
document.querySelectorAll('[data-drink]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('#drink-result').innerHTML=`<b>Try this:</b> ${btn.dataset.drink}`}));
document.querySelectorAll('.inquiry-form').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const type=form.dataset.formType;const heading=type==='quote'?'Wonky Donkey quote request':'Wonky Donkey booking inquiry';const body=[heading,...Object.entries(data).map(([key,value])=>`${key.replaceAll('_',' ')}: ${value}`)].join('\n');try{await navigator.clipboard.writeText(body);alert('Your event details were copied. Paste them into the Instagram message that opens next.')}catch{alert('Please send these event details to us in the Instagram message that opens next.')}window.open('https://www.instagram.com/wonky_donkey_drink_trailer/','_blank','noopener')}));
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'))}
