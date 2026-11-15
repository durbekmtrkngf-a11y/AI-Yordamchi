// =====================================================================
// HISOB-KITOBLAR (sof funksiyalar: ma'lumot kiradi, natija chiqadi).
// Ilovaning barcha pul hisobi shu yerda; testlari: calc.test.mjs
// Qoidalar:
//  - Ish haqi = juftlar soni × SHU SANADAGI narx (valid_from <= ish sanasi bo'lgan eng yangi narx)
//  - Qaytarilgan (returned) ishlar hisobga olinmaydi; tasdiqlanmagan (pending) ishlar hisoblanadi
//  - Qolgan maosh = hisoblangan − berilgan avans − qarz − to'langan maosh (har biri FAQAT BIR MARTA)
//  - Tushum (sotuv), foyda va naqd pul qoldig'i alohida hisoblanadi
// =====================================================================
export const live = (a) => (a || []).filter((r) => !r.deleted_at)
export const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)
export const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to)

/* ---------- sana yordamchilari (YYYY-MM-DD) ---------- */
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const iso = (dt) => dt.toISOString().slice(0, 10)
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
export function addDays(s, n) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
export function addMonths(s, n) {
  const d = parse(s); const day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last)); return iso(d)
}
export const monthStart = (s) => s.slice(0, 8) + '01'
export function weekStart(s) { const d = parse(s); return addDays(s, -((d.getUTCDay() + 6) % 7)) } // dushanba

/* ---------- narx ---------- */
export function priceFor(prices, modelId, typeId, date) {
  let best = null
  for (const p of prices) {
    if (p.deleted_at || p.model_id !== modelId || p.worker_type_id !== typeId || p.valid_from > date) continue
    if (!best || p.valid_from > best.valid_from) best = p
  }
  return best ? Number(best.price) : null
}

/** Barcha (qaytarilmagan) ishlar, narx va summa bilan */
export function pricedEntries(data) {
  const prices = live(data.model_prices)
  const wmap = new Map((data.workers || []).map((w) => [w.id, w]))
  return live(data.work_entries).filter((e) => e.status !== 'returned').map((e) => {
    const w = wmap.get(e.worker_id)
    const price = w ? priceFor(prices, e.model_id, w.worker_type_id, e.work_date) : null
    return { ...e, worker_type_id: w ? w.worker_type_id : null, price, amount: (price || 0) * e.pairs }
  })
}

/* ---------- ishchi hisobi ---------- */
export function workerLedger(data, workerId, from, to, preEntries) {
  const worker = (data.workers || []).find((w) => w.id === workerId)
  if (!worker) return null
  const entries = (preEntries || pricedEntries(data)).filter((e) => e.worker_id === workerId)
  const per = entries.filter((e) => inRange(e.work_date, from, to))
  const advances = sum(live(data.advances).filter((a) => a.worker_id === workerId && a.status === 'paid'), (a) => a.amount)
  const debts = sum(live(data.debts).filter((d) => d.worker_id === workerId), (d) => d.amount)
  const paid = sum(live(data.salary_payments).filter((p) => p.worker_id === workerId), (p) => p.amount)
  const earned = sum(entries, (e) => e.amount)
  return {
    worker, entries,
    periodPairs: sum(per, (e) => e.pairs),
    periodEarned: sum(per, (e) => e.amount),
    totalPairs: sum(entries, (e) => e.pairs),
    earned,
    unverified: sum(entries.filter((e) => e.status === 'pending'), (e) => e.amount),
    advances, debts, paid,
    balance: earned - advances - debts - paid,
    noPrice: entries.filter((e) => e.price === null).length,
  }
}

