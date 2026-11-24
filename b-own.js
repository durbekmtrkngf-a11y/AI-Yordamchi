import { useState } from 'preact/hooks'
import { html, useT, useStore, Field, Sheet, toast, todayStr } from './ui.js'
import * as C from './calc.js'

/** Boshliq o'zi kiritadigan umumiy kunlik ish (pardozni o'zi qilganda va h.k.). Bosh sahifadagi "Kunlik ish chiqishi" ga qo'shiladi. */
export function OwnOutput({ onClose }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const models = C.live(D.models).filter((m) => m.is_active).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  const rowOf = (d, m) => C.live(D.boss_output).find((r) => r.work_date === d && r.model_id === m)
  const init = (d) => Object.fromEntries(models.map((m) => { const r = rowOf(d, m.id); return [m.id, r && r.pairs ? String(r.pairs) : ''] }))
  const [date, setDate] = useState(today)
  const [vals, setVals] = useState(() => init(today))
  const pickDate = (d) => { setDate(d); setVals(init(d)) }
  const total = C.sum(models, (m) => Number(vals[m.id]) || 0)
  function save() {
    if (date > today) return toast(t('Kelajak sanasiga ish kiritib bo‘lmaydi'), 'err')
    for (const m of models) {
      const n = Number(vals[m.id]) || 0; const ex = rowOf(date, m.id)
      if (ex) { if (Number(ex.pairs) !== n) S.patch('boss_output', ex.id, { pairs: n }) }
      else if (n > 0) S.save('boss_output', { model_id: m.id, work_date: date, pairs: n })
    }
    toast(t('Saqlandi')); onClose()
  }
  return html`<${Sheet} title=${t('Umumiy kunlik ish (boshliq)')} onClose=${onClose}>
    <${Field} label=${t('Sana')}><input type="date" max=${today} value=${date} onInput=${(e) => pickDate(e.target.value || date)} /><//>
    ${models.length === 0 && html`<div class="msg warn">${t('Avval Modellar bo‘limida model qo‘shing')}</div>`}
    <div>${models.map((m) => html`<div class="ownrow" key=${m.id}>
      <span>${m.photo ? html`<img class="mth" style="display:inline-block;margin:0 8px 0 0;vertical-align:middle" src=${m.photo} />` : null}<b>${C.mLabel(m)}</b></span>
      <input inputmode="numeric" placeholder="0" value=${vals[m.id]} onInput=${(e) => setVals({ ...vals, [m.id]: e.target.value.replace(/\D/g, '').slice(0, 5) })} /></div>`)}</div>
    <div class="card flat" style="margin-top:12px"><div class="kv big"><span>${t('Jami')}</span><b>${total} ${t('juft')}</b></div>
      <span class="muted small">${t('Bu ish ishchi haqiga qo‘shilmaydi, faqat umumiy kunlik ish chiqishiga kiradi.')}</span></div>
    <button class="btn primary block" onClick=${save}>${t('Saqlash')}</button>
  <//>`
}
