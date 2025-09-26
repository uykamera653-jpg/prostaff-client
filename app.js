// Firebase modul importlari (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier,
  signInWithPhoneNumber, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ====== ENV (env.js orqali keladi) ======
if (!window.__ENV) {
  // Fallback: qo'lda to'ldirishni xohlasangiz shu yerga PRODUCTION kalitlarni kiriting
  window.__ENV = {
    apiKey: "", authDomain: "", projectId: "", storageBucket: "",
    messagingSenderId: "", appId: "", measurementId: "", vapidKey: ""
  };
}

// ====== Firebase init ======
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
const db = getFirestore(app);

// ====== UI helpers ======
const $ = s => document.querySelector(s);
const show = id => {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('show'));
  $(id).classList.add('show');
};
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1500); };

// ====== Auth flow ======
const btnGoogle = $('#btnGoogle');
const btnPhone  = $('#btnPhone');
const btnLogout = $('#btnLogout');

btnGoogle?.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) { alert(e.message); }
});

btnPhone?.addEventListener('click', async () => {
  const raw = $('#phoneInput').value.trim();
  if (!raw) { toast("Telefon raqam kiriting"); return; }
  try {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
    const conf = await signInWithPhoneNumber(auth, raw, window.recaptchaVerifier);
    const code = prompt("SMS kodini kiriting:");
    await conf.confirm(code);
  } catch (e) {
    alert(e.message);
  }
});

btnLogout?.addEventListener('click', async () => {
  await signOut(auth);
});

// User kuzatuvchi
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $('#tabs').style.display = 'none';
    btnLogout.style.display = 'none';
    show('#screen-welcome');
    return;
  }
  btnLogout.style.display = 'inline-block';

  // user doc bormi?
  const uref = doc(db, 'users', user.uid);
  const usnap = await getDoc(uref);
  if (!usnap.exists()) {
    // yangi user — profil formasi
    show('#screen-profile');
    $('#btnSaveProfile').onclick = async () => {
      const firstName = $('#firstName').value.trim();
      const lastName  = $('#lastName').value.trim();
      const city      = $('#city').value.trim();
      if (!firstName || !lastName) { toast("Ism va familiyani kiriting"); return; }
      await setDoc(uref, {
        firstName, lastName, city: city || null,
        phone: user.phoneNumber || null,
        email: user.email || null,
        role: 'client',
        createdAt: Date.now()
      });
      toast("Profil saqlandi");
      enterApp(user);
    };
  } else {
    enterApp(user, usnap.data());
  }
});

// Asosiy oynaga kirish
function enterApp(user, profile) {
  $('#tabs').style.display = 'flex';
  show('#screen-home');
  // Profil kartasi
  const data = profile || {};
  $('#profileCard').innerHTML = `
    <div><b>Foydalanuvchi:</b> ${data.firstName ?? ''} ${data.lastName ?? ''}</div>
    <div><b>Tel:</b> ${user.phoneNumber ?? '-'}</div>
    <div><b>Email:</b> ${user.email ?? '-'}</div>
    <div><b>Shahar:</b> ${data.city ?? '-'}</div>
  `;
  bootOrders(user);
}

// ====== Tabs ======
const tabs = $('#tabs');
tabs.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    if (tab === 'home') show('#screen-home');
    if (tab === 'create') show('#screen-create');
    if (tab === 'orders') show('#screen-orders');
    if (tab === 'profile') show('#screen-profile-view');
  });
});

// Asosiy 2 tile
$('#tileDaily')?.addEventListener('click', () => {
  tabs.querySelector('[data-tab="create"]').click();
  $('#oType').value = 'cleaning';
});
$('#tileFirms')?.addEventListener('click', () => {
  alert("Firmalar katalogi keyingi bosqichda qo‘shiladi 😊");
});

// ====== Order yaratish va ro'yxat ======
$('#btnCreate')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const order = {
    ownerUid: user.uid,
    title: $('#oTitle').value.trim(),
    type: $('#oType').value,
    budget: parseInt($('#oBudget').value || '0', 10),
    desc: $('#oDesc').value.trim(),
    status: 'open',
    createdAt: Date.now()
  };
  if (!order.title || !order.budget) { toast("Sarlavha va byudjet shart"); return; }

  await addDoc(collection(db, 'orders'), order);
  toast("Buyurtma yaratildi");
  // tozalash
  $('#oTitle').value = ''; $('#oBudget').value=''; $('#oDesc').value='';
});

function bootOrders(user) {
  const q = query(
    collection(db, 'orders'),
    where('ownerUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  onSnapshot(q, (snap) => {
    const box = $('#ordersBox');
    if (snap.empty) { box.className='list-empty muted'; box.textContent='Hozircha buyurtma yo‘q.'; return; }
    box.className=''; box.innerHTML='';
    snap.forEach(docu => {
      const o = docu.data();
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <b>${o.title}</b>
        <div class="muted">${o.type} · ${(o.budget||0).toLocaleString('uz-UZ')} so‘m · ${o.status}</div>
        <div>${o.desc ?? ''}</div>
      `;
      box.appendChild(el);
    });
  });
                        }
