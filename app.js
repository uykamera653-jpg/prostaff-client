// ===== Firebase CDN =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier,
  signInWithPhoneNumber, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot,
  query, where, orderBy, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging.js";

// ===== Helpers =====
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const show = id => { $$('.screen').forEach(e=>e.classList.remove('show')); $(id).classList.add('show'); };
const toast = m => { const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1500); };

// ===== ENV va Firebase init =====
if (!window.__ENV) window.__ENV = {};
const app = initializeApp(window.__ENV);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser=null;
let currentOrderId=null;
let selectedCat=null;
let selectedWorkers = new Set();
let currentChat = { id:null, with:null, orderId:null };

// 20+ kategoriya
const CATS = [
  "Uy tozalash","Ta’mirlash","Santexnika","Elektrik","Bo‘yoq-bo‘yoq","Yuk ko‘tarish",
  "Ko‘chirish","Bog‘dorchilik","Qurilish yordamchi","Payvandlash","Kafel/plitka",
  "Shpaklyovka","Gipsokarton","Mebellar yig‘ish","Avtomoyka","Avto mexanik",
  "Kuryer","Oshpaz","Ofitsiant","Qorovul","Sotuvchi","O‘qituvchi","Tarjimon","IT yordam"
];

// ===== UI bog'lanish =====
$('#btnGoogle').onclick = async ()=>{ try{ await signInWithPopup(auth,new GoogleAuthProvider()); }catch(e){ alert(e.message);} };
$('#btnPhone').onclick  = async ()=>{
  const raw=$('#phoneInput').value.trim(); if(!raw) return toast("Telefon kiriting");
  try{
    window.recaptchaVerifier = new RecaptchaVerifier(auth,'recaptcha-container',{size:'invisible'});
    const conf = await signInWithPhoneNumber(auth, raw, window.recaptchaVerifier);
    const code = prompt("SMS kodi:"); await conf.confirm(code);
  }catch(e){ alert(e.message); }
};
$('#btnLogout').onclick = ()=>signOut(auth);

// tabs
$('#tabs').querySelectorAll('button').forEach(b=>{
  b.onclick=()=>{
    $('#tabs').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const t=b.dataset.tab;
    if(t==='home')show('#screen-home');
    if(t==='create') { selectedCat=null; buildCats(); show('#screen-categories'); }
    if(t==='orders') { loadMyOrders(); show('#screen-orders'); }
    if(t==='profile') { show('#screen-profile-view'); }
  };
});

// Daily card → kategoriyalar
$('#tileDaily').onclick = ()=>{ buildCats(); show('#screen-categories'); };
$('#btnBackHome').onclick = ()=> show('#screen-home');

function buildCats(){
  const box=$('#catList'); box.innerHTML='';
  CATS.forEach(c=>{
    const btn=document.createElement('button');
    btn.textContent=c; btn.onclick=()=>{ selectedCat=c; $('#chosenCat').textContent="Kategoriya: "+c; show('#screen-create');};
    box.appendChild(btn);
  });
}

// create order
$('#btnCreate').onclick = async ()=>{
  if(!currentUser) return;
  const order = {
    ownerUid: currentUser.uid,
    ownerName: $('#cName').value.trim(),
    ownerPhone: $('#cPhone').value.trim(),
    category: selectedCat,
    desc: $('#cDesc').value.trim(),
    workerGender: $('#cGender').value || null,
    budget: parseInt($('#cBudget').value||'0',10),
    location: $('#cLocation').value.trim(),
    pay: $('#cPay').value,
    date: $('#cDate').value || null,
    status: 'pending',
    createdAt: Date.now()
  };
  if(!order.ownerName || !order.ownerPhone || !order.category || !order.budget) return toast("Ism/telefon/kategoriya/byudjet shart");

  // rasm optional (faqat metadata sifatida saqlaymiz – Hostingda file saqlamaymiz)
  const img = $('#cImage').files?.[0];
  if(img){ order.imageName = img.name; }

  const ref = await addDoc(collection(db,'orders'), order);
  currentOrderId = ref.id;
  toast("E’lon berildi");
  show('#screen-wait');
};

// waiting → offers
$('#btnGoOffers').onclick = ()=>{ if(!currentOrderId) return; watchOffers(currentOrderId); show('#screen-offers'); };
$('#btnAssign').onclick = async ()=>{
  if(!currentOrderId || selectedWorkers.size===0) return toast("Ishchi tanlang");
  await updateDoc(doc(db,'orders',currentOrderId),{ status:'assigned', assignedTo:[...selectedWorkers] });
  toast("Biriktirildi");
};

// chat
$('#btnSend').onclick = async ()=>{
  const text=$('#chatMsg').value.trim(); if(!text || !currentChat.id) return;
  await addDoc(collection(db,'chats',currentChat.id,'messages'),{
    sender: currentUser.uid, text, createdAt: serverTimestamp()
  });
  $('#chatMsg').value='';
};
$('#btnBackOffers').onclick = ()=>{ show('#screen-offers'); };

