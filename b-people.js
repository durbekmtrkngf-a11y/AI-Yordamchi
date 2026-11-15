import { useState, useEffect } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Chips, Icon, Field, MoneyInput, Sheet, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import { supabase, friendlyError } from './lib.js'
import * as C from './calc.js'

const mcode = (D, id) => (C.live(D.models).find((m) => m.id === id) || (D.models || []).find((m) => m.id === id) || {}).code || '?'
const typeName = (D, id) => ((D.worker_types || []).find((x) => x.id === id) || {}).name || ''
const STATUS = { pending: ['Kutilmoqda', 'amber'], approved: ['Tasdiqlangan', 'green'], returned: ['Qaytarilgan', 'red'] }

/* ===================== Ishchilar ro'yxati ===================== */
export function WorkersPage({ go, membership }) {
  const { t } = useT()
  const S = useStore(); const D = S.all()
  const [pending, setPending] = useState([])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const loadPending = () => supabase.rpc('list_pending_members', { p_company: membership.company_id })
    .then(({ data }) => setPending(data || []), () => {})
  useEffect(() => { loadPending() }, [])

  async function decide(id, ok) {
    if (!ok && !(await ask(t('So‘rov rad etilsinmi?'), { danger: true }))) return
    const { error } = await supabase.rpc('decide_member', { p_membership: id, p_approve: ok })
    if (error) return toast(friendlyError(error.message), 'err')
    toast(ok ? t('Ishchi qabul qilindi') : t('So‘rov rad etildi'))
    loadPending(); S.load()
  }
  const types = C.live(D.worker_types)
  const pre = C.pricedEntries(D)
  const list = (D.workers || []).filter((w) => {
    if (filter === 'arxiv') return !!w.deleted_at
    if (w.deleted_at) return false
    if (filter !== 'all' && w.worker_type_id !== filter) return false
    return !q || w.full_name.toLowerCase().includes(q.toLowerCase())
  }).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return html`<${Page} title=${t('Ishchilar')} sub=${`${list.length} ${t('ta')}`}>
    ${pending.length > 0 && html`<h2 style="margin-top:6px">${t('Kutayotgan ishchilar')}</h2>
      <div class="list">${pending.map((p) => html`<div class="card" style="margin:0">
        <div class="kv"><div><b>${p.full_name}</b><br /><span class="muted">${t(p.worker_type || '')} · ${p.phone}</span></div></div>
        <div class="btns"><button class="btn primary sm" onClick=${() => decide(p.membership_id, true)}><${Icon} name="check" size=${16} />${t('Qabul qilish')}</button>
          <button class="btn danger sm" onClick=${() => decide(p.membership_id, false)}><${Icon} name="x" size=${16} />${t('Rad etish')}</button></div>
      </div>`)}</div>`}
    <div class="search"><${Icon} name="search" size=${18} /><input placeholder=${t('Ism bo‘yicha qidirish')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <${Chips} value=${filter} onChange=${setFilter}
      items=${[['all', t('Hammasi')], ...types.map((x) => [x.id, t(x.name)]), ['arxiv', t('Arxiv')]]} />
    ${list.length === 0 && html`<${Empty} icon="users" text=${t('Bu yerda hozircha ishchi yo‘q')} />`}
    <div class="list">${list.map((w) => {
      const l = C.workerLedger(D, w.id, undefined, undefined, pre)
      return html`<${Row} icon="user" title=${w.full_name} sub=${`${t(typeName(D, w.worker_type_id))}${w.phone ? ' · ' + w.phone : ''}`}
        right=${html`<span class=${l && l.balance > 0 ? 'pos' : ''}>${C.fmt(l ? l.balance : 0)}</span>`} onClick=${() => go('ishchi/' + w.id)} />`
    })}</div>
  <//>`
}

