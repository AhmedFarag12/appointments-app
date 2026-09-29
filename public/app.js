// ---------- State ----------
const state = {
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
};

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const STATUS = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const view = document.getElementById('view');

// ---------- Helpers ----------
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 3000);
}

function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
  const d = new Date(`${date}T00:00:00`);
  return {
    day: d.getDate(),
    label: `${d.toLocaleDateString('ar-EG', { weekday: 'long' })} · ${d.toLocaleDateString('ar-EG', { month: 'long' })}`,
  };
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (res.status === 401 && state.token) {
    logout();
    throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى');
  }
  if (!res.ok) {
    const msg = json?.errors?.length ? json.errors.join('، ') : json?.message;
    const err = new Error(msg || 'حدث خطأ');
    err.status = res.status;
    throw err;
  }
  return json?.data;
}

function setSession({ accessToken, user }) {
  state.token = accessToken;
  state.user = user;
  localStorage.setItem('token', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.hash = '#/login';
}

function isProvider() {
  return state.user?.role === 'provider';
}

function loading() {
  view.innerHTML = '<p class="empty">جاري التحميل…</p>';
}

// ---------- Nav ----------
function renderNav() {
  const nav = document.getElementById('nav');
  const current = location.hash.split('?')[0];
  const link = (href, text) =>
    `<a href="${href}" class="${current.startsWith(href) ? 'active' : ''}">${text}</a>`;

  if (!state.user) {
    nav.innerHTML = link('#/providers', 'مقدمو الخدمة') + link('#/login', 'دخول') + link('#/register', 'حساب جديد');
    return;
  }
  nav.innerHTML =
    link('#/providers', 'مقدمو الخدمة') +
    link('#/appointments', isProvider() ? 'الحجوزات' : 'مواعيدي') +
    (isProvider() ? link('#/profile', 'بروفايلي') : '') +
    `<span class="user-chip">${esc(state.user.name)}</span>` +
    `<button class="btn btn-ghost btn-sm" id="logout">خروج</button>`;
  document.getElementById('logout').onclick = logout;
}

// ---------- Views ----------
function loginView() {
  view.innerHTML = `
    <div class="card auth-card">
      <h1>تسجيل الدخول</h1>
      <form id="form">
        <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email" /></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" required autocomplete="current-password" /></div>
        <div class="field"><button class="btn btn-block">دخول</button></div>
      </form>
      <p class="muted small">ليس لديك حساب؟ <a href="#/register">أنشئ حساباً</a></p>
    </div>`;
  bindForm('form', async (data) => {
    setSession(await api('POST', '/auth/login', data));
    toast(`أهلاً ${state.user.name}`);
    location.hash = isProvider() ? '#/appointments' : '#/providers';
  });
}

function registerView() {
  view.innerHTML = `
    <div class="card auth-card">
      <h1>حساب جديد</h1>
      <form id="form">
        <div class="field">
          <label>نوع الحساب</label>
          <div class="role-picker">
            <input type="radio" name="role" id="r-customer" value="customer" checked /><label for="r-customer">عميل</label>
            <input type="radio" name="role" id="r-provider" value="provider" /><label for="r-provider">مقدم خدمة</label>
          </div>
        </div>
        <div class="field"><label>الاسم</label><input name="name" required /></div>
        <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email" /></div>
        <div class="field"><label>رقم الهاتف (اختياري)</label><input name="phone" type="tel" /></div>
        <div class="field"><label>كلمة المرور</label><input name="password" type="password" minlength="6" required autocomplete="new-password" /></div>
        <div class="field"><button class="btn btn-block">إنشاء الحساب</button></div>
      </form>
      <p class="muted small">لديك حساب؟ <a href="#/login">سجّل الدخول</a></p>
    </div>`;
  bindForm('form', async (data) => {
    if (!data.phone) delete data.phone;
    setSession(await api('POST', '/auth/register', data));
    toast('تم إنشاء الحساب');
    location.hash = isProvider() ? '#/profile' : '#/providers';
  });
}

async function providersView(params) {
  const search = params.get('search') || '';
  const specialty = params.get('specialty') || '';
  view.innerHTML = `
    <div class="page-head"><h1>مقدمو الخدمة</h1></div>
    <form class="filters" id="filters">
      <input name="search" placeholder="ابحث بالاسم أو الوصف…" value="${esc(search)}" />
      <input name="specialty" placeholder="التخصص" value="${esc(specialty)}" />
      <button class="btn">بحث</button>
    </form>
    <div id="list"><p class="empty">جاري التحميل…</p></div>`;

  document.getElementById('filters').onsubmit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams(
      [...new FormData(e.target)].filter(([, v]) => v.trim()),
    );
    location.hash = `#/providers${q.toString() ? '?' + q : ''}`;
  };

  const q = new URLSearchParams({ limit: '50' });
  if (search) q.set('search', search);
  if (specialty) q.set('specialty', specialty);
  const { items } = await api('GET', `/providers?${q}`);

  document.getElementById('list').innerHTML = items.length
    ? `<div class="grid">${items
        .map(
          (p) => `
        <div class="card provider-card">
          <h3>${esc(p.businessName)}</h3>
          <div><span class="tag">${esc(p.specialty)}</span></div>
          ${p.description ? `<p class="muted small" style="margin:0">${esc(p.description)}</p>` : ''}
          ${p.address ? `<p class="small" style="margin:0">📍 ${esc(p.address)}</p>` : ''}
          <a class="btn btn-sm" href="#/providers/${p._id}">احجز موعد</a>
        </div>`,
        )
        .join('')}</div>`
    : '<div class="card empty">لا يوجد مقدمو خدمة مطابقون</div>';
}

