/**
 * 點名單列印：產生整份 HTML 字串，供 window.open + document.write 列印用。
 * 每張點名表包在 .notice-page，一頁 A4 橫向。
 */
import type { AttendanceTableData, Student } from '../types';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateMMDD(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

interface ProcessedStudent extends Student {
  rowSpan: number;
  isGray: boolean;
}

function processStudents(students: Student[]): ProcessedStudent[] {
  const normalized = students.map((s) => ({
    ...s,
    period: s.period != null ? String(s.period).trim() || '第一節' : '第一節',
  }));
  const periodCounts: Record<string, number> = {};
  normalized.forEach((s) => {
    periodCounts[s.period] = (periodCounts[s.period] || 0) + 1;
  });
  const periodRendered: Record<string, number> = {};
  let groupIndex = 0;
  let lastPeriod = normalized[0]?.period ?? '';
  return normalized.map((s) => {
    if (s.period !== lastPeriod) {
      groupIndex++;
      lastPeriod = s.period;
    }
    const count = periodRendered[s.period] || 0;
    const isFirst = count === 0;
    periodRendered[s.period] = count + 1;
    return {
      ...s,
      rowSpan: isFirst ? periodCounts[s.period] : 0,
      isGray: groupIndex % 2 !== 0,
    };
  });
}

function buildOneSheet(data: AttendanceTableData): string {
  const {
    academicYear,
    semester,
    courseName,
    instructorName,
    classTime,
    location,
    dates,
    students,
  } = data;
  const processed = processStudents(students);
  const semesterText = semester.includes('學期') ? semester : `${semester}學期`;
  const dateCells = dates.map((d) => `<th class="th-date">${esc(formatDateMMDD(d))}</th>`).join('');
  const dateCellsBody = dates.map(() => '<td class="td-cell td-date"></td>').join('');

  const rows = processed
    .map((student) => {
      const gray = student.isGray ? ' class="row-gray"' : '';
      const grayStyle = student.isGray ? ' style="-webkit-print-color-adjust: exact; print-color-adjust: exact;"' : '';
      const periodCell =
        student.rowSpan > 0
          ? `<td class="td-cell" rowspan="${student.rowSpan}" style="vertical-align: middle">${esc(student.period)}</td>`
          : '';
      return `<tr${gray}${grayStyle}>
        <td class="td-cell">${esc(student.id)}</td>${periodCell}
        <td class="td-cell td-class">${esc(student.className)}</td>
        <td class="td-cell td-name">${esc(student.name)}</td>
        ${dateCellsBody}
        <td class="td-cell td-last"></td>
      </tr>`;
    })
    .join('');

  const dateFooterCells = dates.map(() => '<td class="td-cell td-date"></td>').join('');

  return `
    <div class="sheet-content">
      <div class="sheet-header">
        <h1 class="sheet-title">${esc(academicYear)} 學年${esc(semesterText)}加昌國小${esc(courseName)}點名單</h1>
        <div class="sheet-teacher">授課教師：${esc(instructorName)}</div>
      </div>
      <div class="sheet-info">
        <div>上課時間：${esc(classTime)}</div>
        <div>上課地點：${esc(location)}</div>
      </div>
      <table class="sheet-table">
        <thead>
          <tr>
            <th class="th-cell w-num"><span class="cell-inner">編<br/>號</span></th>
            <th class="th-cell w-time">上課時間</th>
            <th class="th-cell w-class">班級</th>
            <th class="th-cell w-name">姓名</th>
            ${dateCells}
            <th class="th-cell w-grade"><span class="cell-inner">成<br/>績</span></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="row-sign">
            <td colspan="4" class="td-sign">教師簽名</td>
            ${dateFooterCells}
            <td class="td-cell td-last"></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: "BiauKai", "DFKai-SB", "KaiTi", "標楷體", serif; }
  .notice-page {
    width: 100%;
    height: 210mm;
    min-height: 210mm;
    max-height: 210mm;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    padding: 2mm 0 0 0;
  }
  .notice-page:last-child { page-break-after: auto; break-after: auto; }
  .sheet-content { width: 100%; padding: 4px 0 0 0; }
  .sheet-header { text-align: center; margin-bottom: 2px; }
  .sheet-title { font-size: 20px; font-weight: bold; letter-spacing: 0.1em; margin: 0 0 4px 0; }
  .sheet-teacher { font-size: 14px; text-align: right; }
  .sheet-info { font-size: 12px; font-weight: 500; margin-bottom: 2px; }
  .sheet-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 12px;
    border-top: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
  }
  .sheet-table th,
  .sheet-table td {
    border-top: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
    padding: 2px 4px;
    text-align: center;
    vertical-align: middle;
    white-space: nowrap;
    overflow: hidden;
  }
  .th-cell { background: #f9fafb; font-weight: 600; }
  .td-date, .th-date { width: 8mm !important; min-width: 8mm !important; max-width: 8mm !important; }
  .w-num { width: 2.5em; }
  .w-time { width: 5em; }
  .w-class { width: 4em; font-size: 13.5pt; }
  .w-name { width: 6em; font-size: 13.5pt; }
  .w-grade { width: 4em; }
  .td-class, .td-name { font-size: 13.5pt; }
  .td-name { font-weight: 500; }
  .cell-inner { display: block; width: 100%; text-align: center; }
  .row-gray { background: #f3f4f6; }
  .row-sign .td-sign { font-weight: bold; text-align: center; padding: 4px 8px; }
  .sheet-scale-wrap { overflow: hidden; }
`;

/**
 * 由課程名稱取得「語言別」（例：排灣語3A → 排灣語、閩南語A → 閩南語）
 */
function getLanguageType(courseName: string): string {
  const s = (courseName ?? '').trim();
  return s.replace(/\s*[\dA-Za-z]+\s*$/, '').trim() || s;
}

/**
 * 同一語言別且同一老師：依「同一天」合併點名表，每日期一頁、該日所有班級學生合併列出
 */
export function mergeSheetsByLanguageAndTeacher(sheets: AttendanceTableData[]): AttendanceTableData[] {
  if (sheets.length === 0) return [];
  const key = (s: AttendanceTableData) => `${getLanguageType(s.courseName)}|${(s.instructorName ?? '').trim()}`;
  const groups = new Map<string, AttendanceTableData[]>();
  for (const s of sheets) {
    const k = key(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }
  const result: AttendanceTableData[] = [];
  for (const [, groupSheets] of groups) {
    const first = groupSheets[0];
    if (groupSheets.length === 1) {
      result.push(first);
      continue;
    }
    const allDates = Array.from(
      new Set(groupSheets.flatMap((s) => s.dates.map((d) => d.getTime())))
    ).sort((a, b) => a - b);
    const datesList = allDates.map((t) => new Date(t));
    const languageLabel = `${getLanguageType(first.courseName)}（${first.instructorName}）`;
    for (const date of datesList) {
      const combined: Student[] = [];
      for (const sheet of groupSheets) {
        for (const st of sheet.students) {
          combined.push({
            ...st,
            period: st.period ?? '第一節',
          });
        }
      }
      combined.sort((a, b) => {
        const c = (a.className ?? '').localeCompare(b.className ?? '', undefined, { numeric: true });
        return c !== 0 ? c : (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
      });
      result.push({
        academicYear: first.academicYear,
        semester: first.semester,
        courseName: languageLabel,
        instructorName: first.instructorName,
        classTime: '多班',
        location: first.location,
        dates: [date],
        students: combined.map((st, i) => ({ ...st, id: String(i + 1) })),
      });
    }
  }
  return result;
}

/**
 * 產生完整列印用 HTML（含 DOCTYPE、head 內嵌 CSS、body 內多個 .notice-page）
 * 若傳入多張點名表，會先依「同一語言別且同一老師」合併同一天再列印
 */
export function buildAttendanceSheetsPrintHtml(sheets: AttendanceTableData[]): string {
  const merged = mergeSheetsByLanguageAndTeacher(sheets);
  const pages = merged
    .map((data) => `<div class="notice-page">${buildOneSheet(data)}</div>`)
    .join('\n');
  const script = `
(function(){
  var pageHeightMm = 210;
  var pageHeightPx = pageHeightMm * 96 / 25.4;
  function fitPages(){
    document.querySelectorAll('.notice-page').forEach(function(page){
      var content = page.querySelector('.sheet-content');
      if (!content) return;
      var h = content.offsetHeight;
      var w = content.offsetWidth;
      if (h <= pageHeightPx) return;
      var scale = pageHeightPx / h;
      var wrap = document.createElement('div');
      wrap.className = 'sheet-scale-wrap';
      wrap.style.height = pageHeightPx + 'px';
      wrap.style.width = (w * scale) + 'px';
      wrap.style.margin = '0';
      wrap.style.padding = '0';
      content.parentNode.insertBefore(wrap, content);
      wrap.appendChild(content);
      content.style.transform = 'scale(' + scale + ')';
      content.style.transformOrigin = 'top left';
    });
  }
  if (document.readyState === 'complete') fitPages();
  else window.addEventListener('load', fitPages);
})();
`;
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>點名單列印</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
${pages}
<script>${script}<\/script>
</body>
</html>`;
}
