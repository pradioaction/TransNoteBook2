import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const s = (props: IconProps) => ({
  width: props.size ?? 16,
  height: props.size ?? 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

// 文件夹
export function IconFolder(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M1.5 4.5v-1a1 1 0 0 1 1-1h3l1.5 2h5a1 1 0 0 1 1 1v.5" />
      <path d="M1.5 5.5v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-6.5l-1.5-2h-3a1 1 0 0 0-1 1z" />
    </svg>
  )
}

// 打开文件夹
export function IconFolderOpen(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M1.5 3.5v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7.5L6 3.5H3a1 1 0 0 0-1 1z" />
      <path d="M1.5 7.5l1.2 2.4a1 1 0 0 0 .9.6h9.4" />
    </svg>
  )
}

// 文件
export function IconFile(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M3 1.5h6l3.5 3.5V14a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" />
      <path d="M9 1.5v3h3.5" />
    </svg>
  )
}

// 搜索
export function IconSearch(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={7} cy={7} r={4} />
      <path d="M10 10l3.5 3.5" />
    </svg>
  )
}

// 书本/背诵
export function IconBook(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M2 2.5h4a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H2z" />
      <path d="M14 2.5h-4a2 2 0 0 0-2 2v9a2 2 0 0 1 2-2h4z" />
      <path d="M6 5.5H3" /><path d="M6 7.5H3" /><path d="M6 9.5H3" />
      <path d="M13 5.5h-3" /><path d="M13 7.5h-3" /><path d="M13 9.5h-3" />
    </svg>
  )
}

// 设置齿轮
export function IconSettings(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={2.5} />
      <path d="M8 1.5v1.5M8 13v1.5M3.2 3.2l1 1M11.8 11.8l1 1M1.5 8H3M13 8h1.5M3.2 12.8l1-1M11.8 4.2l1-1" opacity={0.6} />
    </svg>
  )
}

// 检查/完成 ✓
export function IconCheck(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M3.5 8.5l3 3 6-6" />
    </svg>
  )
}

// 错误 ✗
export function IconCross(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

// 关闭 (细版)
export function IconClose(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

// 播放/翻译 ▶
export function IconPlay(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M4 2.5v11l9-5.5z" />
    </svg>
  )
}

// 展开/向下 ▼
export function IconChevronDown(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

// 折叠/向右 ▶
export function IconChevronRight(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}

// 上移 ▲
export function IconArrowUp(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M8 13V3M4 6.5L8 3l4 3.5" />
    </svg>
  )
}

// 下移 ▼
export function IconArrowDown(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M8 3v10M4 9.5L8 13l4-3.5" />
    </svg>
  )
}

// 刷新 🔄
export function IconRefresh(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M13 8A5 5 0 1 1 8 3" />
      <path d="M13 3v3.5H9.5" />
    </svg>
  )
}

// 导入 📥
export function IconImport(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M8 1.5v9M4.5 7L8 10.5 11.5 7" />
      <path d="M1.5 11v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" />
    </svg>
  )
}

// 保存 💾
export function IconSave(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M12.5 14.5h-9a1 1 0 0 1-1-1V4l3-3h7a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1z" />
      <path d="M4.5 14.5V10h7v4.5" />
      <path d="M4.5 1.5v3h5v-3" />
    </svg>
  )
}

// 编辑文件 📝
export function IconEdit(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M11.5 1.5l3 3L5 14H2v-3z" />
      <path d="M9.5 3.5l3 3" />
    </svg>
  )
}

// 亮色主题 ☀
export function IconSun(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={3} />
      <path d="M8 1.5v1.5M8 13v1.5M3.2 3.2l1 1M11.8 11.8l1 1M1.5 8H3M13 8h1.5M3.2 12.8l1-1M11.8 4.2l1-1" />
    </svg>
  )
}

// 暗色主题 ☾
export function IconMoon(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M13 9.5A6 6 0 0 1 6.5 3a6 6 0 1 0 6.5 6.5z" />
    </svg>
  )
}

// 删除
export function IconTrash(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M2.5 4h11M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4" />
      <path d="M3 4l1 9.5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1L13 4" />
    </svg>
  )
}

// 问号
export function IconQuestion(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={5.5} />
      <path d="M6.5 6a1.5 1.5 0 1 1 2.5 1C8.5 7.5 8 8 8 9" />
      <circle cx={8} cy={11} r={0.8} fill="currentColor" stroke="none" />
    </svg>
  )
}

// 问题/议题
export function IconIssues(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={5} />
      <circle cx={8} cy={5} r={1.2} fill="currentColor" stroke="none" />
      <path d="M8 7.5v4" />
    </svg>
  )
}

// 庆祝 🎉
export function IconCelebrate(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={3} />
      <path d="M8 1v2M8 13v2M2 8H0M16 8h-2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5" />
    </svg>
  )
}

// 带圆点 (修改标记)
export function IconDot(props: IconProps) {
  return (
    <svg {...s(props)}>
      <circle cx={8} cy={8} r={2} fill="currentColor" stroke="none" />
    </svg>
  )
}

// 复制
export function IconCopy(props: IconProps) {
  return (
    <svg {...s(props)}>
      <rect x={5.5} y={1.5} width={9} height={9} rx={0.5} />
      <path d="M1.5 5.5v8a1 1 0 0 0 1 1h8" />
    </svg>
  )
}

// 合并
export function IconMerge(props: IconProps) {
  return (
    <svg {...s(props)}>
      <path d="M4 1.5v6a2 2 0 0 0 2 2h4" />
      <path d="M4 1.5H1.5M12 9.5l2.5 2.5L12 14.5" />
      <path d="M6.5 9.5l2.5 2.5-2.5 2.5" />
    </svg>
  )
}
