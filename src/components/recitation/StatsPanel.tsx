import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useRecitationService } from '@/hooks/useRecitationService'
import { useRecitationStore } from '@/store/recitationStore'
import { mergeToSixStages } from '@/recitation/types'
import type { StageDistribution, StageSummary, Book } from '@/recitation/types'

const STAGE_META: Array<{ key: keyof StageSummary; label: string }> = [
  { key: 'unstudied', label: '未学' },
  { key: 'beginner', label: '初学' },
  { key: 'review', label: '复习' },
  { key: 'consolidate', label: '巩固' },
  { key: 'proficient', label: '熟练' },
  { key: 'mastered', label: '掌握' },
]

function getStageColor(colors: Record<string, string>, key: string): string {
  const map: Record<string, string> = {
    unstudied: colors.stageUnstudied,
    beginner: colors.stageBeginner,
    review: colors.stageReview,
    consolidate: colors.stageConsolidate,
    proficient: colors.stageProficient,
    mastered: colors.stageMastered,
  }
  return map[key] || '#999'
}

/** 纯 SVG 环形图 */
function DonutChart({
  data,
  colors,
  size = 160,
  strokeWidth = 28,
}: {
  data: Array<{ key: string; value: number; color: string }>
  colors: Record<string, string>
  size?: number
  strokeWidth?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = (size - strokeWidth) / 2

  // 过滤掉 value 为 0 的数据
  const nonZero = data.filter((d) => d.value > 0)
  if (nonZero.length === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.bookProgressBarTrack} strokeWidth={strokeWidth} />
      </svg>
    )
  }

  // 计算每个扇区的 arc path
  const totalAngle = 360
  let currentAngle = -90 // 从顶部开始

  const slices = nonZero.map((d) => {
    const angle = (d.value / total) * totalAngle
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

    return { key: d.key, path, color: d.color }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((slice) => (
        <path key={slice.key} d={slice.path} fill={slice.color} stroke="none" />
      ))}
      {/* 中心留白产生环形效果 */}
      <circle cx={cx} cy={cy} r={r * 0.55} fill={colors.recitationSidebarBackground || colors.sidebarBackground} />
      {/* 总单词数 */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={colors.foreground} fontSize={16} fontWeight={600}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={colors.foreground} fontSize={10} opacity={0.6}>
        总计
      </text>
    </svg>
  )
}

export function StatsPanel() {
  const { colors } = useTheme()
  const recitationService = useRecitationService()
  const selectedBookId = useRecitationStore((s) => s.selectedBookId)

  const [books, setBooks] = useState<Book[]>([])
  const [selectedOption, setSelectedOption] = useState<number | 'all'>('all')
  const [distribution, setDistribution] = useState<StageDistribution | null>(null)
  const [loading, setLoading] = useState(true)

  // 加载词书列表
  useEffect(() => {
    recitationService.getBooks().then((list) => {
      setBooks(list)
    }).catch(() => {})
  }, [recitationService])

  // 加载分布数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let dist: StageDistribution
      if (selectedOption === 'all') {
        dist = await recitationService.getOverallStageDistribution()
      } else {
        dist = await recitationService.getStageDistribution(selectedOption)
      }
      setDistribution(dist)
    } catch {
      console.error('加载阶段分布数据失败')
    } finally {
      setLoading(false)
    }
  }, [recitationService, selectedOption])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 合并为 6 阶段
  const summary: StageSummary | null = useMemo(() => {
    if (!distribution) return null
    return mergeToSixStages(distribution)
  }, [distribution])

  // 准备图表数据
  const chartData = useMemo(() => {
    if (!summary) return []
    const total = Object.values(summary).reduce((a, b) => a + b, 0)
    return STAGE_META.map(({ key, label }) => ({
      key,
      label,
      value: summary[key],
      pct: total > 0 ? ((summary[key] / total) * 100).toFixed(1) : '0.0',
      color: getStageColor(colors as unknown as Record<string, string>, key),
    }))
  }, [summary, colors])

  const totalWords = useMemo(() => {
    if (!summary) return 0
    return Object.values(summary).reduce((a, b) => a + b, 0)
  }, [summary])

  const studiedWords = useMemo(() => {
    if (!summary) return 0
    return totalWords - summary.unstudied
  }, [summary, totalWords])

  // 当选中词书变化时，自动切换下拉
  useEffect(() => {
    if (selectedBookId && selectedOption === 'all') {
      setSelectedOption(selectedBookId)
    }
  }, [selectedBookId, selectedOption])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.sidebarBackground,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: `1px solid ${colors.sidebarBorder}`,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '12px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: colors.foreground,
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}
      >
        学习统计
      </div>

      {/* 词书选择器 */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <select
          value={selectedOption === 'all' ? 'all' : String(selectedOption)}
          onChange={(e) => {
            const val = e.target.value
            setSelectedOption(val === 'all' ? 'all' : Number(val))
          }}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 12,
            backgroundColor: colors.inputBackground,
            color: colors.foreground,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 4,
            outline: 'none',
          }}
        >
          <option value="all">全部词书</option>
          {books.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* 环形图 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px 0',
          flexShrink: 0,
        }}
      >
        {loading ? (
          <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.foreground, opacity: 0.4, fontSize: 12 }}>
            加载中...
          </div>
        ) : (
          <DonutChart data={chartData} colors={colors as unknown as Record<string, string>} />
        )}
      </div>

      {/* 阶段明细列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 8px' }}>
        {!loading && chartData.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 0',
              fontSize: 12,
              color: colors.foreground,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, opacity: 0.8 }}>{item.label}</span>
            <span style={{ fontWeight: 500 }}>{item.value}</span>
            <span style={{ opacity: 0.5, minWidth: 36, textAlign: 'right' }}>{item.pct}%</span>
          </div>
        ))}
      </div>

      {/* 关键指标 */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${colors.border}`,
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        <MetricCard label="总词数" value={String(totalWords)} colors={colors as unknown as Record<string, string>} />
        <MetricCard label="已学习" value={String(studiedWords)} colors={colors as unknown as Record<string, string>} />
        <MetricCard label="待复习" value={String(distribution ? (() => {
          // 粗略估算待复习：stage 0-4 的已学单词
          if (!distribution) return 0
          return distribution.stage0 + distribution.stage1 + distribution.stage2 + distribution.stage3 + distribution.stage4
        })() : 0)} colors={colors as unknown as Record<string, string>} />
        <MetricCard label="已掌握" value={String(distribution?.stage8 || 0)} colors={colors as unknown as Record<string, string>} />
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  colors,
}: {
  label: string
  value: string
  colors: Record<string, string>
}) {
  return (
    <div
      style={{
        padding: '6px 8px',
        borderRadius: 4,
        backgroundColor: colors.quizCardBackground,
        border: `1px solid ${colors.quizCardBorder}`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: colors.foreground, opacity: 0.6, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: colors.foreground }}>{value}</div>
    </div>
  )
}
