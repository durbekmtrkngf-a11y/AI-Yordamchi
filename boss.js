import { useState, useEffect, useCallback } from 'preact/hooks'
import { html, useT, LangSwitch, BottomNav, useRoute, Soon, PasswordInput, fmtDate } from './ui.js'
import { supabase, friendlyError } from './lib.js'

const NAV = [
  ['bosh', '🏠', 'Bosh sahifa'], ['ishchilar', '👷', 'Ishchilar'], ['xarajat', '💸', 'Xarajatlar'],
  ['klient', '👥', 'Klientlar'], ['model', '👟', 'Modellar'], ['hamkor', '🤝', 'Hamkor'],
  ['ijara', '🏢', 'Ijara'], ['qiymat', '💰', 'Qiymatlar'], ['yana', '⋯', 'Yana'],
]
const SOON = {
  xarajat: ['Xarajatlar', 5, 'Xomashyo, charm, yelim, elektr va boshqa xarajatlarni yozish, tahrirlash va qidirish.'],
  klient: ['Klientlar', 5, 'Mijozlar, buyurtmalar, to‘lovlar va qarzdorlik.'],
  model: ['Modellar', 3, 'Poyabzal modellari va har bir kasb uchun ish haqi narxlari.'],
  hamkor: ['Hamkor', 6, 'Hamkor ulushi va unga berilgan pullar hisobi.'],
  ijara: ['Ijara', 6, 'Ijara kirim-chiqimi va to‘lov muddati eslatmalari.'],
  qiymat: ['Qiymatlar', 6, 'Har bir model uchun tannarx, sotuv narxi va foyda.'],
}

/** Boshliq kabineti: pastki navigatsiya + bo'limlar */
export function BossApp({ membership, onLogout }) {
  const [route, go] = useRoute('bosh')
  const cid = membership.company_id
  const [types, setTypes] = useState([])
  const [workers, setWorkers] = useState([])
  const [pending, setPending] = useState([])
  const [err, setErr] = useState('')

  const reload = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('worker_types').select('id, code, name').eq('company_id', cid).order('name'),
      supabase.from('workers')
        .select('id, full_name, phone, worker_type_id, membership_id, deleted_at, created_at')
        .eq('company_id', cid).order('full_name'),
      supabase.rpc('list_pending_members', { p_company: cid }),
    ])
    const e = a.error || b.error || c.error
    if (e) return setErr(friendlyError(e.message))
    setErr('')
    setTypes(a.data || []); setWorkers(b.data || []); setPending(c.data || [])
  }, [cid])
  useEffect(() => { reload() }, [reload])

  const p = { membership, types, workers, pending, reload, go, err, onLogout }
  let page
  if (route === 'ishchilar') page = html`<${Workers} ...${p} />`
  else if (route === 'yana') page = html`<${More} ...${p} />`
  else if (SOON[route]) page = html`<${Soon} title=${SOON[route][0]} stage=${SOON[route][1]} text=${SOON[route][2]} />`
  else page = html`<${Home} ...${p} />`

  return html`<div class="screen withnav">${page}</div>
    <${BottomNav} items=${NAV} route=${NAV.some((n) => n[0] === route) ? route : 'bosh'} go=${go} />`
}

function Home({ membership, types, workers, pending, go, err }) {
  const { t } = useT()
  const active = workers.filter((w) => !w.deleted_at)
  const count = (tid) => active.filter((w) => w.worker_type_id === tid).length
  return html`<div>
    <h1 class="brand">${membership.companies && membership.companies.name}</h1>
    ${err && html`<div class="msg err">${err}</div>`}
    <h2>${t('Ishchilar')}</h2>
    <div class="grid">
      ${types.map((ty) => html`<button class="stat" onClick=${() => go('ishchilar')}>
        <div class="n">${count(ty.id)}</div><div class="l">${t(ty.name)}</div></button>`)}
      <button class=${'stat' + (pending.length ? ' warn' : '')} onClick=${() => go('ishchilar')}>
        <div class="n">${pending.length}</div><div class="l">${t('Kutayotgan so‘rovlar')}</div></button>
    </div>
    <p class="muted">${t('Ish soni, maosh va foyda kartalari ish daftari yozilgach (3–4-bosqich) shu yerda chiqadi.')}</p>
  </div>`
}

