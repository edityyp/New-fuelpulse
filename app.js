import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const SUPABASE_URL = 'https://zdmpcvlmjmsapydaljms.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eGELBhmMhdPu4g4Sw5g2xg_3oO7g8ib';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const DEVICE_KEY = 'fuelpulse-v2-device-id';
const PENDING_KEY = 'fuelpulse-v2-verification';
const CLAIM_FUNCTION = 'customer-claim-offer';
const app = document.querySelector('#app');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
}) : '—';
const toast = (message, type = 'info') => {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3600);
};
const errorText = (error) => {
  const message = String(error?.message || error || 'Request failed.');
  const map = {
    already_redeemed: 'This Parchi has already been verified.',
    vehicle_mismatch: 'The selected vehicle does not match the station transaction.',
    mobile_mismatch: 'The mobile number does not match the station transaction.',
    receipt_expired: 'This Parchi has expired.',
    future_receipt: 'This transaction date is not valid yet.',
    amount_mismatch: 'The amount does not match the station record.',
    volume_mismatch: 'The fuel volume does not match the station record.',
    token_mismatch: 'The transaction token does not match.',
    invoice_mismatch: 'The invoice number does not match.',
    trusted_transaction_not_found: 'The station transaction could not be verified.',
    unauthorized: 'Your account is not authorized.',
    account_inactive: 'Your account is inactive.',
    device_already_registered: 'This device already has a FuelPulse account.'
  };
  return map[message] || message;
};

let session = null;
let profile = null;
let vehicles = [];
let ledger = [];
let offers = [];
let redemptions = [];
let activeView = 'home';
let scanState = null;
let accountCreating = false;

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function shell(content) {
  app.innerHTML = `<div class="app">
    <header class="top">
      <div class="brand"><span class="logo">F</span><span>FuelPulse</span></div>
      <span class="device-badge">This device</span>
    </header>
    <main>${content}</main>
    <nav class="nav" aria-label="Main navigation">
      <button data-view="home" class="${activeView === 'home' ? 'on' : ''}">⌂<small>Home</small></button>
      <button data-view="scan" class="${activeView === 'scan' ? 'on' : ''}">▣<small>Verify</small></button>
      <button data-view="vehicles" class="${activeView === 'vehicles' ? 'on' : ''}">◉<small>Vehicles</small></button>
      <button data-view="points" class="${activeView === 'points' ? 'on' : ''}">★<small>Points</small></button>
      <button data-view="profile" class="${activeView === 'profile' ? 'on' : ''}">●<small>Profile</small></button>
    </nav>
  </div>`;
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = () => { activeView = button.dataset.view; render(); };
  });
}

async function load() {
  if (!session?.user?.id) throw new Error('unauthorized');
  const uid = session.user.id;
  const p = await supabase.from('user_profiles')
    .select('id,full_name,mobile,role,status,organization_id,device_id')
    .eq('id', uid).single();
  if (p.error) throw p.error;
  profile = p.data;
  if (profile.status !== 'ACTIVE') throw new Error('ACCOUNT_SUSPENDED');

  const [v, l, o, r] = await Promise.all([
    supabase.from('vehicles').select('id,registration_number,registration_normalized,label,active,created_at')
      .eq('user_id', uid).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('points_ledger').select('id,points,reason,created_at,receipt_id')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
    profile.organization_id
      ? supabase.from('offers').select('id,title,description,points_cost,active,created_at')
          .eq('organization_id', profile.organization_id).eq('active', true).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from('receipt_redemptions').select('id,receipt_id,status,points,created_at')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(20)
  ]);
  if (v.error) throw v.error;
  if (l.error) throw l.error;
  if (o.error) throw o.error;
  if (r.error) throw r.error;
  vehicles = v.data || [];
  ledger = l.data || [];
  offers = o.data || [];
  redemptions = r.data || [];
}

const points = () => ledger.reduce((total, item) => total + Number(item.points || 0), 0);

