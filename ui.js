import { h, createContext } from 'preact'
import { useState, useEffect, useContext } from 'preact/hooks'
import htm from 'htm'
import { toCyr } from './lib.js'
import { store } from './store.js'

export const html = htm.bind(h)

/* ===================== Til (lotin / kirill) ===================== */
const LangCtx = createContext({ lang: 'lat', setLang: () => {}, t: (s) => s })
export const useT = () => useContext(LangCtx)
export function LangProvider({ children }) {
  const [lang, setL] = useState(localStorage.getItem('lang') || 'lat')
  const setLang = (l) => { localStorage.setItem('lang', l); setL(l) }
  const t = (s) => (lang === 'cyr' ? toCyr(String(s)) : s)
  return html`<${LangCtx.Provider} value=${{ lang, setLang, t }}>${children}<//>`
}
export function LangSwitch({ dark }) {
  const { lang, setLang } = useT()
  return html`<button class=${'chip-btn' + (dark ? ' dark' : '')} onClick=${() => setLang(lang === 'lat' ? 'cyr' : 'lat')}>
    ${lang === 'lat' ? 'Ўзбекча' : 'O‘zbekcha'}</button>`
}

/* ===================== Ikonalar (SVG, bir xil uslubda) ===================== */
const P = {
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  shoe: '<path d="M3 17v-3.5c2.5 0 4.5-1 5.5-3.2l1.8.9c1.1 1.1 2.8 2 4.7 2.4 3 .6 6 1.2 6 3.9V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M10.5 9.8l1.4-2M13.5 11.2l1.4-2"/>',
  partner: '<circle cx="8.5" cy="12" r="5.5"/><circle cx="15.5" cy="12" r="5.5"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  sync: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/>',
  cloudoff: '<path d="m2 2 20 20"/><path d="M5.8 5.8A7 7 0 0 0 7 19h10a4.5 4.5 0 0 0 1.9-.4M9.5 4.6A7 7 0 0 1 17.7 9 4.5 4.5 0 0 1 21 13.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9M9.9 5.2A9.1 9.1 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m2 2 20 20"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  factory: '<path d="M2 21V9l7 4V9l7 4V4h4v17z"/><path d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
}
export function Icon({ name, size = 22 }) {
  return html`<svg class="ic" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML=${{ __html: P[name] || '' }}></svg>`
}

/* ===================== Ma'lumot (store) ulanishi ===================== */
export function useStore() {
  const [, setN] = useState(0)
  useEffect(() => store.subscribe(() => setN((n) => n + 1)), [])
  return store
}

/* ===================== Oynalar: tasdiqlash, tanlash, xabarlar ===================== */
const api = { ask: null, toast: null }
export const ask = (message, opts) => (api.ask ? api.ask(message, opts || {}) : Promise.resolve(null))
export const toast = (msg, kind) => { if (api.toast) api.toast(msg, kind || 'ok') }

export function Host() {
  const { t } = useT()
  const [dlg, setDlg] = useState(null)
  const [text, setText] = useState('')
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    api.ask = (message, opts) => new Promise((res) => { setText(''); setDlg({ message, opts, res }) })
    api.toast = (msg, kind) => {
      const id = Math.random()
      setToasts((l) => [...l, { id, msg, kind }])
      setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3400)
    }
  }, [])
  const close = (value) => { const d = dlg; setDlg(null); d.res(d.opts.input && value !== null ? { value, text } : value) }
  const options = dlg ? dlg.opts.options || [{ value: true, label: t('Ha'), tone: dlg.opts.danger ? 'danger' : 'primary' }] : []
  return html`<div>
    ${dlg && html`<div class="overlay center" onClick=${() => close(null)}>
      <div class="dialog" onClick=${(e) => e.stopPropagation()}>
        <div class="dlg-msg">${dlg.message}</div>
        ${dlg.opts.input && html`<input autofocus placeholder=${dlg.opts.input} value=${text} onInput=${(e) => setText(e.target.value)} />`}
        <div class="dlg-btns">
          ${options.map((o) => html`<button class=${'btn ' + (o.tone || '')} onClick=${() => close(o.value)}>${o.label}</button>`)}
          <button class="btn ghost" onClick=${() => close(null)}>${t('Bekor qilish')}</button>
        </div>
      </div></div>`}
    <div class="toasts">${toasts.map((x) => html`<div class=${'toast ' + x.kind}>${x.msg}</div>`)}</div>
  </div>`
}

