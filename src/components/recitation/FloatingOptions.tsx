import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SpeakButton } from '@/components/common/SpeakButton'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationStore } from '@/store/recitationStore'
import type { QuizQuestion, QuizQuestionType } from '@/recitation/quizTypes'

interface FloatingOptionsProps {
  question: QuizQuestion
  onSelect: (optionId: string) => void
  selectedOptionId?: string
  disabled?: boolean
  questionKey?: number
  damping?: number
  impulse?: number
  kbHoveredOptionId?: string | null
  /** 是否处于翻转放大状态 */
  flipped?: boolean
  /** 翻转卡片展示的数据 */
  flipCardData?: {
    type: QuizQuestionType
    word: string
    phonetic?: string
    definition?: string
    example?: string
    stage?: number
  } | null
  /** 点击遮罩翻回的回调 */
  onFlipBack?: () => void
  /** 点击已答题的选项触发翻转（传入选项ID） */
  onFlipToOption?: (optionId: string) => void
}

const OPTION_W = 210
const OPTION_H = 52
const CARD_W = 500
const CARD_H = 130

const STAGE_LABELS_KEY = [
  'floatingOptions.stageUnstudied',
  'floatingOptions.stageBeginner',
  'floatingOptions.stageReview',
  'floatingOptions.stageConsolidate',
  'floatingOptions.stageProficient',
  'floatingOptions.stageMastered',
] as const

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

