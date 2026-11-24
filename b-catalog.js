import { useState } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Row, Chips, Icon, Field, MoneyInput, Sheet, Switch, Empty, toast, ask, todayStr, fmtDate } from './ui.js'
import { supabase, friendlyError } from './lib.js'
import * as C from './calc.js'

const KASB_ORDER = ['kosib', 'zakatofkachi', 'kroychik', 'pardozchi']
const sortedTypes = (D) => C.live(D.worker_types).sort((a, b) => KASB_ORDER.indexOf(a.code) - KASB_ORDER.indexOf(b.code))

/* ===================== Modellar va ish haqi narxlari ===================== */
export function ModelsPage({ go }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const [filter, setFilter] = useState('active')
  const [sheet, setSheet] = useState(null)
  const types = sortedTypes(D)
  const prices = C.live(D.model_prices)
  async function remove(mm) {
    if (await ask(t('Model o‘chirilsinmi? Eski ishlar va hisob-kitoblar saqlanadi.'), { danger: true })) { S.archive('models', mm.id); toast(t('Model o‘chirildi')) }
  }
  const list = (D.models || []).filter((m) => (filter === 'arxiv' ? !!m.deleted_at : !m.deleted_at && (filter === 'all' || m.is_active === (filter === 'active'))))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  return html`<${Page} title=${t('Modellar')} sub=${`${list.length} ${t('ta')}`} right=${html`<button class="icon-btn light" onClick=${() => setSheet({})}><${Icon} name="plus" /></button>`}>
    <${Chips} value=${filter} onChange=${setFilter} items=${[['active', t('Faol')], ['inactive', t('Vaqtincha o‘chirilgan')], ['arxiv', t('O‘chirilganlar')]]} />
    ${list.length === 0 && html`<${Empty} icon="shoe" text=${t('Hozircha model yo‘q. + tugmasi bilan qo‘shing.')} />`}
    <div class="list">${list.map((m) => html`<${Row} icon="shoe" img=${m.photo} title=${C.mLabel(m)}
      sub=${types.map((ty) => { const p = C.priceFor(prices, m.id, ty.id, today); return `${t(ty.name)}: ${p === null ? '—' : C.fmt(p)}` }).join(' · ')}
      right=${html`<span class="rbtns">${m.deleted_at ? html`<span class="pill gray">${t('O‘chirilgan')}</span>` : html`${!m.is_active ? html`<span class="pill amber">${t('Nofaol')}</span>` : null}<button class="btn sm ghost" onClick=${(ev) => { ev.stopPropagation(); setSheet(m) }}><${Icon} name="edit" size=${16} /></button><button class="btn sm ghost" onClick=${(ev) => { ev.stopPropagation(); remove(m) }}><${Icon} name="archive" size=${16} /></button>`}</span>`}
      onClick=${() => setSheet(m)} />`)}</div>
    ${sheet && html`<${ModelSheet} model=${sheet.id ? sheet : null} onClose=${() => setSheet(null)} />`}
  <//>`
}