export function Sheet({ title, onClose, children }) {
  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet-h"><b>${title}</b><button class="icon-btn" onClick=${onClose}><${Icon} name="x" /></button></div>
      <div class="sheet-b">${children}</div>
    </div></div>`
}

/* ===================== Umumiy elementlar ===================== */
export function Page({ title, sub, back, right, hero, children }) {
  return html`<div class="page">
    <header class="hero">
      <div class="hero-row">
        ${back ? html`<button class="icon-btn light" onClick=${() => (typeof back === 'function' ? back() : history.back())}><${Icon} name="back" /></button>` : null}
        <div class="hero-t"><h1>${title}</h1>${sub ? html`<div class="sub">${sub}</div>` : null}</div>
        <div class="hero-r">${right}</div>
      </div>${hero}
    </header>
    <main class="body">${children}</main>
  </div>`
}

export function Stat({ n, label, icon, tone, onClick, wide }) {
  const Tag = onClick ? 'button' : 'div'
  return html`<${Tag} class=${'stat ' + (tone || '') + (wide ? ' wide' : '')} onClick=${onClick}>
    ${icon ? html`<span class="stat-ic"><${Icon} name=${icon} size=${18} /></span>` : null}
    <div class="n">${n}</div><div class="l">${label}</div><//>`
}

export function Row({ icon, title, sub, right, onClick, tone }) {
  const Tag = onClick ? 'button' : 'div'
  return html`<${Tag} class=${'row-item ' + (tone || '')} onClick=${onClick}>
    ${icon ? html`<span class="row-ic"><${Icon} name=${icon} size=${20} /></span>` : null}
    <span class="row-m"><b>${title}</b>${sub ? html`<small>${sub}</small>` : null}</span>
    <span class="row-r">${right}</span>
    ${onClick ? html`<span class="row-chev"><${Icon} name="next" size=${18} /></span>` : null}
  <//>`
}

export function Chips({ items, value, onChange }) {
  return html`<div class="chips">${items.map(([v, label]) =>
    html`<button class=${value === v ? 'on' : ''} onClick=${() => onChange(v)}>${label}</button>`)}</div>`
}

export function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`
}

export function MoneyInput({ value, onChange, placeholder }) {
  const shown = value === '' || value == null ? '' : Number(value).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
  return html`<input inputmode="numeric" placeholder=${placeholder || '0'} value=${shown}
    onInput=${(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d === '' ? '' : Number(d)) }} />`
}

export function Switch({ on, onChange, label }) {
  return html`<button type="button" class=${'switch' + (on ? ' on' : '')} onClick=${() => onChange(!on)}>
    <span class="knob"></span><span class="sw-l">${label}</span></button>`
}

export function Empty({ icon, text }) {
  return html`<div class="empty"><${Icon} name=${icon || 'book'} size=${34} /><p>${text}</p></div>`
}

export function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return html`<div class="pw">
    <input type=${show ? 'text' : 'password'} value=${value} placeholder=${placeholder} onInput=${(e) => onChange(e.target.value)} />
    <button type="button" class="eye" onClick=${() => setShow(!show)}><${Icon} name=${show ? 'eyeoff' : 'eye'} size=${20} /></button>
  </div>`
}

/* ===================== Pastki navigatsiya ===================== */
export function BottomNav({ items, route, go }) {
  const { t } = useT()
  return html`<nav class="nav">
    ${items.map(([id, icon, label]) => html`<button class=${route === id ? 'on' : ''} onClick=${() => go(id)}>
      <span class="nav-ic"><${Icon} name=${icon} size=${21} /></span><small>${t(label)}</small></button>`)}
  </nav>`
}

/* ===================== Sahifalar orasida o'tish: #/nom/arg ===================== */
export function useRoute(defaultRoute) {
  const get = () => (location.hash.startsWith('#/') ? location.hash.slice(2) : defaultRoute)
  const [route, setR] = useState(get())
  useEffect(() => {
    const f = () => { setR(get()); window.scrollTo(0, 0) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return [route, (r) => { location.hash = '/' + r }]
}

/* ===================== Sana va fayl yordamchilari ===================== */
export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}.${m}.${y}` }
export const fmtTime = (iso) => { if (!iso) return '—'; const d = new Date(iso); return `${fmtDate(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
export function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
