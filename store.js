// =====================================================================
// MA'LUMOTLAR QATLAMI: online + offline + sinxronlash
//  - base   : serverdan olingan oxirgi ma'lumot (telefonda IndexedDB'da saqlanadi)
//  - outbox : hali serverga yuborilmagan o'zgarishlar (internet bo'lmasa ham saqlanadi)
//  - view   : base + outbox (ekranda ko'rinadigan, eng yangi holat)
//  Takroriy yozuv bo'lmasligi uchun har yozuvga qurilmada noyob ID beriladi (upsert).
//  Bir yozuv ikki qurilmada o'zgarsa: versiya solishtiriladi va ziddiyat chiqadi.
// =====================================================================
const BOSS_TABLES = [
  'worker_types', 'workers', 'models', 'model_prices', 'work_entries', 'advances', 'debts',
  'salary_payments', 'expenses', 'clients', 'orders', 'client_payments', 'partners',
  'partner_shares', 'partner_payments', 'rent_records', 'rent_payments', 'product_costs', 'duties', 'notifications',
  'app_settings', 'boss_output',
]
const WORKER_TABLES = ['worker_types', 'workers', 'models', 'model_prices', 'work_entries', 'advances', 'debts', 'salary_payments', 'duties', 'notifications', 'app_settings']
const NATURAL = { work_entries: ['worker_id', 'model_id', 'work_date'], app_settings: ['key'], boss_output: ['model_id', 'work_date'] }

