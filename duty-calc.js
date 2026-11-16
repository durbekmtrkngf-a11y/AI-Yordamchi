import { addDays } from './calc.js'

/* ===================== Navbatchi: aylanma tartib (sof hisob-kitob, testlanadi) =====================
   roster  - navbat tartibidagi ishchi ID lari (faol ishchilar)
   duties  - saqlangan navbatlar: { id, worker_id, duty_date, status: planned | done | absent }
   Qoida: bugungi navbatchidan keyingi kunlar tartib bo'yicha keyingi ishchiga beriladi.
   "Kelmadi" bosilsa o'sha kun uchun keyingi ishchi navbatchi bo'ladi va keyingi kunlar undan davom etadi. */

const live = (a) => (a || []).filter((r) => !r.deleted_at)

/** Tartibda workerId dan keyingi ishchi (aylanib o'tadi). exclude dagilar o'tkazib yuboriladi. */
export function cycleNext(roster, workerId, exclude = []) {
  if (!roster.length) return null
  const i = roster.indexOf(workerId)               // -1 bo'lsa boshidan boshlanadi
  for (let k = 1; k <= roster.length; k++) {
    const id = roster[(i + k + roster.length) % roster.length]
    if (!exclude.includes(id)) return id
  }
  return null
}

/** Jadvalni yangilash rejasi: nimani yaratish, arxivlash va o'zgartirish kerak */
export function ensurePlan({ roster, duties, today, horizon = 21 }) {
  const out = { create: [], archive: [], patch: [], needsStart: false }
  if (!roster.length) return out
  const rows = live(duties).filter((d) => d.status !== 'absent')
    .sort((a, b) => (a.duty_date < b.duty_date ? -1 : a.duty_date > b.duty_date ? 1 : 0))
  if (!rows.length) { out.needsStart = true; return out }
  // o'tib ketgan kunlardagi "planned" -> "done"
  rows.filter((d) => d.duty_date < today && d.status === 'planned').forEach((d) => out.patch.push({ id: d.id, fields: { status: 'done' } }))
  const fixed = rows.filter((d) => d.duty_date <= today)
  const base = fixed.length ? fixed[fixed.length - 1] : rows[0]
  const toDate = addDays(today, horizon - 1)
  let prev = base.worker_id
  for (let d = addDays(base.duty_date, 1); d <= toDate; d = addDays(d, 1)) {
    const w = cycleNext(roster, prev)
    if (!w) break
    prev = w
    const ex = rows.filter((r) => r.duty_date === d)
    if (d <= today) {
      if (!ex.length) out.create.push({ worker_id: w, duty_date: d, status: d < today ? 'done' : 'planned', note: '' })
      continue
    }
    if (ex.some((r) => r.worker_id === w)) { ex.filter((r) => r.worker_id !== w).forEach((r) => out.archive.push(r.id)); continue }
    ex.forEach((r) => out.archive.push(r.id))
    out.create.push({ worker_id: w, duty_date: d, status: 'planned', note: '' })
  }
  return out
}

/** "Kelmadi": o'rniga kim navbatchi bo'ladi (o'sha kuni allaqachon yozilganlar o'tkazib yuboriladi) */
export function absentReplacement({ roster, duties, duty }) {
  const sameDay = live(duties).filter((d) => d.duty_date === duty.duty_date).map((d) => d.worker_id)
  return cycleNext(roster, duty.worker_id, sameDay)
}

/** Tartibni 0..n-1 qilib qayta raqamlash (ko'tarish/tushirish uchun) */
export function moveInRoster(rows, id, dir) {
  const a = [...rows]
  const i = a.findIndex((r) => r.id === id), j = i + dir
  if (i < 0 || j < 0 || j >= a.length) return []
  ;[a[i], a[j]] = [a[j], a[i]]
  return a.map((r, k) => ({ id: r.id, position: k })).filter((x, k) => rows[k].id !== x.id || rows[k].position !== x.position)
}
