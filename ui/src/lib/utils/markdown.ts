export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/~~(.+?)~~/g, '$1') // strikethrough
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^[-*+]\s+/gm, '') // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/`(.+?)`/g, '$1'); // inline code
}