function ModelSheet({ model, onClose }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const types = sortedTypes(D); const allPrices = C.live(D.model_prices)
  const current = (tid) => (model ? C.priceFor(allPrices, model.id, tid, today) : null)
  const [code, setCode] = useState(model ? model.code : '')
  const [name, setName] = useState(model ? model.name : '')
  const [note, setNote] = useState(model ? model.note : '')
  const [active, setActive] = useState(model ? model.is_active : true)
  const [photo, setPhoto] = useState(model && model.photo ? model.photo : '')
  function pickPhoto(ev) {
    const f = ev.target.files && ev.target.files[0]; if (!f) return
    const fr = new FileReader()
    fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 160 / Math.max(im.width, im.height)), c = document.createElement('canvas')
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k)
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); setPhoto(c.toDataURL('image/jpeg', 0.65))
    }; im.src = fr.result }
    fr.readAsDataURL(f)
  }
  const [pr, setPr] = useState(Object.fromEntries(types.map((ty) => [ty.id, current(ty.id) === null ? '' : current(ty.id)])))
  const [busy, setBusy] = useState(false)

  async function save() {
    const c = code.trim()
    if (!c) return toast(t('Model kodini kiriting'), 'err')
    if (C.live(D.models).some((m) => m.code === c && (!model || m.id !== model.id))) return toast(t('Bu model kodi band'), 'err')
    const changes = types.filter((ty) => pr[ty.id] !== '' && pr[ty.id] !== current(ty.id)).map((ty) => ({ ty, old: current(ty.id), val: pr[ty.id] }))
    const hasOld = changes.some((x) => x.old !== null)
    let mode = 'from'
    if (hasOld) {
      const lines = changes.filter((x) => x.old !== null).map((x) => `${t(x.ty.name)}: ${C.fmt(x.old)} → ${C.fmt(x.val)}`).join('\n')
      mode = await ask(`${t('Narx o‘zgartirilsinmi?')}\n${lines}\n\n${t('Barcha davr: oldingi ishlar ham yangi narxda qayta hisoblanadi. Bugundan boshlab: oldingi ishlar eski narxda qoladi.')}`,
        { options: [{ value: 'from', label: t('Bugundan boshlab'), tone: 'primary' }, { value: 'all', label: t('Barcha davr uchun'), tone: 'navy' }] })
      if (!mode) return
    }
    setBusy(true)
    let id = model ? model.id : null
    const ph = photo !== ((model && model.photo) || '') ? { photo: photo || null } : {}
    if (model) S.patch('models', id, { code: c, name: name.trim(), note: note.trim(), is_active: active, ...ph })
    else id = S.save('models', { code: c, name: name.trim(), note: note.trim(), is_active: active, ...ph })
    if (changes.length) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { toast(t('Model saqlandi. Narxni o‘zgartirish uchun internet kerak.'), 'err'); setBusy(false); return onClose() }
      await S.sync()
      if (S.all().models.some((m) => m.id === id && m._pending)) { toast(t('Model hali sinxronlanmadi. Birozdan keyin narxni qayta kiriting.'), 'err'); setBusy(false); return onClose() }
      for (const x of changes) {
        const { error } = await supabase.rpc('change_model_price', { p_model: id, p_type: x.ty.id, p_price: x.val, p_mode: x.old === null ? 'from' : mode, p_from: todayStr() })
        if (error) { toast(friendlyError(error.message), 'err'); setBusy(false); await S.load(); return }
      }
      await S.load()
    }
    toast(t('Saqlandi')); setBusy(false); onClose()
  }
  async function archive() {
    if (await ask(t('Model o‘chirilsinmi? Eski ishlar va hisob-kitoblar saqlanadi.'), { danger: true })) { S.archive('models', model.id); onClose() }
  }
  const hist = model ? allPrices.filter((p) => p.model_id === model.id).sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1)) : []
  return html`<${Sheet} title=${model ? t('Modelni tahrirlash') : t('Yangi model')} onClose=${onClose}>
    <form class="fform" onSubmit=${(ev) => { ev.preventDefault(); if (!busy) save() }}>
    <div class="two"><${Field} label=${t('Model kodi')}><input enterkeyhint="go" value=${code} onInput=${(e) => setCode(e.target.value)} placeholder="01" /><//>
      <${Field} label=${t('Model nomi')}><input enterkeyhint="go" value=${name} onInput=${(e) => setName(e.target.value)} /><//></div>
    <${Field} label=${t('Model rasmi (ixtiyoriy)')}><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${photo ? html`<img class="mth big" src=${photo} alt="" />` : null}<input type="file" accept="image/*" onChange=${pickPhoto} style="flex:1;min-width:0" />${photo ? html`<button type="button" class="btn sm ghost" onClick=${() => setPhoto('')}>${t('Olib tashlash')}</button>` : null}</div><//>
    <${Field} label=${t('Izoh')}><input enterkeyhint="go" value=${note} onInput=${(e) => setNote(e.target.value)} /><//>
    <${Switch} on=${active} onChange=${setActive} label=${t('Faol')} />
    <b>${t('Ish haqi narxi (bir juft uchun, so‘m)')}</b>
    ${types.map((ty) => html`<${Field} label=${t(ty.name)}><${MoneyInput} value=${pr[ty.id]} onChange=${(v) => setPr({ ...pr, [ty.id]: v })} /><//>`)}
    ${hist.length > 0 && html`<details><summary class="muted">${t('Narxlar tarixi')}</summary>
      ${hist.map((p) => html`<div class="kv small"><span>${t((types.find((x) => x.id === p.worker_type_id) || {}).name || '')}</span><span>${C.fmt(p.price)} · ${p.valid_from === '2000-01-01' ? t('boshidan') : fmtDate(p.valid_from)}</span></div>`)}</details>`}
    <button type="submit" class="btn primary block" disabled=${busy}>${busy ? t('Kuting...') : t('Saqlash')}</button>
    ${model && !model.deleted_at && html`<button type="button" class="btn danger block" onClick=${archive}><${Icon} name="archive" size=${18} />${t('O‘chirish')}</button>`}
    ${model && model.deleted_at && html`<button type="button" class="btn block" onClick=${() => { S.restore('models', model.id); onClose() }}>${t('Qaytarish')}</button>`}
    </form>
  <//>`
}