/* ---------- kosib / zakatofkachi / kroychik / pardozchi hisoboti (hammasi bir xil mexanizm) ---------- */
export function kasbReport(data, typeId, date) {
  const pre = pricedEntries(data)
  const rows = live(data.workers).filter((w) => w.worker_type_id === typeId).map((w) => {
    const day = workerLedger(data, w.id, date, date, pre)
    const all = workerLedger(data, w.id, undefined, undefined, pre)
    return { worker: w, dayPairs: day.periodPairs, dayEarned: day.periodEarned, totalPairs: all.totalPairs, totalEarned: all.earned, balance: all.balance }
  })
  return {
    rows,
    dayPairs: sum(rows, (r) => r.dayPairs), dayEarned: sum(rows, (r) => r.dayEarned),
    totalPairs: sum(rows, (r) => r.totalPairs), totalEarned: sum(rows, (r) => r.totalEarned),
  }
}

/* ---------- tannarx / sotuv narxi ---------- */
export function costFor(data, modelId, date) {
  let best = null
  for (const c of live(data.product_costs)) {
    if (c.model_id !== modelId || c.valid_from > date) continue
    if (!best || c.valid_from > best.valid_from) best = c
  }
  return best
}

/* ---------- bugun sexdan chiqqan tayyor ish ----------
   Tayyor juftlar FAQAT kosiblar ishidan sanaladi (bir juft ikki marta sanalmasin).
   Ish haqi esa shu kuni hamma kasblar bo'yicha hisoblangan summa. */
export function production(data, date) {
  const kosib = live(data.worker_types).find((t) => t.code === 'kosib')
  const all = pricedEntries(data).filter((e) => e.work_date === date)
  const done = kosib ? all.filter((e) => e.worker_type_id === kosib.id) : []
  const byModel = new Map()
  for (const e of done) byModel.set(e.model_id, (byModel.get(e.model_id) || 0) + e.pairs)
  const rows = [...byModel.entries()].map(([modelId, pairs]) => {
    const m = (data.models || []).find((x) => x.id === modelId)
    const c = costFor(data, modelId, date)
    return { modelId, code: m ? m.code : '?', pairs, cost: c ? c.cost_per_pair * pairs : null, sale: c ? c.sale_price_per_pair * pairs : null }
  }).sort((a, b) => a.code.localeCompare(b.code))
  const known = rows.filter((r) => r.cost !== null)
  const cost = sum(known, (r) => r.cost), sale = sum(known, (r) => r.sale)
  return {
    pairs: sum(rows, (r) => r.pairs), rows, wages: sum(all, (e) => e.amount),
    cost, sale, profit: sale - cost, missingCost: rows.length - known.length,
  }
}

/* ---------- klient ---------- */
export function clientBalance(data, clientId) {
  const total = sum(live(data.orders).filter((o) => o.client_id === clientId), (o) => o.pairs * o.price_per_pair)
  const paid = sum(live(data.client_payments).filter((p) => p.client_id === clientId), (p) => p.amount)
  return { total, paid, debt: total - paid }
}

/* ---------- ijara ---------- */
export function rentDue(rec, today) {
  if (rec.start_date > today) return 0
  const end = rec.end_date && rec.end_date < today ? rec.end_date : today
  if (rec.period_type === 'day') return (diffDays(rec.start_date, end) + 1) * Number(rec.rent_amount)
  const a = parse(rec.start_date), b = parse(end)
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (b.getUTCDate() < a.getUTCDate()) months -= 1
  return (months + 1) * Number(rec.rent_amount) // boshlangan oy uchun oldindan to'lov
}
export function rentBalance(data, recId, today) {
  const rec = (data.rent_records || []).find((r) => r.id === recId)
  const paid = sum(live(data.rent_payments).filter((p) => p.rent_id === recId), (p) => p.amount)
  const due = rec ? rentDue(rec, today) : 0
  return { due, paid, remaining: Math.max(0, due - paid), overpaid: Math.max(0, paid - due) }
}
export function nextRentDate(rec, today) {
  if (rec.period_type === 'day') return rec.end_date && rec.end_date < today ? null : today
  let n = 0, d = rec.start_date
  while (d < today && n < 1200) { n += 1; d = addMonths(rec.start_date, n) }
  return rec.end_date && d > rec.end_date ? null : d
}

