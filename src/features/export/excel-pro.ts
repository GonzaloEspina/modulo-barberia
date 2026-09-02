import * as XLSX from 'xlsx'

export function applyExcelProFormatting(sheet: XLSX.WorkSheet) {
  if (!sheet['!ref']) return
  sheet['!autofilter'] = { ref: sheet['!ref'] }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }
}

export function createProWorkbook(
  sheetName: string,
  rows: Record<string, string | number | null | undefined>[],
) {
  const sheet = XLSX.utils.json_to_sheet(rows)
  applyExcelProFormatting(sheet)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  return book
}

export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename)
}