/* ===================== Qiymatlar: tannarx, sotuv narxi, foyda ===================== */
export function ValuesPage({ go }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const [sheet, setSheet] = useState(null)
  const models = C.live(D.models).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  return html`<${Page} title=${t('Qiymatlar')} sub=${t('Tannarx va sotuv narxi')}>
    <div class="msg warn" style="margin-bottom:12px">${t('Tannarxga ish haqi va boshqa xarajatlar kiradi. Ular alohida yana qo‘shilmaydi, shuning uchun ikki marta hisoblanmaydi.')}</div>
    ${models.length === 0 && html`<${Empty} icon="tag" text=${t('Avval Modellar bo‘limida model qo‘shing')} />`}
    <div class="list">${models.map((m) => {
      const c = C.costFor(D, m.id, today)
      return html`<${Row} icon="tag" img=${m.photo} title=${C.mLabel(m)}
        sub=${c ? `${t('Tannarx')}: ${C.fmt(c.cost_per_pair)} · ${t('Sotuv')}: ${C.fmt(c.sale_price_per_pair)}` : t('Kiritilmagan')}
        right=${c ? html`<span class=${c.sale_price_per_pair - c.cost_per_pair >= 0 ? 'pos' : 'neg'}>${C.fmt(c.sale_price_per_pair - c.cost_per_pair)}</span>` : null}
        onClick=${() => setSheet(m)} />`
    })}</div>
    ${sheet && html`<${ValueSheet} model=${sheet} onClose=${() => setSheet(null)} />`}
  <//>`
}

function ValueSheet({ model, onClose }) {
  const { t } = useT()
  const S = useStore(); const D = S.all(); const today = todayStr()
  const cur = C.costFor(D, model.id, '9999-12-31')
  const [cost, setCost] = useState(cur ? cur.cost_per_pair : '')
  const [sale, setSale] = useState(cur ? cur.sale_price_per_pair : '')
  const profit = (Number(sale) || 0) - (Number(cost) || 0)
  function save() {
    if (cost === '' || sale === '') return toast(t('Ikkala qiymatni kiriting'), 'err')
    if (cur) S.patch('product_costs', cur.id, { cost_per_pair: cost, sale_price_per_pair: sale })
    else S.save('product_costs', { model_id: model.id, cost_per_pair: cost, sale_price_per_pair: sale, valid_from: today })
    toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${`${t('Model')} ${model.code}`} onClose=${onClose}>
    <${Field} label=${t('Bir juft ishlab chiqarish tannarxi (so‘m)')}><${MoneyInput} value=${cost} onChange=${setCost} /><//>
    <${Field} label=${t('Bir juft sotuv narxi (so‘m)')}><${MoneyInput} value=${sale} onChange=${setSale} /><//>
    <div class="card flat"><div class="kv big"><span>${t('Bir juftdan foyda')}</span><b class=${profit >= 0 ? 'pos' : 'neg'}>${C.fmt(profit)} ${t('so‘m')}</b></div>
      <span class="muted small">${t('Foyda = sotuv narxi − tannarx')}</span></div>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}
