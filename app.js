import { h, render } from 'preact'
import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { supabase, toEmail, friendlyError } from './lib.js'
import { html, useT, LangProvider, LangSwitch, PasswordInput } from './ui.js'
import { BossApp } from './boss.js'
import { WorkerApp } from './worker.js'

/* ===================== Kirish / Ro'yxatdan o'tish / Tiklash ===================== */
const WORKER_TYPES = [['zakatofkachi', 'Zakatofkachi'], ['kosib', 'Kosib'], ['kroychik', 'Kroychik'], ['pardozchi', 'Pardozchi']]

function Auth() {
  const { t } = useT()
  const urlCode = new URLSearchParams(location.search).get('kod') || ''
  const [mode, setMode] = useState(urlCode ? 'register' : 'login')
  const [role, setRole] = useState(urlCode ? 'worker' : 'boss')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [company, setCompany] = useState('')
  const [code, setCode] = useState(urlCode)
  const [wtype, setWtype] = useState('kosib')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr(''); setInfo('')
    try {
      if (!login.trim()) throw new Error(t('Login kiriting'))
      if (mode === 'reset') {
        if (!login.includes('@')) throw new Error(t('Parolni tiklash uchun elektron pochta kerak'))
        setBusy(true)
        const { error } = await supabase.auth.resetPasswordForEmail(login.trim().toLowerCase(), {
          redirectTo: location.origin + location.pathname,
        })
        if (error) throw error
        setInfo(t('Pochtangizga parolni tiklash havolasi yuborildi'))
        return
      }
      if (password.length < 6) throw new Error(t('Parol kamida 6 belgidan iborat bo‘lsin'))
      if (mode === 'login') {
        setBusy(true)
        const { error } = await supabase.auth.signInWithPassword({ email: toEmail(login), password })
        if (error) throw error
        return
      }
      if (password !== password2) throw new Error(t('Parollar bir xil emas'))
      if (!fullName.trim()) throw new Error(t('Ism va familiyani kiriting'))
      if (!phone.trim()) throw new Error(t('Telefon raqamini kiriting'))
      if (role === 'boss' && !company.trim()) throw new Error(t('Sex nomini kiriting'))
      if (role === 'worker' && !code.trim()) throw new Error(t('Boshliq bergan taklif kodini kiriting'))
      setBusy(true)
      // Sex yaratish / sexga qo'shilish ma'lumotlari user_metadata ga yoziladi;
      // kirgandan keyin Gate ularni avtomatik bajaradi (jarayon uzilib qolmasligi uchun).
      const { data, error } = await supabase.auth.signUp({
        email: toEmail(login),
        password,
        options: { data: {
          full_name: fullName.trim(), phone: phone.trim(), login: login.trim(),
          role, company_name: company.trim(), invite_code: code.trim(), worker_type: wtype,
        } },
      })
      if (error) throw error
      if (!data.session) setInfo(t('Pochtangizga tasdiqlash xati yuborildi. Tasdiqlab, keyin kiring.'))
    } catch (e2) {
      setErr(friendlyError(e2 && e2.message ? e2.message : e2))
    } finally {
      setBusy(false)
    }
  }

  const tabs = [['login', 'Kirish'], ['register', 'Ro‘yxatdan o‘tish'], ['reset', 'Parolni tiklash']]
  const submitLabel = mode === 'login' ? 'Kirish' : mode === 'register' ? 'Ro‘yxatdan o‘tish' : 'Havola yuborish'

  return html`<div class="screen">
    <div class="topbar"><${LangSwitch} /></div>
    <img class="logo" src="icon-192.png" alt="" />
    <h1 class="brand">${t('Poyabzal Seh')}</h1>
    <div class="tabs">
      ${tabs.map(([m, label]) => html`<button class=${mode === m ? 'on' : ''}
        onClick=${() => { setMode(m); setErr(''); setInfo('') }}>${t(label)}</button>`)}
    </div>
    <form class="card" onSubmit=${submit}>
      ${mode === 'register' && html`
        <div class="seg">
          <button type="button" class=${role === 'boss' ? 'on' : ''} onClick=${() => setRole('boss')}>${t('Boshliq')}</button>
          <button type="button" class=${role === 'worker' ? 'on' : ''} onClick=${() => setRole('worker')}>${t('Ishchi')}</button>
        </div>
        <input placeholder=${t('Ism va familiya')} value=${fullName} onInput=${(e) => setFullName(e.target.value)} />
        <input placeholder=${t('Telefon raqami')} inputmode="tel" value=${phone} onInput=${(e) => setPhone(e.target.value)} />
        ${role === 'boss' && html`<input placeholder=${t('Sex nomi')} value=${company} onInput=${(e) => setCompany(e.target.value)} />`}
        ${role === 'worker' && html`
          <select value=${wtype} onChange=${(e) => setWtype(e.target.value)}>
            ${WORKER_TYPES.map(([c, n]) => html`<option value=${c}>${t(n)}</option>`)}
          </select>
          <input placeholder=${t('Taklif kodi')} value=${code} onInput=${(e) => setCode(e.target.value.toUpperCase())} />`}
      `}
      <input placeholder=${t(mode === 'reset' ? 'Elektron pochta' : 'Login yoki elektron pochta')}
        autocapitalize="none" autocorrect="off" value=${login} onInput=${(e) => setLogin(e.target.value)} />
      ${mode !== 'reset' && html`<${PasswordInput} value=${password} onChange=${setPassword} placeholder=${t('Parol')} />`}
      ${mode === 'register' && html`<${PasswordInput} value=${password2} onChange=${setPassword2} placeholder=${t('Parolni takrorlang')} />`}
      ${err && html`<div class="msg err">${err}</div>`}
      ${info && html`<div class="msg ok">${info}</div>`}
      <button class="primary" disabled=${busy}>${busy ? t('Kuting...') : t(submitLabel)}</button>
    </form>
  </div>`
}

