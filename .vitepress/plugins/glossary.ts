import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { glossary } from '../data/glossary'

/** 转义正则特殊字符 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 构建词条匹配正则：
 * - 词条按长度降序排列，保证长词（如 SQL INJECTION）优先于短词（SQL）匹配
 * - 大小写不敏感，但保留原文大小写显示
 * - 单词边界：两侧不能紧邻字母或数字，避免误匹配单词内部（如 index 命中 indexed）
 */
const sortedTerms = [...glossary]
  .sort((a, b) => b.term.length - a.term.length)
  .map((g) => escapeRegExp(g.term))

const TERM_PATTERN = new RegExp(
  `(?<![A-Za-z0-9])(?:${sortedTerms.join('|')})(?![A-Za-z0-9])`,
  'gi'
)

/** HTML 转义（span 内容） */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 属性转义（data-term） */
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * markdown-it 插件：将正文中的词条自动包裹为
 * <span class="glossary-term" data-term="...">...</span>
 *
 * 规则：
 * - 只处理 inline 块中的 text 子 token；code_inline（行内代码）天然是独立 token，不会误伤
 * - 跳过标题（heading_open/close 之间）
 * - 代码块 fence / code_block 是 block 级 token，不在 inline children 中，天然跳过
 * - 匹配命中的文本拆分为 文本 + span + 文本 的 token 序列
 */
export function glossaryPlugin(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'glossary_terms', (state) => {
    const tokens = state.tokens
    let inHeading = false

    for (const token of tokens) {
      if (token.type === 'heading_open') {
        inHeading = true
        continue
      }
      if (token.type === 'heading_close') {
        inHeading = false
        continue
      }
      if (token.type !== 'inline' || inHeading || !token.children || token.children.length === 0) {
        continue
      }

      const children = token.children
      const newChildren: Token[] = []

      for (const child of children) {
        // 只处理纯文本，行内代码/链接/强调等的内部结构交由各自 token 处理
        if (child.type !== 'text' || !child.content) {
          newChildren.push(child)
          continue
        }

        TERM_PATTERN.lastIndex = 0
        let lastIndex = 0
        let matched = false
        let m: RegExpExecArray | null

        while ((m = TERM_PATTERN.exec(child.content)) !== null) {
          matched = true
          if (m.index > lastIndex) {
            const t = new state.Token('text', '', 0)
            t.content = child.content.slice(lastIndex, m.index)
            newChildren.push(t)
          }
          const span = new state.Token('html_inline', '', 0)
          span.content = `<span class="glossary-term" data-term="${escapeAttr(
            m[0].toLowerCase()
          )}">${escapeHtml(m[0])}</span>`
          newChildren.push(span)
          lastIndex = m.index + m[0].length
          if (m[0].length === 0) {
            TERM_PATTERN.lastIndex++
          }
        }

        if (!matched) {
          newChildren.push(child)
        } else if (lastIndex < child.content.length) {
          const t = new state.Token('text', '', 0)
          t.content = child.content.slice(lastIndex)
          newChildren.push(t)
        }
      }

      token.children = newChildren
    }
    return true
  })
}
