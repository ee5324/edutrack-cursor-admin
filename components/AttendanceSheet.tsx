import React from 'react';
import { AttendanceTableData } from '../types';

interface AttendanceSheetProps {
  data: AttendanceTableData;
}

const AttendanceSheet: React.FC<AttendanceSheetProps> = ({ data }) => {
  const { 
    academicYear, 
    semester, 
    courseName, 
    instructorName,
    classTime, // Weekday
    location, 
    dates, 
    students 
  } = data;

  // 格式化日期：MM/DD
  const formatDateMMDD = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}`;
  };

  // 預先處理學生資料，計算背景色與合併儲存格 (rowSpan)
  // 邏輯：當節次(period)改變時，群組索引+1，奇數群組為灰色
  let groupIndex = 0;
  let lastPeriod = students[0]?.period;
  
  // 計算每個節次的出現次數，用於 rowSpan
  const periodCounts: { [key: string]: number } = {};
  students.forEach(s => {
    periodCounts[s.period] = (periodCounts[s.period] || 0) + 1;
  });

  // 追蹤每個節次已經渲染了幾次，只有第一次渲染時帶上 rowSpan
  const periodRendered: { [key: string]: number } = {};

  const processedStudents = students.map((s) => {
    if (s.period !== lastPeriod) {
      groupIndex++;
      lastPeriod = s.period;
    }
    
    const count = periodRendered[s.period] || 0;
    const isFirst = count === 0;
    periodRendered[s.period] = count + 1;

    return { 
      ...s, 
      isGray: groupIndex % 2 !== 0,
      rowSpan: isFirst ? periodCounts[s.period] : 0
    };
  });

  // 樣式設定
  // whitespace-nowrap 防止文字換行
  // text-base 對應約 16px, print:text-sm 對應約 14px (列印時縮小字體)
  // h-12 對應 48px, print:h-auto 允許列印時高度自適應 (稍微緊湊一點)
  const borderStyle = "border border-black px-1 py-1 h-12 print:h-auto print:py-0.5 align-middle text-center whitespace-nowrap overflow-hidden text-base print:text-sm";
  
  // 表頭樣式
  const headerBorderStyle = "border border-black px-1 py-2 bg-gray-50 print:bg-transparent font-semibold align-middle text-center whitespace-nowrap text-base print:text-sm";
  
  // 字體設定：優先使用標楷體
  const fontStyle = {
    fontFamily: '"BiauKai", "DFKai-SB", "KaiTi", "標楷體", serif'
  };

  return (
    <div 
        id="attendance-sheet-root"
        className="bg-white p-8 shadow-lg mx-auto overflow-x-auto print:shadow-none print:p-0 print:w-full print:overflow-visible text-black"
        style={fontStyle}
    >
      
      {/* 標題區塊 */}
      <div className="text-center mb-1 relative">
        <h1 className="text-2xl print:text-xl font-bold tracking-widest mb-2">
            {/* 修正：如果學期變數沒有「學期」二字 (例如 "下")，自動補上 */}
            {academicYear} 學年{semester.includes('學期') ? semester : `${semester}學期`}加昌國小{courseName}點名單
        </h1>
        {/* 授課教師 */}
        <div className="flex justify-end w-full">
             <span className="font-medium text-lg print:text-base">授課教師：{instructorName}</span>
        </div>
      </div>

      {/* 資訊區塊 (左側對齊) */}
      <div className="mb-1 text-base print:text-sm font-medium leading-tight">
        <div>上課時間：{classTime}</div>
        <div>上課地點：{location}</div>
      </div>

      {/* 表格區塊 - print:text-sm 設定為列印時縮小字級 */}
      <table className="w-full border-collapse border border-black text-base print:text-sm">
        <thead>
            <tr>
                <th className={`${headerBorderStyle} w-12`}>
                    <span className="block w-full text-center">編<br/>號</span>
                </th>
                {/* 加寬欄位以容納 "上課時間" 不換行 */}
                <th className={`${headerBorderStyle} w-28 print:w-24`}>上課時間</th>
                {/* 加寬欄位以容納 "班級" 不換行 */}
                <th className={`${headerBorderStyle} w-20`}>班級</th>
                <th className={`${headerBorderStyle} w-32`}>姓名</th>
                
                {/* 日期欄位 (MM/DD) */}
                {dates.map((date, idx) => {
                    const dateStr = formatDateMMDD(date);
                    return (
                        <th key={idx} className={`${headerBorderStyle} min-w-[3rem]`}>
                            {dateStr}
                        </th>
                    );
                })}

                {/* 成績欄位 */}
                <th className={`${headerBorderStyle} w-28 align-middle`}>
                     <span className="block w-full text-center">成<br/>績</span>
                </th>
            </tr>
        </thead>
        <tbody>
            {processedStudents.map((student, idx) => (
                <tr 
                    key={idx} 
                    className={student.isGray ? "bg-gray-100 print:bg-gray-100" : ""}
                    style={student.isGray ? { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } : {}}
                >
                    <td className={borderStyle}>{student.id}</td>
                    {student.rowSpan > 0 && (
                        <td className={borderStyle} rowSpan={student.rowSpan}>
                            {student.period}
                        </td>
                    )}
                    <td className={borderStyle}>{student.className}</td>
                    <td className={`${borderStyle} font-medium`}>{student.name}</td>
                    
                    {/* 日期格 (空白) */}
                    {dates.map((_, dateIdx) => (
                        <td key={dateIdx} className={borderStyle}></td>
                    ))}

                    {/* 成績格 (空白) */}
                    <td className={borderStyle}></td>
                </tr>
            ))}
            
            {/* 頁尾：教師簽名 */}
            <tr className="h-14 print:h-12">
                <td colSpan={4} className="border border-black px-4 font-bold text-center align-middle whitespace-nowrap">
                    教師簽名
                </td>
                {dates.map((_, dateIdx) => (
                    <td key={dateIdx} className="border border-black"></td>
                ))}
                <td className="border border-black"></td>
            </tr>
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceSheet;