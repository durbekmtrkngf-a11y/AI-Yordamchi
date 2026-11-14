import { createClient } from '@supabase/supabase-js'
import { CONFIG } from './config.js'

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Login "ali01" -> "ali01@seh.app". Email yozilsa o'zgarmaydi. */
export function toEmail(login) {
  const l = login.trim().toLowerCase()
  return l.includes('@') ? l : `${l}@${CONFIG.LOGIN_DOMAIN}`
}

/** Supabase xatolarini tushunarli o'zbekchaga o'giradi */
export function friendlyError(msg) {
  const m = String(msg).toLowerCase()
  if (m.includes('invalid login')) return 'Login yoki parol noto‘g‘ri'
  if (m.includes('already registered')) return 'Bu login band. Boshqa login tanlang'
  if (m.includes('password should be')) return 'Parol kamida 6 belgidan iborat bo‘lsin'
  if (m.includes('invalid') && m.includes('email')) return 'Login noto‘g‘ri formatda (faqat lotin harf va raqam)'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Internet yo‘q yoki server javob bermayapti'
  if (m.includes('taklif kodi')) return 'Taklif kodi noto‘g‘ri'
  return String(msg)
}

/** Lotin -> kirill (o'zbek). Faqat dastur matnlari uchun. */
export function toCyr(src) {
  const AP = "'‘’ʻʼ`"
  const map = {
    a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
    n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з',
  }
  const isLetter = (c) => /[a-z]/i.test(c) || AP.includes(c)
  let out = ''
  for (let i = 0; i < src.length; ) {
    const ch = src[i]
    const low = ch.toLowerCase()
    const next = (src[i + 1] ?? '').toLowerCase()
    const upper = ch !== low
    const put = (cyr, len) => {
      out += upper ? cyr.charAt(0).toUpperCase() + cyr.slice(1) : cyr
      i += len
    }
    const wordStart = i === 0 || !isLetter(src[i - 1])
    if (!/[a-z]/i.test(ch)) { out += ch; i++; continue }
    if (low === 'o' && AP.includes(src[i + 1] ?? '')) { put('ў', 2); continue }
    if (low === 'g' && AP.includes(src[i + 1] ?? '')) { put('ғ', 2); continue }
    if (low === 's' && next === 'h') { put('ш', 2); continue }
    if (low === 'c' && next === 'h') { put('ч', 2); continue }
    if (wordStart && low === 'y' && next === 'o') { put('ё', 2); continue }
    if (wordStart && low === 'y' && next === 'u') { put('ю', 2); continue }
    if (wordStart && low === 'y' && next === 'a') { put('я', 2); continue }
    if (low === 'e') { put(wordStart ? 'э' : 'е', 1); continue }
    if (map[low]) { put(map[low], 1); continue }
    put(ch, 1)
  }
  return out.replace(/['‘’ʻʼ`]/g, 'ъ')
}
