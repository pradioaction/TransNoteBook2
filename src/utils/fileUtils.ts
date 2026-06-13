import type { NotebookData, NotebookCell } from '@/types/notebook'

export function parseNotebookFile(content: string): NotebookData {
  try {
    const data = JSON.parse(content)
    const version = data.version || '1.0'
    const rawCells: Record<string, unknown>[] = data.cells || []

    const cells: NotebookCell[] = rawCells.map((c) => ({
      id: (c.id as string) || crypto.randomUUID(),
      type: (c.type as NotebookCell['type']) || 'markdown',
      content: (c.content as string) || '',
      output: (c.output as string) || '',
      parentId: (c.parentId as string | null) || null,
      indentLevel: (c.indentLevel as number) || 0,
      isCollapsed: (c.isCollapsed as boolean) || false,
      isInputCollapsed: (c as { isInputCollapsed?: boolean }).isInputCollapsed || false,
      isOutputCollapsed: (c as { isOutputCollapsed?: boolean }).isOutputCollapsed || false,
    }))

    return { version, cells }
  } catch {
    return { version: '2.0', cells: [] }
  }
}

export function serializeNotebookFile(cells: NotebookCell[]): string {
  const data: NotebookData = {
    version: '2.0',
    cells: cells.map((c) => ({
      type: c.type,
      content: c.content,
      output: c.output,
      id: c.id,
      parentId: c.parentId,
      indentLevel: c.indentLevel,
      isCollapsed: c.isCollapsed,
      isInputCollapsed: c.isInputCollapsed,
      isOutputCollapsed: c.isOutputCollapsed,
    } as NotebookCell)),
  }
  return JSON.stringify(data, null, 2)
}

export function splitTextIntoParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}