/* ---------- IndexedDB (kalit-qiymat). Ishlamasa, xotirada ishlaydi ---------- */
const mem = new Map()
let idb = null
async function openKV() {
  if (idb || typeof indexedDB === 'undefined') return
  try {
    idb = await new Promise((res, rej) => {
      const r = indexedDB.open('seh-erp', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('kv')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  } catch (_) { idb = null }
}
const kv = {
  async get(k) {
    if (!idb) return mem.get(k)
    return new Promise((res) => { const q = idb.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined) })
  },
  async set(k, v) {
    mem.set(k, v)
    if (!idb) return
    return new Promise((res) => { const q = idb.transaction('kv', 'readwrite').objectStore('kv').put(v, k); q.onsuccess = () => res(); q.onerror = () => res() })
  },
}

/* ---------- yordamchilar ---------- */
function uuidv4() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID()
  const b = new Uint8Array(16); crypto.getRandomValues(b)
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}
const isNetErr = (e) => !e || (!e.code && /fetch|network|load failed|timeout|abort/i.test(String(e.message || e)))
const isAuthErr = (e) => e && (e.code === 'PGRST301' || /jwt/i.test(String(e.message || '')))
const errText = (e) => {
  const m = String((e && e.message) || e)
  if (/row-level security|violates row/i.test(m)) return 'Ruxsat yo‘q (tasdiqlangan yozuvni o‘zgartirib bo‘lmaydi)'
  if (/duplicate|23505|unique/i.test(m)) return 'Bunday yozuv allaqachon bor'
  if (/foreign key|23503/i.test(m)) return 'Bog‘liq yozuv topilmadi'
  return m
}
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')))

/* ---------- holat ---------- */
const S = {
  ctx: null, client: null, base: {}, outbox: [], conflicts: [], view: {},
  syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  error: '', lastSync: null, loaded: false, timer: null, flushTimer: null, detach: null, flushing: null,
}
const listeners = new Set()
const emit = () => listeners.forEach((f) => { try { f() } catch (_) {} })
const tablesFor = () => (S.ctx && S.ctx.role === 'boss' ? BOSS_TABLES : WORKER_TABLES)
const key = (n) => `${n}:${S.ctx.userId}:${S.ctx.companyId}`
const pendingOps = () => S.outbox.filter((o) => !o.error)
const persist = () => { if (S.ctx) { kv.set(key('outbox'), S.outbox); kv.set(key('conflicts'), S.conflicts) } }

function rebuild() {
  const v = {}
  for (const t of tablesFor()) v[t] = (S.base[t] || []).map((r) => ({ ...r }))
  for (const op of S.outbox) {
    const arr = v[op.table]; if (!arr) continue
    if (op.type === 'upsert') {
      let i = arr.findIndex((r) => r.id === op.row.id)
      if (i < 0 && NATURAL[op.table]) i = arr.findIndex((r) => NATURAL[op.table].every((k) => r[k] === op.row[k]))
      if (i >= 0) arr[i] = { ...arr[i], ...op.row, id: arr[i].id, _pending: true }
      else arr.push({ ...op.row, _pending: true })
    } else {
      const r = arr.find((x) => x.id === op.id)
      if (r) Object.assign(r, op.fields, { _pending: true })
    }
  }
  S.view = v
}

async function fetchAll(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await S.client.from(table).select('*').eq('company_id', S.ctx.companyId).order('id').range(from, from + 999)
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [] // jadval hali yaratilmagan (SQL 03 ishga tushmagan)
      throw error
    }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

async function load() {
  if (!S.ctx) return
  try {
    const tables = tablesFor()
    const res = await Promise.all(tables.map(fetchAll))
    const next = {}; tables.forEach((t, i) => { next[t] = res[i] })
    S.base = next; S.online = true; S.error = ''; S.lastSync = new Date().toISOString(); S.loaded = true
    await kv.set(key('base'), { data: next, at: S.lastSync })
  } catch (e) {
    if (isNetErr(e)) S.online = false
    else S.error = errText(e)
  }
  rebuild(); emit()
}

function drop(op) { S.outbox = S.outbox.filter((o) => o.opid !== op.opid) }

async function runOp(op) {
  const c = S.client
  const fail = (e) => {
    if (isNetErr(e) || isAuthErr(e)) return 'network'
    op.error = errText(e); return 'error'
  }
  try {
    if (op.type === 'upsert') {
      let row = clean(op.row)
      let r = await c.from(op.table).upsert(row, { onConflict: 'id' })
      if (r.error && r.error.code === '23505' && NATURAL[op.table]) {
        // shu katak boshqa qurilmada allaqachon yaratilgan: o'sha yozuvni topib, yangilaymiz
        let q = c.from(op.table).select('id')
        for (const k of NATURAL[op.table]) q = q.eq(k, row[k])
        const f = await q.maybeSingle()
        if (f.data) { row = { ...row, id: f.data.id }; r = await c.from(op.table).upsert(row, { onConflict: 'id' }) }
      }
      if (r.error) return fail(r.error)
      drop(op); return 'ok'
    }
    let q = c.from(op.table).update(op.fields).eq('id', op.id)
    if (op.base_version != null) q = q.eq('version', op.base_version)
    const r = await q.select('id')
    if (r.error) return fail(r.error)
    if (!r.data || r.data.length === 0) {
      const s = await c.from(op.table).select('*').eq('id', op.id).maybeSingle()
      if (s.error) return fail(s.error)
      drop(op)
      S.conflicts.push({ opid: op.opid, table: op.table, id: op.id, fields: op.fields, server: s.data })
      if (S.ctx.role === 'boss') {
        c.from('sync_queue').insert({ company_id: S.ctx.companyId, table_name: op.table, record_id: op.id, payload: op.fields, status: 'conflict', error_text: 'versiya mos kelmadi' }).then(() => {}, () => {})
      }
      return 'conflict'
    }
    drop(op); return 'ok'
  } catch (e) { return 'network' }
}

function flush() {
  if (S.flushing) return S.flushing
  S.flushing = (async () => {
    if (!S.ctx || pendingOps().length === 0) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { S.online = false; emit(); return }
    S.syncing = true; S.error = ''; emit()
    let progressed = false
    for (const op of pendingOps()) {
      const res = await runOp(op)
      if (res === 'network') { S.online = false; break }
      progressed = true
      persist()
    }
    S.syncing = false
    persist()
    if (progressed) await load(); else { rebuild(); emit() }
  })().finally(() => { S.flushing = null })
  return S.flushing
}

function scheduleFlush() { clearTimeout(S.flushTimer); S.flushTimer = setTimeout(() => flush(), 300) }
async function sync() { if (pendingOps().length) await flush(); else await load() }

function attach() {
  if (typeof window === 'undefined') return
  const onOnline = () => { S.online = true; emit(); sync() }
  const onOffline = () => { S.online = false; emit() }
  const onVis = () => { if (document.visibilityState === 'visible') sync() }
  window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVis)
  S.timer = setInterval(() => { if (document.visibilityState === 'visible') sync() }, 20000)
  S.detach = () => {
    window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVis); clearInterval(S.timer)
  }
}

