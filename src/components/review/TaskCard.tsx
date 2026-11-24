import { useMemo, useRef, useState } from 'react'
import type { ErrorType, Example, Grade, ReviewTask } from '../../types'
import { ERROR_LABEL, GRADE_HINT, GRADE_LABEL } from '../../lib/srs'
import { useData } from '../../store/AppData'
import { Button, Card, Chip, TextArea } from '../ui'

export interface TaskSubmit {
  grade: Grade
  correct?: boolean
  errorType?: ErrorType
  userAnswer?: string
  durationMs: number
}

const GRADES: Grade[] = ['forgot', 'fuzzy', 'ok', 'mastered']

const GRADE_BUTTON: Record<Grade, string> = {
  forgot: 'border-clay/40 bg-clay-soft text-clay',
  fuzzy: 'border-[#E3D3A8] bg-[#F6EFDF] text-[#8C6E34]',
  ok: 'border-sky/30 bg-sky-soft text-sky',
  mastered: 'border-pine/30 bg-pine-soft text-pine',
}

const ERROR_OPTIONS: ErrorType[] = ['meaning', 'connection', 'recall', 'confusion', 'expression']

function GradePicker({ value, onChange }: { value: Grade | null; onChange: (g: Grade) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GRADES.map((grade) => (
        <button
          key={grade}
          type="button"
          onClick={() => onChange(grade)}
          className={`rounded-xl2 border px-3.5 py-2.5 text-left transition ${
            value === grade ? GRADE_BUTTON[grade] : 'border-line bg-card text-ink active:bg-line/20'
          }`}
        >
          <span className="block text-[14px] font-medium">{GRADE_LABEL[grade]}</span>
          <span className="mt-0.5 block text-[11px] text-sub">{GRADE_HINT[grade]}</span>
        </button>
      ))}
    </div>
  )
}

