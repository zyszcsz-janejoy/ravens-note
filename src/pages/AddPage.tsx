import { useState } from 'react'
import { GrammarForm, VocabularyForm } from '../components/forms'
import { PageHeader, Segmented } from '../components/ui'

type Tab = 'vocab' | 'grammar'

export default function AddPage() {
  const [tab, setTab] = useState<Tab>('vocab')

  return (
    <div>
      <PageHeader title="录入" subtitle="把课文里的词汇和语法收进笔记本。" />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'vocab', label: '添加词汇' },
          { value: 'grammar', label: '添加语法' },
        ]}
      />
      <div className="mt-4">{tab === 'vocab' ? <VocabularyForm key="new-vocab" /> : <GrammarForm key="new-grammar" />}</div>
    </div>
  )
}