export function FloatingOptions({
  question, onSelect, selectedOptionId, disabled, questionKey,
  damping = 0.9985, impulse = 8, kbHoveredOptionId,
  flipped = false, flipCardData, onFlipBack, onFlipToOption,
}: FloatingOptionsProps) {
  const { t } = useTranslation()
  const gather = !useRecitationStore((s) => s.floatingAnimationEnabled)
  const { colors } = useTheme()
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const bodiesRef = useRef<Body[]>([])
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([])
  const areaRef = useRef({ w: 700, h: 460 })
  const dampingRef = useRef(damping)
  const impulseRef = useRef(impulse)
  dampingRef.current = damping
  impulseRef.current = impulse
  const localAnsweredRef = useRef<string | null>(null)

  useEffect(() => {
    localAnsweredRef.current = null
  }, [questionKey])

  // 初始化 / 切换题目
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

  // 物理动画循环（翻转时暂停）
  const rafRef = useRef(0)
  useEffect(() => {
    if (flipped) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16, 3)
      last = now

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
          const dx = b.targetX - b.x
          const dy = b.targetY - b.y
          b.vx += dx * 0.08 * dt
          b.vy += dy * 0.08 * dt
          b.vx *= 0.9
          b.vy *= 0.9
        }

        const d = dampingRef.current
        b.vx *= d
        b.vy *= d
        b.x += b.vx * dt
        b.y += b.vy * dt

        const minX = -halfW + OPTION_W / 2
        const maxX = halfW - OPTION_W / 2
        const minY = -halfH + OPTION_H / 2
        const maxY = halfH - OPTION_H / 2
        if (b.x < minX) { b.x = minX; b.vx = -b.vx * 0.6 }
        if (b.x > maxX) { b.x = maxX; b.vx = -b.vx * 0.6 }
        if (b.y < minY) { b.y = minY; b.vy = -b.vy * 0.6 }
        if (b.y > maxY) { b.y = maxY; b.vy = -b.vy * 0.6 }
      }

      for (const b of bodies) {
        const [hit, px, py] = overlap(b.x, b.y, OPTION_W, OPTION_H, 0, cardCenterY, CARD_W, CARD_H)
        if (hit) {
          b.x += px; b.y += py
          if (px !== 0) b.vx = -b.vx * 0.5
          if (py !== 0) b.vy = -b.vy * 0.5
        }
      }

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
  }, [gather, flipped])

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

  // 翻转卡片上展示的单词
  const displayWord = flipCardData?.word ?? ''

  // 阶段标签
  const stageLabel = flipCardData?.stage != null
    ? t(STAGE_LABELS_KEY[Math.min(flipCardData.stage, STAGE_LABELS_KEY.length - 1)])
    : ''

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 8,
      }}
    >
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
          opacity: flipped ? 0.15 : 1,
          transition: 'opacity 0.4s',
        }}
      >
        <div style={{ fontSize: 11, color: colors.foreground, opacity: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
          {question.type === 'word-to-meaning' ? t('floatingOptions.wordToMeaning') : t('floatingOptions.meaningToWord')}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: colors.foreground, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'auto' }}>
          <span style={{ verticalAlign: 'middle' }}>{question.word}</span>
          <SpeakButton
            text={question.type === 'meaning-to-word'
              ? (question.options.find(o => o.id === question.correctAnswer)?.text ?? question.word)
              : question.word
            }
            size={16}
          />
        </div>
        <div style={{ fontSize: 13, color: colors.foreground, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.type === 'word-to-meaning' ? t('floatingOptions.selectDefinition') : t('floatingOptions.selectWord')}
        </div>
      </div>

      {/* 浮动选项（翻转时缩小淡出） */}
      {question.options.map((option, i) => {
        const off = offsets[i] ?? { x: 0, y: 0 }
        const s = getStyle(option.id)

        return (
          <button
            key={`${questionKey}-${option.id}`}
            onClick={(e) => {
              e.stopPropagation()
              if (flipped) return
              if (disabled || localAnsweredRef.current) {
                // 已答题：点击选项翻转查看该选项的单词
                if (question.answered && onFlipToOption) {
                  onFlipToOption(option.id)
                }
                return
              }
              localAnsweredRef.current = option.id
              onSelect(option.id)
            }}
            onMouseEnter={() => setHoveredOptionId(option.id)}
            onMouseLeave={() => setHoveredOptionId(null)}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: flipped
                ? 'translate(-50%, -50%) scale(0.3)'
                : `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
              width: OPTION_W,
              height: OPTION_H,
              padding: 0,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 15,
              cursor: s.isSelected ? 'default' : 'pointer',
              transition: 'opacity 0.4s ease, background-color 0.15s, border-color 0.15s',
              opacity: flipped ? 0 : 1,
              zIndex: s.isSelected ? 1 : 0,
              pointerEvents: flipped ? 'none' : 'auto',
            }}
          >
            <div
              style={{
                width: '100%', height: '100%',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: s.bg, border: `2px solid ${s.bd}`,
                color: s.fg,
                boxShadow: s.isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 8, flexShrink: 0 }}>{option.id}.</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedOptionId && (hoveredOptionId === option.id || kbHoveredOptionId === option.id) ? option.pairText : option.text}
              </span>
            </div>
          </button>
        )
      })}

      {/* 翻转态：独立详情卡片 */}
      {flipped && (
        <>
          <style>{`
            @keyframes floatingCardPop {
              from { opacity: 0; transform: scale(0.7); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
          {/* 定位层：固定居中 */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 101,
            }}
          >
            {/* 动画层：只做缩放淡入 */}
            <div
              style={{
                animation: 'floatingCardPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                minWidth: 340,
                maxWidth: '90vw',
              }}
            >
              <div
                style={{
                  background: `linear-gradient(135deg, ${colors.quizCardBackground}, ${colors.recitationBackground})`,
                  border: `1px solid ${colors.primaryButton}40`,
                  borderRadius: 20,
                  padding: '40px 36px',
                  textAlign: 'center',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 3, opacity: 0.5, marginBottom: 12 }}>
                  {flipCardData?.type === 'word-to-meaning' ? t('floatingOptions.wordToMeaning') : t('floatingOptions.meaningToWord')}
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <span>{displayWord}</span>
                  <SpeakButton text={displayWord} size={24} />
                </div>
                {flipCardData?.phonetic && (
                  <div style={{ fontSize: 16, opacity: 0.6, fontFamily: "'Times New Roman', serif", marginBottom: 16 }}>
                    {flipCardData.phonetic}
                  </div>
                )}
                <div style={{
                  width: 60, height: 3,
                  background: `linear-gradient(90deg, transparent, ${colors.primaryButton}, transparent)`,
                  borderRadius: 2, margin: '0 auto 20px',
                }} />
                {flipCardData?.definition && (
                  <div style={{ fontSize: 20, fontWeight: 500, color: colors.link || '#b0a8ff', lineHeight: 1.4, marginBottom: 16 }}>
                    {flipCardData.definition}
                  </div>
                )}
                {flipCardData?.example && (
                  <div style={{ fontSize: 15, opacity: 0.7, fontStyle: 'italic', marginBottom: 20, lineHeight: 1.5 }}>
                    &ldquo;{flipCardData.example}&rdquo;
                  </div>
                )}
                {flipCardData?.stage != null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ opacity: 0.5 }}>{t('floatingOptions.ebbinghaus')}</span>
                    <span style={{
                      padding: '4px 14px', borderRadius: 20,
                      background: `${colors.primaryButton}26`,
                      border: `1px solid ${colors.primaryButton}4D`,
                      color: colors.link || '#b0a8ff', fontWeight: 600,
                    }}>
                      {t('floatingOptions.stageN', { n: flipCardData.stage })}
                    </span>
                    <span style={{ opacity: 0.5 }}>{stageLabel}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, opacity: 0.25, letterSpacing: 1 }}>
                  {t('floatingOptions.clickToFlipBack')}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 翻转态半透明遮罩 */}
      {flipped && (
        <div
          onClick={onFlipBack}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.01)',
            zIndex: 99,
            cursor: 'pointer',
          }}
        />
      )}
    </div>
  )
}
