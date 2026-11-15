import { html, useT, useStore, Icon, Page, Row, Empty, toast, ask, fmtTime } from './ui.js'

/** Sinxronlash holati: sinxronlangan / kutilmoqda / xatolik / offline */
export function SyncBadge({ go }) {
  const { t } = useT()
  const st = useStore().status()
  let cls = '', label = t('Sinxronlangan')
  if (st.syncing) { cls = 'spin pending'; label = t('Sinxronlanmoqda...') }
  else if (!st.online) { cls = 'offline'; label = st.pending ? `${t('Offline')} · ${st.pending}` : t('Offline') }
  else if (st.failed.length || st.conflicts.length || st.error) { cls = 'error'; label = t('Sinxronlashda xatolik') }
  else if (st.pending) { cls = 'pending'; label = `${t('Sinxronlash kutilmoqda')} · ${st.pending}` }
  return html`<button class=${'sync ' + cls} onClick=${() => go('sinx')}>
    ${st.syncing ? html`<${Icon} name="sync" size=${14} />` : html`<i></i>`}<span>${label}</span></button>`
}

const FIELD_NAMES = { amount: 'Summa', title: 'Nomi', category: 'Kategoriya', note: 'Izoh', pairs: 'Juft soni', status: 'Holat', name: 'Nomi', phone: 'Telefon', price: 'Narx' }

export function SyncPage({ back }) {
  const { t } = useT()
  const S = useStore(); const st = S.status()
  const run = async () => { await S.sync(); toast(t('Sinxronlash tugadi')) }
  const val = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))
  return html`<${Page} title=${t('Sinxronlash')} back=${back}>
    <div class="card">
      <div class="kv"><span>${t('Holat')}</span><b>${st.syncing ? t('Sinxronlanmoqda...') : st.online ? t('Internet bor') : t('Internet yo‘q')}</b></div>
      <div class="kv"><span>${t('Oxirgi sinxronlash')}</span><b>${fmtTime(st.lastSync)}</b></div>
      <div class="kv"><span>${t('Yuborilmagan o‘zgarishlar')}</span><b>${st.pending}</b></div>
      ${st.error && html`<div class="msg err">${st.error}</div>`}
      <button class="btn primary block" onClick=${run}><${Icon} name="sync" size=${18} />${t('Hozir sinxronlash')}</button>
      <p class="muted small">${t('Internet bo‘lmaganda kiritilgan ma‘lumotlar telefonda saqlanadi va internet qaytganda avtomatik yuboriladi. Takroriy yozuv yaratilmaydi.')}</p>
    </div>
    ${st.failed.length > 0 && html`<h2>${t('Yuborilmagan (xatolik)')}</h2>
      <div class="list">${st.failed.map((o) => html`<div class="card flat">
        <b>${o.table}</b><div class="msg err">${o.error}</div>
        <div class="btns"><button class="btn sm" onClick=${() => S.retryFailed()}>${t('Qayta urinish')}</button>
          <button class="btn sm danger" onClick=${async () => { if (await ask(t('Bu o‘zgarish o‘chirib tashlansinmi?'), { danger: true })) S.discard(o.opid) }}>${t('O‘chirish')}</button></div>
      </div>`)}</div>`}
    ${st.conflicts.length > 0 && html`<h2>${t('Ziddiyatlar')}</h2>
      <p class="muted small" style="margin-bottom:8px">${t('Bu yozuv boshqa qurilmada ham o‘zgartirilgan. Qaysi qiymat qolsin?')}</p>
      <div class="list">${st.conflicts.map((c) => html`<div class="card flat">
        <b>${c.table}</b>
        ${Object.keys(c.fields).map((k) => html`<div class="kv small"><span>${t(FIELD_NAMES[k] || k)}</span>
          <span>${t('Meniki')}: <b>${val(c.fields[k])}</b> · ${t('Serverniki')}: <b>${val(c.server && c.server[k])}</b></span></div>`)}
        <div class="btns"><button class="btn sm primary" onClick=${() => S.resolveConflict(c.opid, 'mine')}>${t('Meniki qolsin')}</button>
          <button class="btn sm" onClick=${() => S.resolveConflict(c.opid, 'server')}>${t('Serverniki qolsin')}</button></div>
      </div>`)}</div>`}
    ${st.failed.length === 0 && st.conflicts.length === 0 && html`<${Empty} icon="shield" text=${t('Xatolik va ziddiyat yo‘q')} />`}
  <//>`
}
