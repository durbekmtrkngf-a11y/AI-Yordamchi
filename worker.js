import { useState, useEffect } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Icon, Field, MoneyInput, Sheet, Empty, BottomNav, useRoute, LangSwitch, toast, ask, todayStr, fmtDate, downloadFile, LangSeg } from './ui.js'
import { supabase } from './lib.js'
import * as C from './calc.js'
import { SyncBadge, SyncPage } from './sync-ui.js'
import { NotifPage, HeaderRight, useNotifyWatcher, unreadCount } from './duty.js'

const NAV = [['bosh', 'home', 'Bosh sahifa'], ['daftar', 'book', 'Ish daftari'], ['avans', 'cash', 'Avans'], ['yana', 'more', 'Yana']]

/** Ishchi kabineti: boshliq kabinetidan alohida interfeys. Server (RLS) faqat o'z ma'lumotini beradi. */
export function WorkerApp({ membership, onLogout }) {
  const [route, go] = useRoute('bosh')
  useNotifyWatcher()
  const [name] = route.split('/')
  const p = { go, membership, onLogout }
  const pages = { daftar: Notebook, avans: Advances, yana: More, bildirish: (q) => html`<${NotifPage} back=${() => q.go('bosh')} />`, sinx: (q) => html`<${SyncPage} back=${() => q.go('yana')} />` }
  const Page_ = pages[name] || Home
  const active = NAV.some((n) => n[0] === name) ? name : name === 'sinx' ? 'yana' : 'bosh'
  return html`<${Page_} ...${p} /><${BottomNav} items=${NAV} route=${active} go=${go} />`
}

const useMe = () => {
  const S = useStore(); const D = S.all()
  const w = (D.workers || []).find((x) => !x.deleted_at) || (D.workers || [])[0]
  return { S, D, w, today: todayStr() }
}

function Home({ go, membership }) {
  const { t } = useT(); const { D, w, today } = useMe()
  const company = membership.companies && membership.companies.name
  const kasb = membership.worker_types && membership.worker_types.name
  if (!w) return html`<${Page} title=${company} sub=${t(kasb || '')} right=${html`<${SyncBadge} go=${go} />`}><${Empty} icon="clock" text=${t('Ma‘lumotlar yuklanmoqda...')} /><//>`
  const day = C.workerLedger(D, w.id, today, today); const all = C.workerLedger(D, w.id)
  const returned = C.live(D.work_entries).filter((e) => e.status === 'returned').length
  const reqAdv = C.live(D.advances).filter((a) => a.status === 'requested').length
  const myDuty = C.live(D.duties).filter((d) => d.worker_id === w.id)
  const dutyToday = myDuty.some((d) => d.duty_date === today)
  const nextDuty = myDuty.filter((d) => d.duty_date > today).sort((a, b) => (a.duty_date < b.duty_date ? -1 : 1))[0]
  return html`<${Page} title=${w.full_name} sub=${`${company} · ${t(kasb || '')}`} right=${html`<${HeaderRight} go=${go} />`}>
    <${LangSeg} />
    ${dutyToday && html`<div class="msg ok" style="margin-bottom:12px"><b>${t('Bugun siz navbatchisiz')}</b></div>`}
    ${!dutyToday && nextDuty && html`<div class="msg warn" style="margin-bottom:12px">${t('Keyingi navbatingiz')}: <b>${fmtDate(nextDuty.duty_date)}</b>${nextDuty.note ? ' · ' + nextDuty.note : ''}</div>`}
    ${returned > 0 && html`<button class="msg err" style="width:100%;text-align:left;margin-bottom:12px" onClick=${() => go('daftar')}><b>${returned} ${t('ta ish qaytarilgan')}</b> — ${t('tuzatib qayta kiriting')}</button>`}
    <div class="grid">
      <${Stat} icon="shoe" n=${C.fmt(day.periodPairs)} label=${t('Bugun bajargan ish (juft)')} />
      <${Stat} icon="cash" tone="green" n=${C.fmt(day.periodEarned)} label=${t('Bugungi ishlab topgan pul')} />
      <${Stat} icon="book" n=${C.fmt(all.totalPairs)} label=${t('Jami bajargan ish (juft)')} />
      <${Stat} icon="trend" n=${C.fmt(all.earned)} label=${t('Jami hisoblangan maosh')} />
      <${Stat} icon="wallet" n=${C.fmt(all.advances)} label=${t('Olingan avans')} onClick=${() => go('avans')} />
      <${Stat} icon="alert" tone=${all.debts ? 'amber' : ''} n=${C.fmt(all.debts)} label=${t('Qarz')} />
      <${Stat} wide tone="dark" icon="cash" n=${`${C.fmt(all.balance)} ${t('so‘m')}`} label=${t('Qolgan ish haqi')} />
    </div>
    ${all.unverified > 0 && html`<div class="msg warn">${t('Shundan boshliq tasdiqlamagan')}: ${C.fmt(all.unverified)} ${t('so‘m')}</div>`}
    ${reqAdv > 0 && html`<div class="msg ok" style="margin-top:10px">${reqAdv} ${t('ta avans so‘rovi boshliq javobini kutmoqda')}</div>`}
    <button class="btn primary block" style="margin-top:14px" onClick=${() => go('daftar')}><${Icon} name="plus" size=${18} />${t('Ish kiritish')}</button>
  <//>`
}

