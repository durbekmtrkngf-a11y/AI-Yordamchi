import { render } from 'preact'
import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { supabase, toEmail, friendlyError } from './lib.js'
import { store } from './store.js'
import { html, useT, LangProvider, LangSwitch, PasswordInput, Host, Icon, ask, toast } from './ui.js'
import { BossApp } from './boss.js'
import { WorkerApp } from './worker.js'

/* ===================== Kirish / Ro'yxatdan o'tish / Parolni tiklash ===================== */
const WORKER_TYPES = [['zakatofkachi', 'Zakatofkachi'], ['kosib', 'Kosib'], ['kroychik', 'Kroychik'], ['pardozchi', 'Pardozchi']]

function Auth() {
  const { t } = useT()
  const urlCode = new URLSearchParams(location.search).get('kod') || ''
  const [mode, setMode] = useState(urlCode ? 'register' : 'login')
  const [role, setRole] = useState(urlCode ? 'worker' : 'boss')
  const [f, setF] = useState({ fullName: '', phone: '', login: '', company: '', code: urlCode, wtype: 'kosib' })
  const [password, setPassword] = useState(''); const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [info, setInfo] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value })

  async function submit(e) {
    e.preventDefault(); setErr(''); setInfo('')
    try {
      if (!f.login.trim()) throw new Error(t('Login kiriting'))
      if (mode === 'reset') {
        if (!f.login.includes('@')) throw new Error(t('Parolni tiklash uchun elektron pochta kerak'))
        setBusy(true)
        const { error } = await supabase.auth.resetPasswordForEmail(f.login.trim().toLowerCase(), { redirectTo: location.origin + location.pathname })
        if (error) throw error
        setInfo(t('Pochtangizga parolni tiklash havolasi yuborildi')); return
      }
      if (password.length < 6) throw new Error(t('Parol kamida 6 belgidan iborat bo‘lsin'))
      if (mode === 'login') {
        setBusy(true)
        const { error } = await supabase.auth.signInWithPassword({ email: toEmail(f.login), password })
        if (error) throw error
        return
      }
      if (password !== password2) throw new Error(t('Parollar bir xil emas'))
      if (!f.fullName.trim()) throw new Error(t('Ism va familiyani kiriting'))
      if (!f.phone.trim()) throw new Error(t('Telefon raqamini kiriting'))
      if (role === 'boss' && !f.company.trim()) throw new Error(t('Sex nomini kiriting'))
      if (role === 'worker' && !f.code.trim()) throw new Error(t('Boshliq bergan taklif kodini kiriting'))
      setBusy(true)
      const { data, error } = await supabase.auth.signUp({
        email: toEmail(f.login), password,
        options: { data: { full_name: f.fullName.trim(), phone: f.phone.trim(), login: f.login.trim(), role, company_name: f.company.trim(), invite_code: f.code.trim(), worker_type: f.wtype } },
      })
      if (error) throw error
      if (!data.session) setInfo(t('Pochtangizga tasdiqlash xati yuborildi. Tasdiqlab, keyin kiring.'))
    } catch (e2) { setErr(friendlyError(e2 && e2.message ? e2.message : e2)) } finally { setBusy(false) }
  }
  const tabs = [['login', 'Kirish'], ['register', 'Ro‘yxatdan o‘tish'], ['reset', 'Parolni tiklash']]
  const label = mode === 'login' ? 'Kirish' : mode === 'register' ? 'Ro‘yxatdan o‘tish' : 'Havola yuborish'
  return html`<div class="auth-wrap">
    <div style="display:flex;justify-content:flex-end"><${LangSwitch} dark=${true} /></div>
    <img class="auth-logo" src="icon-192.png" alt="" />
    <h1 class="auth-title">${t('Poyabzal Seh')}</h1>
    <div class="tabs">${tabs.map(([m, l]) => html`<button class=${mode === m ? 'on' : ''} onClick=${() => { setMode(m); setErr(''); setInfo('') }}>${t(l)}</button>`)}</div>
    <form class="card" onSubmit=${submit}>
      ${mode === 'register' && html`
        <div class="tabs"><button type="button" class=${role === 'boss' ? 'on' : ''} onClick=${() => setRole('boss')}>${t('Boshliq')}</button>
          <button type="button" class=${role === 'worker' ? 'on' : ''} onClick=${() => setRole('worker')}>${t('Ishchi')}</button></div>
        <input placeholder=${t('Ism va familiya')} value=${f.fullName} onInput=${set('fullName')} />
        <input placeholder=${t('Telefon raqami')} inputmode="tel" value=${f.phone} onInput=${set('phone')} />
        ${role === 'boss' && html`<input placeholder=${t('Sex nomi')} value=${f.company} onInput=${set('company')} />`}
        ${role === 'worker' && html`<select value=${f.wtype} onChange=${set('wtype')}>${WORKER_TYPES.map(([c, n]) => html`<option value=${c}>${t(n)}</option>`)}</select>
          <input placeholder=${t('Taklif kodi')} value=${f.code} onInput=${set('code')} />`}`}
      <input placeholder=${t(mode === 'reset' ? 'Elektron pochta' : 'Login yoki elektron pochta')} autocapitalize="none" autocorrect="off" value=${f.login} onInput=${set('login')} />
      ${mode !== 'reset' && html`<${PasswordInput} value=${password} onChange=${setPassword} placeholder=${t('Parol')} />`}
      ${mode === 'register' && html`<${PasswordInput} value=${password2} onChange=${setPassword2} placeholder=${t('Parolni takrorlang')} />`}
      ${err && html`<div class="msg err">${err}</div>`}${info && html`<div class="msg ok">${info}</div>`}
      <button class="btn primary block" disabled=${busy}>${busy ? t('Kuting...') : t(label)}</button>
    </form>
  </div>`
}

