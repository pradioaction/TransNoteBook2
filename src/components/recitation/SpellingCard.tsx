import { useCallback, useRef, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { SpellingInput } from './SpellingInput'
import type { QuizQuestion } from '@/recitation/quizTypes'

interface SpellingCardProps {
  question: QuizQuestion
  locked: boolean
  onSolved: (firstTry: boolean) => void
}

const normalize = (s: string) => s.trim().toLowerCase()
/** 目标词仅比对字母部分：空格 / 连字符 / 撇号等特殊字符由控件直接显示，不参与拼写 */
const lettersOnly = (s: string) => s.replace(/[^a-zA-Z]/g, '')

/** 将例句中出现的目标单词替换为等长的 *（大小写不敏感） */
function maskWord(example: string, word: string): string {
  if (!word) return example
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return example.replace(new RegExp(escaped, 'gi'), (m) => '*'.repeat(m.length))
}

/** 拼写题卡片：字母槽位输入 + 音标 / 释义 / 遮蔽例句 */
export function SpellingCard({ question, locked, onSolved }: SpellingCardProps) {
  const { colors } = useTheme()
  const [typed, setTyped] = useState('')
  const [localSolved, setLocalSolved] = useState(false)
  const hadWrong = useRef(false)
  const solvedRef = useRef(false)

  const handleFullLength = useCallback(
    (typedValue: string) => {
      if (solvedRef.current) return
      if (normalize(typedValue) === normalize(lettersOnly(question.word))) {
        solvedRef.current = true
        setLocalSolved(true)
        onSolved(!hadWrong.current)
      } else {
        // 曾拼错：仅记录标记，不锁定、不清空，允许退格继续改
        hadWrong.current = true
      }
    },
    [question.word, onSolved],
  )

  // 未完全拼对时遮蔽例句中的目标单词
  const maskedExample =
    question.example && !locked && !localSolved
      ? maskWord(question.example, question.word)
      : question.example

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        color: colors.foreground,
      }}
    >
      <SpellingInput
        word={question.word}
        value={typed}
        locked={locked}
        onChange={setTyped}
        onFullLength={handleFullLength}
      />

      {question.phonetic && (
        <div style={{ fontSize: 18, color: colors.link }}>{question.phonetic}</div>
      )}

      {question.definition && (
        <div style={{ fontSize: 20, fontWeight: 500, textAlign: 'center' }}>
          {question.definition}
        </div>
      )}

      {maskedExample && (
        <div
          style={{
            fontSize: 14,
            fontStyle: 'italic',
            opacity: 0.7,
            textAlign: 'center',
            maxWidth: 560,
            lineHeight: 1.6,
          }}
        >
          {maskedExample}
        </div>
      )}
    </div>
  )
}