/* ===================== Bitta ishchi: hisob-kitob va ishlar ===================== */
export function WorkerPage({ arg, go }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const [from, setFrom] = useState(C.monthStart(today)); const [to, setTo] = useState(today)
  const [sheet, setSheet] = useState(null)
  const l = C.workerLedger(D, arg, from, to)
  if (!l) return html`<${Page} title=${t('Ishchi')} back=${() => go('ishchilar')}><${Empty} text=${t('Ishchi topilmadi')} /><//>`
  const w = l.worker
  const rows = l.entries.filter((e) => C.inRange(e.work_date, from, to)).sort((a, b) => (a.work_date < b.work_date ? 1 : -1))
  const advs = C.live(D.advances).filter((a) => a.worker_id === arg).sort((a, b) => (a.advance_date < b.advance_date ? 1 : -1))
  const debts = C.live(D.debts).filter((a) => a.worker_id === arg)
  const pays = C.live(D.salary_payments).filter((a) => a.worker_id === arg)

  async function returnEntry(e) {
    const r = await ask(t('Ish tuzatish uchun qaytarilsinmi? Ishchi uni qayta kiritadi.'), { input: t('Sabab (ixtiyoriy)'), danger: true, options: [{ value: true, label: t('Qaytarish'), tone: 'danger' }] })
    if (r) { S.patch('work_entries', e.id, { status: 'returned', return_note: r.text || '' }); toast(t('Qaytarildi')) }
  }
  async function archiveWorker() {
    if (!(await ask(t('Ishchi arxivlansinmi? U tizimga kira olmaydi, hisob-kitob tarixi saqlanadi.'), { danger: true }))) return
    S.patch('workers', w.id, { deleted_at: new Date().toISOString() })
    if (w.membership_id) supabase.from('memberships').update({ status: 'blocked' }).eq('id', w.membership_id).then(({ error }) => { if (error) toast(t('Kirishni bloklash uchun internet kerak'), 'err') }, () => toast(t('Kirishni bloklash uchun internet kerak'), 'err'))
    go('ishchilar')
  }
  async function restoreWorker() {
    S.patch('workers', w.id, { deleted_at: null })
    if (w.membership_id) supabase.from('memberships').update({ status: 'active' }).eq('id', w.membership_id).then(() => {}, () => {})
    toast(t('Arxivdan qaytarildi'))
  }
  const del = async (table, id) => { if (await ask(t('Bu yozuv arxivlansinmi?'), { danger: true })) S.archive(table, id) }

  return html`<${Page} title=${w.full_name} sub=${t(typeName(D, w.worker_type_id))} back=${() => go('ishchilar')}
    right=${w.phone ? html`<a class="icon-btn light" href=${'tel:' + w.phone}><${Icon} name="phone" size=${20} /></a>` : null}>
    <div class="card">
      <div class="kv big"><span>${t('Qolgan ish haqi')}</span><b class=${l.balance >= 0 ? 'pos' : 'neg'}>${C.fmt(l.balance)} ${t('so‘m')}</b></div>
      <div class="kv"><span>${t('Jami hisoblangan')}</span><b>${C.fmt(l.earned)}</b></div>
      <div class="kv"><span>− ${t('Berilgan avans')}</span><b>${C.fmt(l.advances)}</b></div>
      <div class="kv"><span>− ${t('Qarz')}</span><b>${C.fmt(l.debts)}</b></div>
      <div class="kv"><span>− ${t('To‘langan maosh')}</span><b>${C.fmt(l.paid)}</b></div>
      ${l.unverified > 0 && html`<div class="msg warn">${t('Shundan tasdiqlanmagan')}: ${C.fmt(l.unverified)} ${t('so‘m')}</div>`}
      ${l.noPrice > 0 && html`<div class="msg warn">${l.noPrice} ${t('ta ish uchun narx belgilanmagan (Modellar bo‘limi)')}</div>`}
    </div>
    <div class="btns" style="margin-bottom:12px">
      <button class="btn primary" onClick=${() => setSheet('salary_payments')}><${Icon} name="cash" size=${18} />${t('Maosh to‘lash')}</button>
      <button class="btn" onClick=${() => setSheet('advances')}>${t('Avans berish')}</button>
      <button class="btn" onClick=${() => setSheet('debts')}>${t('Qarz yozish')}</button>
    </div>
    <h2>${t('Ishlar hisoboti')}</h2>
    <div class="datebar"><input type="date" value=${from} onInput=${(e) => setFrom(e.target.value)} /><span>—</span><input type="date" value=${to} onInput=${(e) => setTo(e.target.value)} /></div>
    <div class="grid"><${Stat} n=${C.fmt(l.periodPairs)} label=${t('Ish soni (juft)')} /><${Stat} tone="green" n=${C.fmt(l.periodEarned)} label=${t('Davr ish haqi (so‘m)')} /></div>
    ${rows.length === 0 && html`<${Empty} icon="book" text=${t('Bu davrda ish yo‘q')} />`}
    <div class="list">${rows.map((e) => html`<div class="card" style="margin:0;padding:12px 14px">
      <div class="kv"><b>${fmtDate(e.work_date)} · ${t('Model')} ${mcode(D, e.model_id)}</b><span class=${'pill ' + STATUS[e.status][1]}>${t(STATUS[e.status][0])}</span></div>
      <div class="kv"><span>${e.pairs} ${t('juft')} × ${e.price === null ? '?' : C.fmt(e.price)}</span><b>${C.fmt(e.amount)}</b></div>
      <div class="btns">
        ${e.status === 'pending' && html`<button class="btn primary sm" onClick=${() => S.patch('work_entries', e.id, { status: 'approved' })}><${Icon} name="check" size=${16} />${t('Tasdiqlash')}</button>`}
        <button class="btn sm" onClick=${() => returnEntry(e)}>${t('Qaytarish')}</button>
      </div></div>`)}</div>
    ${advs.length > 0 && html`<h2>${t('Avanslar')}</h2><div class="list">${advs.map((a) => html`<div class="card" style="margin:0;padding:12px 14px">
      <div class="kv"><b>${C.fmt(a.amount)} ${t('so‘m')}</b><span class=${'pill ' + (a.status === 'paid' ? 'green' : a.status === 'rejected' ? 'red' : 'amber')}>${t(a.status === 'paid' ? 'Berilgan' : a.status === 'rejected' ? 'Rad etilgan' : 'So‘ralgan')}</span></div>
      <div class="muted small">${fmtDate(a.advance_date)} ${a.note ? '· ' + a.note : ''}</div>
      ${a.status === 'requested' && html`<div class="btns"><button class="btn primary sm" onClick=${() => { S.patch('advances', a.id, { status: 'paid', advance_date: todayStr() }); toast(t('Avans berildi deb qayd etildi')) }}>${t('Berildi')}</button>
        <button class="btn danger sm" onClick=${() => S.patch('advances', a.id, { status: 'rejected' })}>${t('Rad etish')}</button></div>`}
      ${a.status === 'paid' && html`<button class="btn sm ghost" onClick=${() => del('advances', a.id)}>${t('Arxivlash')}</button>`}
    </div>`)}</div>`}
    ${debts.length > 0 && html`<h2>${t('Qarzlar')}</h2><div class="list">${debts.map((a) => html`<${Row} icon="alert" tone="warn" title=${`${C.fmt(a.amount)} ${t('so‘m')}`} sub=${`${fmtDate(a.debt_date)} ${a.note || ''}`} right=${html`<button class="btn sm ghost" onClick=${() => del('debts', a.id)}><${Icon} name="archive" size=${16} /></button>`} />`)}</div>`}
    ${pays.length > 0 && html`<h2>${t('To‘langan maoshlar')}</h2><div class="list">${pays.map((a) => html`<${Row} icon="cash" tone="ok" title=${`${C.fmt(a.amount)} ${t('so‘m')}`} sub=${`${fmtDate(a.paid_date)} ${a.note || ''}`} right=${html`<button class="btn sm ghost" onClick=${() => del('salary_payments', a.id)}><${Icon} name="archive" size=${16} /></button>`} />`)}</div>`}
    <div style="margin-top:18px">${w.deleted_at
      ? html`<button class="btn block" onClick=${restoreWorker}>${t('Arxivdan qaytarish')}</button>`
      : html`<button class="btn danger block" onClick=${archiveWorker}><${Icon} name="archive" size=${18} />${t('Ishchini arxivlash')}</button>`}</div>
    ${sheet && html`<${MoneySheet} kind=${sheet} worker=${w} balance=${l.balance} onClose=${() => setSheet(null)} />`}
  <//>`
}