function NewPassword({ onDone }) {
  const { t } = useT(); const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [err, setErr] = useState('')
  async function save(e) {
    e.preventDefault()
    if (p1.length < 6) return setErr(t('Parol kamida 6 belgidan iborat bo‘lsin'))
    if (p1 !== p2) return setErr(t('Parollar bir xil emas'))
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return setErr(friendlyError(error.message))
    onDone()
  }
  return html`<div class="auth-wrap"><h1 class="auth-title">${t('Yangi parol')}</h1>
    <form class="card" onSubmit=${save}>
      <${PasswordInput} value=${p1} onChange=${setP1} placeholder=${t('Yangi parol')} />
      <${PasswordInput} value=${p2} onChange=${setP2} placeholder=${t('Parolni takrorlang')} />
      ${err && html`<div class="msg err">${err}</div>`}<button class="btn primary block">${t('Saqlash')}</button></form></div>`
}

/* ===================== Gate: foydalanuvchining sexdagi holatiga qarab oyna ===================== */
const readIdentity = () => { try { return JSON.parse(localStorage.getItem('seh_identity')) } catch (_) { return null } }
const isNet = (e) => !e || (!e.code && /fetch|network|load failed/i.test(String(e.message || e)))

function Gate({ session, offline }) {
  const { t } = useT()
  const uid = session.user.id
  const [memberships, setMemberships] = useState(null); const [err, setErr] = useState('')
  const finishing = useRef(false)

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('memberships').select('id, role, status, company_id, companies(name, invite_code), worker_types(name)').eq('user_id', uid)
      if (error) throw error
      setErr(''); setMemberships(data || [])
      if (data && data[0] && data[0].status === 'active') localStorage.setItem('seh_identity', JSON.stringify({ uid, m: data[0] }))
    } catch (e) {
      const c = readIdentity()
      if (c && c.uid === uid && isNet(e)) setMemberships([c.m])  // internet yo'q: oxirgi ma'lum holat bilan ishlaymiz
      else setErr(friendlyError(e.message || e))
    }
  }, [uid])
  useEffect(() => { load() }, [load])

  // Ro'yxatdan o'tish tugallanmagan bo'lsa (sex hali yaratilmagan) - avtomatik tugatamiz
  useEffect(() => {
    if (memberships === null || memberships.length > 0 || finishing.current || offline) return
    const m = session.user.user_metadata || {}
    if (!m.role) return
    finishing.current = true
    ;(async () => {
      const res = m.role === 'boss'
        ? await supabase.rpc('register_boss', { p_company_name: m.company_name })
        : await supabase.rpc('join_company', { p_code: m.invite_code, p_type_code: m.worker_type })
      if (res.error) { setErr(friendlyError(res.error.message)); finishing.current = false; return }
      await load()
    })()
  }, [memberships, session.user, load])

  const m = memberships && memberships[0]
  useEffect(() => { if (m && m.status === 'active') store.init({ userId: uid, companyId: m.company_id, role: m.role }, supabase) }, [m && m.id, m && m.status])

  async function logout() {
    const n = store.status().pending
    if (n > 0 && !(await ask(`${n} ${t('ta o‘zgarish hali yuborilmagan. Chiqsangiz, ular telefonda saqlanadi va shu akkauntga qayta kirganda yuboriladi. Chiqilsinmi?')}`, { danger: true }))) return
    store.stop(); localStorage.removeItem('seh_identity'); await supabase.auth.signOut(); location.hash = ''
  }

  if (err) return html`<div class="center-screen"><div class="msg err">${err}</div>
    <button class="btn" onClick=${() => { setErr(''); load() }}>${t('Qayta urinish')}</button><button class="btn ghost" onClick=${logout}>${t('Chiqish')}</button></div>`
  if (memberships === null) return html`<div class="center-screen"><${Icon} name="sync" size=${30} /><span class="muted">${t('Yuklanmoqda...')}</span></div>`
  if (!m) return html`<div class="center-screen"><${Icon} name="sync" size=${30} /><span class="muted">${t('Sex ma‘lumotlari tayyorlanmoqda...')}</span></div>`
  if (m.status === 'pending') return html`<div class="center-screen"><${Icon} name="clock" size=${40} /><h2>${t('So‘rov yuborildi')}</h2>
    <p class="muted">${t('Boshliq sizni tasdiqlagandan keyin ishlay olasiz.')}</p>
    <button class="btn primary" onClick=${load}>${t('Yangilash')}</button><button class="btn ghost" onClick=${logout}>${t('Chiqish')}</button></div>`
  if (m.status !== 'active') return html`<div class="center-screen"><${Icon} name="alert" size=${40} /><h2>${t('Kirish yopiq')}</h2>
    <p class="muted">${t('Boshliq so‘rovingizni rad etgan yoki sizni bloklagan.')}</p><button class="btn" onClick=${logout}>${t('Chiqish')}</button></div>`
  return m.role === 'boss' ? html`<${BossApp} membership=${m} onLogout=${logout} />` : html`<${WorkerApp} membership=${m} onLogout=${logout} />`
}

/* ===================== Asosiy ilova ===================== */
function App() {
  const { t } = useT()
  const [session, setSession] = useState(null); const [ready, setReady] = useState(false); const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session)
      else { const id = readIdentity(); if (id && navigator.onLine === false) setSession({ user: { id: id.uid, user_metadata: {} }, offline: true }) }
      setReady(true)
    }, () => {
      const id = readIdentity(); if (id) setSession({ user: { id: id.uid, user_metadata: {} }, offline: true }); setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) setSession(s); else if (event === 'SIGNED_OUT') setSession(null)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  if (!ready) return html`<div class="center-screen"><${Icon} name="sync" size=${30} /><span class="muted">${t('Yuklanmoqda...')}</span></div>`
  if (recovery) return html`<${NewPassword} onDone=${() => setRecovery(false)} />`
  if (!session) return html`<${Auth} />`
  return html`<${Gate} session=${session} offline=${!!session.offline} />`
}

render(html`<${LangProvider}><${App} /><${Host} /><//>`, document.getElementById('root'))
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
