import { useState, useEffect, useRef } from 'preact/hooks'
import { html, useT, useStore, Page, Row, Icon, Field, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import * as C from './calc.js'
import { SyncBadge } from './sync-ui.js'

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

/* ===================== Navbatchi (boshliq) ===================== */
export function DutyPage({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const workers = (D.workers || []).filter((w) => !w.deleted_at).sort((a, b) => a.full_name.localeCompare(b.full_name))
  const duties = C.live(D.duties)
  const nameOf = (id) => ((D.workers || []).find((w) => w.id === id) || {}).full_name || '?'
  const [date, setDate] = useState(today); const [wid, setWid] = useState(''); const [note, setNote] = useState('')
  const todayList = duties.filter((d) => d.duty_date === today)
  const upcoming = duties.filter((d) => d.duty_date > today).sort((a, b) => (a.duty_date < b.duty_date ? -1 : 1))
  const past = duties.filter((d) => d.duty_date < today).sort((a, b) => (a.duty_date < b.duty_date ? 1 : -1)).slice(0, 15)

  function add(e) {
    e.preventDefault()
    if (!wid) return toast(t('Ishchini tanlang'), 'err')
    if (!date) return toast(t('Sanani tanlang'), 'err')
    if (duties.some((d) => d.worker_id === wid && d.duty_date === date)) return toast(t('Bu ishchi shu kunga allaqachon navbatchi'), 'err')
    S.save('duties', { worker_id: wid, duty_date: date, note: note.trim() })
    toast(t('Navbatchi tayinlandi. Ishchiga bildirishnoma boradi.')); setNote('')
  }
  async function remove(d) {
    if (await ask(t('Navbatchilik bekor qilinsinmi?'), { danger: true })) S.archive('duties', d.id)
  }
  const item = (d) => html`<${Row} icon="shield" title=${nameOf(d.worker_id)} sub=${`${fmtDate(d.duty_date)}${d.note ? ' · ' + d.note : ''}`}
    right=${html`<button class="btn sm ghost" onClick=${() => remove(d)}><${Icon} name="archive" size=${16} /></button>`} />`

  return html`<${Page} title=${t('Navbatchi')} sub=${fmtDate(today)} right=${html`<${HeaderRight} go=${go} />`}>
    <div class=${'card ' + (todayList.length ? '' : 'flat')}>
      <div class="muted">${t('Bugungi navbatchi')}</div>
      ${todayList.length ? todayList.map((d) => html`<b>${nameOf(d.worker_id)}${d.note ? ' · ' + d.note : ''}</b>`) : html`<b>${t('Bugun navbatchi tayinlanmagan')}</b>`}
    </div>
    <form class="card fform" onSubmit=${add}>
      <b>${t('Navbatchi tayinlash')}</b>
      <${Field} label=${t('Ishchi')}><select value=${wid} onChange=${(e) => setWid(e.target.value)}>
        <option value="">${t('Tanlang')}</option>${workers.map((w) => html`<option value=${w.id}>${w.full_name}</option>`)}</select><//>
      <${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
      <${Field} label=${t('Izoh (ixtiyoriy)')}><input enterkeyhint="go" value=${note} onInput=${(e) => setNote(e.target.value)} placeholder=${t('Masalan: sexni tozalash')} /><//>
      <button type="submit" class="btn primary block"><${Icon} name="bell" size=${18} />${t('Tayinlash va xabar yuborish')}</button>
    </form>
    ${upcoming.length > 0 && html`<h2>${t('Kelgusi navbatlar')}</h2><div class="list">${upcoming.map(item)}</div>`}
    ${todayList.length > 0 && html`<h2>${t('Bugun')}</h2><div class="list">${todayList.map(item)}</div>`}
    ${past.length > 0 && html`<h2>${t('Oldingi navbatlar')}</h2><div class="list">${past.map(item)}</div>`}
  <//>`
}
