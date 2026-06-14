import { useRef, useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import type { QuizQuestion } from '@/recitation/quizTypes'

interface FloatingOptionsProps {
  question: QuizQuestion
  onSelect: (optionId: string) => void
  selectedOptionId?: string
  disabled?: boolean
  questionKey?: number
  damping?: number
  impulse?: number
}

const OPTION_W = 210
const OPTION_H = 52
const CARD_W = 500
const CARD_H = 130

interface Body {
  x: number; y: number
  vx: number; vy: number
  targetX: number; targetY: number
  phaseX: number; phaseY: number
}

function overlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): [boolean, number, number] {
  const dx = ax - bx
  const dy = ay - by
  const ox = (aw + bw) / 2 - Math.abs(dx)
  const oy = (ah + bh) / 2 - Math.abs(dy)
  if (ox <= 0 || oy <= 0) return [false, 0, 0]
  return ox < oy
    ? [true, Math.sign(dx) * ox, 0]
    : [true, 0, Math.sign(dy) * oy]
}

export function FloatingOptions({ question, onSelect, selectedOptionId, disabled, questionKey, damping = 0.9985, impulse = 8 }: FloatingOptionsProps) {
  const gather = !useRecitationStore((s) => s.floatingAnimationEnabled)
  const { colors } = useTheme()

  const containerRef = useRef<HTMLDivElement>(null)
  const bodiesRef = useRef<Body[]>([])
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([])
  const areaRef = useRef({ w: 700, h: 460 })
  const dampingRef = useRef(damping)
  const impulseRef = useRef(impulse)
  dampingRef.current = damping
  impulseRef.current = impulse
  // 组件内部独立答题守卫 —— 与父组件 prop 无关，同一题目内只允许一次选择
  const localAnsweredRef = useRef<string | null>(null)

  // 切换题目时重置内部守卫
  useEffect(() => {
    localAnsweredRef.current = null
  }, [questionKey])

  // 初始化 / 切换题目（保留已有位置和速度，仅更新目标点）
  useEffect(() => {
    const basePositions = [
      { x: -130, y: 40 },
      { x: 130, y: 40 },
      { x: -130, y: 140 },
      { x: 130, y: 140 },
    ]
    const existing = bodiesRef.current
    const imp = impulseRef.current
    const bodies = question.options.map((_, i) => {
      const bp = basePositions[i]
      const prev = existing[i]
      return {
        x: prev ? prev.x : bp.x,
        y: prev ? prev.y : bp.y,
        // 切换题目时在保留速度基础上叠加随机冲量
        vx: prev ? prev.vx + (Math.random() - 0.5) * imp * 2 : (Math.random() - 0.5) * imp * 2,
        vy: prev ? prev.vy + (Math.random() - 0.5) * imp * 2 : (Math.random() - 0.5) * imp * 2,
        targetX: bp.x,
        targetY: bp.y,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      }
    })
    bodiesRef.current = bodies
    setOffsets(bodies.map(b => ({ x: b.x, y: b.y })))
  }, [questionKey, question.options.length])

  // 物理动画循环
  const rafRef = useRef(0)
  useEffect(() => {
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16, 3)
      last = now

      // 每次帧更新容器尺寸，适配父容器变化
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        areaRef.current = { w: rect.width, h: rect.height }
      }
      const { w: areaW, h: areaH } = areaRef.current
      const halfW = areaW / 2
      const halfH = areaH / 2
      const cardTop = -halfH
      const cardCenterY = cardTop + CARD_H / 2

      const bodies = bodiesRef.current

      for (const b of bodies) {
        if (gather) {
          // 集合：弹性归位 + 阻尼
          const dx = b.targetX - b.x
          const dy = b.targetY - b.y
          b.vx += dx * 0.08 * dt
          b.vy += dy * 0.08 * dt
          b.vx *= 0.9
          b.vy *= 0.9
        }
        // 浮动模式：不做额外牵引，仅靠初始速度 + 碰撞 + 微弱阻尼维持运动

        const d = dampingRef.current
        b.vx *= d
        b.vy *= d
        b.x += b.vx * dt
        b.y += b.vy * dt

        // 墙壁
        const minX = -halfW + OPTION_W / 2
        const maxX = halfW - OPTION_W / 2
        const minY = -halfH + OPTION_H / 2
        const maxY = halfH - OPTION_H / 2
        if (b.x < minX) { b.x = minX; b.vx = -b.vx * 0.6 }
        if (b.x > maxX) { b.x = maxX; b.vx = -b.vx * 0.6 }
        if (b.y < minY) { b.y = minY; b.vy = -b.vy * 0.6 }
        if (b.y > maxY) { b.y = maxY; b.vy = -b.vy * 0.6 }
      }

      // 选项 vs 卡片
      for (const b of bodies) {
        const [hit, px, py] = overlap(b.x, b.y, OPTION_W, OPTION_H, 0, cardCenterY, CARD_W, CARD_H)
        if (hit) {
          b.x += px; b.y += py
          if (px !== 0) b.vx = -b.vx * 0.5
          if (py !== 0) b.vy = -b.vy * 0.5
        }
      }

      // 选项 vs 选项
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i]
          const b = bodies[j]
          const [hit, px, py] = overlap(a.x, a.y, OPTION_W, OPTION_H, b.x, b.y, OPTION_W, OPTION_H)
          if (hit) {
            a.x += px / 2; a.y += py / 2
            b.x -= px / 2; b.y -= py / 2
            if (px !== 0) { a.vx = -a.vx * 0.5; b.vx = -b.vx * 0.5 }
            if (py !== 0) { a.vy = -a.vy * 0.5; b.vy = -b.vy * 0.5 }
          }
        }
      }

      setOffsets(bodies.map(b => ({ x: b.x, y: b.y })))
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gather])

  const getStyle = (optionId: string) => {
    const isSelected = selectedOptionId === optionId
    const isCorrect = isSelected && optionId === question.correctAnswer
    const isWrong = isSelected && optionId !== question.correctAnswer
    const showCorrect = selectedOptionId && optionId === question.correctAnswer && !isSelected

    let bg = colors.quizOptionBackground
    let bd = colors.quizCardBorder
    let fg = colors.foreground

    if (isWrong) { bg = colors.quizOptionWrong; bd = colors.errorBorder; fg = '#fff' }
    else if (isCorrect || showCorrect) { bg = colors.quizOptionCorrect; bd = colors.primaryButton; fg = '#fff' }
    else if (isSelected) { bg = colors.quizOptionSelected; bd = colors.primaryButton; fg = '#fff' }
    return { bg, bd, fg, isSelected }
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
      {/* 固定题目卡片 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%)',
          width: CARD_W,
          height: CARD_H,
          padding: '20px 32px',
          backgroundColor: colors.quizCardBackground,
          border: `1px solid ${colors.quizCardBorder}`,
          borderRadius: 10,
          textAlign: 'center',
          boxSizing: 'border-box',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 11, color: colors.foreground, opacity: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
          {question.type === 'word-to-meaning' ? '单词选释义' : '释义选单词'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: colors.foreground, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.word}
        </div>
        <div style={{ fontSize: 13, color: colors.foreground, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.type === 'word-to-meaning' ? '请选择正确的释义' : '请选择对应的单词'}
        </div>
      </div>

      {/* 浮动选项 */}
      {question.options.map((option, i) => {
        const off = offsets[i] ?? { x: 0, y: 0 }
        const s = getStyle(option.id)
        return (
          <button
            key={`${questionKey}-${option.id}`}
            onClick={(e) => {
              e.stopPropagation()
              if (disabled || localAnsweredRef.current) return
              localAnsweredRef.current = option.id
              onSelect(option.id)
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
              width: OPTION_W,
              height: OPTION_H,
              padding: 0,
              backgroundColor: s.bg,
              border: `2px solid ${s.bd}`,
              borderRadius: 8,
              color: s.fg,
              fontSize: 15,
              cursor: s.isSelected ? 'default' : 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
              zIndex: s.isSelected ? 1 : 0,
              boxShadow: s.isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontWeight: 700, marginRight: 8, flexShrink: 0 }}>{option.id}.</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.text}</span>
          </button>
        )
      })}
    </div>
  )
}
