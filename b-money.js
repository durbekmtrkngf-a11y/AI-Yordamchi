import { useState } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Chips, Icon, Field, MoneyInput, Sheet, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import * as C from './calc.js'

const CATS = ['Xomashyo', 'Charm', 'Yelim', 'Ip', 'Taglik', 'Elektr energiyasi', 'Transport', 'Ta‘mirlash', 'Ovqatlanish', 'Boshqa xarajatlar']

/* ===================== Xarajatlar ===================== */
export function ExpensesPage() {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const [period, setPeriod] = useState('today'); const [cat, setCat] = useState('all'); const [q, setQ] = useState('')
  const [day, setDay] = useState(''); const [sheet, setSheet] = useState(null)
  const from = day || (period === 'today' ? today : period === 'week' ? C.weekStart(today) : period === 'month' ? C.monthStart(today) : '')
  const to = day || (period === 'all' ? '' : today)
  const all = C.live(D.expenses)
  const list = all.filter((x) => C.inRange(x.expense_date, from, to) && (cat === 'all' || x.category === cat) &&
    (!q || (x.title + ' ' + x.note).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
  const todayTotal = C.sum(all.filter((x) => x.expense_date === today), (x) => x.amount)
  return html`<${Page} title=${t('Xarajatlar')} sub=${fmtDate(today)} right=${html`<button class="icon-btn light" onClick=${() => setSheet({})}><${Icon} name="plus" /></button>`}
    hero=${html`<div style="margin-top:14px"><div style="font-size:13px;opacity:.8">${t('Bugungi xarajat')}</div><div style="font-size:28px;font-weight:800">${C.fmt(todayTotal)} ${t('so‘m')}</div></div>`}>
    <${Chips} value=${period} onChange=${(v) => { setPeriod(v); setDay('') }} items=${[['today', t('Bugun')], ['week', t('Hafta')], ['month', t('Oy')], ['all', t('Hammasi')]]} />
    <div class="datebar"><${Icon} name="calendar" size=${20} /><input type="date" value=${day} onInput=${(e) => setDay(e.target.value)} />${day && html`<button class="btn sm" onClick=${() => setDay('')}>${t('Tozalash')}</button>`}</div>
    <div class="search"><${Icon} name="search" size=${18} /><input placeholder=${t('Qidirish')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    <${Chips} value=${cat} onChange=${setCat} items=${[['all', t('Hammasi')], ...CATS.map((c) => [c, t(c)])]} />
    <div class="grid"><${Stat} n=${C.fmt(C.sum(list, (x) => x.amount))} label=${t('Tanlangan davr jami (so‘m)')} wide /></div>
    ${list.length === 0 && html`<${Empty} icon="wallet" text=${t('Xarajat topilmadi')} />`}
    <div class="list">${list.map((x) => html`<${Row} icon="receipt" title=${x.title} sub=${`${t(x.category)} · ${fmtDate(x.expense_date)} · ${x.pay_method === 'card' ? t('Karta') : t('Naqd')}`}
      right=${C.fmt(x.amount)} onClick=${() => setSheet(x)} />`)}</div>
    ${sheet && html`<${ExpenseSheet} item=${sheet.id ? sheet : null} onClose=${() => setSheet(null)} />`}
  <//>`
}

function ExpenseSheet({ item, onClose }) {
  const { t } = useT(); const S = useStore()
  const [title, setTitle] = useState(item ? item.title : '')
  const [category, setCategory] = useState(item ? item.category : CATS[0])
  const [amount, setAmount] = useState(item ? item.amount : '')
  const [date, setDate] = useState(item ? item.expense_date : todayStr())
  const [note, setNote] = useState(item ? item.note : '')
  const [method, setMethod] = useState(item ? item.pay_method : 'cash')
  function save() {
    if (!title.trim()) return toast(t('Xarajat nomini kiriting'), 'err')
    if (!amount || amount <= 0) return toast(t('Summani kiriting'), 'err')
    const row = { title: title.trim(), category, amount, expense_date: date, note, pay_method: method }
    if (item) S.patch('expenses', item.id, row); else S.save('expenses', row)
    toast(t('Saqlandi')); onClose()
  }
  async function del() { if (await ask(t('Xarajat arxivlansinmi?'), { danger: true })) { S.archive('expenses', item.id); onClose() } }
  return html`<${Sheet} title=${item ? t('Xarajatni tahrirlash') : t('Yangi xarajat')} onClose=${onClose}>
    <${Field} label=${t('Xarajat nomi')}><input value=${title} onInput=${(e) => setTitle(e.target.value)} /><//>
    <${Field} label=${t('Kategoriya')}><select value=${category} onChange=${(e) => setCategory(e.target.value)}>${CATS.map((c) => html`<option value=${c}>${t(c)}</option>`)}</select><//>
    <${Field} label=${t('Summa (so‘m)')}><${MoneyInput} value=${amount} onChange=${setAmount} /><//>
    <div class="two"><${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
      <${Field} label=${t('To‘lov turi')}><select value=${method} onChange=${(e) => setMethod(e.target.value)}><option value="cash">${t('Naqd')}</option><option value="card">${t('Karta')}</option></select><//></div>
    <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    ${item && html`<p class="muted small">${t('Tuzatilganda eski qiymat tarixda saqlanadi.')}</p>`}
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
    ${item && html`<button class="btn danger block" onClick=${del}><${Icon} name="archive" size=${18} />${t('Arxivlash')}</button>`}
  <//>`
}

/* ===================== Klientlar, buyurtmalar, to'lovlar ===================== */
export function ClientsPage({ arg, go }) {
  return arg ? html`<${ClientDetail} id=${arg} go=${go} />` : html`<${ClientList} go=${go} />`
}

function ClientList({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all()
  const [q, setQ] = useState(''); const [sheet, setSheet] = useState(false)
  const list = C.live(D.clients).filter((c) => !q || (c.name + c.phone).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))
  const totalDebt = C.sum(C.live(D.clients), (c) => C.clientBalance(D, c.id).debt)
  return html`<${Page} title=${t('Klientlar')} sub=${`${t('Jami qarzdorlik')}: ${C.fmt(totalDebt)}`} right=${html`<button class="icon-btn light" onClick=${() => setSheet(true)}><${Icon} name="plus" /></button>`}>
    <div class="search"><${Icon} name="search" size=${18} /><input placeholder=${t('Ism yoki telefon')} value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
    ${list.length === 0 && html`<${Empty} icon="user" text=${t('Klient yo‘q. + tugmasi bilan qo‘shing.')} />`}
    <div class="list">${list.map((c) => { const b = C.clientBalance(D, c.id)
      return html`<${Row} icon="user" title=${c.name} sub=${c.phone || t('Telefon yo‘q')} right=${html`<span class=${b.debt > 0 ? 'neg' : 'pos'}>${C.fmt(b.debt)}</span>`} onClick=${() => go('klient/' + c.id)} />` })}</div>
    ${sheet && html`<${ClientSheet} onClose=${() => setSheet(false)} />`}
  <//>`
}

function ClientSheet({ client, onClose }) {
  const { t } = useT(); const S = useStore()
  const [f, setF] = useState({ name: client ? client.name : '', phone: client ? client.phone : '', address: client ? client.address : '', note: client ? client.note : '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  function save() {
    if (!f.name.trim()) return toast(t('Ism yoki korxona nomini kiriting'), 'err')
    if (client) S.patch('clients', client.id, f); else S.save('clients', f)
    toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${client ? t('Klientni tahrirlash') : t('Yangi klient')} onClose=${onClose}>
    <${Field} label=${t('Ism-familiya yoki korxona nomi')}><input value=${f.name} onInput=${set('name')} /><//>
    <${Field} label=${t('Telefon raqami')}><input inputmode="tel" value=${f.phone} onInput=${set('phone')} /><//>
    <${Field} label=${t('Manzil')}><input value=${f.address} onInput=${set('address')} /><//>
    <${Field} label=${t('Izoh')}><input value=${f.note} onInput=${set('note')} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

function ClientDetail({ id, go }) {
  const { t } = useT(); const S = useStore(); const D = S.all()
  const [sheet, setSheet] = useState(null)
  const c = (D.clients || []).find((x) => x.id === id)
  if (!c) return html`<${Page} title=${t('Klient')} back=${() => go('klient')}><${Empty} text=${t('Topilmadi')} /><//>`
  const b = C.clientBalance(D, id)
  const orders = C.live(D.orders).filter((o) => o.client_id === id).sort((a, z) => (a.order_date < z.order_date ? 1 : -1))
  const pays = C.live(D.client_payments).filter((p) => p.client_id === id).sort((a, z) => (a.paid_date < z.paid_date ? 1 : -1))
  const mcode = (mid) => ((D.models || []).find((m) => m.id === mid) || {}).code || '?'
  const del = async (table, rid) => { if (await ask(t('Bu yozuv arxivlansinmi?'), { danger: true })) S.archive(table, rid) }
  return html`<${Page} title=${c.name} sub=${c.address} back=${() => go('klient')}
    right=${c.phone ? html`<a class="icon-btn light" href=${'tel:' + c.phone}><${Icon} name="phone" size=${20} /></a>` : null}>
    <div class="card">
      <div class="kv"><span>${t('Jami buyurtma qiymati')}</span><b>${C.fmt(b.total)}</b></div>
      <div class="kv"><span>${t('To‘lagan')}</span><b class="pos">${C.fmt(b.paid)}</b></div>
      <div class="kv big"><span>${t('Qarzi')}</span><b class=${b.debt > 0 ? 'neg' : 'pos'}>${C.fmt(b.debt)} ${t('so‘m')}</b></div>
      ${c.note && html`<span class="muted">${c.note}</span>`}
    </div>
    <div class="btns" style="margin-bottom:12px">
      <button class="btn primary" onClick=${() => setSheet('pay')}><${Icon} name="cash" size=${18} />${t('Pul kiritish')}</button>
      <button class="btn" onClick=${() => setSheet('order')}><${Icon} name="plus" size=${18} />${t('Buyurtma')}</button>
      <button class="btn" onClick=${() => setSheet('edit')}><${Icon} name="edit" size=${18} /></button>
    </div>
    <h2>${t('Buyurtmalar')} (${orders.length})</h2>
    <div class="list">${orders.map((o) => html`<${Row} icon="shoe" title=${`${t('Model')} ${mcode(o.model_id)} · ${o.pairs} ${t('juft')}`}
      sub=${`${fmtDate(o.order_date)} · ${C.fmt(o.price_per_pair)} ${t('so‘m')}/${t('juft')}`} right=${C.fmt(o.pairs * o.price_per_pair)}
      onClick=${() => del('orders', o.id)} />`)}</div>
    <h2>${t('To‘lovlar tarixi')} (${pays.length})</h2>
    <div class="list">${pays.map((p) => html`<${Row} icon="cash" tone="ok" title=${`${C.fmt(p.amount)} ${t('so‘m')}`} sub=${`${fmtDate(p.paid_date)} ${p.note || ''}`}
      right=${html`<${Icon} name="archive" size=${16} />`} onClick=${() => del('client_payments', p.id)} />`)}</div>
    <p class="muted small">${t('Buyurtma yoki to‘lovni arxivlash uchun ustiga bosing.')}</p>
    ${sheet === 'edit' && html`<${ClientSheet} client=${c} onClose=${() => setSheet(null)} />`}
    ${sheet === 'pay' && html`<${PaySheet} client=${c} debt=${b.debt} onClose=${() => setSheet(null)} />`}
    ${sheet === 'order' && html`<${OrderSheet} client=${c} onClose=${() => setSheet(null)} />`}
  <//>`
}

function PaySheet({ client, debt, onClose }) {
  const { t } = useT(); const S = useStore()
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState('')
  function save() {
    if (!amount || amount <= 0) return toast(t('Summani kiriting'), 'err')
    S.save('client_payments', { client_id: client.id, amount, paid_date: date, note }); toast(t('To‘lov saqlandi, qarz kamaydi')); onClose()
  }
  return html`<${Sheet} title=${`${client.name}: ${t('pul kiritish')}`} onClose=${onClose}>
    <div class="msg warn">${t('Joriy qarz')}: ${C.fmt(debt)} ${t('so‘m')}</div>
    <${Field} label=${t('To‘lov summasi (so‘m)')}><${MoneyInput} value=${amount} onChange=${setAmount} /><//>
    <${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
    <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}

function OrderSheet({ client, onClose }) {
  const { t } = useT(); const S = useStore(); const D = S.all()
  const models = C.live(D.models).filter((m) => m.is_active)
  const [model, setModel] = useState(models[0] ? models[0].id : '')
  const [pairs, setPairs] = useState(''); const [date, setDate] = useState(todayStr()); const [note, setNote] = useState('')
  const defPrice = (mid) => { const c = C.costFor(D, mid, '9999-12-31'); return c ? c.sale_price_per_pair : '' }
  const [price, setPrice] = useState(models[0] ? defPrice(models[0].id) : '')
  function save() {
    if (!model) return toast(t('Model tanlang'), 'err')
    if (!pairs || pairs <= 0) return toast(t('Juft sonini kiriting'), 'err')
    if (price === '') return toast(t('Bir juft narxini kiriting'), 'err')
    S.save('orders', { client_id: client.id, model_id: model, order_date: date, pairs, price_per_pair: price, note }); toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${`${client.name}: ${t('buyurtma')}`} onClose=${onClose}>
    ${models.length === 0 ? html`<div class="msg warn">${t('Avval Modellar bo‘limida model qo‘shing')}</div>` : html`
    <${Field} label=${t('Model')}><select value=${model} onChange=${(e) => { setModel(e.target.value); setPrice(defPrice(e.target.value)) }}>${models.map((m) => html`<option value=${m.id}>${m.code} ${m.name}</option>`)}</select><//>
    <div class="two"><${Field} label=${t('Miqdor (juft)')}><${MoneyInput} value=${pairs} onChange=${setPairs} /><//>
      <${Field} label=${t('Bir juft narxi')}><${MoneyInput} value=${price} onChange=${setPrice} /><//></div>
    <div class="kv big"><span>${t('Jami')}</span><b>${C.fmt((Number(pairs) || 0) * (Number(price) || 0))} ${t('so‘m')}</b></div>
    <${Field} label=${t('Sana')}><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} /><//>
    <${Field} label=${t('Izoh')}><input value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>`}
  <//>`
}

/* ===================== Moliyaviy hisobot ===================== */
export function FinancePage({ go }) {
  const { t } = useT(); const D = useStore().all(); const today = todayStr()
  const [period, setPeriod] = useState('month'); const [a, setA] = useState(C.monthStart(today)); const [b, setB] = useState(today)
  const from = period === 'today' ? today : period === 'week' ? C.weekStart(today) : period === 'month' ? C.monthStart(today) : period === 'all' ? '' : a
  const to = period === 'range' ? b : period === 'all' ? '' : today
  const f = C.finance(D, from, to, today)
  const K = ({ k, v, tone }) => html`<div class="kv"><span>${k}</span><b class=${tone || ''}>${C.fmt(v)}</b></div>`
  return html`<${Page} title=${t('Moliyaviy hisobot')} sub=${from ? `${fmtDate(from)} — ${fmtDate(to)}` : t('Butun davr')} back=${() => go('yana')}>
    <${Chips} value=${period} onChange=${setPeriod} items=${[['today', t('Kun')], ['week', t('Hafta')], ['month', t('Oy')], ['range', t('Oraliq')], ['all', t('Hammasi')]]} />
    ${period === 'range' && html`<div class="datebar"><input type="date" value=${a} onInput=${(e) => setA(e.target.value)} /><span>—</span><input type="date" value=${b} onInput=${(e) => setB(e.target.value)} /></div>`}
    <div class="grid">
      <${Stat} icon="trend" tone="dark" n=${C.fmt(f.sales)} label=${t('Tushum (sotuv)')} />
      <${Stat} icon="chart" tone="green" n=${C.fmt(f.operatingProfit)} label=${t('Foyda')} />
      <${Stat} icon="cash" wide n=${C.fmt(f.cashFlow)} label=${t('Naqd pul harakati (kirgan − chiqqan)')} />
    </div>
    <div class="card"><h2 style="margin:0">${t('Tushum va foyda')}</h2>
      <${K} k=${t('Sotuv (buyurtmalar qiymati)')} v=${f.sales} />
      <${K} k=${'− ' + t('Xarajatlar')} v=${f.expenses} />
      <${K} k=${'− ' + t('Ishchilarga hisoblangan maosh')} v=${f.salaryAccrued} />
      <${K} k=${'+ ' + t('Ijara kirimi')} v=${f.rentIn} /><${K} k=${'− ' + t('Ijara chiqimi')} v=${f.rentOut} />
      <div class="kv big"><span>${t('Foyda (hamkor ulushigacha)')}</span><b class=${f.operatingProfit >= 0 ? 'pos' : 'neg'}>${C.fmt(f.operatingProfit)}</b></div>
      <${K} k=${'− ' + t('Hamkor ulushi')} v=${f.partnerShares} />
      <div class="kv big"><span>${t('Sof foyda')}</span><b class=${f.profitAfterPartners >= 0 ? 'pos' : 'neg'}>${C.fmt(f.profitAfterPartners)}</b></div>
    </div>
    <div class="card"><h2 style="margin:0">${t('Pul harakati')}</h2>
      <${K} k=${'+ ' + t('Klientlardan tushgan pul')} v=${f.clientsPaid} /><${K} k=${'+ ' + t('Ijara kirimi')} v=${f.rentIn} />
      <${K} k=${'− ' + t('Xarajatlar')} v=${f.expenses} /><${K} k=${'− ' + t('Ishchilarga to‘langan maosh')} v=${f.salaryPaid} />
      <${K} k=${'− ' + t('Ishchilarga berilgan avans')} v=${f.advancesPaid} /><${K} k=${'− ' + t('Hamkorga to‘langan')} v=${f.partnerPaid} />
      <${K} k=${'− ' + t('Ijara chiqimi')} v=${f.rentOut} />
      <div class="kv big"><span>${t('Naqd pul qoldig‘i (davr)')}</span><b class=${f.cashFlow >= 0 ? 'pos' : 'neg'}>${C.fmt(f.cashFlow)}</b></div>
    </div>
    <div class="card"><h2 style="margin:0">${t('Qarzdorlik (hozirgi holat)')}</h2>
      <${K} k=${t('Mijozlarning qarzdorligi')} v=${f.clientDebt} tone="neg" />
      <${K} k=${t('Ishchilarning qolgan maoshi')} v=${f.workersRemaining} />
    </div>
    <div class="card"><h2 style="margin:0">${t('Ma‘lumot uchun')}</h2>
      <${K} k=${t('Ishlab chiqarish tannarxi (kosib juftlari)')} v=${f.productionCost} />
      <span class="muted small">${t('Tannarx foydadan ayrilmaydi: ish haqi va xarajatlar allaqachon alohida hisoblangan, shuning uchun ikki marta sanalmaydi.')}</span>
      ${f.noPrice > 0 && html`<div class="msg warn">${f.noPrice} ${t('ta ish uchun narx belgilanmagan, ular 0 deb hisoblandi.')}</div>`}
    </div>
    <p class="muted small">${t('Tushum, foyda va naqd pul qoldig‘i bir xil tushuncha emas, shuning uchun alohida ko‘rsatilgan.')}</p>
  <//>`
}