/* ---------- moliyaviy hisobot ---------- */
export function finance(data, from, to, today) {
  const entries = pricedEntries(data).filter((e) => inRange(e.work_date, from, to))
  const sales = sum(live(data.orders).filter((o) => inRange(o.order_date, from, to)), (o) => o.pairs * o.price_per_pair)
  const clientsPaid = sum(live(data.client_payments).filter((p) => inRange(p.paid_date, from, to)), (p) => p.amount)
  const expenses = sum(live(data.expenses).filter((x) => inRange(x.expense_date, from, to)), (x) => x.amount)
  const salaryAccrued = sum(entries, (e) => e.amount)
  const salaryPaid = sum(live(data.salary_payments).filter((p) => inRange(p.paid_date, from, to)), (p) => p.amount)
  const advancesPaid = sum(live(data.advances).filter((a) => a.status === 'paid' && inRange(a.advance_date, from, to)), (a) => a.amount)
  const dir = new Map((data.rent_records || []).map((r) => [r.id, r.direction]))
  const rentPays = live(data.rent_payments).filter((p) => inRange(p.paid_date, from, to))
  const rentIn = sum(rentPays.filter((p) => dir.get(p.rent_id) === 'give'), (p) => p.amount)
  const rentOut = sum(rentPays.filter((p) => dir.get(p.rent_id) === 'take'), (p) => p.amount)
  const partnerShares = sum(live(data.partner_shares).filter((s) => inRange(s.period_end, from, to)), (s) => s.share_amount)
  const partnerPaid = sum(live(data.partner_payments).filter((p) => inRange(p.paid_date, from, to)), (p) => p.amount)

  // Ishlab chiqarish tannarxi: kosib juftlari × model tannarxi (MA'LUMOT UCHUN; foydadan ayrilmaydi,
  // chunki ish haqi va xarajatlar allaqachon alohida hisoblangan - ikki marta sanalmasin)
  const kosib = live(data.worker_types).find((t) => t.code === 'kosib')
  let productionCost = 0
  for (const e of entries) {
    if (!kosib || e.worker_type_id !== kosib.id) continue
    const c = costFor(data, e.model_id, e.work_date)
    if (c) productionCost += c.cost_per_pair * e.pairs
  }
  const pre = pricedEntries(data)
  const workersRemaining = sum(live(data.workers), (w) => workerLedger(data, w.id, undefined, undefined, pre).balance)
  const clientDebt = sum(live(data.clients), (c) => clientBalance(data, c.id).debt)

  const operatingProfit = sales - expenses - salaryAccrued + rentIn - rentOut
  return {
    sales, clientsPaid, expenses, salaryAccrued, salaryPaid, advancesPaid, rentIn, rentOut,
    partnerShares, partnerPaid, productionCost, workersRemaining, clientDebt,
    operatingProfit,                              // foyda (hamkor ulushigacha)
    profitAfterPartners: operatingProfit - partnerShares,
    cashFlow: clientsPaid + rentIn - expenses - salaryPaid - advancesPaid - partnerPaid - rentOut, // naqd pul harakati
    noPrice: entries.filter((e) => e.price === null).length,
  }
}

/* ---------- hamkor ---------- */
export function partnerShareAmount(partner, base) {
  if (partner.share_type === 'fixed') return Math.round(Number(partner.share_value))
  return base > 0 ? Math.round((base * Number(partner.share_value)) / 100) : 0
}
export function partnerBase(partner, fin, customBase) {
  if (partner.share_base === 'revenue') return fin.sales
  if (partner.share_base === 'custom') return Number(customBase) || 0
  return fin.operatingProfit
}
export function partnerBalance(data, partnerId) {
  const p = (data.partners || []).find((x) => x.id === partnerId)
  const shares = sum(live(data.partner_shares).filter((s) => s.partner_id === partnerId), (s) => s.share_amount)
  const paid = sum(live(data.partner_payments).filter((x) => x.partner_id === partnerId), (x) => x.amount)
  const opening = p ? Number(p.opening_balance) : 0
  return { opening, shares, paid, debt: opening + shares - paid }
}

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
