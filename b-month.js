import { useState } from 'preact/hooks'
import { html, useT, useStore, Page, Stat, Icon, Empty, todayStr, fmtDate } from './ui.js'
import * as C from './calc.js'
import { exportPDF, tbl, h2, note } from './pdf.js'

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

/** Oylik hisobot: bir oyda sexdan nechta ish chiqdi, qaysi modeldan, sotuv summasi, tannarx va foyda */
export function MonthPage({ go }) {
  const { t } = useT(); const S = useStore(); const D = S.all(); const today = todayStr()
  const [start, setStart] = useState(C.monthStart(today))
  const end = C.addDays(C.addMonths(start, 1), -1)
  const R = C.monthReport(D, start, end)
  const label = `${t(MONTHS[Number(start.slice(5, 7)) - 1])} ${start.slice(0, 4)}`
  const isNow = start >= C.monthStart(today)
  const mids = R.rows.map((r) => r.modelId)
  const dayHead = [t('Sana'), ...R.rows.map((r) => r.code), t('Jami')]
  const dayRows = R.days.map((d) => [fmtDate(d.date).slice(0, 5), ...mids.map((m) => d.byModel[m] || ''), d.pairs])
  const dayFoot = [[t('Jami'), ...R.rows.map((r) => r.pairs), R.pairs]]
  const modelHead = [t('Model'), t('Juft'), t('1 juft sotuv narxi'), t('Sotuv summasi'), t('Tannarx'), t('Foyda')]
  const modelRows = R.rows.map((r) => [r.code, r.pairs, C.fmt(r.unit), C.fmt(r.sale), C.fmt(r.cost), C.fmt(r.profit)])
  const modelFoot = [[t('Jami'), R.pairs, '', C.fmt(R.sale), C.fmt(R.cost), C.fmt(R.profit)]]

  const pdf = () => exportPDF({
    t, title: `${t('Oylik hisobot')} — ${label}`, sub: `${fmtDate(start)} — ${fmtDate(end)}`,
    filename: `oylik-hisobot-${start.slice(0, 7)}.pdf`,
    body: h2(t('Modellar bo‘yicha')) + tbl(modelHead, modelRows, modelFoot) +
      h2(t('Kunlik ish chiqishi (juft)')) + tbl(dayHead, dayRows, dayFoot) +
      note(`${t('Foyda = sotuv summasi − tannarx. Tannarx ish haqi va boshqa xarajatlarni o‘z ichiga oladi.')}${R.missing ? ' ' + R.missing + ' ' + t('juft uchun narx kiritilmagan.') : ''}`),
  })

  return html`<${Page} title=${t('Oylik hisobot')} sub=${label} back=${() => go('bosh')} right=${html`<button class="icon-btn light" onClick=${pdf}><${Icon} name="download" /></button>`}>
    <div class="monthbar">
      <button class="btn sm" onClick=${() => setStart(C.addMonths(start, -1))}><${Icon} name="back" size=${18} /></button>
      <b>${label}</b>
      <button class="btn sm" disabled=${isNow} onClick=${() => setStart(C.addMonths(start, 1))}><${Icon} name="next" size=${18} /></button>
    </div>
    <div class="grid">
      <${Stat} icon="shoe" n=${C.fmt(R.pairs)} label=${t('Oyda chiqqan ish (juft)')} />
      <${Stat} icon="cash" n=${C.fmt(R.sale)} label=${t('Sotuv summasi (so‘m)')} />
      <${Stat} icon="wallet" n=${C.fmt(R.cost)} label=${t('Tannarx (so‘m)')} />
      <${Stat} icon="trend" tone="green" n=${C.fmt(R.profit)} label=${t('Foyda (so‘m)')} />
    </div>
    ${R.missing > 0 && html`<div class="msg warn">${R.missing} ${t('juft uchun tannarx/sotuv narxi kiritilmagan. «Qiymatlar» bo‘limida kiriting.')}</div>`}
    <button class="btn primary block" style="margin-bottom:14px" onClick=${pdf}><${Icon} name="download" size=${18} />${t('PDF qilib saqlash / yuborish')}</button>
    ${R.rows.length === 0 ? html`<${Empty} icon="book" text=${t('Bu oyda ish chiqmagan')} />` : html`
      <h2>${t('Modellar bo‘yicha')}</h2>
      <div class="table-wrap"><table class="grid-t"><thead><tr>${modelHead.map((h) => html`<th>${h}</th>`)}</tr></thead>
        <tbody>${modelRows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
        <tfoot>${modelFoot.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tfoot></table></div>
      <h2>${t('Kunlik ish chiqishi (juft)')}</h2>
      <div class="table-wrap"><table class="grid-t"><thead><tr>${dayHead.map((h) => html`<th>${h}</th>`)}</tr></thead>
        <tbody>${dayRows.map((r) => html`<tr>${r.map((c) => html`<td>${c === '' ? '·' : c}</td>`)}</tr>`)}</tbody>
        <tfoot>${dayFoot.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tfoot></table></div>
      <p class="muted small">${t('Foyda = sotuv summasi − tannarx. Tannarx ish haqi va boshqa xarajatlarni o‘z ichiga oladi, shuning uchun ish haqi qayta ayirilmaydi.')}</p>`}
  <//>`
}