export const store = {
  subscribe(f) { listeners.add(f); return () => listeners.delete(f) },
  get: (t) => S.view[t] || [],
  all: () => S.view,
  user: () => (S.ctx ? S.ctx.userId : null),
  status() {
    return {
      online: S.online, syncing: S.syncing, loaded: S.loaded, error: S.error, lastSync: S.lastSync,
      pending: pendingOps().length, failed: S.outbox.filter((o) => o.error), conflicts: S.conflicts,
    }
  },
  async init(ctx, client) {
    if (S.ctx && S.ctx.userId === ctx.userId && S.ctx.companyId === ctx.companyId && S.ctx.role === ctx.role) { S.client = client; return }
    store.stop()
    Object.assign(S, { ctx, client, base: {}, outbox: [], conflicts: [], view: {}, loaded: false, error: '' })
    await openKV()
    const cached = await kv.get(key('base'))
    if (cached && cached.data) { S.base = cached.data; S.lastSync = cached.at; S.loaded = true }
    S.outbox = (await kv.get(key('outbox'))) || []
    S.conflicts = (await kv.get(key('conflicts'))) || []
    rebuild(); emit(); attach()
    await sync()
  },
  stop() {
    if (S.detach) S.detach()
    clearTimeout(S.flushTimer)
    Object.assign(S, { ctx: null, detach: null, base: {}, outbox: [], conflicts: [], view: {}, loaded: false })
    emit()
  },
  /** Yangi yozuv yoki mavjudini to'liq saqlash (offline'da ham ishlaydi). ID qaytaradi. */
  save(table, row) {
    const r = clean(row)
    r.company_id = r.company_id || S.ctx.companyId
    if (NATURAL[table]) {
      const ex = (S.view[table] || []).find((x) => NATURAL[table].every((k) => x[k] === r[k]))
      if (ex) r.id = ex.id
    }
    r.id = r.id || uuidv4()
    const pend = S.outbox.find((o) => o.type === 'upsert' && o.table === table && o.row.id === r.id && !o.error)
    if (pend) pend.row = { ...pend.row, ...r }
    else S.outbox.push({ opid: uuidv4(), table, type: 'upsert', row: r, ts: Date.now() })
    persist(); rebuild(); emit(); scheduleFlush()
    return r.id
  },
  /** Mavjud yozuvning ayrim maydonlarini o'zgartirish / arxivlash (deleted_at) */
  patch(table, id, fields) {
    const pend = S.outbox.find((o) => o.type === 'upsert' && o.table === table && o.row.id === id)
    const upd = S.outbox.find((o) => o.type === 'update' && o.table === table && o.id === id && !o.error)
    if (pend) pend.row = { ...pend.row, ...fields }
    else if (upd) upd.fields = { ...upd.fields, ...fields }
    else {
      const cur = (S.base[table] || []).find((r) => r.id === id)
      S.outbox.push({ opid: uuidv4(), table, type: 'update', id, fields, base_version: cur ? cur.version : null, ts: Date.now() })
    }
    persist(); rebuild(); emit(); scheduleFlush()
  },
  archive(table, id) { store.patch(table, id, { deleted_at: new Date().toISOString() }) },
  restore(table, id) { store.patch(table, id, { deleted_at: null }) },
  sync, load,
  resolveConflict(opid, choice) {
    const i = S.conflicts.findIndex((c) => c.opid === opid); if (i < 0) return
    const c = S.conflicts.splice(i, 1)[0]
    if (choice === 'mine') {
      S.outbox.push({ opid: uuidv4(), table: c.table, type: 'update', id: c.id, fields: c.fields, base_version: c.server ? c.server.version : null, ts: Date.now() })
    }
    persist(); rebuild(); emit(); sync()
  },
  discard(opid) { S.outbox = S.outbox.filter((o) => o.opid !== opid); persist(); rebuild(); emit() },
  retryFailed() { S.outbox.forEach((o) => { delete o.error }); persist(); emit(); return flush() },
  uuid: uuidv4,
}