/* ===================== Ish daftari: sana × model kodi jadvali ===================== */
/** Katak: son to'g'ridan-to'g'ri yoziladi. Klaviaturadagi "keyingi/o'tish" tugmasi saqlaydi va keyingi katakka o'tadi. */
function Cell({ entry, onCommit }) {
  const { t } = useT()
  const stored = entry ? String(entry.pairs) : ''
  const [v, setV] = useState(stored)
  const [focus, setFocus] = useState(false)
  useEffect(() => { if (!focus) setV(stored) }, [stored, focus])
  const locked = !!entry && entry.status === 'approved'
  const cls = 'cellin' + (entry ? (entry.status === 'pending' ? ' pend' : entry.status === 'returned' ? ' ret' : ' ok') : '')
  function commit() {
    setFocus(false)
    const n = v === '' ? 0 : Number(v)
    if (!entry && n === 0) return
    if (entry && n === entry.pairs && entry.status !== 'returned') return
    onCommit(n)
  }
  return html`<input class=${cls} inputmode="numeric" enterkeyhint="next" placeholder="" value=${v} readOnly=${locked}
    onFocus=${(e) => { if (locked) { toast(t('Tasdiqlangan. O‘zgartirish uchun boshliqdan ruxsat so‘rang.')); e.target.blur(); return } setFocus(true); try { e.target.select() } catch (_) {} }}
    onInput=${(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 5))}
    onBlur=${commit}
    onKeyDown=${(e) => {
      if (e.key !== 'Enter' && e.keyCode !== 13) return
      e.preventDefault()
      const all = [...document.querySelectorAll('.cellin:not([readonly])')]
      const i = all.indexOf(e.target)
      e.target.blur()
      if (all[i + 1]) all[i + 1].focus()
    }} />`
}

