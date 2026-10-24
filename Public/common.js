const $=s=>document.querySelector(s);
const api=async(a,body,tk)=>{const t=localStorage.getItem(tk||'tk');const r=await fetch('/api?a='+a,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>({error:'Server error'}));if(!r.ok)throw new Error(j.error||'Gagal');return j};
const badge=s=>`<span class="badge ${s}">Anggota ${s==='lama'?'Lama':'Baru'}</span>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function shrink(file,max=900,q=.7){return new Promise(res=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q))};i.src=URL.createObjectURL(file)})}
function loader(){setTimeout(()=>{const l=$('#loader');l.style.opacity=0;setTimeout(()=>l.remove(),600)},6000)}
