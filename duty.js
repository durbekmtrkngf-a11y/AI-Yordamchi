import { useState, useEffect, useRef } from 'preact/hooks'
import { html, useT, useStore, Page, Row, Icon, Field, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import * as C from './calc.js'
import { SyncBadge } from './sync-ui.js'
import * as DC from './duty-calc.js'

/* ===================== Bildirishnomalar (ilova ichida) ===================== */
const mine = (S) => {
  const uid = S.user()
  return C.live(S.all().notifications).filter((n) => n.user_id === uid)
    .sort((a, b) => (String(a.created_at) < String(b.created_at) ? 1 : -1))
}
export const unreadCount = (S) => mine(S).filter((n) => !n.is_read).length

/** Yangi bildirishnoma kelganda ilova ochiq bo'lsa xabar chiqaradi (ruxsat berilgan bo'lsa telefon xabarnomasi ham) */
export function useNotifyWatcher() {
  const S = useStore(); const seen = useRef(null)
  const loaded = S.status().loaded
  const list = mine(S).filter((n) => !n.is_read)
  const sig = list.map((n) => n.id).join(',')
  useEffect(() => {
    if (!loaded) return
    if (seen.current === null) { seen.current = new Set(list.map((n) => n.id)); return }
    for (const n of list) {
      if (seen.current.has(n.id)) continue
      seen.current.add(n.id)
      toast(n.title + (n.body ? ': ' + n.body : ''))
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification(n.title, { body: n.body, icon: 'icon-192.png' }) } catch (_) {}
    }
  }, [sig, loaded])
}

export function Bell({ go }) {
  const S = useStore(); const n = unreadCount(S)
  return html`<button class="icon-btn light bell" onClick=${() => go('bildirish')}><${Icon} name="bell" size=${20} />${n > 0 && html`<span class="cnt">${n > 9 ? '9+' : n}</span>`}</button>`
}

export function HeaderRight({ go }) {
  return html`<span class="hr"><${Bell} go=${go} /><${SyncBadge} go=${go} /></span>`
}

export function NotifPage({ back }) {
  const { t } = useT(); const S = useStore()
  const list = mine(S)
  const unread = list.filter((n) => !n.is_read)
  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default'
  const [, setTick] = useState(0)
  const readAll = () => unread.forEach((n) => S.patch('notifications', n.id, { is_read: true }))
  async function allow() {
    try { await Notification.requestPermission() } catch (_) {}
    setTick((x) => x + 1)
  }
  const when = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) } catch (_) { return fmtDate(iso) } }
  return html`<${Page} title=${t('Bildirishnomalar')} sub=${unread.length ? `${unread.length} ${t('ta yangi')}` : ''} back=${back}>
    ${canAsk && html`<button class="btn block" style="margin-bottom:12px" onClick=${allow}><${Icon} name="bell" size=${18} />${t('Telefon xabarnomasini yoqish')}</button>
      <p class="muted small">${t('Ilova ochiq yoki orqa fonda bo‘lganda xabar chiqadi.')}</p>`}
    ${unread.length > 0 && html`<button class="btn block" style="margin-bottom:12px" onClick=${readAll}><${Icon} name="check" size=${18} />${t('Hammasini o‘qilgan qilish')}</button>`}
    ${list.length === 0 && html`<${Empty} icon="bell" text=${t('Bildirishnoma yo‘q')} />`}
    <div class="list">${list.map((n) => html`<${Row} icon=${n.is_read ? 'check' : 'bell'} tone=${n.is_read ? '' : 'amber'} title=${t(n.title)} sub=${`${n.body ? n.body + ' · ' : ''}${when(n.created_at)}`}
      onClick=${n.is_read ? null : () => S.patch('notifications', n.id, { is_read: true })} />`)}</div>
  <//>`
}

/* ===================== Navbatchi: aylanma tartib (boshliq) ===================== */
const WD = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
const wd = (iso) => WD[new Date(iso + 'T12:00:00').getDay()]
const asc = (a, b) => (a.duty_date < b.duty_date ? -1 : a.duty_date > b.duty_date ? 1 : 0)