function ErrorPicker({ value, onChange }: { value: ErrorType; onChange: (v: ErrorType) => void }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[12px] text-sub">记一下错在哪里</p>
      <div className="flex flex-wrap gap-2">
        {ERROR_OPTIONS.map((type) => (
          <Chip key={type} active={value === type} onClick={() => onChange(type)}>
            {ERROR_LABEL[type]}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function DeletedNotice({ onSkip }: { onSkip?: () => void }) {
  return (
    <Card className="p-5 text-center">
      <p className="text-[14px] text-sub">这条内容已被删除。</p>
      {onSkip && (
        <Button variant="soft" className="mt-3" onClick={onSkip}>
          跳过这一题
        </Button>
      )}
    </Card>
  )
}

function ExampleList({ list, limit = 3 }: { list: Example[]; limit?: number }) {
  return (
    <div className="space-y-2">
      {list.slice(0, limit).map((ex) => (
        <Card key={ex.id} className="p-3.5">
          <p lang="ja" className="text-[14px] leading-relaxed">
            {ex.ja}
          </p>
          {ex.zh && <p className="mt-1 text-[12px] text-sub">{ex.zh}</p>}
        </Card>
      ))}
    </div>
  )
}

/* ---------------- 词汇复习 ---------------- */

function VocabTask({
  task,
  examples,
  onSubmit,
  onSkip,
}: {
  task: ReviewTask
  examples: Example[]
  onSubmit: (result: TaskSubmit) => void
  onSkip?: () => void
}) {
  const startedAt = useRef(Date.now())
  const { vocabulary } = useData()
  const vocab = vocabulary.find((v) => v.id === task.itemId)
  const [showKana, setShowKana] = useState(false)
  const [showMeaning, setShowMeaning] = useState(false)
  const [showExample, setShowExample] = useState(false)

  if (!vocab) return <DeletedNotice onSkip={onSkip} />

  return (
    <div>
      <Card className="p-5">
        <p className="text-[11px] tracking-wide text-sub">词汇</p>
        <p lang="ja" className="mt-1.5 text-[30px] font-medium leading-snug">
          {vocab.word}
        </p>
        {showKana && (
          <p lang="ja" className="mt-1.5 text-[15px] text-sub">
            {vocab.kana || '（未填写假名）'}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip active={showKana} onClick={() => setShowKana((v) => !v)}>
            {showKana ? '隐藏假名' : '显示假名'}
          </Chip>
          <Chip active={showMeaning} onClick={() => setShowMeaning((v) => !v)}>
            {showMeaning ? '隐藏意思' : '显示意思'}
          </Chip>
          {examples.length > 0 && (
            <Chip active={showExample} onClick={() => setShowExample((v) => !v)}>
              {showExample ? '隐藏例句' : '看例句'}
            </Chip>
          )}
        </div>

        {showMeaning && (
          <div className="mt-4 rounded-xl2 bg-paper p-4">
            <p className="text-[17px] leading-relaxed">{vocab.meaning}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-sub">
              {vocab.pos && <span className="rounded-full bg-card px-2 py-0.5">{vocab.pos}</span>}
              {vocab.transitivity && (
                <span className="rounded-full bg-card px-2 py-0.5">{vocab.transitivity}</span>
              )}
            </div>
            {vocab.note && <p className="mt-2.5 text-[12px] leading-relaxed text-sub">{vocab.note}</p>}
          </div>
        )}

        {showExample && examples.length > 0 && (
          <div className="mt-3">
            <ExampleList list={examples} />
          </div>
        )}
      </Card>

      <div className="mt-4">
        <p className="mb-2 text-[12px] text-sub">这次记得怎么样？</p>
        <div className="grid grid-cols-2 gap-2">
          {GRADES.map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => onSubmit({ grade, durationMs: Date.now() - startedAt.current })}
              className={`min-h-[58px] rounded-xl2 border px-3.5 py-2.5 text-left transition active:scale-[0.99] ${GRADE_BUTTON[grade]}`}
            >
              <span className="block text-[14px] font-medium">{GRADE_LABEL[grade]}</span>
              <span className="mt-0.5 block text-[11px] opacity-70">{GRADE_HINT[grade]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------------- 语法选择题 ---------------- */

function ChoiceTask({
  task,
  onSubmit,
}: {
  task: ReviewTask
  onSubmit: (result: TaskSubmit) => void
}) {
  const startedAt = useRef(Date.now())
  const { grammar } = useData()
  const question = task.question
  const [picked, setPicked] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ErrorType>(
    question?.kind === 'connection' ? 'connection' : 'confusion',
  )

  if (!question) return <DeletedNotice />

  const grammarItem = grammar.find((g) => g.id === task.itemId)
  const answered = picked !== null
  const correct = picked === question.answer

  return (
    <div>
      <Card className="p-5">
        <p className="text-[11px] tracking-wide text-sub">语法选择题</p>
        <p lang="ja" className="mt-2 text-[19px] font-medium leading-snug">
          {question.prompt}
        </p>
        {grammarItem && (
          <p className="mt-2 text-[12px] text-sub">分类：{grammarItem.category || '未分类'}</p>
        )}

        <div className="mt-4 space-y-2">
          {question.options.map((option, index) => {
            const isAnswer = option === question.answer
            const isPicked = option === picked
            let stateClass = 'border-line bg-card text-ink'
            if (answered && isAnswer) stateClass = 'border-pine/40 bg-pine-soft text-pine'
            else if (answered && isPicked && !isAnswer) stateClass = 'border-clay/40 bg-clay-soft text-clay'
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                disabled={answered}
                onClick={() => setPicked(option)}
                className={`flex w-full items-start gap-3 rounded-xl2 border px-3.5 py-3 text-left text-[14px] leading-relaxed transition ${stateClass}`}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0">{option}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {answered && (
        <>
          <Card
            className={`mt-3 p-4 ${correct ? 'border-pine/20 bg-pine-soft/40' : 'border-clay/20 bg-clay-soft/40'}`}
          >
            <p className={`text-[13px] font-medium ${correct ? 'text-pine' : 'text-clay'}`}>
              {correct ? '答对了' : `正确答案：${question.answer}`}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-sub">
              {question.explanation}
            </p>
          </Card>

          {!correct && <ErrorPicker value={errorType} onChange={setErrorType} />}

          <p className="mt-3 text-[11px] leading-relaxed text-sub">
            选择题答对只记录为「基本掌握」，不会直接把语法判定为熟练。
          </p>

          <Button
            className="mt-3 w-full"
            onClick={() =>
              onSubmit({
                grade: correct ? 'ok' : 'forgot',
                correct,
                errorType: correct ? undefined : errorType,
                durationMs: Date.now() - startedAt.current,
              })
            }
          >
            下一题
          </Button>
        </>
      )}
    </div>
  )
}

/* ---------------- 中译日 / 自由造句 ---------------- */

function OutputTask({
  task,
  examples,
  onSubmit,
  onSkip,
}: {
  task: ReviewTask
  examples: Example[]
  onSubmit: (result: TaskSubmit) => void
  onSkip?: () => void
}) {
  const startedAt = useRef(Date.now())
  const { grammar } = useData()
  const isTranslate = task.mode === 'zhJa'
  const grammarItem = grammar.find((g) => g.id === task.itemId)
  const [text, setText] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [errorType, setErrorType] = useState<ErrorType>(isTranslate ? 'recall' : 'expression')

  if (!isTranslate && !grammarItem) return <DeletedNotice onSkip={onSkip} />

  const needsError = grade === 'forgot' || grade === 'fuzzy'

  return (
    <div>
      <Card className="p-5">
        <p className="text-[11px] tracking-wide text-sub">{isTranslate ? '中文翻日语' : '自由造句'}</p>
        {isTranslate ? (
          <>
            <p className="mt-2 text-[19px] leading-relaxed">{task.prompt}</p>
            <p className="mt-3 text-[11px] text-sub">提示：来自语法「{grammarItem?.name ?? '例句'}」</p>
          </>
        ) : (
          <>
            <p lang="ja" className="mt-2 text-[24px] font-medium leading-snug">
              {grammarItem?.name}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed">{grammarItem?.meaning}</p>
            {grammarItem?.connection && (
              <p className="mt-2 text-[12px] text-sub">接续：{grammarItem.connection}</p>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-sub">用这个语法写一句自己的日语。</p>
          </>
        )}
      </Card>

      <div className="mt-3">
        <TextArea
          lang="ja"
          placeholder={isTranslate ? '在这里写下你的日语翻译…' : '在这里写下你造的句子…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[110px]"
        />
      </div>

      {!revealed ? (
        <Button variant="soft" className="mt-3 w-full" onClick={() => setRevealed(true)}>
          {isTranslate ? '查看参考答案' : '查看参考例句'}
        </Button>
      ) : (
        <>
          {isTranslate && task.answer && (
            <Card className="mt-3 p-4">
              <p className="text-[11px] text-sub">参考答案</p>
              <p lang="ja" className="mt-1 text-[16px] leading-relaxed">
                {task.answer}
              </p>
            </Card>
          )}

          {examples.length > 0 && (
            <div className="mt-3">
              <ExampleList list={examples} />
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-[12px] text-sub">
              {isTranslate ? '对照参考答案，评价这次翻译' : '对照参考例句，评价这次造句'}
            </p>
            <GradePicker value={grade} onChange={setGrade} />
            {needsError && <ErrorPicker value={errorType} onChange={setErrorType} />}
            <Button
              className="mt-3 w-full"
              disabled={!grade}
              onClick={() =>
                grade &&
                onSubmit({
                  grade,
                  userAnswer: text,
                  errorType: needsError ? errorType : undefined,
                  durationMs: Date.now() - startedAt.current,
                })
              }
            >
              提交并继续
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function TaskCard({
  task,
  onSubmit,
  onSkip,
}: {
  task: ReviewTask
  onSubmit: (result: TaskSubmit) => void
  onSkip?: () => void
}) {
  const { examples } = useData()
  const taskExamples = useMemo(
    () =>
      examples
        .filter((e) => e.ownerType === task.itemType && e.ownerId === task.itemId)
        .sort((a, b) => a.order - b.order),
    [examples, task.itemId, task.itemType],
  )

  if (task.mode === 'vocab') {
    return <VocabTask task={task} examples={taskExamples} onSubmit={onSubmit} onSkip={onSkip} />
  }
  if (task.mode === 'choice') {
    return <ChoiceTask task={task} onSubmit={onSubmit} />
  }
  return <OutputTask task={task} examples={taskExamples} onSubmit={onSubmit} onSkip={onSkip} />
}