function Workers({ types, workers, pending, reload }) {
  const { t } = useT()
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [err, setErr] = useState('')
  const typeName = (id) => (types.find((x) => x.id === id) || {}).name || ''
  const list = workers.filter((w) =>
    filter === 'arxiv' ? !!w.deleted_at : !w.deleted_at && (filter === 'all' || w.worker_type_id === filter))

  async function decide(id, ok) {
    if (!ok && !confirm(t('Rad etilsinmi?'))) return
    const { error } = await supabase.rpc('decide_member', { p_membership: id, p_approve: ok })
    if (error) return setErr(friendlyError(error.message))
    setErr(''); reload()
  }
  async function archive(w, on) {
    if (on && !confirm(t('Ishchi arxivlansinmi? U tizimga kira olmaydi.'))) return
    let r = await supabase.from('workers').update({ deleted_at: on ? new Date().toISOString() : null }).eq('id', w.id)
    if (!r.error && w.membership_id) {
      r = await supabase.from('memberships').update({ status: on ? 'blocked' : 'active' }).eq('id', w.membership_id)
    }
    if (r.error) return setErr(friendlyError(r.error.message))
    setErr(''); setOpen(null); reload()
  }

  return html`<div>
    <h1 class="brand">${t('Ishchilar')}</h1>
    ${err && html`<div class="msg err">${err}</div>`}
    ${pending.length > 0 && html`<h2>${t('Kutayotgan ishchilar')}</h2>
      ${pending.map((p) => html`<div class="card row">
        <div><b>${p.full_name}</b><br /><span class="muted">${t(p.worker_type || '')} · ${p.phone}</span></div>
        <div class="btns">
          <button class="primary" onClick=${() => decide(p.membership_id, true)}>✓</button>
          <button class="danger" onClick=${() => decide(p.membership_id, false)}>✕</button>
        </div></div>`)}`}
    <div class="chips">
      <button class=${filter === 'all' ? 'on' : ''} onClick=${() => setFilter('all')}>${t('Hammasi')}</button>
      ${types.map((ty) => html`<button class=${filter === ty.id ? 'on' : ''} onClick=${() => setFilter(ty.id)}>${t(ty.name)}</button>`)}
      <button class=${filter === 'arxiv' ? 'on' : ''} onClick=${() => setFilter('arxiv')}>${t('Arxiv')}</button>
    </div>
    ${list.length === 0 && html`<p class="muted">${t('Bu yerda hozircha ishchi yo‘q')}</p>`}
    ${list.map((w) => html`<div class="card">
      <div class="row2" onClick=${() => setOpen(open === w.id ? null : w.id)}>
        <div><b>${w.full_name}</b><br /><span class="muted">${t(typeName(w.worker_type_id))}</span></div>
        <span>${open === w.id ? '▲' : '▼'}</span>
      </div>
      ${open === w.id && html`
        <div>${t('Telefon')}: ${w.phone ? html`<a href=${'tel:' + w.phone}>${w.phone}</a>` : '—'}</div>
        <div class="muted">${t('Qo‘shilgan sana')}: ${fmtDate(w.created_at)}</div>
        ${w.deleted_at
          ? html`<button onClick=${() => archive(w, false)}>${t('Arxivdan qaytarish')}</button>`
          : html`<button class="danger" onClick=${() => archive(w, true)}>${t('Arxivlash')}</button>`}
      `}
    </div>`)}
  </div>`
}

function More({ membership, onLogout }) {
  const { t } = useT()
  const code = (membership.companies && membership.companies.invite_code) || ''
  const link = `${location.origin}${location.pathname}?kod=${code}`
  const [copied, setCopied] = useState(false)
  const [prof, setProf] = useState(null)
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('full_name, phone').maybeSingle().then(({ data }) => setProf(data))
  }, [])

  async function copy() {
    try { await navigator.clipboard.writeText(link) } catch (_) {}
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  async function changePw(e) {
    e.preventDefault()
    if (p1.length < 6) return setMsg(['err', t('Parol kamida 6 belgidan iborat bo‘lsin')])
    if (p1 !== p2) return setMsg(['err', t('Parollar bir xil emas')])
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return setMsg(['err', friendlyError(error.message)])
    setP1(''); setP2(''); setMsg(['ok', t('Parol o‘zgartirildi')])
  }

  return html`<div>
    <h1 class="brand">${t('Yana')}</h1>
    <div class="card">
      <div class="label">${t('Sex')}</div><b>${membership.companies && membership.companies.name}</b>
      <div class="label">${t('Taklif kodi (ishchilarga bering)')}</div>
      <div class="code">${code}</div>
      <button onClick=${copy}>${copied ? t('Nusxalandi') : t('Taklif havolasini nusxalash')}</button>
    </div>
    ${prof && html`<div class="card">
      <div class="label">${t('Profil')}</div><b>${prof.full_name}</b><span class="muted">${prof.phone}</span>
    </div>`}
    <form class="card" onSubmit=${changePw}>
      <div class="label">${t('Parolni o‘zgartirish')}</div>
      <${PasswordInput} value=${p1} onChange=${setP1} placeholder=${t('Yangi parol')} />
      <${PasswordInput} value=${p2} onChange=${setP2} placeholder=${t('Parolni takrorlang')} />
      ${msg && html`<div class=${'msg ' + msg[0]}>${msg[1]}</div>`}
      <button class="primary">${t('Saqlash')}</button>
    </form>
    <div class="card row"><span>${t('Til')}</span><${LangSwitch} /></div>
    <button class="danger" onClick=${onLogout}>${t('Chiqish')}</button>
  </div>`
}
