// script.js — Versão corrigida e modular
// Funcionalidades:
// - Cadastro/login de usuários (localStorage)
// - Proteção da página index.html (apenas acessível quando logado)
// - CRUD local de aniversariantes + listagem e calendário
// - Mensagens centrais (balao) e popups de registro/erro

/* ---------- UTILIDADES ---------- */
function byId(id) { return document.getElementById(id); }
function qs(selector) { return document.querySelector(selector); }

function showMessage(text, timeout = 2500) {
  const box = document.createElement('div');
  box.className = 'balao-msg';
  box.textContent = text;
  // animação simples
  box.style.opacity = '0';
  box.style.transition = 'opacity 220ms ease, transform 220ms ease';
  setTimeout(() => { box.style.opacity = '1'; box.style.transform = 'translateX(-50%) translateY(0)'; }, 30);

  setTimeout(() => {
    box.style.opacity = '0';
    box.style.transform = 'translateX(-50%) translateY(-8px)';
    setTimeout(() => box.remove(), 240);
  }, timeout);
}

/* ---------- STORAGE: USUÁRIOS ---------- */
function saveUsers(users){ localStorage.setItem('usuarios', JSON.stringify(users)); }
function loadUsers(){ return JSON.parse(localStorage.getItem('usuarios')) || []; }
function saveLogged(email){ localStorage.setItem('logado', email); }
function clearLogged(){ localStorage.removeItem('logado'); }
function getLogged(){ return localStorage.getItem('logado'); }
function isLogged(){ return !!getLogged(); }

function registerUser(nome, email, senha){
  const users = loadUsers();
  if(users.some(u => u.email === email)) return { ok:false, msg: 'E-mail já cadastrado' };
  users.push({ nome, email, senha });
  saveUsers(users);
  return { ok:true };
}
function authenticate(email, senha){
  const users = loadUsers();
  return users.find(u => u.email === email && u.senha === senha) || null;
}

/* ---------- STORAGE: ANIVERSARIANTES ---------- */
function loadData(){ return JSON.parse(localStorage.getItem('aniversariantes')) || []; }
function saveData(data){ localStorage.setItem('aniversariantes', JSON.stringify(data)); }
function uid(){ return Date.now() + Math.floor(Math.random()*1000); }

/* ---------- FUNÇÕES DE FORMATAÇÃO ---------- */
function formatDate(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}
function formatDateShort(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

/* ---------- PROTEÇÃO DE PÁGINA (index.html) ---------- */
(function protectIndex(){
  try{
    const path = window.location.pathname;
    if(path.endsWith('index.html') || path.endsWith('/')){
      // Se a página é index, checar login
      if(!isLogged()){
        // redireciona para login
        window.location.href = 'login.html';
      }
    }
  }catch(e){ /* silencioso */ }
})();

/* ---------- AÇÕES DE LOGIN (login.html) ---------- */
(function setupLogin(){
  const loginForm = byId('loginForm');
  if(!loginForm) return; // não estamos na página de login

  const loginEmail = byId('loginEmail');
  const loginPassword = byId('loginPassword');
  const loginMessage = byId('loginMessage');

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = (loginEmail.value || '').trim();
    const senha = (loginPassword.value || '').trim();

    if(!email || !senha){
      if(loginMessage) { loginMessage.textContent = 'Preencha email e senha.'; loginMessage.style.display='block'; }
      return;
    }

    const user = authenticate(email, senha);
    if(user){
      saveLogged(email);
      if(loginMessage){
        loginMessage.textContent = 'Login realizado! Redirecionando...';
        loginMessage.style.display = 'block';
        loginMessage.style.background = '#2ecc71';
        loginMessage.style.color = '#052';
      }
      // redirecionar imediatamente
      setTimeout(() => { window.location.href = 'index.html'; }, 600);
    } else {
      if(loginMessage){
        loginMessage.textContent = 'Email ou senha inválidos.';
        loginMessage.style.display = 'block';
        loginMessage.style.background = '#e74c3c';
        loginMessage.style.color = '#fff';
      }
    }
  });
})();

/* ---------- AÇÕES DE REGISTRO DE USUÁRIO (cadastro.html) ---------- */
(function setupRegister(){
  const registerForm = byId('registerForm');
  if(!registerForm) return;

  const regName = byId('regName');
  const regEmail = byId('regEmail');
  const regPassword = byId('regPassword');
  const registerPopup = byId('registerPopup');

  function showRegPopup(msg, error=false){
    if(registerPopup){
      registerPopup.textContent = msg;
      registerPopup.style.display = 'block';
      registerPopup.style.background = error ? '#e74c3c' : '#2ecc71';
      registerPopup.style.color = error ? '#fff' : '#052';
      setTimeout(()=> registerPopup.style.display = 'none', 1400);
    } else {
      showMessage(msg);
    }
  }

  registerForm.addEventListener('submit', e => {
    e.preventDefault();
    const nome = (regName.value || '').trim();
    const email = (regEmail.value || '').trim();
    const senha = (regPassword.value || '').trim();

    if(!nome || !email || !senha){
      showRegPopup('Preencha todos os campos', true);
      return;
    }

    const r = registerUser(nome, email, senha);
    if(!r.ok){
      showRegPopup(r.msg, true);
      return;
    }

    showRegPopup('Cadastro concluído!');
    setTimeout(()=> { window.location.href = 'login.html'; }, 900);
  });
})();

