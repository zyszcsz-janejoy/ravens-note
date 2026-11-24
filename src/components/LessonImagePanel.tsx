import { useRef, useState } from 'react'
import { Button, ConfirmSheet, SectionTitle } from './ui'
import * as repo from '../db/repo'
import { useData } from '../store/AppData'

const MAX_BYTES = 4 * 1024 * 1024 // 4 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

export default function LessonImagePanel({ lessonId }: { lessonId: string }) {
  const { lessonImages, refresh, notify } = useData()
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const image = lessonImages.find((i) => i.lessonId === lessonId)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('请选择图片文件', 'error')
      return
    }
    if (file.size > MAX_BYTES) {
      notify('图片过大，请选择 4MB 以内的图片', 'error')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await repo.saveLessonImage(lessonId, dataUrl, file.type)
      await refresh()
      notify('二维码已保存')
    } catch (err) {
      console.error(err)
      notify('保存失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    await repo.deleteLessonImage(lessonId)
    await refresh()
    setConfirmRemove(false)
    notify('已删除二维码')
  }

  return (
    <div>
      <SectionTitle>听力二维码</SectionTitle>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPick(e)}
      />

      {image ? (
        <div className="rounded-xl2 border border-line bg-card p-3">
          <div className="overflow-hidden rounded-xl bg-paper">
            <img
              src={image.dataUrl}
              alt="课文听力二维码"
              className="mx-auto block max-h-[320px] w-auto select-none object-contain"
              draggable={false}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-sub">长按图片即可识别二维码，扫码听听力</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button variant="soft" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? '保存中…' : '更换'}
            </Button>
            <Button variant="danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
              删除
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl2 border border-dashed border-line bg-card/60 p-5 text-center">
          <p className="text-[13px] text-sub">还没有上传二维码</p>
          <p className="mt-1 text-[11px] text-sub/80">支持 JPG / PNG 等图片，建议 4MB 以内</p>
          <Button className="mt-3 w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? '保存中…' : '上传二维码图片'}
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={confirmRemove}
        title="删除这张二维码？"
        desc="删除后无法恢复，需要重新上传。"
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