function MoneySheet({ kind, worker, balance, onClose }) {
  const { t } = useT()
  const S = useStore()
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState('')
  const titles = { advances: 'Avans berish', debts: 'Qarz yozish', salary_payments: 'Maosh to‘lash' }
  async function save() {
    if (!amount || amount <= 0) return toast(t('Summani kiriting'), 'err')
    if (kind !== 'debts' && amount > balance && !(await ask(`${t('Summa qolgan ish haqidan katta')} (${C.fmt(balance)}). ${t('Davom etilsinmi?')}`))) return
    const row = { worker_id: worker.id, amount, note }
    if (kind === 'advances') Object.assign(row, { status: 'paid', advance_date: date })
    else if (kind === 'debts') row.debt_date = date
    else row.paid_date = date
    S.save(kind, row); toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${t(titles[kind])} onClose=${onClose}>
    <${Field} label=${t('Summa (so‘m)')}><${MoneyInput} value=${amount} onChange=${setAmount} /><//>
    <${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
    <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

/* ===================== Kasb bo'yicha hisobot (kosib, zakatofkachi, kroychik, pardozchi) ===================== */
export function KasbPage({ arg, go }) {
  const { t } = useT()
  const D = useStore().all()
  const [date, setDate] = useState(todayStr())
  const ty = (D.worker_types || []).find((x) => x.id === arg)
  if (!ty) return html`<${Page} title=${t('Kasb')} back=${() => go('bosh')}><${Empty} text=${t('Topilmadi')} /><//>`
  const r = C.kasbReport(D, arg, date)
  return html`<${Page} title=${t(ty.name + 'lar')} sub=${fmtDate(date)} back=${() => go('bosh')}>
    <div class="datebar"><${Icon} name="calendar" size=${20} /><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /></div>
    <div class="grid">
      <${Stat} icon="shoe" n=${C.fmt(r.dayPairs)} label=${t('Shu kuni bajarilgan (juft)')} />
      <${Stat} icon="cash" tone="green" n=${C.fmt(r.dayEarned)} label=${t('Shu kuni maosh (so‘m)')} />
      <${Stat} n=${C.fmt(r.totalPairs)} label=${t('Umumiy ish soni (juft)')} />
      <${Stat} n=${C.fmt(r.totalEarned)} label=${t('Umumiy hisoblangan maosh')} />
    </div>
    <h2>${t('Ishchilar')}</h2>
    ${r.rows.length === 0 && html`<${Empty} icon="users" text=${t('Bu kasbda ishchi yo‘q')} />`}
    <div class="list">${r.rows.map((x) => html`<${Row} icon="user" title=${x.worker.full_name}
      sub=${`${t('Bugun')}: ${C.fmt(x.dayPairs)} ${t('juft')} · ${C.fmt(x.dayEarned)} · ${t('Jami')}: ${C.fmt(x.totalPairs)} ${t('juft')}`}
      right=${C.fmt(x.balance)} onClick=${() => go('ishchi/' + x.worker.id)} />`)}</div>
    <p class="muted small">${t('O‘ng tomondagi raqam: qolgan ish haqi')}</p>
  <//>`
}

/* ===================== Ishlarni tasdiqlash ===================== */
export function ApprovalsPage({ go }) {
  const { t } = useT()
  const S = useStore(); const D = S.all()
  const wmap = new Map((D.workers || []).map((w) => [w.id, w]))
  const rows = C.pricedEntries(D).filter((e) => e.status === 'pending').sort((a, b) => (a.work_date < b.work_date ? 1 : -1))
  async function all() {
    if (!(await ask(`${rows.length} ${t('ta ish tasdiqlansinmi?')}`))) return
    rows.forEach((e) => S.patch('work_entries', e.id, { status: 'approved' })); toast(t('Tasdiqlandi'))
  }
  async function back(e) {
    const r = await ask(t('Ish tuzatish uchun qaytarilsinmi?'), { input: t('Sabab (ixtiyoriy)'), danger: true, options: [{ value: true, label: t('Qaytarish'), tone: 'danger' }] })
    if (r) S.patch('work_entries', e.id, { status: 'returned', return_note: r.text || '' })
  }
  return html`<${Page} title=${t('Ishlarni tasdiqlash')} sub=${`${rows.length} ${t('ta kutilmoqda')}`} back=${() => go('bosh')}>
    ${rows.length > 1 && html`<button class="btn primary block" style="margin-bottom:12px" onClick=${all}><${Icon} name="check" size=${18} />${t('Hammasini tasdiqlash')}</button>`}
    ${rows.length === 0 && html`<${Empty} icon="check" text=${t('Tasdiqlanadigan ish yo‘q')} />`}
    <div class="list">${rows.map((e) => html`<div class="card" style="margin:0;padding:12px 14px">
      <div class="kv"><b>${(wmap.get(e.worker_id) || {}).full_name}</b><span class="pill">${t('Model')} ${mcode(D, e.model_id)}</span></div>
      <div class="kv"><span>${fmtDate(e.work_date)} · ${e.pairs} ${t('juft')}</span><b>${C.fmt(e.amount)}</b></div>
      <div class="btns"><button class="btn primary sm" onClick=${() => S.patch('work_entries', e.id, { status: 'approved' })}><${Icon} name="check" size=${16} />${t('Tasdiqlash')}</button>
        <button class="btn sm" onClick=${() => back(e)}>${t('Qaytarish')}</button></div></div>`)}</div>
  <//>`
}

/* ===================== Bugun sexdan chiqqan tayyor ish: batafsil ===================== */
export function ProductionPage({ go }) {
  const { t } = useT()
  const D = useStore().all()
  const [date, setDate] = useState(todayStr())
  const p = C.production(D, date)
  return html`<${Page} title=${t('Tayyor ish')} sub=${fmtDate(date)} back=${() => go('bosh')}>
    <div class="datebar"><${Icon} name="calendar" size=${20} /><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /></div>
    <div class="grid">
      <${Stat} icon="shoe" tone="dark" n=${C.fmt(p.pairs)} label=${t('Tayyor bo‘lgan (juft)')} />
      <${Stat} icon="cash" n=${C.fmt(p.wages)} label=${t('Sarflangan ish haqi')} />
      <${Stat} n=${p.cost ? C.fmt(p.cost) : '—'} label=${t('Tayyor mahsulot tannarxi')} />
      <${Stat} n=${p.sale ? C.fmt(p.sale) : '—'} label=${t('Sotuv qiymati')} />
      <${Stat} wide tone="green" icon="trend" n=${p.sale ? C.fmt(p.profit) : '—'} label=${t('Taxminiy foyda (so‘m)')} />
    </div>
    ${p.missingCost > 0 && html`<div class="msg warn" style="margin-bottom:12px">${p.missingCost} ${t('ta model uchun tannarx kiritilmagan (Qiymatlar bo‘limi)')}</div>`}
    <h2>${t('Modellar bo‘yicha')}</h2>
    ${p.rows.length === 0 && html`<${Empty} icon="shoe" text=${t('Bu kuni tayyor ish yo‘q')} />`}
    <div class="list">${p.rows.map((r) => html`<${Row} icon="shoe" title=${`${t('Model')} ${r.code}`} sub=${r.cost !== null ? `${t('Tannarx')}: ${C.fmt(r.cost)} · ${t('Sotuv')}: ${C.fmt(r.sale)}` : t('Tannarx kiritilmagan')} right=${`${r.pairs} ${t('juft')}`} />`)}</div>
    <p class="muted small">${t('Tayyor juftlar faqat kosiblar ishidan sanaladi, shuning uchun bir ish ikki marta hisoblanmaydi. Ish haqi barcha kasblar bo‘yicha.')}</p>
  <//>`
}
