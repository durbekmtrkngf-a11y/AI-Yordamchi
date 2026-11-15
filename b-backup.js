import { useState, useEffect } from 'preact/hooks'
import { html, useT, useStore, Page, Row, Icon, Chips, Empty, toast, ask, downloadFile, fmtTime } from './ui.js'
import { supabase, friendlyError } from './lib.js'

const LABELS = {
  workers: 'Ishchilar', models: 'Modellar', model_prices: 'Model narxlari', work_entries: 'Bajarilgan ishlar', advances: 'Avanslar',
  debts: 'Qarzlar', salary_payments: 'Maosh to‘lovlari', expenses: 'Xarajatlar', clients: 'Klientlar', orders: 'Buyurtmalar',
  client_payments: 'Klient to‘lovlari', partners: 'Hamkorlar', partner_shares: 'Hamkor ulushlari', partner_payments: 'Hamkor to‘lovlari',
  rent_records: 'Ijara', rent_payments: 'Ijara to‘lovlari', product_costs: 'Tannarx', worker_types: 'Kasblar',
}
const strip = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))))
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

export function BackupPage({ go, membership }) {
  const { t } = useT(); const S = useStore()
  const cid = membership.company_id
  const [list, setList] = useState(null); const [busy, setBusy] = useState(false); const [table, setTable] = useState('expenses')

  const load = () => supabase.from('backup_records').select('id, created_at, size_bytes, note').eq('company_id', cid)
    .order('created_at', { ascending: false }).limit(30).then(({ data, error }) => setList(error ? [] : data || []), () => setList([]))
  useEffect(() => { load() }, [])

  async function create() {
    setBusy(true)
    await S.sync()
    const { error } = await supabase.rpc('make_backup', { p_company: cid })
    setBusy(false)
    if (error) return toast(friendlyError(error.message), 'err')
    toast(t('Zaxira nusxa yaratildi')); load()
  }
  async function getData(id) {
    const { data, error } = await supabase.from('backup_records').select('data').eq('id', id).single()
    if (error) { toast(friendlyError(error.message), 'err'); return null }
    return data.data
  }
  async function download(b) { const d = await getData(b.id); if (d) downloadFile(`zaxira-${b.created_at.slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(d), 'application/json') }
  async function restore(data) {
    if (!(await ask(t('Zaxiradagi yozuvlar qaytariladi va o‘zgartiriladi. Keyin qo‘shilgan yozuvlar o‘chmaydi. Davom etilsinmi?'), { danger: true }))) return
    setBusy(true)
    const { error } = await supabase.rpc('restore_data', { p_company: cid, p_data: data })
    setBusy(false)
    if (error) return toast(friendlyError(error.message), 'err')
    await S.load(); toast(t('Ma‘lumotlar tiklandi'))
  }
  async function restoreFrom(b) { const d = await getData(b.id); if (d) restore(d) }
  async function fromFile(e) {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    try { restore(JSON.parse(await f.text())) } catch (_) { toast(t('Fayl noto‘g‘ri'), 'err') }
  }
  async function excel() {
    try {
      const X = await import('xlsx'); const XL = X.default && X.default.utils ? X.default : X
      const wb = XL.utils.book_new(); const D = S.all()
      Object.keys(LABELS).forEach((k) => { if ((D[k] || []).length) XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet(strip(D[k])), LABELS[k].slice(0, 28).replace(/[\\/?*[\]:]/g, '')) })
      XL.writeFile(wb, `seh-malumot-${stamp()}.xlsx`)
    } catch (_) { toast(t('Excel kutubxonasi yuklanmadi (internet kerak). CSV ni sinab ko‘ring.'), 'err') }
  }
  function csv() {
    const rows = strip(S.get(table)); if (!rows.length) return toast(t('Bu jadvalda ma‘lumot yo‘q'), 'err')
    const cols = Object.keys(rows[0]); const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    downloadFile(`${table}-${stamp()}.csv`, '\ufeff' + [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n'), 'text/csv;charset=utf-8')
  }
  const last = list && list[0]
  const old = last ? (Date.now() - new Date(last.created_at).getTime()) / 86400000 > 7 : false
  return html`<${Page} title=${t('Zaxira nusxa')} sub=${last ? `${t('Oxirgisi')}: ${fmtTime(last.created_at)}` : t('Hali yaratilmagan')} back=${() => go('yana')}>
    ${list && (!last || old) && html`<div class="msg warn" style="margin-bottom:12px">${last ? t('Oxirgi zaxira 7 kundan oldin yaratilgan.') : t('Hali zaxira nusxa yaratilmagan.')}</div>`}
    <button class="btn primary block" disabled=${busy} onClick=${create}><${Icon} name="shield" size=${18} />${busy ? t('Kuting...') : t('Zaxira nusxa yaratish (bulutga)')}</button>
    <h2>${t('Bulutdagi zaxiralar')}</h2>
    ${list === null && html`<p class="muted">${t('Yuklanmoqda...')}</p>`}
    ${list && list.length === 0 && html`<${Empty} icon="shield" text=${t('Zaxira yo‘q yoki internet yo‘q')} />`}
    <div class="list">${(list || []).map((b) => html`<div class="card" style="margin:0;padding:12px 14px">
      <div class="kv"><b>${fmtTime(b.created_at)}</b><span class="pill gray">${b.note}</span></div>
      <div class="muted small">${Math.round(b.size_bytes / 1024)} KB</div>
      <div class="btns"><button class="btn sm" onClick=${() => download(b)}><${Icon} name="download" size=${16} />${t('Yuklab olish')}</button>
        <button class="btn sm danger" disabled=${busy} onClick=${() => restoreFrom(b)}>${t('Tiklash')}</button></div></div>`)}</div>
    <h2>${t('Ma‘lumotlarni telefonga yuklab olish')}</h2>
    <div class="card">
      <button class="btn block" onClick=${excel}><${Icon} name="download" size=${18} />${t('Hammasi — Excel (XLSX)')}</button>
      <${Chips} value=${table} onChange=${setTable} items=${Object.entries(LABELS).map(([k, v]) => [k, t(v)])} />
      <button class="btn block" onClick=${csv}><${Icon} name="download" size=${18} />${t('Tanlangan jadval — CSV')}</button>
    </div>
    <h2>${t('Fayldan tiklash')}</h2>
    <div class="card"><label class="btn block"><${Icon} name="upload" size=${18} />${t('Zaxira faylini tanlash (.json)')}<input type="file" accept=".json,application/json" style="display:none" onChange=${fromFile} /></label></div>
    <p class="muted small">${t('Har kuni avtomatik zaxira uchun 04_avto_zaxira_ixtiyoriy.sql ni ishga tushiring (ixtiyoriy).')}</p>
  <//>`
}
