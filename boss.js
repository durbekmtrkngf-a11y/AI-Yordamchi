import { useState, useEffect } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Icon, BottomNav, useRoute, PasswordInput, LangSwitch, toast, todayStr, fmtDate, Empty } from './ui.js'
import { supabase, friendlyError } from './lib.js'
import * as C from './calc.js'
import { SyncBadge, SyncPage } from './sync-ui.js'
import { WorkersPage, WorkerPage, KasbPage, ApprovalsPage, ProductionPage } from './b-people.js'
import { ModelsPage, ValuesPage } from './b-catalog.js'
import { ExpensesPage, ClientsPage, FinancePage } from './b-money.js'
import { PartnersPage, RentPage } from './b-partner.js'
import { BackupPage } from './b-backup.js'

const NAV = [
  ['bosh', 'home', 'Bosh sahifa'], ['ishchilar', 'users', 'Ishchilar'], ['xarajat', 'wallet', 'Xarajatlar'],
  ['klient', 'user', 'Klientlar'], ['model', 'shoe', 'Modellar'], ['hamkor', 'partner', 'Hamkor'],
  ['ijara', 'building', 'Ijara'], ['qiymat', 'tag', 'Qiymatlar'], ['yana', 'more', 'Yana'],
]
const PARENT = { ishchi: 'ishchilar', tasdiq: 'ishchilar', kasb: 'bosh', ishlab: 'bosh', hisobot: 'yana', zaxira: 'yana', sinx: 'yana' }
const KASB_ORDER = ['kosib', 'zakatofkachi', 'kroychik', 'pardozchi']

/** Boshliq kabineti: pastki navigatsiya + hamma bo'limlar */
export function BossApp({ membership, onLogout }) {
  const [route, go] = useRoute('bosh')
  const [name, arg] = route.split('/')
  const p = { go, membership, arg, onLogout }
  const pages = {
    ishchilar: WorkersPage, ishchi: WorkerPage, kasb: KasbPage, tasdiq: ApprovalsPage, ishlab: ProductionPage,
    xarajat: ExpensesPage, klient: ClientsPage, hisobot: FinancePage, model: ModelsPage, qiymat: ValuesPage,
    hamkor: PartnersPage, ijara: RentPage, zaxira: BackupPage, yana: More,
    sinx: (q) => html`<${SyncPage} back=${() => q.go('yana')} />`,
  }
  const Page_ = pages[name] || Home
  const active = NAV.some((n) => n[0] === name) ? name : PARENT[name] || 'bosh'
  return html`<${Page_} ...${p} /><${BottomNav} items=${NAV} route=${active} go=${go} />`
}

function Home({ go, membership }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const company = membership.companies && membership.companies.name
  const days = []
  for (let i = 0; i < 30; i++) days.push(C.addDays(today, -i))
  const per = days.map((d) => ({ d, p: C.production(D, d) }))
  const used = new Set(); per.forEach((x) => x.p.rows.forEach((r) => used.add(r.modelId)))
  const cols = C.live(D.models).filter((m) => m.is_active || used.has(m.id)).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  const shown = per.filter((x) => x.p.pairs > 0 || x.d === today).slice(0, 14)
  const todayP = per[0].p
  return html`<${Page} title=${company} sub=${fmtDate(today)} right=${html`<${SyncBadge} go=${go} />`}>
    <button class="prod-card" onClick=${() => go('ishlab')}>
      <span class="cap">${t('Bugun chiqqan ish')}</span>
      <span class="big">${C.fmt(todayP.pairs)} ${t('juft')}</span>
    </button>
    <h2>${t('Kunlik ish chiqishi')}</h2>
    ${cols.length === 0 || shown.length === 0 ? html`<${Empty} icon="book" text=${t('Hozircha ish yo‘q')} />` : html`
      <div class="table-wrap"><table class="grid-t"><thead><tr><th>${t('Sana')}</th>${cols.map((m) => html`<th>${m.code}</th>`)}<th>${t('Jami')}</th></tr></thead>
        <tbody>${shown.map(({ d, p }) => html`<tr class=${d === today ? 'today' : ''}><td>${fmtDate(d)}</td>
          ${cols.map((m) => { const r = p.rows.find((x) => x.modelId === m.id); return html`<td class=${r ? 'has' : 'zero'}>${r ? r.pairs : '·'}</td>` })}
          <td class=${p.pairs ? 'has' : 'zero'}>${p.pairs || '·'}</td></tr>`)}</tbody></table></div>
      <p class="muted small">${t('Kosiblar bajargan ishlar (qaytarilganlar hisobga olinmaydi). Batafsil ma‘lumot bo‘limlar ichida.')}</p>`}
  <//>`
}

