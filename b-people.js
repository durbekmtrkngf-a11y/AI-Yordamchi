import { useState, useEffect } from 'preact/hooks'
import { exportPDF, tbl, kv, h2, note } from './pdf.js'
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
    ${C.live(D.work_entries).filter((e) => e.status === 'pending').length > 0 && html`<div class="list" style="margin-bottom:12px"><${Row} icon="check" tone="amber" title=${t('Tasdiq kutayotgan ishlar')} right=${C.live(D.work_entries).filter((e) => e.status === 'pending').length} onClick=${() => go('tasdiq')} /></div>`}
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
  const [showCalc, setShowCalc] = useState(false); const [edit, setEdit] = useState(null)
  const l = C.workerLedger(D, arg, from, to)
  if (!l) return html`<${Page} title=${t('Ishchi')} back=${() => go('ishchilar')}><${Empty} text=${t('Ishchi topilmadi')} /><//>`
  const w = l.worker
  const rows = l.entries.filter((e) => C.inRange(e.work_date, from, to)).sort((a, b) => (a.work_date < b.work_date ? 1 : -1))
  const advs = C.live(D.advances).filter((a) => a.worker_id === arg).sort((a, b) => (a.advance_date < b.advance_date ? 1 : -1))
  const debts = C.live(D.debts).filter((a) => a.worker_id === arg)
  const pays = C.live(D.salary_payments).filter((a) => a.worker_id === arg)

  const allIn = C.live(D.work_entries).filter((e) => e.worker_id === arg && C.inRange(e.work_date, from, to))
  const byId = new Map(l.entries.map((e) => [e.id, e]))
  const cells = new Map(allIn.map((e) => [e.work_date + '|' + e.model_id, e]))
  const mids = [...new Set(allIn.map((e) => e.model_id))].sort((a, b) => mcode(D, a).localeCompare(mcode(D, b), undefined, { numeric: true }))
  const dates = [...new Set(allIn.map((e) => e.work_date))].sort().reverse()
  const okIn = (m) => allIn.filter((e) => e.model_id === m && e.status !== 'returned')
  const colPairs = (m) => C.sum(okIn(m), (e) => e.pairs)
  const colMoney = (m) => C.sum(okIn(m), (e) => (byId.get(e.id) || {}).amount)
  const inR = (d) => C.inRange(d, from, to)
  const pAdv = C.sum(advs.filter((a) => a.status === 'paid' && inR(a.advance_date)), (a) => a.amount)
  const pDebt = C.sum(debts.filter((a) => inR(a.debt_date)), (a) => a.amount)
  const pPaid = C.sum(pays.filter((a) => inR(a.paid_date)), (a) => a.amount)
  const net = l.periodEarned - pAdv - pDebt - pPaid
  const editing = edit ? (C.live(D.work_entries).find((x) => x.id === edit.id) || edit) : null

  const typeRow = (D.worker_types || []).find((x) => x.id === w.worker_type_id)
  const pdf = () => exportPDF({
    t, title: `${t('Ishchi hisob varag‘i')}: ${w.full_name}`,
    sub: `${t((typeRow && typeRow.name) || '')} · ${fmtDate(from)} — ${fmtDate(to)}`,
    filename: `hisob-${w.full_name.replace(/\s+/g, '-')}-${to}.pdf`,
    body: h2(t('Ishlar jadvali')) + tbl(
      [t('Sana'), ...mids.map((m) => mcode(D, m)), t('Jami')],
      dates.map((d) => {
        const day = mids.map((m) => cells.get(d + '|' + m))
        return [fmtDate(d).slice(0, 5), ...day.map((e) => (e ? e.pairs + (e.status === 'pending' ? '*' : e.status === 'returned' ? '!' : '') : '')), C.sum(day.filter((e) => e && e.status !== 'returned'), (e) => e.pairs) || '']
      }),
      [[t('Juft'), ...mids.map((m) => colPairs(m)), l.periodPairs], [t('So‘m'), ...mids.map((m) => C.fmt(colMoney(m))), C.fmt(l.periodEarned)]]) +
      note(t('* tasdiqlanmagan, ! qaytarilgan (hisobga olinmaydi)')) +
      h2(t('Hisob-kitob')) + kv([
        [t('Ish soni (juft)'), C.fmt(l.periodPairs)], [t('Hisoblangan ish haqi'), C.fmt(l.periodEarned)],
        ['− ' + t('Avans'), C.fmt(pAdv)], ['− ' + t('Qarz'), C.fmt(pDebt)], ['− ' + t('To‘langan'), C.fmt(pPaid)],
        [t('Shu davr bo‘yicha qoladi'), C.fmt(net) + ' ' + t('so‘m'), true]]),
  })
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
    <h2>${t('Ishlar jadvali')}</h2>
    <div class="datebar"><input type="date" value=${from} onInput=${(e) => setFrom(e.target.value)} /><span>—</span><input type="date" value=${to} onInput=${(e) => setTo(e.target.value)} /></div>
    ${dates.length === 0 ? html`<${Empty} icon="book" text=${t('Bu davrda ish yo‘q')} />` : html`
      <div class="table-wrap"><table class="grid-t"><thead><tr><th>${t('Sana')}</th>${mids.map((m) => html`<th>${mcode(D, m)}</th>`)}<th>${t('Jami')}</th></tr></thead>
        <tbody>${dates.map((d) => {
          const day = mids.map((m) => cells.get(d + '|' + m))
          const tot = C.sum(day.filter((e) => e && e.status !== 'returned'), (e) => e.pairs)
          return html`<tr><td>${fmtDate(d).slice(0, 5)}</td>
            ${day.map((e) => html`<td class=${!e ? 'zero' : e.status === 'pending' ? 'has pend tapc' : e.status === 'returned' ? 'ret tapc' : 'has tapc'} onClick=${e ? () => setEdit(e) : null}>${e ? e.pairs : '·'}</td>`)}
            <td class=${tot ? 'has' : 'zero'}>${tot || '·'}</td></tr>`
        })}</tbody>
        <tfoot><tr><td>${t('Juft')}</td>${mids.map((m) => html`<td>${C.fmt(colPairs(m))}</td>`)}<td>${C.fmt(l.periodPairs)}</td></tr>
          <tr><td>${t('So‘m')}</td>${mids.map((m) => html`<td>${C.fmt(colMoney(m))}</td>`)}<td>${C.fmt(l.periodEarned)}</td></tr></tfoot></table></div>
      <p class="muted small"><span class="dot" style="background:#f59e0b"></span> ${t('Sariq: tasdiqlanmagan')} · <span class="dot" style="background:var(--red)"></span> ${t('Qizil: qaytarilgan')} · ${t('Katakni bossangiz tasdiqlash, tuzatish yoki qaytarish oynasi ochiladi.')}</p>`}
    <div class="two" style="margin-bottom:12px"><button class="btn" onClick=${() => setShowCalc(!showCalc)}><${Icon} name="chart" size=${18} />${t('Hisoblash')}</button>
      <button class="btn primary" onClick=${pdf}><${Icon} name="download" size=${18} />${t('PDF')}</button></div>
    ${showCalc && html`<div class="card">
      <div class="muted small">${fmtDate(from)} — ${fmtDate(to)}</div>
      <div class="kv"><span>${t('Ish soni (juft)')}</span><b>${C.fmt(l.periodPairs)}</b></div>
      <div class="kv"><span>${t('Hisoblangan ish haqi')}</span><b>${C.fmt(l.periodEarned)}</b></div>
      <div class="kv"><span>− ${t('Avans')}</span><b>${C.fmt(pAdv)}</b></div>
      <div class="kv"><span>− ${t('Qarz')}</span><b>${C.fmt(pDebt)}</b></div>
      <div class="kv"><span>− ${t('To‘langan')}</span><b>${C.fmt(pPaid)}</b></div>
      <div class="kv big"><span>${t('Shu davr bo‘yicha qoladi')}</span><b class=${net >= 0 ? 'pos' : 'neg'}>${C.fmt(net)} ${t('so‘m')}</b></div></div>`}
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
    ${editing && html`<${EntryEdit} e=${editing} price=${(byId.get(editing.id) || {}).price} onClose=${() => setEdit(null)} />`}
    ${sheet && html`<${MoneySheet} kind=${sheet} worker=${w} balance=${l.balance} onClose=${() => setSheet(null)} />`}
  <//>`
}

