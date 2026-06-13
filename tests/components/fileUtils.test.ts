import { describe, it, expect } from 'vitest'
import { parseNotebookFile, serializeNotebookFile, splitTextIntoParagraphs } from '@/utils/fileUtils'

describe('fileUtils', () => {
  describe('parseNotebookFile', () => {
    it('should parse v2.0 file', () => {
      const content = JSON.stringify({
        version: '2.0',
        cells: [
          {
            type: 'markdown',
            content: 'Hello',
            output: '你好',
            id: 'test-id',
            parentId: null,
            indentLevel: 0,
            isCollapsed: false,
          },
        ],
      })
      const result = parseNotebookFile(content)
      expect(result.version).toBe('2.0')
      expect(result.cells).toHaveLength(1)
      expect(result.cells[0].content).toBe('Hello')
    })

    it('should migrate v1.0 files', () => {
      const content = JSON.stringify({
        version: '1.0',
        cells: [{ type: 'markdown', content: 'Old', output: '旧' }],
      })
      const result = parseNotebookFile(content)
      expect(result.cells[0].id).toBeTruthy()
      expect(result.cells[0].parentId).toBeNull()
      expect(result.cells[0].indentLevel).toBe(0)
    })

    it('should handle invalid JSON', () => {
      const result = parseNotebookFile('not json')
      expect(result.cells).toHaveLength(0)
    })
  })

  describe('serializeNotebookFile', () => {
    it('should serialize cells to JSON string', () => {
      const cells = [
        {
          id: 'id-1',
          type: 'markdown' as const,
          content: 'Hello',
          output: '你好',
          parentId: null,
          indentLevel: 0,
          isCollapsed: false,
          isInputCollapsed: false,
          isOutputCollapsed: false,
        },
      ]
      const json = serializeNotebookFile(cells)
      const parsed = JSON.parse(json)
      expect(parsed.version).toBe('2.0')
      expect(parsed.cells).toHaveLength(1)
      expect(parsed.cells[0].content).toBe('Hello')
    })
  })

  describe('splitTextIntoParagraphs', () => {
    it('should split text by double newlines', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3'
      const result = splitTextIntoParagraphs(text)
      expect(result).toHaveLength(3)
      expect(result[0]).toBe('Para 1')
    })

    it('should filter empty paragraphs', () => {
      const text = 'Para 1\n\n\n\nPara 2'
      const result = splitTextIntoParagraphs(text)
      expect(result).toHaveLength(2)
    })
  })
})