function Notebook({ go }) {
  const { t } = useT(); const { S, D, w, today } = useMe()
  const [sheet, setSheet] = useState(null); const [jump, setJump] = useState('')
  if (!w) return html`<${Page} title=${t('Ish daftari')}><${Empty} icon="clock" text=${t('Ma‘lumotlar yuklanmoqda...')} /><//>`
  const models = C.live(D.models).filter((m) => m.is_active).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  const entries = C.live(D.work_entries)
  const cell = new Map(entries.map((e) => [e.work_date + '|' + e.model_id, e]))
  const dates = new Set(entries.map((e) => e.work_date))
  for (let i = 0; i < 3; i++) dates.add(C.addDays(today, -i))
  let rows = [...dates].filter((d) => d <= today).sort().reverse().slice(0, 120)
  if (jump) rows = [jump]
  const commit = (d, m, n) => {
    if (d > today) return toast(t('Kelajak sanasiga ish kiritib bo‘lmaydi'), 'err')
    S.save('work_entries', { worker_id: w.id, model_id: m.id, work_date: d, pairs: n, status: 'pending', return_note: '' })
  }
  async function exportGrid() {
    const kind = await ask(t('Daftar qaysi formatda saqlansin?'), { options: [{ value: 'csv', label: 'CSV', tone: 'primary' }, { value: 'xlsx', label: 'Excel (XLSX)', tone: 'navy' }] })
    if (!kind) return
    const days = [...new Set(entries.map((e) => e.work_date))].sort().reverse()
    const aoa = [[t('Sana'), ...models.map((m) => m.code), t('Jami')], ...days.map((d) => {
      const day = models.map((m) => cell.get(d + '|' + m.id))
      return [fmtDate(d), ...day.map((e) => (e ? e.pairs : '')), C.sum(day.filter((e) => e && e.status !== 'returned'), (e) => e.pairs)]
    })]
    if (kind === 'csv') {
      const q = (v) => '"' + String(v).replace(/"/g, '""') + '"'
      downloadFile(`daftar-${today}.csv`, '\ufeff' + aoa.map((r) => r.map(q).join(',')).join('\n'), 'text/csv;charset=utf-8')
    } else {
      try {
        const X = await import('xlsx'); const XL = X.default && X.default.utils ? X.default : X
        const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(aoa), 'Daftar'); XL.writeFile(wb, `daftar-${today}.xlsx`)
      } catch (_) { toast(t('Excel kutubxonasi yuklanmadi (internet kerak). CSV ni sinab ko‘ring.'), 'err') }
    }
  }
  return html`<${Page} title=${t('Ish daftari')} sub=${w.full_name} right=${html`<${SyncBadge} go=${go} />`}>
    <button class="btn block" onClick=${exportGrid}><${Icon} name="download" size=${18} />${t('Daftarni Excel/CSV qilish')}</button>
    <div class="datebar"><${Icon} name="search" size=${20} /><input type="date" max=${today} value=${jump} onInput=${(e) => setJump(e.target.value)} />${jump && html`<button class="btn sm" onClick=${() => setJump('')}>${t('Hammasi')}</button>`}</div>
    ${models.length === 0 && html`<div class="msg warn">${t('Boshliq hali model qo‘shmagan.')}</div>`}
    <div class="table-wrap"><table class="grid-t cells"><thead><tr><th>${t('Sana')}</th>${models.map((m) => html`<th>${m.code}</th>`)}<th>${t('Jami')}</th></tr></thead>
      <tbody>${rows.map((d) => {
        const day = models.map((m) => cell.get(d + '|' + m.id))
        const total = C.sum(day.filter((e) => e && e.status !== 'returned'), (e) => e.pairs)
        return html`<tr class=${d === today ? 'today' : ''} key=${d}><td class="dcol" onClick=${() => setSheet(d)}>${fmtDate(d)}</td>
          ${models.map((m, i) => html`<td class="cin" key=${m.id}><${Cell} entry=${day[i]} onCommit=${(n) => commit(d, m, n)} /></td>`)}
          <td class=${total ? 'has' : 'zero'}>${total || '·'}</td></tr>`
      })}</tbody></table></div>
    <p class="muted small"><span class="dot" style="background:#f59e0b"></span> ${t('Sariq: boshliq tasdiqlashini kutmoqda')} · <span class="dot" style="background:var(--red)"></span> ${t('Qizil: qaytarilgan, tuzating')} · ${t('Katakka sonni yozing, klaviaturadagi tugma saqlaydi. Sanani bossangiz +5, +10 tugmalari chiqadi.')}</p>
    ${sheet && html`<${EntrySheet} date=${sheet} models=${models} worker=${w} onClose=${() => setSheet(null)} />`}
  <//>`
}

