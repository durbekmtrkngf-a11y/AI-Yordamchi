import { useState, useEffect } from 'preact/hooks'
import { html, useT, Icon } from './ui.js'
import { supabase } from './lib.js'

/** Rasmni kichraytirish (kichik: ro'yxat uchun, katta: kattalashtirib ko'rish uchun) */
export function resizeImage(file, max, q) {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onerror = rej
    fr.onload = () => {
      const im = new Image(); im.onerror = rej
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas')
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k)
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q))
      }
      im.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

const DEF = { x: -6, y: 16 }
/** Model rasmini katta va 3D (barmoq bilan aylantiriladigan) ko'rinishda ochish */
export function PhotoView({ m, onClose }) {
  const { t } = useT()
  const [big, setBig] = useState(m.big || null)
  const [r, setR] = useState(DEF)
  const [st, setSt] = useState(null)
  const [spin, setSpin] = useState(false)
  useEffect(() => {
    if (m.big || !m.id) return
    let ok = true
    supabase.from('model_photos').select('big').eq('model_id', m.id).maybeSingle().then(({ data }) => { if (ok && data && data.big) setBig(data.big) }, () => {})
    return () => { ok = false }
  }, [m.id])
  useEffect(() => {
    if (!spin) return
    const iv = setInterval(() => setR((p) => ({ ...p, y: p.y + 2.5 })), 30)
    return () => clearInterval(iv)
  }, [spin])
  const down = (e) => { setSpin(false); e.currentTarget.setPointerCapture(e.pointerId); setSt({ x: e.clientX, y: e.clientY, rx: r.x, ry: r.y }) }
  const move = (e) => { if (!st) return; setR({ x: Math.max(-70, Math.min(70, st.rx - (e.clientY - st.y) * 0.4)), y: st.ry + (e.clientX - st.x) * 0.5 }) }
  const up = () => setSt(null)
  const label = m.name ? `${m.name} · ${m.code}` : m.code
  return html`<div class="overlay center pv" onClick=${onClose}>
    <div class="pv-box" onClick=${(e) => e.stopPropagation()}>
      <div class="pv-h"><b>${label}</b><button class="icon-btn" onClick=${onClose}><${Icon} name="x" /></button></div>
      <div class="pv-stage" onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        <div class="pv-card" style=${`transform: rotateX(${r.x}deg) rotateY(${r.y}deg)`}>
          <img src=${big || m.photo} alt="" draggable="false" />
        </div>
      </div>
      <div class="muted small" style="text-align:center">${t('Barmoq bilan suring: rasm 3D aylanadi')}</div>
      <div class="btns" style="margin-top:10px">
        <button class="btn sm" onClick=${() => setSpin(!spin)}>${spin ? t('To‘xtatish') : t('Aylantirish')}</button>
        <button class="btn sm ghost" onClick=${() => { setSpin(false); setR(DEF) }}>${t('Boshiga qaytarish')}</button>
      </div>
    </div></div>`
}
