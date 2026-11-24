const DB_NAME = 'ravens-note'
const DB_VERSION = 1

export const STORES = [
  'lessons',
  'vocabulary',
  'grammar',
  'examples',
  'lesson_vocabulary',
  'lesson_grammar',
  'review_records',
  'mistakes',
  'study_sessions',
] as const

export type StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        const create = (name: string, indexes: string[] = []) => {
          if (db.objectStoreNames.contains(name)) return
          const store = db.createObjectStore(name, { keyPath: 'id' })
          for (const idx of indexes) store.createIndex(idx, idx, { unique: false })
        }
        create('lessons')
        create('vocabulary', ['word'])
        create('grammar', ['name'])
        create('examples', ['ownerId'])
        create('lesson_vocabulary', ['lessonId', 'vocabularyId'])
        create('lesson_grammar', ['lessonId', 'grammarId'])
        create('review_records', ['createdAt', 'itemId'])
        create('mistakes', ['createdAt', 'itemId'])
        create('study_sessions', ['updatedAt'])
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('无法打开本地数据库'))
    })
  }
  return dbPromise
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('数据库操作失败'))
  })
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open()
  return wrap(db.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>)
}

export async function getOne<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open()
  return wrap(db.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>)
}

export async function putOne<T>(store: StoreName, value: T): Promise<void> {
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  tx.objectStore(store).put(value as unknown as never)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('保存失败'))
    tx.onabort = () => reject(tx.error ?? new Error('保存失败'))
  })
}

export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  for (const v of values) tx.objectStore(store).put(v as unknown as never)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('保存失败'))
    tx.onabort = () => reject(tx.error ?? new Error('保存失败'))
  })
}

export async function remove(store: StoreName, key: string): Promise<void> {
  await removeMany(store, [key])
}

export async function removeMany(store: StoreName, keys: string[]): Promise<void> {
  if (!keys.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  for (const key of keys) tx.objectStore(store).delete(key)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('删除失败'))
    tx.onabort = () => reject(tx.error ?? new Error('删除失败'))
  })
}

export async function clearAllData(): Promise<void> {
  const db = await open()
  const tx = db.transaction([...STORES], 'readwrite')
  for (const store of STORES) tx.objectStore(store).clear()
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('清空失败'))
    tx.onabort = () => reject(tx.error ?? new Error('清空失败'))
  })
}