async function providerDetailView(id) {
  loading();
  const p = await api('GET', `/providers/${id}`);
  const selected = { date: localDate(1), time: null };

  const hours = [...p.workingHours]
    .sort((a, b) => a.day - b.day)
    .map((h) => `<li><span>${DAYS[h.day]}</span><span dir="ltr">${h.start} – ${h.end}</span></li>`)
    .join('');

  view.innerHTML = `
    <p><a href="#/providers">→ رجوع للقائمة</a></p>
    <div class="two-col">
      <div class="card stack">
        <div>
          <h1 style="margin-bottom:4px">${esc(p.businessName)}</h1>
          <span class="tag">${esc(p.specialty)}</span>
        </div>
        ${p.description ? `<p style="margin-bottom:0">${esc(p.description)}</p>` : ''}
        <ul class="info-list">
          ${p.user?.name ? `<li><span class="muted">المسؤول</span><span>${esc(p.user.name)}</span></li>` : ''}
          ${p.phone ? `<li><span class="muted">الهاتف</span><span dir="ltr">${esc(p.phone)}</span></li>` : ''}
          ${p.address ? `<li><span class="muted">العنوان</span><span>${esc(p.address)}</span></li>` : ''}
          <li><span class="muted">مدة الموعد</span><span>${p.slotDuration} دقيقة</span></li>
        </ul>
        <div>
          <h2>مواعيد العمل</h2>
          ${hours ? `<ul class="info-list">${hours}</ul>` : '<p class="muted">لم تُحدد بعد</p>'}
        </div>
      </div>
      <div class="card stack">
        <h2>احجز موعد</h2>
        <div class="field"><label>التاريخ</label><input type="date" id="date" min="${localDate()}" value="${selected.date}" /></div>
        <div id="slots"></div>
        <div class="field"><label>ملاحظات (اختياري)</label><textarea id="notes" rows="3"></textarea></div>
        <button class="btn btn-block" id="book" disabled>اختر موعداً</button>
      </div>
    </div>`;

  const slotsEl = document.getElementById('slots');
  const bookBtn = document.getElementById('book');

  async function loadSlots() {
    selected.time = null;
    bookBtn.disabled = true;
    bookBtn.textContent = 'اختر موعداً';
    slotsEl.innerHTML = '<p class="muted small">جاري تحميل المواعيد…</p>';
    try {
      const { slots } = await api('GET', `/providers/${id}/slots?date=${selected.date}`);
      slotsEl.innerHTML = slots.length
        ? `<div class="slots">${slots.map((s) => `<button class="slot" data-time="${s.startTime}">${s.startTime}</button>`).join('')}</div>`
        : '<p class="muted">لا توجد مواعيد متاحة في هذا اليوم</p>';
    } catch (err) {
      slotsEl.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  slotsEl.onclick = (e) => {
    const btn = e.target.closest('.slot');
    if (!btn) return;
    slotsEl.querySelectorAll('.slot').forEach((b) => b.classList.toggle('selected', b === btn));
    selected.time = btn.dataset.time;
    bookBtn.disabled = false;
    bookBtn.textContent = `احجز ${selected.time}`;
  };

  document.getElementById('date').onchange = (e) => {
    selected.date = e.target.value;
    if (selected.date) loadSlots();
  };

  bookBtn.onclick = async () => {
    if (!state.user) {
      toast('سجّل الدخول أولاً للحجز', true);
      location.hash = '#/login';
      return;
    }
    if (isProvider()) return toast('الحجز متاح لحسابات العملاء فقط', true);
    bookBtn.disabled = true;
    try {
      const notes = document.getElementById('notes').value.trim();
      await api('POST', '/appointments', {
        providerId: id,
        date: selected.date,
        startTime: selected.time,
        ...(notes ? { notes } : {}),
      });
      toast('تم الحجز بنجاح، في انتظار التأكيد');
      location.hash = '#/appointments';
    } catch (err) {
      toast(err.message, true);
      loadSlots();
    }
  };

  loadSlots();
}

async function appointmentsView(params) {
  if (!requireAuth()) return;
  const status = params.get('status') || '';
  const tabs = [['', 'الكل'], ...Object.entries(STATUS)];

  view.innerHTML = `
    <div class="page-head"><h1>${isProvider() ? 'الحجوزات' : 'مواعيدي'}</h1></div>
    <div class="tabs">${tabs
      .map(([k, v]) => `<button data-status="${k}" class="${k === status ? 'active' : ''}">${v}</button>`)
      .join('')}</div>
    <div id="list"><p class="empty">جاري التحميل…</p></div>`;

  view.querySelector('.tabs').onclick = (e) => {
    const s = e.target.dataset?.status;
    if (s === undefined) return;
    location.hash = `#/appointments${s ? '?status=' + s : ''}`;
  };

  let items;
  try {
    ({ items } = await api('GET', `/appointments?limit=100${status ? '&status=' + status : ''}`));
  } catch (err) {
    if (err.status === 403 && isProvider()) {
      document.getElementById('list').innerHTML =
        '<div class="card empty">أنشئ بروفايلك أولاً لاستقبال الحجوزات<br/><br/><a class="btn" href="#/profile">إنشاء البروفايل</a></div>';
      return;
    }
    throw err;
  }

  const list = document.getElementById('list');
  if (!items.length) {
    list.innerHTML = `<div class="card empty">لا توجد مواعيد${isProvider() ? '' : '<br/><br/><a class="btn" href="#/providers">احجز موعداً</a>'}</div>`;
    return;
  }

  list.innerHTML = items
    .map((a) => {
      const d = formatDate(a.date);
      const who = isProvider()
        ? `<h3>${esc(a.customer?.name)}</h3><div class="muted small" dir="ltr" style="text-align:right">${esc(a.customer?.email)}${a.customer?.phone ? ' · ' + esc(a.customer.phone) : ''}</div>`
        : `<h3>${esc(a.provider?.businessName)}</h3><div class="muted small">${esc(a.provider?.specialty)}${a.provider?.address ? ' · ' + esc(a.provider.address) : ''}</div>`;
      const actions = [];
      if (isProvider() && a.status === 'pending')
        actions.push(`<button class="btn btn-sm btn-success" data-act="confirm" data-id="${a._id}">تأكيد</button>`);
      if (isProvider() && a.status === 'confirmed')
        actions.push(`<button class="btn btn-sm btn-success" data-act="complete" data-id="${a._id}">إكمال</button>`);
      if (a.status === 'pending' || a.status === 'confirmed')
        actions.push(`<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${a._id}">إلغاء</button>`);
      return `
        <div class="card appt">
          <div class="appt-date">
            <div class="day">${d.day}</div>
            <div class="small muted">${d.label}</div>
            <div class="time">${a.startTime} – ${a.endTime}</div>
          </div>
          <div class="appt-body">
            ${who}
            <div style="margin-top:6px"><span class="status status-${a.status}">${STATUS[a.status]}</span></div>
            ${a.notes ? `<div class="small" style="margin-top:6px">📝 ${esc(a.notes)}</div>` : ''}
            ${a.cancellationReason ? `<div class="small muted">سبب الإلغاء: ${esc(a.cancellationReason)}</div>` : ''}
          </div>
          <div class="appt-actions">${actions.join('')}</div>
        </div>`;
    })
    .join('');

  list.onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    let body;
    if (act === 'cancel') {
      const reason = prompt('سبب الإلغاء (اختياري):');
      if (reason === null) return;
      body = reason.trim() ? { reason: reason.trim() } : {};
    }
    btn.disabled = true;
    try {
      await api('PATCH', `/appointments/${id}/${act}`, body);
      toast({ confirm: 'تم التأكيد', complete: 'تم الإكمال', cancel: 'تم الإلغاء' }[act]);
      route();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  };
}

async function profileView() {
  if (!requireAuth()) return;
  if (!isProvider()) {
    location.hash = '#/providers';
    return;
  }
  loading();

  let profile = null;
  try {
    profile = await api('GET', '/providers/me');
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const hoursByDay = Object.fromEntries((profile?.workingHours || []).map((h) => [h.day, h]));
  const defaults = !profile;

  view.innerHTML = `
    <div class="page-head">
      <h1>${profile ? 'بروفايلي' : 'إنشاء بروفايل مقدم الخدمة'}</h1>
      ${profile ? `<a class="btn btn-ghost btn-sm" href="#/providers/${profile._id}">عرض الصفحة العامة</a>` : ''}
    </div>
    <form id="form" class="two-col">
      <div class="card">
        <h2>البيانات</h2>
        <div class="field"><label>اسم النشاط</label><input name="businessName" required value="${esc(profile?.businessName)}" /></div>
        <div class="field"><label>التخصص</label><input name="specialty" required placeholder="مثال: طبيب أسنان" value="${esc(profile?.specialty)}" /></div>
        <div class="field"><label>الوصف</label><textarea name="description" rows="3">${esc(profile?.description)}</textarea></div>
        <div class="row field">
          <div><label>الهاتف</label><input name="phone" type="tel" value="${esc(profile?.phone)}" /></div>
          <div><label>مدة الموعد (دقيقة)</label><input name="slotDuration" type="number" min="5" max="480" step="5" value="${profile?.slotDuration ?? 30}" /></div>
        </div>
        <div class="field"><label>العنوان</label><input name="address" value="${esc(profile?.address)}" /></div>
        ${
          profile
            ? `<div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="isActive" style="width:auto" ${profile.isActive ? 'checked' : ''}/> يستقبل حجوزات</label></div>`
            : ''
        }
      </div>
      <div class="card">
        <h2>مواعيد العمل</h2>
        ${DAYS.map((name, day) => {
          const h = hoursByDay[day];
          const on = h || (defaults && day !== 5);
          return `
          <div class="hours-row" data-day="${day}">
            <label><input type="checkbox" class="on" ${on ? 'checked' : ''} /> ${name}</label>
            <input type="time" class="start" value="${h?.start || '09:00'}" ${on ? '' : 'disabled'} />
            <input type="time" class="end" value="${h?.end || '17:00'}" ${on ? '' : 'disabled'} />
          </div>`;
        }).join('')}
        <div class="field"><button class="btn btn-block">${profile ? 'حفظ التعديلات' : 'إنشاء البروفايل'}</button></div>
      </div>
    </form>`;

  const form = document.getElementById('form');
  form.querySelectorAll('.hours-row .on').forEach((cb) => {
    cb.onchange = () => {
      const row = cb.closest('.hours-row');
      row.querySelectorAll('input[type=time]').forEach((i) => (i.disabled = !cb.checked));
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      businessName: fd.get('businessName').trim(),
      specialty: fd.get('specialty').trim(),
      slotDuration: Number(fd.get('slotDuration')),
      workingHours: [...form.querySelectorAll('.hours-row')]
        .filter((r) => r.querySelector('.on').checked)
        .map((r) => ({
          day: Number(r.dataset.day),
          start: r.querySelector('.start').value,
          end: r.querySelector('.end').value,
        })),
    };
    for (const key of ['description', 'phone', 'address']) {
      const v = fd.get(key).trim();
      if (v || profile) body[key] = v;
    }
    if (profile) body.isActive = fd.get('isActive') === 'on';

    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      if (profile) {
        await api('PATCH', `/providers/${profile._id}`, body);
        toast('تم حفظ التعديلات');
      } else {
        await api('POST', '/providers', body);
        toast('تم إنشاء البروفايل');
      }
      route();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  };
}

// ---------- Plumbing ----------
function requireAuth() {
  if (state.user) return true;
  location.hash = '#/login';
  return false;
}

function bindForm(id, handler) {
  const form = document.getElementById(id);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  };
}

async function route() {
  const [path, query] = (location.hash.slice(1) || '/providers').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  renderNav();
  window.scrollTo(0, 0);

  try {
    if (parts[0] === 'login') return state.user ? (location.hash = '#/providers') : loginView();
    if (parts[0] === 'register') return state.user ? (location.hash = '#/providers') : registerView();
    if (parts[0] === 'providers' && parts[1]) return await providerDetailView(parts[1]);
    if (parts[0] === 'appointments') return await appointmentsView(params);
    if (parts[0] === 'profile') return await profileView();
    return await providersView(params);
  } catch (err) {
    view.innerHTML = `<div class="card empty">${esc(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', route);
route();