// ===== auth state =====
onAuthStateChanged(auth, async (u)=>{
  currentUser=u;
  if(!u){ $('#tabs').style.display='none'; $('#btnLogout').style.display='none'; show('#screen-welcome'); return; }
  $('#tabs').style.display='flex'; $('#btnLogout').style.display='inline-block';

  const uref = doc(db,'users',u.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    show('#screen-profile');
    $('#btnSaveProfile').onclick = async ()=>{
      const data={
        firstName: $('#firstName').value.trim(),
        lastName:  $('#lastName').value.trim(),
        gender:    $('#gender').value||null,
        age:       parseInt($('#age').value||'0',10)||null,
        city:      $('#city').value.trim()||null,
        phone:     u.phoneNumber||null,
        email:     u.email||null,
        role: 'client', createdAt: Date.now()
      };
      if(!data.firstName || !data.lastName) return toast("Ism/familiya shart");
      await setDoc(uref,data); toast("Profil saqlandi"); enter(u,data);
    };
  } else {
    enter(u, snap.data());
  }

  // Push token (ixtiyoriy)
  if(window.__ENV.vapidKey){
    try{
      const messaging = getMessaging(app);
      const token = await getToken(messaging,{ vapidKey: window.__ENV.vapidKey });
      if(token){ await setDoc(doc(db,'users',u.uid),{ fcmToken:token },{ merge:true }); }
    }catch(_) {}
  }
});

function enter(u, profile={}){
  show('#screen-home');
  // profile ko'rinishi
  $('#profileCard').innerHTML = `
    <div><b>${profile.firstName??''} ${profile.lastName??''}</b></div>
    <div class="muted">${u.phoneNumber??u.email??'-'} · ${profile.city??''}</div>
  `;
  loadMyOrders();
}

// ===== Orders list =====
function loadMyOrders(){
  const qy=query(collection(db,'orders'),where('ownerUid','==',auth.currentUser.uid),orderBy('createdAt','desc'));
  onSnapshot(qy,(snap)=>{
    const box=$('#ordersBox');
    if(snap.empty){ box.className='list-empty muted'; box.textContent='Hozircha e’lon yo‘q.'; return;}
    box.className=''; box.innerHTML='';
    snap.forEach(d=>{
      const o=d.data(); const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<b>${o.category}</b> · ${(o.budget||0).toLocaleString('uz-UZ')} so‘m · ${o.status}
        <div class="muted">${o.desc??''}</div>
        <div style="margin-top:6px">
          <button class="ghost" data-oid="${d.id}">Takliflar</button>
        </div>`;
      el.querySelector('button').onclick = ()=>{
        currentOrderId=d.id; watchOffers(d.id); show('#screen-offers');
      };
      box.appendChild(el);
    });
  });
}

// ===== Offers (proposals) =====
// Ishchilar tomoni hali alohida ilovada bo'ladi; hozircha strukturani ko'rsatamiz.
// orders/{orderId}/proposals/{workerUid} => { workerUid, price, message, createdAt }
function watchOffers(orderId){
  selectedWorkers.clear(); $('#btnAssign').style.display='none';
  const qy = query(collection(db,'orders',orderId,'proposals'),orderBy('createdAt','desc'));
  onSnapshot(qy, async (snap)=>{
    const box=$('#offerList');
    if(snap.empty){ box.className='list-empty muted'; box.textContent='Hozircha taklif yo‘q…'; return;}
    box.className=''; box.innerHTML='';
    for(const docSnap of snap.docs){
      const p=docSnap.data();
      const uref = await getDoc(doc(db,'users',p.workerUid)); // ishchi profili
      const w = uref.exists()? uref.data(): {firstName:'Ishchi', lastName:'', age:'', avatar:''};
      const card=document.createElement('label'); card.className='card';
      card.innerHTML=`
        <div style="display:flex;gap:10px;align-items:center">
          <img src="${w.avatar||'https://i.pravatar.cc/80?u='+p.workerUid}" style="width:48px;height:48px;border-radius:50%"/>
          <div style="flex:1">
            <b>${w.firstName??''} ${w.lastName??''}</b> <span class="muted">· ${w.age? w.age+' yosh' : ''}</span>
            <div class="muted">Kunlik: ${(w.ratePerDay||p.price||0).toLocaleString('uz-UZ')} so‘m</div>
          </div>
          <input type="checkbox" data-w="${p.workerUid}"/>
        </div>
        <div class="muted" style="margin-top:6px">${p.message??''}</div>
        <div class="muted">${w.phone? '☎ '+w.phone : ''}</div>
        <div style="margin-top:6px">
          <button class="secondary" data-chat="${p.workerUid}">Chat</button>
        </div>
      `;
      // tanlash
      card.querySelector('input').onchange=(e)=>{
        e.target.checked ? selectedWorkers.add(p.workerUid) : selectedWorkers.delete(p.workerUid);
        $('#btnAssign').style.display = selectedWorkers.size? 'inline-block':'none';
      };
      // chat
      card.querySelector('[data-chat]').onclick=()=> openChat(p.workerUid, orderId, `${w.firstName??''} ${w.lastName??''}`);
      box.appendChild(card);
    }
  });
}

async function openChat(workerUid, orderId, title){
  // chat hujjati: chats/{ownerUid_workerUid_orderId}
  const chatId = `${auth.currentUser.uid}_${workerUid}_${orderId}`;
  currentChat = { id:chatId, with:workerUid, orderId };
  $('#chatTitle').textContent = `Chat · ${title}`;
  show('#screen-chat');

  onSnapshot(collection(db,'chats',chatId,'messages'),(snap)=>{
    const box=$('#chatBox'); box.innerHTML='';
    snap.docs.sort((a,b)=>(a.data().createdAt?.seconds||0)-(b.data().createdAt?.seconds||0))
      .forEach(m=>{
        const d=m.data(); const div=document.createElement('div');
        div.className='msg ' + (d.sender===auth.currentUser.uid ? 'me':'them');
        div.textContent=d.text; box.appendChild(div);
      });
    box.scrollTop = box.scrollHeight;
  });
      }
