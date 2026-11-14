import { useState, useEffect } from 'preact/hooks'
import { html, useT, LangSwitch, BottomNav, useRoute, Soon, todayStr } from './ui.js'
import { supabase, friendlyError } from './lib.js'

const NAV = [
  ['bosh', '🏠', 'Bosh sahifa'], ['daftar', '📒', 'Ish daftari'],
  ['avans', '💵', 'Avans'], ['yana', '⋯', 'Yana'],
]

/** Ishchi kabineti: boshliq kabinetidan butunlay alohida interfeys.
    Server (RLS) ishchiga faqat o'z ma'lumotini beradi. */
export function WorkerApp({ membership, onLogout }) {
  const [route, go] = useRoute('bosh')
  let page
  if (route === 'daftar') page = html`<${Soon} title="Ish daftari" stage=${3} text="Kunlik jadval: sana va model kodlari bo‘yicha bajargan juftlaringizni kiritasiz." />`
  else if (route === 'avans') page = html`<${Soon} title="Avans" stage=${4} text="Olingan avans, qarz, to‘langan pul va qolgan ish haqini ko‘rish; avans so‘rovi yuborish." />`
  else if (route === 'yana') page = html`<${More} membership=${membership} onLogout=${onLogout} />`
  else page = html`<${Home} membership=${membership} />`
  return html`<div class="screen withnav">${page}</div>
    <${BottomNav} items=${NAV} route=${NAV.some((n) => n[0] === route) ? route : 'bosh'} go=${go} />`
}

function Home({ membership }) {
  const { t } = useT()
  const [stat, setStat] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    ;(async () => {
      const [w, a] = await Promise.all([
        supabase.from('work_entries').select('pairs, work_date, status'),
        supabase.from('advances').select('amount, status'),
      ])
      const e = w.error || a.error
      if (e) return setErr(friendlyError(e.message))
      const today = todayStr()
      const valid = (w.data || []).filter((x) => x.status !== 'returned')
      setStat({
        todayPairs: valid.filter((x) => x.work_date === today).reduce((s, x) => s + x.pairs, 0),
        totalPairs: valid.reduce((s, x) => s + x.pairs, 0),
        advance: (a.data || []).filter((x) => x.status === 'paid').reduce((s, x) => s + Number(x.amount), 0),
      })
    })()
  }, [])

  const v = (x) => (stat ? x : '…')
  return html`<div>
    <h1 class="brand">${membership.companies && membership.companies.name}</h1>
    <div class="label">${t('Kasbingiz')}: <b>${t((membership.worker_types && membership.worker_types.name) || '')}</b></div>
    ${err && html`<div class="msg err">${err}</div>`}
    <div class="grid">
      <div class="stat"><div class="n">${v(stat && stat.todayPairs)}</div><div class="l">${t('Bugun bajargan ish (juft)')}</div></div>
      <div class="stat"><div class="n">${v(stat && stat.totalPairs)}</div><div class="l">${t('Jami bajargan ish (juft)')}</div></div>
      <div class="stat"><div class="n">${v(stat && stat.advance)}</div><div class="l">${t('Olingan avans (so‘m)')}</div></div>
      <div class="stat soon"><div class="n">—</div><div class="l">${t('Hisoblangan maosh (4-bosqich)')}</div></div>
      <div class="stat soon"><div class="n">—</div><div class="l">${t('Qolgan ish haqi (4-bosqich)')}</div></div>
    </div>
  </div>`
}

function More({ membership, onLogout }) {
  const { t } = useT()
  const [prof, setProf] = useState(null)
  useEffect(() => {
    supabase.from('profiles').select('full_name, phone').maybeSingle().then(({ data }) => setProf(data))
  }, [])
  return html`<div>
    <h1 class="brand">${t('Yana')}</h1>
    ${prof && html`<div class="card">
      <div class="label">${t('Profil')}</div><b>${prof.full_name}</b><span class="muted">${prof.phone}</span>
      <div class="label">${t('Kasbingiz')}</div><b>${t((membership.worker_types && membership.worker_types.name) || '')}</b>
    </div>`}
    <div class="card row"><span>${t('Til')}</span><${LangSwitch} /></div>
    <button class="danger" onClick=${onLogout}>${t('Chiqish')}</button>
  </div>`
}
