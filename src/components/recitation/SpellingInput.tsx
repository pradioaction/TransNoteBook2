import { useEffect, useMemo, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface SpellingInputProps {
  word: string
  value: string
  locked: boolean
  onChange(next: string): void
  onFullLength(typed: string): void
}

const isLetter = (ch: string) => /[a-zA-Z]/.test(ch)
const lettersOnly = (raw: string) => raw.replace(/[^a-zA-Z]/g, '')

/**
 * 拼写输入控件：把目标单词拆成"字母槽位 + 直接显示的特殊字符"。
 * - 字母：渲染为带下划线的槽位，由用户输入；
 * - 非字母（空格 / 连字符 / 撇号 / 数字等）：直接显示原字符，不参与输入。
 * 正确前缀实时标绿，槽位填入与下划线点亮带过渡动画。组件自身不做整体对错判定。
 */
export function SpellingInput({ word, value, locked, onChange, onFullLength }: SpellingInputProps) {
  const { colors } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const isDark = colors.background === '#1e1e1e'
  const correctColor = isDark ? '#66bb6a' : '#43a047'

  // 目标字符单元：字母标记为槽位（带顺序下标），其余直接显示
  const targetLetters = useMemo(() => lettersOnly(word), [word])
  const cells = useMemo(() => {
    let letterIndex = 0
    return Array.from(word).map((ch) => {
      const letter = isLetter(ch)
      const cell = { char: ch, isLetter: letter, letterIndex: letter ? letterIndex : -1 }
      if (letter) letterIndex += 1
      return cell
    })
  }, [word])

  // 挂载 / 单词变化时自动聚焦，让键盘输入直接进入隐藏 input
  useEffect(() => {
    if (locked) return
    inputRef.current?.focus()
  }, [word, locked])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return
    const cleaned = lettersOnly(e.target.value).slice(0, targetLetters.length)
    // 非字母 / 超长被清洗后长度未变时 React 不会回写 DOM，这里手动纠正，
    // 避免残留字符留在输入框中
    if (e.target.value !== cleaned) e.target.value = cleaned
    onChange(cleaned)
    if (cleaned.length === targetLetters.length) onFullLength(cleaned)
  }

  const focusInput = () => {
    if (locked) return
    inputRef.current?.focus()
  }

  return (
    <div
      onClick={focusInput}
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: 12,
        cursor: locked ? 'default' : 'text',
      }}
    >
      {cells.map((cell, i) => {
        // 非字母：直接显示原字符（不参与输入）
        if (!cell.isLetter) {
          return (
            <span
              key={i}
              style={{
                fontSize: 32,
                lineHeight: '40px',
                height: 42,
                display: 'inline-flex',
                alignItems: 'flex-end',
                fontWeight: 600,
                color: colors.foreground,
                opacity: 0.8,
              }}
            >
              {cell.char === ' ' ? '\u00A0' : cell.char}
            </span>
          )
        }

        // 字母槽位
        const idx = cell.letterIndex
        const typed = value[idx] ?? ''
        const filled = typed !== ''
        const isCorrect = filled && typed.toLowerCase() === (targetLetters[idx] ?? '').toLowerCase()
        const letterColor = isCorrect ? correctColor : colors.foreground
        const underlineColor = isCorrect ? correctColor : colors.foreground
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 36,
            }}
          >
            <span
              style={{
                fontSize: 32,
                lineHeight: '40px',
                height: 40,
                fontWeight: 600,
                color: letterColor,
                opacity: filled ? 1 : 0,
                transform: filled ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.8)',
                transition: 'opacity 180ms ease, transform 180ms ease, color 180ms ease',
              }}
            >
              {typed}
            </span>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 2,
                borderRadius: 1,
                backgroundColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: underlineColor,
                  transformOrigin: 'left center',
                  transform: filled ? 'scaleX(1)' : 'scaleX(0)',
                  transition: 'transform 180ms ease, background-color 180ms ease',
                }}
              />
            </div>
          </div>
        )
      })}

      {/* 隐藏输入框：承接键盘输入，保持聚焦即可持续接收按键 */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={locked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={handleChange}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 1,
          height: 1,
          padding: 0,
          border: 'none',
          outline: 'none',
          opacity: 0,
          background: 'transparent',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