const rosterOf = (D) => {
  const ws = (D.workers || []).filter((w) => !w.deleted_at)
  const rows = C.live(D.duty_roster).filter((r) => ws.some((w) => w.id === r.worker_id)).sort((a, b) => a.position - b.position)
  return { rows, ids: rows.map((r) => r.worker_id), workers: ws }
}

/** Boshliq ilovasi ochilganda: navbat jadvali keyingi 3 hafta uchun o'zi to'ldiriladi va ishchilarga sanasi bilan xabar boradi */
export function useDutyAutofill() {
  const S = useStore(); const D = S.all(); const st = S.status(); const today = todayStr()
  const { ids } = rosterOf(D)
  const duties = C.live(D.duties)
  const sig = JSON.stringify([today, ids, duties.map((d) => [d.id, d.worker_id, d.duty_date, d.status])])
  useEffect(() => {
    if (!st.loaded || st.syncing || ids.length === 0) return
    const p = DC.ensurePlan({ roster: ids, duties, today, horizon: 21 })
    p.patch.forEach((x) => S.patch('duties', x.id, x.fields))
    p.archive.forEach((id) => S.archive('duties', id))
    p.create.forEach((r) => S.save('duties', r))
  }, [sig, st.loaded, st.syncing])
}

export function DutyPage({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const { rows, ids, workers } = rosterOf(D)
  const nameOf = (id) => ((D.workers || []).find((w) => w.id === id) || {}).full_name || '?'
  const duties = C.live(D.duties)
  const active = duties.filter((d) => d.status !== 'absent')
  const todayRow = active.find((d) => d.duty_date === today)
  const upcoming = active.filter((d) => d.duty_date > today).sort(asc).slice(0, 10)
  const history = duties.filter((d) => d.duty_date < today || (d.duty_date === today && d.status === 'absent'))
    .sort((a, b) => asc(b, a)).slice(0, 15)
  const notIn = workers.filter((w) => !ids.includes(w.id)).sort((a, b) => a.full_name.localeCompare(b.full_name))
  const [startWorker, setStartWorker] = useState(''); const [startDate, setStartDate] = useState(today)
  const needsStart = ids.length > 0 && active.length === 0

  const addToRoster = (list) => { let pos = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0; list.forEach((w) => S.save('duty_roster', { worker_id: w.id, position: pos++ })) }
  const removeFromRoster = async (r) => { if (await ask(t('Ishchi navbat tartibidan chiqarilsinmi? Kelgusi navbatlar qayta hisoblanadi.'), { danger: true })) S.archive('duty_roster', r.id) }
  const move = (r, dir) => DC.moveInRoster(rows, r.id, dir).forEach((x) => S.patch('duty_roster', x.id, { position: x.position }))
  function start() {
    const w = startWorker || ids[0]
    if (!w || !startDate) return toast(t('Ishchini tanlang'), 'err')
    S.save('duties', { worker_id: w, duty_date: startDate, status: 'planned', note: '' })
    toast(t('Navbat boshlandi. Keyingilar sanasi bilan avtomatik yoziladi.'))
  }
  async function absent(d) {
    const repl = DC.absentReplacement({ roster: ids, duties, duty: d })
    if (!repl) return toast(t('Almashtiradigan boshqa ishchi yo‘q'), 'err')
    if (!(await ask(`${nameOf(d.worker_id)} ${t('kelmadimi?')} ${t('Navbat')} ${nameOf(repl)} ${t('ga o‘tadi')}.`, { danger: true }))) return
    S.patch('duties', d.id, { status: 'absent' })
    S.save('duties', { worker_id: repl, duty_date: d.duty_date, status: 'planned', note: 'Kelmagan o‘rniga' })
    toast(`${nameOf(repl)} ${t('navbatchi bo‘ldi')}`)
  }
  const absentBtn = (d) => html`<button class="btn sm danger" onClick=${() => absent(d)}>${t('Kelmadi')}</button>`

  return html`<${Page} title=${t('Navbatchi')} sub=${fmtDate(today)} right=${html`<${HeaderRight} go=${go} />`}>
    ${ids.length === 0 ? html`<div class="card"><b>${t('Avval ishchilarni navbatga yozing')}</b>
        <span class="muted">${t('Hamma ishchilar tartib bilan navbatchi bo‘lib aylanadi.')}</span>
        <button class="btn primary block" onClick=${() => addToRoster(notIn)}><${Icon} name="users" size=${18} />${t('Hamma ishchilarni navbatga yozish')}</button></div>`
      : needsStart ? html`<div class="card fform"><b>${t('Navbatni boshlash')}</b>
          <span class="muted">${t('Birinchi navbatchini tanlang. Keyingilarni dastur tartib bilan sanasi bilan o‘zi yozadi va ogohlantiradi.')}</span>
          <${Field} label=${t('Birinchi navbatchi')}><select value=${startWorker || ids[0]} onChange=${(e) => setStartWorker(e.target.value)}>${ids.map((id) => html`<option value=${id}>${nameOf(id)}</option>`)}</select><//>
          <${Field} label=${t('Boshlanish sanasi')}><input type="date" value=${startDate} onInput=${(e) => setStartDate(e.target.value)} /><//>
          <button class="btn primary block" onClick=${start}><${Icon} name="bell" size=${18} />${t('Boshlash')}</button></div>`
      : html`<div class=${'card ' + (todayRow ? '' : 'flat')}><div class="muted">${t('Bugungi navbatchi')} · ${t(wd(today))}</div>
          ${todayRow ? html`<b style="font-size:22px">${nameOf(todayRow.worker_id)}${todayRow.note ? html`<span class="muted small"> · ${todayRow.note}</span>` : ''}</b>${absentBtn(todayRow)}`
            : html`<b>${t('Bugun navbatchi hisoblanmoqda...')}</b>`}</div>`}

    ${upcoming.length > 0 && html`<h2>${t('Keyingi navbatlar')}</h2><div class="list">${upcoming.map((d) => html`<${Row} icon="shield" title=${nameOf(d.worker_id)}
      sub=${`${fmtDate(d.duty_date)} · ${t(wd(d.duty_date))}`} right=${absentBtn(d)} />`)}</div>`}

    <h2>${t('Navbat tartibi')}</h2>
    ${rows.length === 0 && html`<p class="muted small">${t('Hali hech kim yozilmagan.')}</p>`}
    <div class="list">${rows.map((r, i) => html`<${Row} icon="user" title=${`${i + 1}. ${nameOf(r.worker_id)}`}
      right=${html`<span class="rbtns"><button class="btn sm ghost" disabled=${i === 0} onClick=${() => move(r, -1)}>↑</button><button class="btn sm ghost" disabled=${i === rows.length - 1} onClick=${() => move(r, 1)}>↓</button><button class="btn sm ghost" onClick=${() => removeFromRoster(r)}>✕</button></span>`} />`)}</div>
    ${notIn.length > 0 && ids.length > 0 && html`<div class="card"><span class="muted">${t('Navbatda yo‘q ishchilar')}: ${notIn.map((w) => w.full_name).join(', ')}</span>
      <button class="btn block" onClick=${() => addToRoster(notIn)}><${Icon} name="plus" size=${18} />${t('Navbatga qo‘shish')}</button></div>`}

    ${history.length > 0 && html`<h2>${t('Oldingi navbatlar')}</h2><div class="list">${history.map((d) => html`<${Row} icon=${d.status === 'absent' ? 'x' : 'check'} tone=${d.status === 'absent' ? 'amber' : ''}
      title=${nameOf(d.worker_id)} sub=${`${fmtDate(d.duty_date)}${d.status === 'absent' ? ' · ' + t('Kelmadi') : ''}`} />`)}</div>`}
  <//>`
}