function home() {
  return `<section class="hero">
    <div class="eyebrow">CUSTOMER REWARDS</div>
    <h1>Welcome, ${esc(profile.full_name || 'there')}.</h1>
    <p>Your points, vehicles and Parchi verification — securely connected to FuelPulse.</p>
    <div class="balance"><span>Current points</span><strong>${points().toLocaleString('en-IN')}</strong></div>
    <button class="primary" data-view="scan">Verify a Parchi</button>
  </section>
  <section class="stats">
    <div><b>${vehicles.length}</b><span>Vehicles</span></div>
    <div><b>${redemptions.filter((x) => x.status === 'SUCCESS').length}</b><span>Verified</span></div>
    <div><b>${offers.length}</b><span>Active offers</span></div>
  </section>
  <section class="section"><div class="section-head"><h2>Vehicles</h2><button class="link" data-view="vehicles">Manage</button></div>
    ${vehicles.length ? vehicles.slice(0, 3).map(vehicleCard).join('') : `<div class="empty"><b>Add your first vehicle</b><span>You'll need a vehicle before verifying a Parchi.</span><button class="secondary" data-view="vehicles">Add vehicle</button></div>`}
  </section>
  <section class="section"><div class="section-head"><h2>Recent activity</h2><button class="link" data-view="points">View all</button></div>
    ${ledger.length ? ledger.slice(0, 4).map(activityRow).join('') : `<div class="empty"><span>No points activity yet.</span></div>`}
  </section>
  <section class="section"><div class="section-head"><h2>Active offers</h2></div>
    ${offers.length ? offers.slice(0, 3).map(offerCard).join('') : `<div class="empty"><span>No active offers right now.</span></div>`}
  </section>`;
}

function vehicleCard(v) {
  return `<div class="vehicle"><span class="vehicle-icon">🚗</span><div><b>${esc(v.label || 'Vehicle')}</b><small>${esc(v.registration_number)}</small></div><span class="pill">Active</span></div>`;
}
function activityRow(x) {
  const n = Number(x.points);
  return `<div class="row"><div><b>${esc(x.reason || 'Points activity')}</b><small>${date(x.created_at)}</small></div><strong class="${n >= 0 ? 'positive' : 'negative'}">${n >= 0 ? '+' : ''}${n}</strong></div>`;
}
function offerCard(o) {
  return `<article class="offer"><div><b>${esc(o.title)}</b><p>${esc(o.description || '')}</p></div><div class="offer-action"><span>${Number(o.points_cost || 0).toLocaleString('en-IN')} pts</span><button class="secondary claim-offer" data-offer="${esc(o.id)}">Claim</button></div></article>`;
}

function vehiclesView() {
  return `<section class="page-head"><div class="eyebrow">MY GARAGE</div><h1>Your vehicles</h1><p>Add as many vehicles as you need. Only your active vehicles can be used for verification.</p></section>
  <section class="section"><form id="vehicleForm" class="card form">
    <label>Registration number<input name="registration" required maxlength="16" placeholder="UP85AB1234" autocomplete="off"></label>
    <label>Vehicle label<input name="label" maxlength="40" placeholder="My car"></label>
    <button class="primary">Add vehicle</button>
  </form></section>
  <section class="section"><h2>Saved vehicles</h2>
    ${vehicles.length ? vehicles.map((v) => `<div class="vehicle"><span class="vehicle-icon">🚗</span><div><b>${esc(v.label || 'Vehicle')}</b><small>${esc(v.registration_number)}</small></div><button class="danger ghost" data-delete="${esc(v.id)}">Remove</button></div>`).join('') : `<div class="empty"><span>No active vehicles.</span></div>`}
  </section>`;
}
function pointsView() {
  return `<section class="page-head"><div class="eyebrow">REWARDS</div><h1>${points().toLocaleString('en-IN')} points</h1><p>Your balance and history come directly from the FuelPulse database.</p></section>
  <section class="section"><h2>History</h2>${ledger.length ? ledger.map(activityRow).join('') : `<div class="empty"><span>No points activity yet.</span></div>`}</section>`;
}
function profileView() {
  return `<section class="page-head"><div class="eyebrow">ACCOUNT</div><h1>${esc(profile.full_name || 'FuelPulse customer')}</h1><p>${esc(profile.mobile ? `+91 ${profile.mobile}` : 'Mobile number not added')}</p></section>
  <section class="section"><div class="card"><div class="row"><span>Account status</span><b>${esc(profile.status)}</b></div><div class="row"><span>Account type</span><b>Customer</b></div></div></section>
  <section class="section"><h2>Device security</h2><div class="empty"><b>One account on this device</b><span>This customer account is bound to this browser installation. You can keep adding vehicles without creating another account.</span></div></section>`;
}
function scanView() {
  return `<section class="page-head"><div class="eyebrow">PARCHI VERIFICATION</div><h1>Verify your fuel receipt</h1><p>Scan or photograph the receipt. OCR only extracts fields — the trusted station transaction decides whether points are awarded.</p></section>
  <section class="section"><div class="card scan-card"><label class="upload"><input id="receiptFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment"><span class="camera">▣</span><b>Take a photo or choose an image</b><small>JPEG, PNG, WebP or HEIC · max 5 MB</small></label><div id="scanFields" class="hidden"></div></div></section>`;
}

async function handleFile(file) {
  if (!file) return;
  if (file.size > 5242880) return toast('Image is larger than 5 MB.', 'error');
  if (!/^image\/(jpeg|png|webp|heic)$/.test(file.type)) return toast('Unsupported image type.', 'error');
  const box = document.querySelector('#scanFields');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="progress"><span>Preparing scan…</span><i></i></div>';
  scanState = { file };
  let text = '';
  try {
    const { default: Tesseract } = await import('https://esm.sh/tesseract.js@7.0.0');
    box.querySelector('.progress span').textContent = 'Reading receipt…';
    const result = await Tesseract.recognize(file, 'eng');
    text = result.data.text || '';
  } catch (error) {
    console.warn(error);
    box.querySelector('.progress span').textContent = 'OCR unavailable — enter details manually.';
  }
  const extracted = parseText(text);
  box.innerHTML = `<form id="verifyForm" class="form">
    <div class="preview"><img src="${URL.createObjectURL(file)}" alt="Receipt preview"></div>
    <div class="notice">OCR is only an assistant. Correct any field before secure server verification.</div>
    <label>Invoice number<input name="invoice" value="${esc(extracted.invoice)}" autocomplete="off"></label>
    <label>Transaction token<input name="token" value="${esc(extracted.token)}" autocomplete="off"></label>
    <label>Vehicle<select name="vehicle" required>${vehicles.map((v) => `<option value="${esc(v.id)}">${esc(v.registration_number)}</option>`).join('')}</select></label>
    <label>Amount (₹)<input name="amount" inputmode="decimal" value="${esc(extracted.amount)}" min="0" step="0.01"></label>
    <label>Volume (L)<input name="volume" inputmode="decimal" value="${esc(extracted.volume)}" min="0" step="0.001"></label>
    <button class="primary">Securely verify Parchi</button>
    <p class="fine">Points are awarded only after the trusted station transaction passes server-side checks.</p>
  </form>`;
  document.querySelector('#verifyForm').onsubmit = verifyForm;
}
function parseText(text) {
  const normalized = text.replace(/\r/g, '').replace(/\s+/g, ' ');
  const invoice = (normalized.match(/(?:invoice|inv|bill)[\s:#-]*([A-Z0-9/-]{4,})/i) || [])[1] || '';
  const token = (normalized.match(/(?:token|txn|transaction)[\s:#-]*([A-Z0-9_-]{8,})/i) || [])[1] || '';
  const amount = (normalized.match(/(?:amount|total|net)[\s:₹-]*([0-9]+(?:\.[0-9]{1,2})?)/i) || [])[1] || '';
  const volume = (normalized.match(/([0-9]+(?:\.[0-9]{1,3})?)\s*(?:L|ltr|litre)/i) || [])[1] || '';
  return { invoice, token, amount, volume };
}

async function verifyForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const vehicleId = String(form.get('vehicle') || '');
  const file = scanState?.file;
  const button = event.currentTarget.querySelector('button');
  let idempotency = sessionStorage.getItem(PENDING_KEY);
  if (!idempotency) {
    idempotency = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    sessionStorage.setItem(PENDING_KEY, idempotency);
  }
  button.disabled = true;
  button.textContent = 'Preparing secure verification…';
  let uploadedPath = '';
  try {
    if (!vehicles.some((v) => v.id === vehicleId)) throw new Error('Select a vehicle');
    const amount = form.get('amount') ? Number(form.get('amount')) : null;
    const volume = form.get('volume') ? Number(form.get('volume')) : null;
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) throw new Error('Enter a valid amount.');
    if (volume != null && (!Number.isFinite(volume) || volume < 0)) throw new Error('Enter a valid fuel volume.');
    const body = {
      invoice_number: String(form.get('invoice') || '').trim() || null,
      transaction_token: String(form.get('token') || '').trim() || null,
      vehicle_id: vehicleId,
      amount,
      volume_litre: volume,
      idempotency_key: idempotency
    };
    if (!body.invoice_number && !body.transaction_token) throw new Error('Enter an invoice number or transaction token.');
    if (file) {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/heic' ? 'heic' : 'jpg';
      uploadedPath = `${session.user.id}/${idempotency}.${ext}`;
      const upload = await supabase.storage.from('receipt-images-private').upload(uploadedPath, file, {
        contentType: file.type, upsert: false
      });
      if (upload.error) throw new Error('Receipt image upload failed. Please retry.');
      Object.assign(body, { receipt_image_path: uploadedPath, receipt_image_sha256: hash, receipt_image_size: file.size, receipt_image_type: file.type });
    }
    button.textContent = 'Verifying securely…';
    const { data, error } = await supabase.functions.invoke('customer-redeem', { body });
    if (error) throw error;
    if (data?.decision !== 'APPROVED') throw new Error(data?.error || data?.message || data?.reason || 'Parchi could not be verified.');
    sessionStorage.removeItem(PENDING_KEY);
    toast(`Parchi verified — ${data.points || 0} points added.`, 'success');
    await load();
    activeView = 'home';
    render();
  } catch (error) {
    console.error(error);
    if (uploadedPath) await supabase.storage.from('receipt-images-private').remove([uploadedPath]);
    toast(errorText(error), 'error');
    button.disabled = false;
    button.textContent = 'Try again';
  }
}

async function claimOffer(id) {
  const button = document.querySelector(`[data-offer="${CSS.escape(id)}"]`);
  if (button) { button.disabled = true; button.textContent = 'Claiming…'; }
  try {
    const { data, error } = await supabase.functions.invoke(CLAIM_FUNCTION, { body: { offer_id: id } });
    if (error) throw error;
    if (data?.decision !== 'CLAIMED') throw new Error(data?.error || 'claim_failed');
    await load(); render(); toast('Offer claimed successfully.', 'success');
  } catch (error) {
    toast(errorText(error), 'error');
    if (button) { button.disabled = false; button.textContent = 'Claim'; }
  }
}

async function addVehicle(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const registration = String(form.get('registration') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(registration)) return toast('Enter a valid Indian vehicle registration.', 'error');
  const { error } = await supabase.from('vehicles').insert({
    user_id: session.user.id,
    registration_number: registration,
    registration_normalized: registration,
    label: String(form.get('label') || '').trim() || null
  });
  if (error) return toast(error.code === '23505' ? 'That vehicle is already active.' : error.message, 'error');
  await load(); render(); toast('Vehicle added.', 'success');
}

async function removeVehicle(id) {
  if (!window.confirm('Remove this vehicle from your active garage?')) return;
  const { error } = await supabase.from('vehicles').update({ active: false }).eq('id', id).eq('user_id', session.user.id);
  if (error) return toast(error.message, 'error');
  await load(); render(); toast('Vehicle removed.', 'success');
}

async function createAccount(event) {
  event.preventDefault();
  if (accountCreating) return;
  const form = new FormData(event.currentTarget);
  const name = String(form.get('name') || '').trim();
  const mobile = String(form.get('mobile') || '').replace(/\D/g, '');
  if (name.length < 2) return toast('Enter your full name.', 'error');
  if (mobile && mobile.length !== 10) return toast('Enter a valid 10-digit mobile number.', 'error');
  accountCreating = true;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  button.textContent = 'Creating account…';
  try {
    let current = (await supabase.auth.getSession()).data.session;
    if (!current) {
      const result = await supabase.auth.signInAnonymously();
      if (result.error) throw result.error;
      current = result.data.session;
    }
    if (!current?.user) throw new Error('Unable to create a device account.');
    const { error } = await supabase.rpc('create_customer_account', {
      p_full_name: name,
      p_mobile: mobile || null,
      p_device_id: deviceId()
    });
    if (error) throw error;
    session = current;
    await load();
    toast('Your FuelPulse account is ready.', 'success');
    render();
  } catch (error) {
    console.error(error);
    if (String(error?.message || '').includes('anonymous')) {
      toast('Device account creation is not enabled in the new Supabase Auth settings.', 'error');
    } else {
      toast(errorText(error), 'error');
    }
    await supabase.auth.signOut();
  } finally {
    accountCreating = false;
  }
}

function auth() {
  app.innerHTML = `<div class="auth">
    <div class="brand big"><span class="logo">F</span><span>FuelPulse</span></div>
    <div class="auth-copy"><div class="eyebrow">ONE DEVICE · ONE ACCOUNT</div><h1>Fuel rewards, verified.</h1><p>Create your FuelPulse customer account on this device. No OTP or password is required.</p></div>
    <div class="auth-card">
      <form id="createAccount" class="form">
        <label>Full name<input name="name" minlength="2" maxlength="80" autocomplete="name" required placeholder="Your name"></label>
        <label>Mobile number <span class="optional">(optional)</span><input name="mobile" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="98765 43210"></label>
        <button class="primary">Create my account</button>
        <div class="account-note"><b>One account on this device</b><span>Your account stays signed in on this device and can contain any number of vehicles.</span></div>
      </form>
    </div>
  </div>`;
  document.querySelector('#createAccount').onsubmit = createAccount;
}

function render() {
  if (!session || !profile) return auth();
  const content = activeView === 'home' ? home() : activeView === 'vehicles' ? vehiclesView() : activeView === 'points' ? pointsView() : activeView === 'profile' ? profileView() : scanView();
  shell(content);
  const form = document.querySelector('#vehicleForm');
  if (form) form.onsubmit = addVehicle;
  document.querySelectorAll('[data-delete]').forEach((button) => { button.onclick = () => removeVehicle(button.dataset.delete); });
  document.querySelectorAll('.claim-offer').forEach((button) => { button.onclick = () => claimOffer(button.dataset.offer); });
  const receipt = document.querySelector('#receiptFile');
  if (receipt) receipt.onchange = () => handleFile(receipt.files[0]);
}

supabase.auth.onAuthStateChange(async (_event, nextSession) => {
  session = nextSession;
  if (!nextSession) { profile = null; render(); return; }
  try {
    await load();
    render();
  } catch (error) {
    console.error(error);
    if (error.message === 'ACCOUNT_SUSPENDED') {
      toast('This account is suspended.', 'error');
      await supabase.auth.signOut();
    } else {
      render();
    }
  }
});

(async () => {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) {
    try { await load(); } catch (error) { console.error(error); }
  }
  render();
})();
