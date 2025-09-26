// ===== Firebase CDN modullari =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier,
  signInWithPhoneNumber, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ===== ENV (env.js dan keladi) =====
if (!window.__ENV) window.__ENV = {}; // agar yo'q bo'lsa

// ===== Firebase init =====
const app = initializeApp({
  apiKey: window.__ENV.apiKey,
  authDomain: window.__ENV.authDomain,
  projectId: window.__ENV.projectId,
  storageBucket: window.__ENV.storageBucket,
  messagingSenderId: window.__ENV.messagingSenderId,
  appId: window.__ENV.appId,
  measurementId: window.__ENV.measurementId
});
const auth = getAuth(app);
const db   = getFirestore(app);

// ===== UI helpers =====
const $ = s => document.querySelector(s);
const show = id => { document.querySelectorAll('.screen').forEach(e=>e.classList.remove('show')); $(id).classList.add('show'); };
const toast = m => { const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1500); };

// ===== Auth kirish =====
$('#btnGoogle').onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(e){ alert(e.message); }
};
$('#btnPhone').onclick = async () => {
  const raw = $('#phoneInput').value.trim();
  if (!raw) return toast("Telefon raqam kiriting");
  try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth,'recaptcha-container',{size:'invisible'});
    const conf = await signInWithPhoneNumber(auth, raw, window.recaptchaVerifier);
    const code = prompt("SMS kodi:");
    await conf.confirm(code);
  } catch(e){ alert(e.message); }
};
$('#btnLogout').onclick = () => signOut(auth);

// ===== User holati =====
onAuthStateChanged(auth, async (user)=>{
  if (!user){ $('#tabs').style.display='none'; $('#btnLogout').style.display='none'; show('#screen-welcome'); return; }
  $('#tabs').style.display='flex'; $('#btnLogout').style.display='inline-block';

  const uref = doc(db,'users',user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()){
    show('#screen-profile');
    $('#btnSaveProfile').onclick = async ()=>{
      const firstName=$('#firstName').value.trim();
      const lastName=$('#lastName').value.trim();
      const city=$('#city').value.trim();
      if(!firstName||!lastName) return toast("Ism va familiya shart");
      await setDoc(uref, {
        firstName,lastName,city:city||null,
        phone:user.phoneNumber||null,email:user.email||null,
        role:'client',createdAt:Date.now()
      });
      toast("Profil saqlandi"); enter(user);
    };
  } else enter(user, snap.data());
});

function enter(user, profile={}){
  show('#screen-home');
  $('#profileCard').innerHTML = `
    <div><b>Foydalanuvchi:</b> ${profile.firstName??''} ${profile.lastName??''}</div>
    <div><b>Tel:</b> ${user.phoneNumber??'-'}</div>
    <div><b>Email:</b> ${user.email??'-'}</div>
    <div><b>Shahar:</b> ${profile.city??'-'}</div>`;
  bootOrders(user);
}

// ===== Tabs =====
$('#tabs').querySelectorAll('button').forEach(b=>{
  b.onclick=()=>{
    $('#tabs').querySelectorAll('button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    const t=b.dataset.tab;
    if(t==='home')show('#screen-home');
    if(t==='create')show('#screen-create');
    if(t==='orders')show('#screen-orders');
    if(t==='profile')show('#screen-profile-view');
  };
});

// Asosiy kartalar
$('#tileDaily').onclick = ()=>{ $('#tabs [data-tab="create"]').click(); $('#oType').value='cleaning'; };
$('#tileFirms').onclick = ()=> alert("Firmalar katalogi keyingi bosqichda qo‘shiladi 😊");

// Buyurtma yaratish
$('#btnCreate').onclick = async ()=>{
  const u=auth.currentUser; if(!u) return;
  const order={
    ownerUid:u.uid,title:$('#oTitle').value.trim(),
    type:$('#oType').value,budget:parseInt($('#oBudget').value||'0',10),
    desc:$('#oDesc').value.trim(),status:'open',createdAt:Date.now()
  };
  if(!order.title||!order.budget) return toast("Sarlavha va byudjet shart");
  await addDoc(collection(db,'orders'),order);
  toast("Buyurtma yaratildi");
  $('#oTitle').value=''; $('#oBudget').value=''; $('#oDesc').value='';
};

// Mening buyurtmalarim
function bootOrders(user){
  const q=query(collection(db,'orders'),where('ownerUid','==',user.uid),orderBy('createdAt','desc'));
  onSnapshot(q,(snap)=>{
    const box=$('#ordersBox');
    if(snap.empty){ box.className='list-empty muted'; box.textContent='Hozircha buyurtma yo‘q.'; return; }
    box.className=''; box.innerHTML='';
    snap.forEach(d=>{
      const o=d.data(); const el=document.createElement('div'); el.className='card';
      el.innerHTML=`<b>${o.title}</b>
        <div class="muted">${o.type} · ${(o.budget||0).toLocaleString('uz-UZ')} so‘m · ${o.status}</div>
        <div>${o.desc??''}</div>`;
      box.appendChild(el);
    });
  });
               }
