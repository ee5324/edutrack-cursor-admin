import React from 'react';
import { Compass, ExternalLink, MapPinned, ZoomIn } from 'lucide-react';

const CampusMap: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
              <MapPinned size={16} />
              校園平面圖
            </div>
            <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-slate-900">校園平面圖重繪版</h2>
            <p className="mt-2 text-slate-600 leading-7">
              依照你提供的照片版面重新整理，保留原圖的建物相對位置、表格感與黃色樓名標籤，讓頁面看起來更接近平面圖原稿。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 max-w-md">
            <div className="flex items-center gap-2 font-medium text-slate-800">
              <ZoomIn size={16} />
              使用方式
            </div>
            <p className="mt-2">手機可雙指縮放，電腦可直接放大頁面觀看。若你之後要補每間教室名稱，我可以再做第二版精修。</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 overflow-auto">
        <div className="flex items-center justify-end mb-3">
          <a
            href="/campus-map-rendered.svg"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            <ExternalLink size={14} />
            另開大圖
          </a>
        </div>
        <div className="min-w-[980px]">
          <img
            src="/campus-map-rendered.svg"
            alt="校園平面圖重繪版"
            className="w-full h-auto rounded-xl border border-slate-200 bg-[#f9f9f7]"
          />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <Compass size={18} />
          目前版本說明
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          這一版已改成接近你照片原稿的平面圖形式，而不是資訊卡。若你下一步要我再精修成更像原圖，例如逐格補完整教室名稱、樓層代碼、或把字的位置再校準，我可以直接在這張圖上繼續微調。
        </p>
      </section>
    </div>
  );
};

export default CampusMap;
