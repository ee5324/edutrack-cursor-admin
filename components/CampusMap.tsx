import React, { useState } from 'react';
import { MapPinned, ImageOff } from 'lucide-react';

/**
 * 校園平面圖：僅顯示 public 目錄下的檔案，不自製、不渲染向量。
 * 請將您的平面圖放入 public/，檔名見下方常數。
 */
const CAMPUS_MAP_FILE = '/campus-plan.png';
// 若使用 jpg/svg 等，請改為 '/campus-plan.jpg' 等，並放入對應檔案。

const CampusMap: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
          <MapPinned size={16} />
          校園平面圖
        </div>
        <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-slate-900">校園平面圖</h2>
        <p className="mt-2 text-slate-600 leading-7">
          本頁僅顯示您提供的圖檔（置于 public 資料夾），未經程式繪製或重製。
          更新圖檔時請直接替換檔案即可。
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 overflow-auto">
        {imgError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl bg-slate-50">
            <ImageOff size={48} className="mb-4 text-slate-400" />
            <p className="font-medium text-slate-700">尚未置入平面圖或路徑不符</p>
            <p className="mt-2 text-sm max-w-lg">
              請將平面圖放入專案 <code className="bg-slate-200 px-1 rounded">public</code> 目錄，
              檔名建議：<code className="bg-slate-200 px-1 rounded">campus-plan.png</code>
              （或修改 <code className="bg-slate-200 px-1 rounded">CampusMap.tsx</code> 內的 CAMPUS_MAP_FILE）。
            </p>
            <p className="mt-2 text-xs text-slate-400">詳見 public/README-CAMPUS-MAP.txt</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={CAMPUS_MAP_FILE}
              alt="校園平面圖"
              className="max-w-full h-auto rounded-xl border border-slate-200 bg-slate-50"
              onError={() => setImgError(true)}
            />
          </div>
        )}
      </section>
    </div>
  );
};

export default CampusMap;
