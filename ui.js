import { h, createContext } from 'preact'
import { useState, useEffect, useContext } from 'preact/hooks'
import htm from 'htm'
import { toCyr } from './lib.js'

export const html = htm.bind(h)

/* ---------- Til (lotin / kirill) ---------- */
const LangCtx = createContext({ lang: 'lat', setLang: () => {}, t: (s) => s })
export const useT = () => useContext(LangCtx)

export function LangProvider({ children }) {
  const [lang, setL] = useState(localStorage.getItem('lang') || 'lat')
  const setLang = (l) => { localStorage.setItem('lang', l); setL(l) }
  const t = (s) => (lang === 'cyr' ? toCyr(s) : s)
  return html`<${LangCtx.Provider} value=${{ lang, setLang, t }}>${children}<//>`
}

export function LangSwitch() {
  const { lang, setLang } = useT()
  return html`<button class="lang" onClick=${() => setLang(lang === 'lat' ? 'cyr' : 'lat')}>
    ${lang === 'lat' ? 'Ўзбекча' : 'O‘zbekcha'}
  </button>`
}

/* ---------- Parol maydoni (ko'z belgisi) ---------- */
export function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return html`<div class="pw">
    <input type=${show ? 'text' : 'password'} value=${value} placeholder=${placeholder}
      onInput=${(e) => onChange(e.target.value)} />
    <button type="button" class="eye" onClick=${() => setShow(!show)}>${show ? '🙈' : '👁'}</button>
  </div>`
}

/* ---------- Sahifalar orasida o'tish (#/nom). Orqaga tugmasi ishlaydi ---------- */
export function useRoute(defaultRoute) {
  const get = () => (location.hash.startsWith('#/') ? location.hash.slice(2) : defaultRoute)
  const [route, setR] = useState(get())
  useEffect(() => {
    const f = () => setR(get())
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return [route, (r) => { location.hash = '/' + r }]
}

/* ---------- Pastki navigatsiya paneli (ko'p bo'lim bo'lsa yon tomonga suriladi) ---------- */
export function BottomNav({ items, route, go }) {
  const { t } = useT()
  return html`<nav class="nav">
    ${items.map(([id, icon, label]) => html`<button class=${route === id ? 'on' : ''} onClick=${() => go(id)}>
      <span class="ic">${icon}</span><small>${t(label)}</small>
    </button>`)}
  </nav>`
}

/* ---------- Hali yozilmagan bo'lim (aniq bosqich ko'rsatiladi) ---------- */
export function Soon({ title, stage, text }) {
  const { t } = useT()
  return html`<div>
    <h1 class="brand">${t(title)}</h1>
    <div class="card">
      <b>${t(stage + '-bosqichda qo‘shiladi')}</b>
      <p class="muted">${t(text)}</p>
    </div>
  </div>`
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '')
