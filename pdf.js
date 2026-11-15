import { toast, ask, downloadFile } from './ui.js'

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const CSS = `
.pdf{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#fff;width:720px;padding:28px 26px;box-sizing:border-box}
.pdf h1{font-size:22px;margin:0 0 4px;color:#0b2a5b}.pdf .sub{font-size:13px;color:#475569;margin-bottom:14px}
.pdf h2{font-size:15px;margin:18px 0 6px;color:#0b2a5b}
.pdf table{border-collapse:collapse;width:100%;font-size:13px;margin-bottom:6px}
.pdf th,.pdf td{border:1px solid #64748b;padding:6px 8px;text-align:center}
.pdf th{background:#0b2a5b;color:#fff}.pdf td:first-child,.pdf th:first-child{text-align:left}
.pdf tfoot td,.pdf tr.sum td{font-weight:700;background:#eef2f7}
.pdf table.kv td:last-child{text-align:right;font-weight:700}
.pdf .note{font-size:11px;color:#64748b;margin-top:6px}.pdf .foot{margin-top:18px;font-size:11px;color:#94a3b8;text-align:right}`

/** HTML jadval (chiziqli). foot - pastki jami qatorlari */
export const tbl = (head, rows, foot) =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>` +
  (foot && foot.length ? `<tfoot>${foot.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tfoot>` : '') + '</table>'
export const kv = (rows) =>
  `<table class="kv"><tbody>${rows.map(([k, v, strong]) => `<tr${strong ? ' class="sum"' : ''}><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
export const h2 = (s) => `<h2>${esc(s)}</h2>`
export const note = (s) => `<div class="note">${esc(s)}</div>`

/** Canvas balandligini A4 sahifalarga bo'lish (sof hisob, testlanadi) */
export function pageSlices(canvasW, canvasH, pageW, pageH, margin) {
  const scale = (pageW - 2 * margin) / canvasW
  const per = Math.max(1, Math.floor((pageH - 2 * margin) / scale))
  const out = []
  for (let y = 0; y < canvasH; y += per) out.push({ y, h: Math.min(per, canvasH - y) })
  return { scale, slices: out }
}

let busy = false

/** Hisobotni PDF qiladi: so'ng "Yuborish (ulashish)" yoki "Telefonga saqlash" tanlanadi.
    Kutubxonalar (html2canvas, jsPDF) birinchi marta internetdan yuklanadi. */
export async function exportPDF({ title, sub, body, filename, t }) {
  if (busy) return
  busy = true
  toast(t('PDF tayyorlanmoqda...'))
  let wrap
  try {
    let html2canvas, JsPDF
    try {
      const a = await import('html2canvas'); html2canvas = a.default || a
      const b = await import('jspdf'); JsPDF = b.jsPDF || (b.default && (b.default.jsPDF || b.default))
    } catch (_) { toast(t('PDF kutubxonasi yuklanmadi. Internetni tekshiring.'), 'err'); return }
    wrap = document.createElement('div')
    wrap.className = 'pdf'
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;'
    wrap.innerHTML = `<style>${CSS}</style><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div>${body}<div class="foot">Poyabzal Seh · ${new Date().toLocaleDateString('ru-RU')}</div>`
    document.body.appendChild(wrap)
    const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    wrap.remove(); wrap = null
    const doc = new JsPDF({ unit: 'pt', format: 'a4' })
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), m = 24
    const { scale, slices } = pageSlices(canvas.width, canvas.height, pw, ph, m)
    slices.forEach((s, i) => {
      const part = document.createElement('canvas'); part.width = canvas.width; part.height = s.h
      part.getContext('2d').drawImage(canvas, 0, s.y, canvas.width, s.h, 0, 0, canvas.width, s.h)
      if (i > 0) doc.addPage()
      doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, canvas.width * scale, s.h * scale)
    })
    const blob = doc.output('blob')
    const file = new File([blob], filename, { type: 'application/pdf' })
    const choice = await ask(t('PDF tayyor. Nima qilamiz?'), { options: [
      { value: 'share', label: t('Yuborish (ulashish)'), tone: 'primary' },
      { value: 'save', label: t('Telefonga saqlash'), tone: 'navy' }] })
    if (!choice) return
    if (choice === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return } catch (e) { if (e && e.name === 'AbortError') return }
    }
    downloadFile(filename, blob)
    toast(t('PDF saqlandi'))
  } catch (_) {
    toast(t('PDF yaratishda xatolik'), 'err')
  } finally {
    if (wrap) wrap.remove()
    busy = false
  }
}