function NewPassword({ onDone }) {
  const { t } = useT()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  async function save(e) {
    e.preventDefault()
    if (p1.length < 6) return setErr(t('Parol kamida 6 belgidan iborat bo‘lsin'))
    if (p1 !== p2) return setErr(t('Parollar bir xil emas'))
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return setErr(friendlyError(error.message))
    onDone()
  }
  return html`<div class="screen">
    <h1 class="brand">${t('Yangi parol')}</h1>
    <form class="card" onSubmit=${save}>
      <${PasswordInput} value=${p1} onChange=${setP1} placeholder=${t('Yangi parol')} />
      <${PasswordInput} value=${p2} onChange=${setP2} placeholder=${t('Parolni takrorlang')} />
      ${err && html`<div class="msg err">${err}</div>`}
      <button class="primary">${t('Saqlash')}</button>
    </form>
  </div>`
}

/* ===================== Gate: foydalanuvchi holatiga qarab oyna ===================== */
function Gate({ session }) {
  const { t } = useT()
  const [memberships, setMemberships] = useState(null)
  const [err, setErr] = useState('')
  const finishing = useRef(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('memberships')
      .select('id, role, status, company_id, companies(name, invite_code), worker_types(name)')
      .eq('user_id', session.user.id)
    if (error) return setErr(friendlyError(error.message))
    setMemberships(data || [])
  }, [session.user.id])
  useEffect(() => { load() }, [load])

  // Ro'yxatdan o'tish tugallanmagan bo'lsa (sex hali yaratilmagan) - avtomatik tugatamiz
  useEffect(() => {
    if (memberships === null || memberships.length > 0 || finishing.current) return
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

  const logout = () => supabase.auth.signOut()

  if (err) return html`<div class="screen center">
    <div class="msg err">${err}</div>
    <button onClick=${() => { setErr(''); load() }}>${t('Qayta urinish')}</button>
    <button onClick=${logout}>${t('Chiqish')}</button>
  </div>`
  if (memberships === null) return html`<div class="screen center">${t('Yuklanmoqda...')}</div>`
  const m = memberships[0]
  if (!m) return html`<div class="screen center">${t('Sex ma‘lumotlari tayyorlanmoqda...')}</div>`
  if (m.status === 'pending') return html`<div class="screen center">
    <h2>${t('So‘rov yuborildi')}</h2>
    <p>${t('Boshliq sizni tasdiqlagandan keyin ishlay olasiz.')}</p>
    <button onClick=${load}>${t('Yangilash')}</button>
    <button onClick=${logout}>${t('Chiqish')}</button>
  </div>`
  if (m.status !== 'active') return html`<div class="screen center">
    <h2>${t('Kirish yopiq')}</h2>
    <p>${t('Boshliq so‘rovingizni rad etgan yoki sizni bloklagan.')}</p>
    <button onClick=${logout}>${t('Chiqish')}</button>
  </div>`
  return m.role === 'boss'
    ? html`<${BossApp} membership=${m} onLogout=${logout} />`
    : html`<${WorkerApp} membership=${m} onLogout=${logout} />`
}

/* ===================== Asosiy ilova ===================== */
function App() {
  const { t } = useT()
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return html`<div class="screen center">${t('Yuklanmoqda...')}</div>`
  if (recovery) return html`<${NewPassword} onDone=${() => setRecovery(false)} />`
  if (!session) return html`<${Auth} />`
  return html`<${Gate} session=${session} />`
}

render(html`<${LangProvider}><${App} /><//>`, document.getElementById('root'))

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
