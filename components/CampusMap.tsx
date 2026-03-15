import React, { useState } from 'react';
import { MapPinned, Building2, TreeDeciduous, ChevronDown, ChevronRight } from 'lucide-react';
import {
  CAMPUS_TITLE,
  BUILDINGS,
  OUTDOOR_AREAS,
  LEGEND_ITEMS,
  type BuildingPlan,
  type OutdoorArea,
} from '../data/campusPlan';

/**
 * 校園平面圖：依 114 學年平面圖以 SVG 重新繪製，可點選建築查看樓層與空間。
 */
const CampusMap: React.FC = () => {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingPlan | null>(null);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());

  const toggleFloor = (buildingId: string, floor: string) => {
    const key = `${buildingId}-${floor}`;
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** SVG 視圖框 0~100 對應百分比，留邊距後換算 */
  const viewBox = '0 0 100 100';
  const padding = 1;

  const buildingColor = (id: string) => {
    const palette: Record<string, string> = {
      'red-brick': '#c2410c',
      'xingshan': '#1e40af',
      'jingye': '#15803d',
      'chengzheng': '#a16207',
      'zhixin': '#7c3aed',
      'east-wing': '#0d9488',
    };
    return palette[id] ?? '#475569';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
          <MapPinned size={16} />
          校園平面圖
        </div>
        <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-slate-900">{CAMPUS_TITLE}</h2>
        <p className="mt-2 text-slate-600 leading-7">
          依 114.06.02 平面圖重新繪製。點選建築可查看樓層與室名；北側約在圖上方。
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG 平面圖 */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-auto">
          <div className="min-h-[420px] flex items-center justify-center">
            <svg
              viewBox={viewBox}
              className="w-full max-w-2xl h-auto border border-slate-200 rounded-xl bg-slate-50"
              style={{ aspectRatio: '1' }}
            >
              {/* 戶外區域 */}
              {OUTDOOR_AREAS.map((area) => (
                <g key={area.id}>
                  <rect
                    x={area.x + padding}
                    y={area.y + padding}
                    width={area.w - padding * 2}
                    height={area.h - padding * 2}
                    fill={area.id === 'road' ? '#e2e8f0' : area.name.includes('庭') || area.name.includes('場') || area.name.includes('園') ? '#dcfce7' : '#f1f5f9'}
                    stroke="#94a3b8"
                    strokeWidth="0.2"
                    rx="0.3"
                  />
                  {(area.h >= 6 && area.w >= 6) && (
                    <text
                      x={area.x + area.w / 2}
                      y={area.y + area.h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-slate-600"
                      style={{ fontSize: area.w > 10 ? 2.2 : 1.6 }}
                    >
                      {area.name.replace('（永續校園示範區）', '')}
                    </text>
                  )}
                </g>
              ))}

              {/* 建築物 */}
              {BUILDINGS.map((b) => (
                <g
                  key={b.id}
                  onClick={() => setSelectedBuilding(b)}
                  className="cursor-pointer"
                >
                  <rect
                    x={b.x + padding}
                    y={b.y + padding}
                    width={b.w - padding * 2}
                    height={b.h - padding * 2}
                    fill={buildingColor(b.id)}
                    fillOpacity={selectedBuilding?.id === b.id ? 1 : 0.85}
                    stroke={selectedBuilding?.id === b.id ? '#0f172a' : '#64748b'}
                    strokeWidth={selectedBuilding?.id === b.id ? 0.4 : 0.25}
                    rx="0.4"
                  />
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    style={{ fontSize: b.w > 14 ? 2.4 : 1.8, fontWeight: 600 }}
                  >
                    {b.name.split('（')[0]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <p className="mt-3 text-xs text-slate-500 text-center">點選建築可查看樓層與室名</p>
        </section>

        {/* 右側：選中建築之樓層與室名 */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-auto">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Building2 size={18} />
            建築與樓層
          </h3>
          {selectedBuilding ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">{selectedBuilding.name}</p>
              {selectedBuilding.note && (
                <p className="text-xs text-slate-500">{selectedBuilding.note}</p>
              )}
              <div className="space-y-1">
                {selectedBuilding.floors.map((f) => {
                  const key = `${selectedBuilding.id}-${f.floor}`;
                  const open = expandedFloors.has(key);
                  return (
                    <div key={f.floor} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleFloor(selectedBuilding.id, f.floor)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left text-sm font-medium text-slate-800"
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {f.label}（{f.floor}）
                      </button>
                      {open && (
                        <ul className="px-3 py-2 bg-white text-slate-600 text-sm flex flex-wrap gap-1.5 list-none">
                          {f.rooms.map((r, i) => (
                            <li key={i} className="px-2 py-0.5 rounded bg-slate-100">
                              {r.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">請在左側平面圖點選建築</p>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
              <TreeDeciduous size={12} />
              前庭廣場內
            </h4>
            <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
              {LEGEND_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CampusMap;