/* ---------- AÇÕES E LOGIC DO INDEX (agenda) ---------- */
(function setupAgenda(){
  // elementos da agenda — se não existirem, sair silenciosamente
  const form = byId('formCadastro');
  const listEl = byId('birthday-list');
  const emptyMsg = byId('empty-msg');
  const globalMessages = byId('global-messages');
  const searchInput = byId('search');
  const filterMonth = byId('filter-month');
  const themeToggle = byId('theme-toggle');
  const notifyCheck = byId('notify-check');
  const calendarGrid = byId('calendar-grid');
  const calendarMonthTitle = byId('calendar-title-month');
  const prevMonthBtn = byId('prev-month');
  const nextMonthBtn = byId('next-month');
  const calendarDayInfo = byId('calendar-day-info');
  const logoutBtn = byId('logoutBtn');

  if(!form) return; // não estamos na página da agenda

  let currentDate = new Date();

  // helper: stringToColor
  function stringToColor(str){
    if(!str) str='x';
    let hash = 0;
    for(let i=0;i<str.length;i++){
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return `#${'00000'.substring(0,6-c.length)+c}`;
  }

  // password confirm e validações leves — usa os spans de erro existentes
  const campos = ['name','email','password','confirm-password','birthdate'];
  campos.forEach(cid => {
    const el = byId(cid);
    if(!el) return;
    el.addEventListener('input', ()=>{
      const err = byId(`error-${cid}`);
      if(el.validity.valid) { if(err) err.textContent=''; el.classList.remove('invalid'); }
      else { if(err){
        if(el.validity.valueMissing) err.textContent = 'Este campo é obrigatório.';
        else if(el.validity.typeMismatch) err.textContent = 'Formato inválido.';
        else if(el.validity.tooShort) err.textContent = `Mínimo de ${el.minLength} caracteres.`;
      } el.classList.add('invalid'); }
      if(cid==='password' || cid==='confirm-password'){
        const pw = (byId('password')||{}).value||'';
        const cf = (byId('confirm-password')||{}).value||'';
        if(pw && cf && pw !== cf){ const e = byId('error-confirm-password'); if(e) e.textContent='As senhas não conferem.'; }
        else { const e = byId('error-confirm-password'); if(e) e.textContent=''; }
      }
    });
  });

  // SUBMIT de cadastro de aniversariante
  form.addEventListener('submit', e =>{
    e.preventDefault();
    // validações
    const name = (byId('name')||{}).value.trim();
    const email = (byId('email')||{}).value.trim();
    const password = (byId('password')||{}).value || '';
    const confirm = (byId('confirm-password')||{}).value || '';
    const birthdate = (byId('birthdate')||{}).value || '';

    if(!name || !email || !birthdate){ showMessage('Preencha nome, email e data.'); return; }
    if(password !== confirm){ showMessage('As senhas não conferem.', 2000); return; }

    const idField = byId('currentId');
    const isEditing = idField && idField.value;

    const data = loadData();

    if(isEditing){
      const idx = data.findIndex(x => String(x.id) === String(idField.value));
      if(idx > -1){
        data[idx] = { ...data[idx], name, email, password, birthdate };
        saveData(data);
        showMessage('Cadastro atualizado com sucesso!');
      }
      idField.value = '';
      const sb = byId('save-btn'); if(sb) sb.textContent='Cadastrar';
      const ce = byId('cancel-edit'); if(ce) ce.style.display='none';
    } else {
      data.push({ id: uid(), name, email, password, birthdate });
      saveData(data);
      showMessage('Aniversariante cadastrado com sucesso!');
    }

    form.reset();
    campos.forEach(c => { const e = byId(`error-${c}`); if(e) e.textContent=''; const el = byId(c); if(el) el.classList.remove('invalid'); });
    renderList();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  });

  // edição/exclusão
  function startEdit(id){
    const data = loadData();
    const item = data.find(x => x.id === id);
    if(!item) return;
    if(byId('currentId')) byId('currentId').value = String(item.id);
    if(byId('name')) byId('name').value = item.name;
    if(byId('email')) byId('email').value = item.email;
    if(byId('password')) byId('password').value = item.password;
    if(byId('confirm-password')) byId('confirm-password').value = item.password;
    if(byId('birthdate')) byId('birthdate').value = item.birthdate;
    const sb = byId('save-btn'); if(sb) sb.textContent='Salvar';
    const ce = byId('cancel-edit'); if(ce) ce.style.display='inline-block';
    // ir para aba cadastro
    const tab = qs('.tab-btn[data-tab="cadastro"]'); if(tab) tab.click();
  }

  const cancelEditBtn = byId('cancel-edit');
  if(cancelEditBtn) cancelEditBtn.addEventListener('click', ()=>{
    if(byId('currentId')) byId('currentId').value = '';
    form.reset();
    const sb = byId('save-btn'); if(sb) sb.textContent='Cadastrar';
    cancelEditBtn.style.display='none';
  });

  function deleteBirthday(id){
    if(!confirm('Deseja realmente excluir este aniversariante?')) return;
    const data = loadData().filter(x => x.id !== id);
    saveData(data);
    showMessage('Registro excluído.');
    renderList();
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  }

  /* LISTAGEM E FILTROS */
  function nextBirthdayDate(birthdate){
    const now = new Date();
    const b = new Date(birthdate + 'T00:00:00');
    const year = now.getFullYear();
    let next = new Date(year, b.getMonth(), b.getDate());
    if(next < new Date(now.getFullYear(), now.getMonth(), now.getDate())){
      next = new Date(year+1, b.getMonth(), b.getDate());
    }
    return next;
  }
  function daysUntil(date){
    const now = new Date();
    return Math.ceil((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (1000*60*60*24));
  }

  function renderList(){
    const data = loadData();
    const month = (filterMonth && filterMonth.value) ? filterMonth.value : 'all';
    const query = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';

    let filtered = data.slice().sort((a,b)=>{
      const da = new Date(a.birthdate + 'T00:00:00');
      const db = new Date(b.birthdate + 'T00:00:00');
      if(da.getMonth() !== db.getMonth()) return da.getMonth() - db.getMonth();
      return da.getDate() - db.getDate();
    });

    if(month !== 'all') filtered = filtered.filter(item => new Date(item.birthdate + 'T00:00:00').getMonth()+1 == month);
    if(query) filtered = filtered.filter(item => item.name.toLowerCase().includes(query));

    if(!listEl) return;
    listEl.innerHTML = '';

    if(filtered.length === 0){ if(emptyMsg) emptyMsg.style.display='block'; }
    else{
      if(emptyMsg) emptyMsg.style.display='none';
      filtered.forEach(item => {
        const li = document.createElement('li'); li.className='birthday-item';

        const avatar = document.createElement('div'); avatar.className='avatar'; avatar.textContent = (item.name||' ')[0].toUpperCase(); avatar.style.background = stringToColor(item.name||'x');
        const nameEl = document.createElement('div'); nameEl.className='details';
        const nm = document.createElement('div'); nm.className='name'; nm.textContent = item.name;
        const meta = document.createElement('div'); meta.className='meta';
        const next = nextBirthdayDate(item.birthdate); const days = daysUntil(next);
        meta.textContent = `${formatDate(item.birthdate)} • Em ${days} dia(s)`;
        nameEl.appendChild(nm); nameEl.appendChild(meta);

        const left = document.createElement('div'); left.className='left'; left.appendChild(avatar); left.appendChild(nameEl);

        const actions = document.createElement('div'); actions.className='item-actions';
        const btnEdit = document.createElement('button'); btnEdit.className='btn-edit'; btnEdit.textContent='Editar'; btnEdit.addEventListener('click', ()=> startEdit(item.id));
        const btnDelete = document.createElement('button'); btnDelete.className='btn-delete'; btnDelete.textContent='Excluir'; btnDelete.addEventListener('click', ()=> deleteBirthday(item.id));
        actions.appendChild(btnEdit); actions.appendChild(btnDelete);

        li.appendChild(left); li.appendChild(actions); listEl.appendChild(li);
      });
    }
    renderUpcoming();
  }

  function renderUpcoming(){
    const data = loadData();
    if(!byId('upcoming-next')) return;
    if(data.length === 0){ byId('upcoming-next').textContent = ''; return; }
    let next = null;
    data.forEach(item => { const n = nextBirthdayDate(item.birthdate); if(!next || n < next.date) next = { date: n, item }; });
    if(next){ const days = daysUntil(next.date); byId('upcoming-next').textContent = `Próximo: ${next.item.name} — em ${days} dia(s) (${formatDate(next.item.birthdate)})`; }
  }

  /* CALENDÁRIO */
  function renderCalendar(year, month){
    if(!calendarGrid || !calendarMonthTitle) return;
    calendarGrid.innerHTML = '';
    calendarMonthTitle.textContent = `${new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    for(let i=0;i<firstDayOfWeek;i++){ const empty = document.createElement('div'); empty.className='calendar-cell'; calendarGrid.appendChild(empty); }

    const data = loadData();
    for(let day=1; day<=daysInMonth; day++){
      const dd = document.createElement('div'); dd.className='calendar-cell';
      const dayNum = document.createElement('div'); dayNum.className='cell-day'; dayNum.textContent = day; dd.appendChild(dayNum);
      const badgeWrap = document.createElement('div'); badgeWrap.className='cell-badge';
      const matches = data.filter(item => { const d = new Date(item.birthdate + 'T00:00:00'); return d.getDate() === day && d.getMonth() === month; });
      matches.forEach(m => { const b = document.createElement('div'); b.className='badge'; b.textContent = (m.name||'').split(' ')[0]; badgeWrap.appendChild(b); });
      dd.appendChild(badgeWrap);
      dd.addEventListener('click', () => {
        if(!calendarDayInfo) return;
        if(matches.length === 0) calendarDayInfo.textContent = `Nenhum aniversariante em ${day}/${month+1}/${year}.`;
        else calendarDayInfo.innerHTML = `<strong>${day}/${month+1}/${year}:</strong> ` + matches.map(m => `${m.name} (${formatDateShort(m.birthdate)})`).join(' — ');
        calendarDayInfo.scrollIntoView({ behavior: 'smooth' });
      });
      calendarGrid.appendChild(dd);
    }
  }

  if(prevMonthBtn) prevMonthBtn.addEventListener('click', ()=>{ currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); });
  if(nextMonthBtn) nextMonthBtn.addEventListener('click', ()=>{ currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); });

  async function notifPermission(){ if(!('Notification' in window)) return false; if(Notification.permission === 'granted') return true; if(Notification.permission !== 'denied'){ const res = await Notification.requestPermission(); return res === 'granted'; } return false; }

  async function checkTodayBirthdays(alsoNotify=true){
    const data = loadData();
    const now = new Date();
    const todays = data.filter(item => { const d = new Date(item.birthdate + 'T00:00:00'); return d.getDate() === now.getDate() && d.getMonth() === now.getMonth(); });
    const alertBoxId = 'today-alert';
    let alertBox = byId(alertBoxId);
    if(!alertBox){
      alertBox = document.createElement('div'); alertBox.id = alertBoxId;
      alertBox.style.padding = '12px'; alertBox.style.borderRadius='8px'; alertBox.style.marginBottom='12px'; alertBox.style.fontWeight='700';
      const mainEl = document.querySelector('main'); if(mainEl) mainEl.prepend(alertBox);
    }
    if(todays.length > 0){ const names = todays.map(t => t.name).join(', '); alertBox.textContent = `🎉 Hoje é aniversário de ${names}! 🎂`; alertBox.style.background = '#ffb347'; alertBox.style.color='#222';
      if(alsoNotify && await notifPermission()){ new Notification('Aniversário!', { body: `Hoje é aniversário de ${names}! 🎉` }); }
    } else { if(alertBox) alertBox.remove(); }
  }

  if(notifyCheck) notifyCheck.addEventListener('click', ()=> checkTodayBirthdays(true));

  // abas
  const tabs = Array.from(document.querySelectorAll('.tab-btn')); const contents = Array.from(document.querySelectorAll('.tab-content'));
  tabs.forEach(tab => { tab.addEventListener('click', ()=>{
    tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
    contents.forEach(c => c.classList.remove('active'));
    const target = byId(tab.dataset.tab); if(target) target.classList.add('active');
    if(tab.dataset.tab === 'consulta'){ renderList(); checkTodayBirthdays(false); }
    if(tab.dataset.tab === 'calendar'){ renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); }
  }); });

  if(searchInput) searchInput.addEventListener('input', renderList);
  if(filterMonth) filterMonth.addEventListener('change', renderList);

  // tema
  function applyTheme(theme){ if(theme === 'dark'){ document.body.classList.add('dark-mode'); if(themeToggle) themeToggle.textContent = '☀️'; } else { document.body.classList.remove('dark-mode'); if(themeToggle) themeToggle.textContent = '🌙'; } localStorage.setItem('theme', theme); }
  const savedTheme = localStorage.getItem('theme') || 'light'; applyTheme(savedTheme);
  if(themeToggle) themeToggle.addEventListener('click', ()=>{ const cur = document.body.classList.contains('dark-mode') ? 'dark' : 'light'; applyTheme(cur === 'dark' ? 'light' : 'dark'); });

  // logout
  if(logoutBtn) logoutBtn.addEventListener('click', ()=>{ clearLogged(); window.location.href='login.html'; });

  // init
  function init(){ renderList(); renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); checkTodayBirthdays(false); }
  init();

})();

/* ---------- FIM ---------- */