function More({ go, membership, onLogout }) {
  const { t } = useT()
  const code = (membership.companies && membership.companies.invite_code) || ''
  const link = `${location.origin}${location.pathname}?kod=${code}`
  const [prof, setProf] = useState(null)
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => { supabase.from('profiles').select('full_name, phone').maybeSingle().then(({ data }) => setProf(data), () => {}) }, [])
  async function copy() { try { await navigator.clipboard.writeText(link); toast(t('Nusxalandi')) } catch (_) { toast(link) } }
  async function changePw(e) {
    e.preventDefault()
    if (p1.length < 6) return toast(t('Parol kamida 6 belgidan iborat bo‘lsin'), 'err')
    if (p1 !== p2) return toast(t('Parollar bir xil emas'), 'err')
    const { error } = await supabase.auth.updateUser({ password: p1 })
    if (error) return toast(friendlyError(error.message), 'err')
    setP1(''); setP2(''); setOpen(false); toast(t('Parol o‘zgartirildi'))
  }
  return html`<${Page} title=${t('Yana')} sub=${prof && prof.full_name} right=${html`<${SyncBadge} go=${go} />`}>
    <div class="card">
      <div class="muted">${t('Sex')}</div><b>${membership.companies && membership.companies.name}</b>
      <div class="muted">${t('Taklif kodi (ishchilarga bering)')}</div>
      <div class="code">${code}</div>
      <button class="btn block" onClick=${copy}><${Icon} name="copy" size=${18} />${t('Taklif havolasini nusxalash')}</button>
    </div>
    <div class="list">
      <${Row} icon="chart" title=${t('Moliyaviy hisobot')} sub=${t('Tushum, foyda, naqd pul, qarzlar')} onClick=${() => go('hisobot')} />
      <${Row} icon="check" title=${t('Ishlarni tasdiqlash')} sub=${t('Ishchilar kiritgan ishlar')} onClick=${() => go('tasdiq')} />
      <${Row} icon="sync" title=${t('Sinxronlash')} sub=${t('Offline ma‘lumotlar va ziddiyatlar')} onClick=${() => go('sinx')} />
      <${Row} icon="shield" title=${t('Zaxira nusxa')} sub=${t('Saqlash, tiklash, Excel va CSV')} onClick=${() => go('zaxira')} />
    </div>
    <div class="card">
      <button class="row-item" style="box-shadow:none;padding:0" onClick=${() => setOpen(!open)}>
        <span class="row-ic"><${Icon} name="key" size=${20} /></span><span class="row-m"><b>${t('Parolni o‘zgartirish')}</b></span></button>
      ${open && html`<form class="card flat" onSubmit=${changePw}>
        <${PasswordInput} value=${p1} onChange=${setP1} placeholder=${t('Yangi parol')} />
        <${PasswordInput} value=${p2} onChange=${setP2} placeholder=${t('Parolni takrorlang')} />
        <button class="btn primary block">${t('Saqlash')}</button></form>`}
    </div>
    <div class="card"><div class="kv"><span>${t('Til')}</span><${LangSwitch} dark=${true} /></div></div>
    <button class="btn danger block" onClick=${onLogout}><${Icon} name="logout" size=${18} />${t('Chiqish')}</button>
    <p class="footer-note">Poyabzal Seh · AI Yordamchi</p>
  <//>`
}