/** Boshliq: bitta katakdagi ishni tasdiqlash, tuzatish yoki qaytarish */
function EntryEdit({ e, price, onClose }) {
  const { t } = useT(); const S = useStore(); const D = S.all()
  const [n, setN] = useState(String(e.pairs))
  const st = STATUS[e.status] || STATUS.pending
  function save(ev) {
    if (ev) ev.preventDefault()
    const v = Number(n)
    if (n === '' || !(v >= 0)) return toast(t('Juft sonini kiriting'), 'err')
    S.patch('work_entries', e.id, { pairs: v }); toast(t('Saqlandi')); onClose()
  }
  const setStatus = (status) => { S.patch('work_entries', e.id, { status }); toast(t('Saqlandi')); onClose() }
  async function back() {
    const r = await ask(t('Ish tuzatish uchun qaytarilsinmi? Ishchi uni qayta kiritadi.'), { input: t('Sabab (ixtiyoriy)'), danger: true, options: [{ value: true, label: t('Qaytarish'), tone: 'danger' }] })
    if (r) { S.patch('work_entries', e.id, { status: 'returned', return_note: r.text || '' }); toast(t('Qaytarildi')); onClose() }
  }
  return html`<${Sheet} title=${`${fmtDate(e.work_date)} · ${t('Model')} ${mcode(D, e.model_id)}`} onClose=${onClose}>
    <form class="fform" onSubmit=${save}>
      <div class="kv"><span>${t('Holati')}</span><span class=${'pill ' + st[1]}>${t(st[0])}</span></div>
      <div class="kv"><span>${t('Bir juft narxi')}</span><b>${price === null || price === undefined ? t('belgilanmagan') : C.fmt(price)}</b></div>
      <${Field} label=${t('Juft soni')}><input class="bigin" inputmode="numeric" enterkeyhint="go" value=${n} onInput=${(ev) => setN(ev.target.value.replace(/\D/g, ''))} /><//>
      <div class="kv big"><span>${t('Ish haqi')}</span><b class="pos">${C.fmt((Number(n) || 0) * (price || 0))} ${t('so‘m')}</b></div>
      <button type="submit" class="btn primary block">${t('Saqlash')}</button>
      ${e.status === 'pending' && html`<button type="button" class="btn block" onClick=${() => setStatus('approved')}><${Icon} name="check" size=${18} />${t('Tasdiqlash')}</button>`}
      ${e.status === 'approved' && html`<button type="button" class="btn block" onClick=${() => setStatus('pending')}>${t('Qayta ochish (tahrirlash uchun)')}</button>`}
      ${e.status !== 'returned' && html`<button type="button" class="btn danger block" onClick=${back}>${t('Qaytarish')}</button>`}
    </form>
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