function EntrySheet({ date, models, worker, onClose }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const prices = C.live(D.model_prices)
  const find = (d, m) => C.live(D.work_entries).find((e) => e.work_date === d && e.model_id === m)
  const [d, setD] = useState(date); const [m, setM] = useState(models[0] ? models[0].id : '')
  const [pairs, setPairs] = useState(() => { const e = models[0] && find(date, models[0].id); return e ? e.pairs : '' })
  const ex = m ? find(d, m) : null
  const pick = (nd, nm) => { setD(nd); setM(nm); const e = find(nd, nm); setPairs(e ? e.pairs : '') }
  const price = m ? C.priceFor(prices, m, worker.worker_type_id, d) : null
  const locked = ex && ex.status === 'approved'
  function save() {
    if (!m) return toast(t('Model tanlang'), 'err')
    if (d > today) return toast(t('Kelajak sanasiga ish kiritib bo‘lmaydi'), 'err')
    const n = Number(pairs)
    if (!(n >= 0) || pairs === '') return toast(t('Juft sonini kiriting'), 'err')
    if (n === 0 && !ex) return toast(t('Juft soni 0 dan katta bo‘lsin'), 'err')
    S.save('work_entries', { worker_id: worker.id, model_id: m, work_date: d, pairs: n, status: 'pending', return_note: '' })
    toast(t('Saqlandi')); onClose()
  }
  const add = (k) => setPairs((Number(pairs) || 0) + k)
  return html`<${Sheet} title=${t('Ish kiritish')} onClose=${onClose}>
    <${Field} label=${t('Sana')}><input type="date" max=${today} value=${d} onInput=${(e) => pick(e.target.value || d, m)} /><//>
    <${Field} label=${t('Model kodi')}><div class="chips" style="flex-wrap:wrap;overflow:visible">${models.map((x) => html`<button class=${m === x.id ? 'on' : ''} onClick=${() => pick(d, x.id)}>${x.code}</button>`)}</div><//>
    ${ex && ex.status === 'returned' && html`<div class="msg err">${t('Boshliq qaytargan')}${ex.return_note ? ': ' + ex.return_note : ''}. ${t('Tuzatib qayta saqlang.')}</div>`}
    ${locked && html`<div class="msg warn">${t('Bu ish tasdiqlangan. O‘zgartirish uchun boshliqdan ruxsat so‘rang.')}</div>`}
    <input class="bigin" inputmode="numeric" placeholder="0" disabled=${locked} value=${pairs} onInput=${(e) => { const v = e.target.value.replace(/\D/g, ''); setPairs(v === '' ? '' : Number(v)) }} />
    <div class="qbtns"><button class="btn" disabled=${locked} onClick=${() => add(1)}>+1</button><button class="btn" disabled=${locked} onClick=${() => add(5)}>+5</button>
      <button class="btn" disabled=${locked} onClick=${() => add(10)}>+10</button><button class="btn" disabled=${locked} onClick=${() => add(20)}>+20</button></div>
    <div class="btns"><button class="btn sm ghost" disabled=${locked} onClick=${() => setPairs('')}>${t('Tozalash')}</button>
      <button class="btn sm ghost" disabled=${locked || !(pairs > 0)} onClick=${() => setPairs(Math.max(0, Number(pairs) - 1))}>−1</button></div>
    <div class="card flat"><div class="kv"><span>${t('Bir juft narxi')}</span><b>${price === null ? t('belgilanmagan') : C.fmt(price)}</b></div>
      <div class="kv big"><span>${t('Ish haqi')}</span><b class="pos">${C.fmt((Number(pairs) || 0) * (price || 0))} ${t('so‘m')}</b></div></div>
    <button class="btn primary block" disabled=${locked} onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

/* ===================== Avans, qarz, to'lovlar ===================== */
function Advances({ go }) {
  const { t } = useT(); const { S, D, w } = useMe()
  const [amount, setAmount] = useState(''); const [note, setNote] = useState('')
  if (!w) return html`<${Page} title=${t('Avans')}><${Empty} icon="clock" text=${t('Ma‘lumotlar yuklanmoqda...')} /><//>`
  const l = C.workerLedger(D, w.id)
  const advs = C.live(D.advances).sort((a, b) => (a.created_at || 'z') < (b.created_at || 'z') ? 1 : -1)
  const pays = C.live(D.salary_payments).sort((a, b) => (a.paid_date < b.paid_date ? 1 : -1))
  async function send() {
    if (!amount || amount <= 0) return toast(t('Summani kiriting'), 'err')
    if (amount > l.balance && !(await ask(`${t('So‘ralgan summa qolgan ish haqidan katta')} (${C.fmt(l.balance)}). ${t('Baribir yuborilsinmi?')}`))) return
    S.save('advances', { worker_id: w.id, amount, status: 'requested', advance_date: todayStr(), note }); setAmount(''); setNote(''); toast(t('Avans so‘rovi yuborildi'))
  }
  const st = { requested: ['So‘ralgan', 'amber'], paid: ['Berilgan', 'green'], rejected: ['Rad etilgan', 'red'] }
  return html`<${Page} title=${t('Avans va hisob')} sub=${w.full_name} right=${html`<${SyncBadge} go=${go} />`}>
    <div class="card">
      <div class="kv"><span>${t('Jami hisoblangan maosh')}</span><b>${C.fmt(l.earned)}</b></div>
      <div class="kv"><span>− ${t('Olingan avans')}</span><b>${C.fmt(l.advances)}</b></div>
      <div class="kv"><span>− ${t('Qaytarilishi kerak bo‘lgan qarz')}</span><b>${C.fmt(l.debts)}</b></div>
      <div class="kv"><span>− ${t('To‘langan pul')}</span><b>${C.fmt(l.paid)}</b></div>
      <div class="kv big"><span>${t('Qolgan ish haqi')}</span><b class=${l.balance >= 0 ? 'pos' : 'neg'}>${C.fmt(l.balance)} ${t('so‘m')}</b></div>
    </div>
    <div class="card"><h2 style="margin:0">${t('Avans so‘rash')}</h2>
      <${Field} label=${t('Summa (so‘m)')}><${MoneyInput} value=${amount} onChange=${setAmount} /><//>
      <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
      <button class="btn primary block" onClick=${send}>${t('So‘rov yuborish')}</button>
      <span class="muted small">${t('Avansni boshliq tasdiqlaydi va pul berilganini o‘zi qayd etadi.')}</span></div>
    ${advs.length > 0 && html`<h2>${t('Avanslarim')}</h2><div class="list">${advs.map((a) => html`<${Row} icon="cash" title=${`${C.fmt(a.amount)} ${t('so‘m')}`} sub=${`${fmtDate(a.advance_date)} ${a.note || ''}`} right=${html`<span class=${'pill ' + st[a.status][1]}>${t(st[a.status][0])}</span>`} />`)}</div>`}
    ${pays.length > 0 && html`<h2>${t('Olingan maoshlar')}</h2><div class="list">${pays.map((a) => html`<${Row} icon="check" tone="ok" title=${`${C.fmt(a.amount)} ${t('so‘m')}`} sub=${`${fmtDate(a.paid_date)} ${a.note || ''}`} />`)}</div>`}
  <//>`
}

