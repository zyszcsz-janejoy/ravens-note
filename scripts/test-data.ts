import 'fake-indexeddb/auto'
import * as repo from '../src/db/repo'
import { buildTasks, countPlan } from '../src/lib/plan'
import { dueDays, isDue } from '../src/lib/srs'
import type { Snapshot } from '../src/types'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg)
  console.log('PASS  ' + msg)
}

async function main() {
  await repo.clearEverything()

  const lesson = await repo.saveLesson({ title: '第1课', theme: '测试', note: '' })
  const v = await repo.saveVocabulary({
    word: '教科書',
    kana: 'きょうかしょ',
    meaning: '教科书',
    pos: '名词',
    transitivity: '',
    note: '',
  })
  await repo.setItemLessons('vocab', v.id, [lesson.id])
  await repo.replaceExamples('vocab', v.id, [{ ja: '教科書を読みます。', zh: '读教科书。' }])

  const g1 = await repo.saveGrammar({
    name: '〜てしまう',
    connection: '动词て形＋しまう',
    meaning: '表示完成或遗憾',
    usage: '',
    category: '句型',
    pitfalls: '',
    note: '',
  })
  const g2 = await repo.saveGrammar({
    name: '〜ながら',
    connection: '动词ます形＋ながら',
    meaning: '一边…一边…',
    usage: '',
    category: '句型',
    pitfalls: '',
    note: '',
  })
  await repo.replaceExamples('grammar', g1.id, [{ ja: 'ケーキを食べてしまった。', zh: '不小心把蛋糕吃完了。' }])
  await repo.setItemLessons('grammar', g1.id, [lesson.id])

  const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const PIXEL2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
  await repo.saveLessonImage(lesson.id, PIXEL, 'image/png')
  await repo.saveLessonImage(lesson.id, PIXEL2, 'image/png') // 重复上传应替换，不新增

  let snap: Snapshot = await repo.loadSnapshot()
  assert(snap.vocabulary.length === 1 && snap.grammar.length === 2, '词汇和语法写入成功')
  assert(snap.examples.length === 2, '例句写入成功')
  assert(snap.lessonVocabulary.length === 1 && snap.lessonGrammar.length === 1, '课文关联写入成功')
  assert(snap.lessonImages.length === 1, '课文配图写入成功（重复上传只保留一张）')
  assert(snap.lessonImages[0].dataUrl === PIXEL2, '重复上传替换为最新图片')

  const counts = countPlan(snap)
  assert(counts.vocab === 1, '到期词汇计数为 1')
  assert(counts.grammar === 2, '到期语法计数为 2')
  assert(counts.zhJa === 1 && counts.freeWrite === 1, '输出练习计数正确')

  const mixed = buildTasks(snap, 'mixed', 9)
  assert(mixed.length > 0 && mixed.length <= 9, '混合复习任务生成且不超过上限')

  const choice = mixed.find((t) => t.mode === 'choice')
  assert(!!choice?.question, '语法选择题生成成功')
  assert(!!choice?.question?.options.includes(choice.question.answer), '选择题答案存在于选项中')
  assert(choice?.question?.options.length === 2, '只有两条语法时选项数量正确')

  await repo.gradeVocabulary(v.id, 'forgot')
  snap = await repo.loadSnapshot()
  let srs = snap.vocabulary[0].srs
  assert(isDue(srs) && srs.reviews === 1 && srs.stage === 0, '完全忘记：当天稍后再复习')

  await repo.gradeVocabulary(v.id, 'fuzzy')
  snap = await repo.loadSnapshot()
  srs = snap.vocabulary[0].srs
  assert(srs.stage === 1 && dueDays(srs) === 1, '模糊：次日复习')

  await repo.gradeVocabulary(v.id, 'ok')
  snap = await repo.loadSnapshot()
  srs = snap.vocabulary[0].srs
  assert(srs.stage === 2 && dueDays(srs) === 3, '基本掌握：3 天后')

  await repo.gradeVocabulary(v.id, 'mastered')
  snap = await repo.loadSnapshot()
  srs = snap.vocabulary[0].srs
  assert(srs.stage === 3 && dueDays(srs) === 7, '熟练：7 天后')

  await repo.gradeVocabulary(v.id, 'mastered')
  snap = await repo.loadSnapshot()
  srs = snap.vocabulary[0].srs
  assert(srs.stage === 4 && dueDays(srs) === 14, '连续熟练：延长到 14 天')

  await repo.gradeVocabulary(v.id, 'mastered')
  snap = await repo.loadSnapshot()
  srs = snap.vocabulary[0].srs
  assert(srs.stage === 5 && dueDays(srs) === 30, '连续熟练：延长到 30 天')

  await repo.gradeGrammarFacet(g1.id, 'meaning', 'ok')
  snap = await repo.loadSnapshot()
  const gram = snap.grammar.find((g) => g.id === g1.id)!
  assert(gram.facets.meaning.stage === 2, '语法「意思」面向独立记录')
  assert(gram.facets.zhJa.reviews === 0, '其他语法面向不受影响')

  const backup = await repo.buildBackup()
  assert(backup.counts.vocabulary === 1 && backup.counts.grammar === 2, '导出数据计数正确')
  assert(backup.counts.lesson_images === 1, '导出包含课文配图')

  await repo.clearEverything()
  snap = await repo.loadSnapshot()
  assert(snap.vocabulary.length === 0 && snap.grammar.length === 0, '清空数据成功')

  const report = await repo.importBackup(JSON.stringify(backup))
  assert(
    report.added.vocabulary === 1 && report.added.grammar === 2 && report.added.lessons === 1,
    '导入恢复词汇、语法、课文',
  )
  snap = await repo.loadSnapshot()
  assert(snap.vocabulary.length === 1 && snap.grammar.length === 2, '导入后数量正确')
  assert(
    snap.examples.length === 2 && snap.lessonVocabulary.length === 1 && snap.lessonGrammar.length === 1,
    '导入后例句与课文关联正确',
  )
  assert(snap.lessonImages.length === 1 && snap.lessonImages[0].dataUrl === PIXEL2, '导入后课文配图正确')

  const again = await repo.importBackup(JSON.stringify(backup))
  snap = await repo.loadSnapshot()
  assert(again.added.vocabulary === 0 && snap.vocabulary.length === 1, '重复导入不会产生重复数据')
  assert(again.added.lesson_images === 0 && snap.lessonImages.length === 1, '重复导入不会重复配图')

  const savedId = snap.vocabulary[0].id
  await repo.deleteVocabulary(savedId)
  snap = await repo.loadSnapshot()
  assert(
    snap.vocabulary.length === 0 && snap.examples.every((e) => e.ownerType !== 'vocab'),
    '删除词汇时级联清理例句',
  )

  const lessonId = snap.lessons[0].id
  await repo.deleteLesson(lessonId)
  snap = await repo.loadSnapshot()
  assert(
    snap.lessons.length === 0 && snap.lessonImages.length === 0 && snap.lessonVocabulary.length === 0,
    '删除课文时级联清理配图与关联',
  )

  const bad = repo.parseBackup('{"app":"other","data":{}}')
  assert(!bad.ok, '非法备份文件被拒绝')

  console.log('\nALL TESTS PASSED')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
