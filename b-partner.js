import { useState } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Chips, Icon, Field, MoneyInput, Sheet, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import * as C from './calc.js'

const BASES = { net_profit: 'Sof foyda', revenue: 'Tushum', custom: 'Boshqa asos (qo‘lda)' }

/* ===================== Hamkorlar ===================== */
export function PartnersPage({ arg, go }) {
  return arg ? html`<${PartnerDetail} id=${arg} go=${go} />` : html`<${PartnerList} go=${go} />`
}

function PartnerList({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all()
  const [sheet, setSheet] = useState(false)
  const list = C.live(D.partners)
  return html`<${Page} title=${t('Hamkor')} sub=${`${list.length} ${t('ta')}`} right=${html`<button class="icon-btn light" onClick=${() => setSheet(true)}><${Icon} name="plus" /></button>`}>
    ${list.length === 0 && html`<${Empty} icon="partner" text=${t('Hamkor yo‘q. + tugmasi bilan qo‘shing.')} />`}
    <div class="list">${list.map((p) => { const b = C.partnerBalance(D, p.id)
      return html`<${Row} icon="partner" title=${p.name} sub=${`${p.share_type === 'percent' ? p.share_value + '%' : C.fmt(p.share_value) + ' ' + t('so‘m')} · ${t(BASES[p.share_base])}`}
        right=${html`<span class=${b.debt > 0 ? 'neg' : 'pos'}>${C.fmt(b.debt)}</span>`} onClick=${() => go('hamkor/' + p.id)} />` })}</div>
    <p class="muted small">${t('O‘ng tomondagi raqam: hamkorga qolgan qarzdorlik.')}</p>
    ${sheet && html`<${PartnerSheet} onClose=${() => setSheet(false)} />`}
  <//>`
}

function PartnerSheet({ partner, onClose }) {
  const { t } = useT(); const S = useStore()
  const [f, setF] = useState({ name: partner ? partner.name : '', phone: partner ? partner.phone : '', share_type: partner ? partner.share_type : 'percent',
    share_value: partner ? Number(partner.share_value) : '', share_base: partner ? partner.share_base : 'net_profit', opening_balance: partner ? Number(partner.opening_balance) : 0, note: partner ? partner.note : '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  function save() {
    if (!f.name.trim()) return toast(t('Hamkor ismini kiriting'), 'err')
    if (f.share_value === '' || f.share_value < 0) return toast(t('Ulushni kiriting'), 'err')
    const row = { ...f, name: f.name.trim(), opening_balance: f.opening_balance || 0 }
    if (partner) S.patch('partners', partner.id, row); else S.save('partners', row)
    toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${partner ? t('Hamkorni tahrirlash') : t('Yangi hamkor')} onClose=${onClose}>
    <${Field} label=${t('Ism-familiya')}><input value=${f.name} onInput=${set('name')} /><//>
    <${Field} label=${t('Telefon raqami')}><input inputmode="tel" value=${f.phone} onInput=${set('phone')} /><//>
    <div class="two"><${Field} label=${t('Ulush turi')}><select value=${f.share_type} onChange=${set('share_type')}><option value="percent">${t('Foiz (%)')}</option><option value="fixed">${t('Belgilangan summa')}</option></select><//>
      <${Field} label=${f.share_type === 'percent' ? t('Foiz') : t('Summa (so‘m)')}><${MoneyInput} value=${f.share_value} onChange=${(v) => setF({ ...f, share_value: v })} /><//></div>
    <${Field} label=${t('Ulush hisoblash asosi')}><select value=${f.share_base} onChange=${set('share_base')}>${Object.entries(BASES).map(([k, v]) => html`<option value=${k}>${t(v)}</option>`)}</select><//>
    <${Field} label=${t('Boshlang‘ich hisob (so‘m)')}><${MoneyInput} value=${f.opening_balance} onChange=${(v) => setF({ ...f, opening_balance: v })} /><//>
    <${Field} label=${t('Izoh')}><input value=${f.note} onInput=${set('note')} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

function PartnerDetail({ id, go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const [period, setPeriod] = useState('month'); const [custom, setCustom] = useState('')
  const [sheet, setSheet] = useState(null)
  const p = (D.partners || []).find((x) => x.id === id)
  if (!p) return html`<${Page} title=${t('Hamkor')} back=${() => go('hamkor')}><${Empty} text=${t('Topilmadi')} /><//>`
  const from = period === 'today' ? today : period === 'week' ? C.weekStart(today) : C.monthStart(today)
  const fin = C.finance(D, from, today, today)
  const base = C.partnerBase(p, fin, custom)
  const share = C.partnerShareAmount(p, base)
  const bal = C.partnerBalance(D, id)
  const prod = C.production(D, today)
  const shares = C.live(D.partner_shares).filter((s) => s.partner_id === id).sort((a, b) => (a.period_end < b.period_end ? 1 : -1))
  const pays = C.live(D.partner_payments).filter((s) => s.partner_id === id).sort((a, b) => (a.paid_date < b.paid_date ? 1 : -1))
  async function saveShare() {
    if (shares.some((s) => s.period_start === from && s.period_end === today)) return toast(t('Bu davr uchun ulush allaqachon saqlangan'), 'err')
    if (!(await ask(`${t('Ulush')}: ${C.fmt(share)} ${t('so‘m')}\n${t('Hisoblab saqlansinmi?')}`))) return
    S.save('partner_shares', { partner_id: id, period_start: from, period_end: today, base_amount: Math.round(base), share_amount: share }); toast(t('Ulush saqlandi'))
  }
  const del = async (table, rid) => { if (await ask(t('Bu yozuv arxivlansinmi?'), { danger: true })) S.archive(table, rid) }
  return html`<${Page} title=${p.name} sub=${p.share_type === 'percent' ? `${p.share_value}% · ${t(BASES[p.share_base])}` : `${C.fmt(p.share_value)} ${t('so‘m')}`} back=${() => go('hamkor')}
    right=${html`<button class="icon-btn light" onClick=${() => setSheet('edit')}><${Icon} name="edit" size=${20} /></button>`}>
    <div class="grid">
      <${Stat} icon="factory" n=${C.fmt(prod.pairs)} label=${t('Bugungi ishlab chiqarish (juft)')} />
      <${Stat} icon="trend" n=${C.fmt(prod.sale ? prod.profit : 0)} label=${t('Bugungi taxminiy foyda')} />
      <${Stat} tone="green" n=${C.fmt(bal.shares)} label=${t('Umumiy yig‘ilgan ulush')} />
      <${Stat} n=${C.fmt(bal.paid)} label=${t('Hamkorga berilgan pullar')} />
      <${Stat} wide tone=${bal.debt > 0 ? 'red' : 'green'} icon="cash" n=${C.fmt(bal.debt)} label=${t('Qolgan qarzdorlik (so‘m)')} />
    </div>
    <div class="card"><h2 style="margin:0">${t('Ulushni hisoblash')}</h2>
      <${Chips} value=${period} onChange=${setPeriod} items=${[['today', t('Bugun')], ['week', t('Hafta')], ['month', t('Oy')]]} />
      ${p.share_base === 'custom' && html`<${Field} label=${t('Hisoblash asosi summasi')}><${MoneyInput} value=${custom} onChange=${setCustom} /><//>`}
      <div class="kv"><span>${t(BASES[p.share_base])} (${fmtDate(from)} — ${fmtDate(today)})</span><b>${C.fmt(base)}</b></div>
      <div class="kv big"><span>${t('Hamkor ulushi')}</span><b class="pos">${C.fmt(share)} ${t('so‘m')}</b></div>
      <button class="btn primary block" onClick=${saveShare}>${t('Hisoblab saqlash')}</button>
    </div>
    <div class="btns" style="margin-bottom:12px"><button class="btn navy" onClick=${() => setSheet('pay')}><${Icon} name="cash" size=${18} />${t('Hamkorga pul berish')}</button></div>
    ${bal.opening !== 0 && html`<div class="kv small" style="margin-bottom:8px"><span>${t('Boshlang‘ich hisob')}</span><b>${C.fmt(bal.opening)}</b></div>`}
    ${shares.length > 0 && html`<h2>${t('Hisoblangan ulushlar')}</h2><div class="list">${shares.map((s) => html`<${Row} icon="partner" title=${`${C.fmt(s.share_amount)} ${t('so‘m')}`} sub=${`${fmtDate(s.period_start)} — ${fmtDate(s.period_end)} · ${t('asos')}: ${C.fmt(s.base_amount)}`} right=${html`<${Icon} name="archive" size=${16} />`} onClick=${() => del('partner_shares', s.id)} />`)}</div>`}
    ${pays.length > 0 && html`<h2>${t('To‘lovlar')}</h2><div class="list">${pays.map((s) => html`<${Row} icon="cash" tone="ok" title=${`${C.fmt(s.amount)} ${t('so‘m')}`} sub=${`${fmtDate(s.paid_date)} ${s.note || ''}`} right=${html`<${Icon} name="archive" size=${16} />`} onClick=${() => del('partner_payments', s.id)} />`)}</div>`}
    ${sheet === 'edit' && html`<${PartnerSheet} partner=${p} onClose=${() => setSheet(null)} />`}
    ${sheet === 'pay' && html`<${SimplePay} title=${t('Hamkorga pul berish')} table="partner_payments" extra=${{ partner_id: id }} dateKey="paid_date" onClose=${() => setSheet(null)} />`}
  <//>`
}

/** Oddiy to'lov oynasi: summa + sana + izoh */
function SimplePay({ title, table, extra, dateKey, onClose }) {
  const { t } = useT(); const S = useStore()
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState('')
  function save() {
    if (!amount || amount <= 0) return toast(t('Summani kiriting'), 'err')
    S.save(table, { ...extra, amount, [dateKey]: date, note }); toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${title} onClose=${onClose}>
    <${Field} label=${t('Summa (so‘m)')}><${MoneyInput} value=${amount} onChange=${setAmount} /><//>
    <${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
    <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

/* ===================== Ijara ===================== */
export function RentPage({ arg, go }) {
  return arg ? html`<${RentDetail} id=${arg} go=${go} />` : html`<${RentList} go=${go} />`
}

function RentList({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const [sheet, setSheet] = useState(false)
  const list = C.live(D.rent_records)
  const remind = list.filter((r) => C.rentBalance(D, r.id, today).remaining > 0)
  return html`<${Page} title=${t('Ijara')} sub=${`${list.length} ${t('ta yozuv')}`} right=${html`<button class="icon-btn light" onClick=${() => setSheet(true)}><${Icon} name="plus" /></button>`}>
    ${remind.length > 0 && html`<div class="msg warn" style="margin-bottom:12px"><b>${t('Eslatma')}:</b> ${remind.length} ${t('ta ijara bo‘yicha to‘lanmagan summa bor')}</div>`}
    ${list.length === 0 && html`<${Empty} icon="building" text=${t('Ijara yozuvi yo‘q. + tugmasi bilan qo‘shing.')} />`}
    <div class="list">${list.map((r) => { const b = C.rentBalance(D, r.id, today); const nx = C.nextRentDate(r, today)
      return html`<${Row} icon="building" tone=${b.remaining > 0 ? 'warn' : 'ok'} title=${r.party_name}
        sub=${`${r.direction === 'give' ? t('Ijaraga beraman') : t('Ijaraga olaman')} · ${C.fmt(r.rent_amount)}/${r.period_type === 'month' ? t('oy') : t('kun')}${nx && b.remaining > 0 ? ' · ' + t('muddat') + ': ' + fmtDate(nx) : ''}`}
        right=${html`<span class=${b.remaining > 0 ? 'neg' : 'pos'}>${C.fmt(b.remaining)}</span>`} onClick=${() => go('ijara/' + r.id)} />` })}</div>
    <p class="muted small">${t('O‘ng tomondagi raqam: to‘lanmagan (qolgan) summa.')}</p>
    ${sheet && html`<${RentSheet} onClose=${() => setSheet(false)} />`}
  <//>`
}

function RentSheet({ rec, onClose }) {
  const { t } = useT(); const S = useStore()
  const [f, setF] = useState({ party_name: rec ? rec.party_name : '', phone: rec ? rec.phone : '', direction: rec ? rec.direction : 'give', period_type: rec ? rec.period_type : 'month',
    rent_amount: rec ? Number(rec.rent_amount) : '', start_date: rec ? rec.start_date : todayStr(), end_date: rec ? rec.end_date || '' : '', note: rec ? rec.note : '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  function save() {
    if (!f.party_name.trim()) return toast(t('Ism-familiyani kiriting'), 'err')
    if (!f.rent_amount) return toast(t('Ijara summasini kiriting'), 'err')
    const row = { ...f, party_name: f.party_name.trim(), end_date: f.end_date || null }
    if (rec) S.patch('rent_records', rec.id, row); else S.save('rent_records', row)
    toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${rec ? t('Ijarani tahrirlash') : t('Yangi ijara')} onClose=${onClose}>
    <${Field} label=${t('Ijarachi / ijaraga beruvchi')}><input value=${f.party_name} onInput=${set('party_name')} /><//>
    <${Field} label=${t('Telefon raqami')}><input inputmode="tel" value=${f.phone} onInput=${set('phone')} /><//>
    <div class="two"><${Field} label=${t('Ijara turi')}><select value=${f.direction} onChange=${set('direction')}><option value="give">${t('Ijaraga beraman')}</option><option value="take">${t('Ijaraga olaman')}</option></select><//>
      <${Field} label=${t('Davr')}><select value=${f.period_type} onChange=${set('period_type')}><option value="month">${t('Oylik')}</option><option value="day">${t('Kunlik')}</option></select><//></div>
    <${Field} label=${t('Ijara summasi (so‘m)')}><${MoneyInput} value=${f.rent_amount} onChange=${(v) => setF({ ...f, rent_amount: v })} /><//>
    <div class="two"><${Field} label=${t('Boshlanish sanasi')}><input type="date" value=${f.start_date} onInput=${set('start_date')} /><//>
      <${Field} label=${t('Tugash sanasi')}><input type="date" value=${f.end_date} onInput=${set('end_date')} /><//></div>
    <${Field} label=${t('Izoh')}><input value=${f.note} onInput=${set('note')} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

function RentDetail({ id, go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const [sheet, setSheet] = useState(null)
  const r = (D.rent_records || []).find((x) => x.id === id)
  if (!r) return html`<${Page} title=${t('Ijara')} back=${() => go('ijara')}><${Empty} text=${t('Topilmadi')} /><//>`
  const b = C.rentBalance(D, id, today); const nx = C.nextRentDate(r, today)
  const pays = C.live(D.rent_payments).filter((p) => p.rent_id === id).sort((a, z) => (a.paid_date < z.paid_date ? 1 : -1))
  async function archive() { if (await ask(t('Ijara yozuvi arxivlansinmi?'), { danger: true })) { S.archive('rent_records', id); go('ijara') } }
  const del = async (pid) => { if (await ask(t('Bu to‘lov arxivlansinmi?'), { danger: true })) S.archive('rent_payments', pid) }
  const tip = r.direction === 'give' ? t('Kirim (sizga to‘lanadi)') : t('Chiqim (siz to‘laysiz)')
  return html`<${Page} title=${r.party_name} sub=${tip} back=${() => go('ijara')}
    right=${html`<div class="hero-r">${r.phone && html`<a class="icon-btn light" href=${'tel:' + r.phone}><${Icon} name="phone" size=${20} /></a>`}<button class="icon-btn light" onClick=${() => setSheet('edit')}><${Icon} name="edit" size=${20} /></button></div>`}>
    <div class="card">
      <div class="kv"><span>${t('Ijara')}</span><b>${C.fmt(r.rent_amount)} / ${r.period_type === 'month' ? t('oy') : t('kun')}</b></div>
      <div class="kv"><span>${t('Davr')}</span><b>${fmtDate(r.start_date)} — ${r.end_date ? fmtDate(r.end_date) : t('muddatsiz')}</b></div>
      <div class="kv"><span>${t('Hisoblangan jami')}</span><b>${C.fmt(b.due)}</b></div>
      <div class="kv"><span>${t('To‘langan')}</span><b class="pos">${C.fmt(b.paid)}</b></div>
      <div class="kv big"><span>${t('Qolgan qarz')}</span><b class=${b.remaining > 0 ? 'neg' : 'pos'}>${C.fmt(b.remaining)} ${t('so‘m')}</b></div>
      ${b.overpaid > 0 && html`<div class="msg ok">${t('Oldindan to‘langan')}: ${C.fmt(b.overpaid)}</div>`}
      ${nx && b.remaining > 0 && html`<div class="msg warn">${t('To‘lov muddati')}: ${fmtDate(nx)}</div>`}
    </div>
    <button class="btn primary block" style="margin-bottom:12px" onClick=${() => setSheet('pay')}><${Icon} name="cash" size=${18} />${r.direction === 'give' ? t('To‘lov qabul qilish') : t('To‘lov berish')}</button>
    <h2>${t('To‘lovlar')} (${pays.length})</h2>
    <div class="list">${pays.map((p) => html`<${Row} icon="cash" tone="ok" title=${`${C.fmt(p.amount)} ${t('so‘m')}`} sub=${`${fmtDate(p.paid_date)} ${p.note || ''}`} right=${html`<${Icon} name="archive" size=${16} />`} onClick=${() => del(p.id)} />`)}</div>
    <button class="btn danger block" onClick=${archive}><${Icon} name="archive" size=${18} />${t('Yozuvni arxivlash')}</button>
    ${sheet === 'edit' && html`<${RentSheet} rec=${r} onClose=${() => setSheet(null)} />`}
    ${sheet === 'pay' && html`<${SimplePay} title=${t('Ijara to‘lovi')} table="rent_payments" extra=${{ rent_id: id }} dateKey="paid_date" onClose=${() => setSheet(null)} />`}
  <//>`
}