function More({ go, membership, onLogout }) {
  const { t } = useT(); const [prof, setProf] = useState(null)
  const unread = unreadCount(useStore())
  useEffect(() => { supabase.from('profiles').select('full_name, phone').maybeSingle().then(({ data }) => setProf(data), () => {}) }, [])
  return html`<${Page} title=${t('Yana')} sub=${prof && prof.full_name} right=${html`<${SyncBadge} go=${go} />`}>
    ${prof && html`<div class="card"><div class="muted">${t('Profil')}</div><b>${prof.full_name}</b><span class="muted">${prof.phone}</span>
      <div class="muted">${t('Kasbingiz')}</div><b>${t((membership.worker_types && membership.worker_types.name) || '')}</b>
      <div class="muted">${t('Sex')}</div><b>${membership.companies && membership.companies.name}</b></div>`}
    <div class="list"><${Row} icon="bell" title=${t('Bildirishnomalar')} sub=${t('Navbatchilik va boshqa xabarlar')} right=${unread > 0 ? html`<span class="pill amber">${unread}</span>` : null} onClick=${() => go('bildirish')} />
      <${Row} icon="sync" title=${t('Sinxronlash')} sub=${t('Offline ma‘lumotlar holati')} onClick=${() => go('sinx')} /></div>
    <div class="card"><div class="kv"><span>${t('Til')}</span><${LangSwitch} dark=${true} /></div></div>
    <button class="btn danger block" onClick=${onLogout}><${Icon} name="logout" size=${18} />${t('Chiqish')}</button>
  <//>`
}
