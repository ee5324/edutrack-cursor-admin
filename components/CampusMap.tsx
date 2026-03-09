import React from 'react';
import { Building2, Compass, Info, MapPinned } from 'lucide-react';

type BuildingCard = {
  id: string;
  name: string;
  subtitle?: string;
  floors: string[];
  notes?: string[];
  className: string;
  tone?: 'amber' | 'blue' | 'emerald' | 'slate';
};

const BUILDINGS: BuildingCard[] = [
  {
    id: 'activity-center',
    name: '活動中心',
    subtitle: '2825',
    floors: ['1F 圖書館', '2F 幼兒園 / 教室', '3F 辦公 / 教室', '4F 專科教室', '5F 活動中心'],
    className: 'xl:col-span-3 xl:row-span-1',
    tone: 'amber',
  },
  {
    id: 'xing-guan',
    name: '行管樓',
    floors: ['主要教室群', '鄰近行政樓', '西側動線'],
    className: 'xl:col-span-2 xl:row-span-2',
    tone: 'blue',
  },
  {
    id: 'administration',
    name: '行政樓',
    subtitle: '含辦公室與教師空間',
    floors: ['1F 教務 / 地下室', '2F 輔導 / 校長室', '3F 會議 / 科任', '4F 行政辦公'],
    notes: ['中段樞紐建物', '連接行管樓與誠正樓動線'],
    className: 'xl:col-span-3 xl:row-span-2',
    tone: 'amber',
  },
  {
    id: 'jing-ye',
    name: '敬業樓',
    subtitle: '北側教室群',
    floors: ['1F~4F 一般教室', 'B1 地下空間', '近中庭'],
    className: 'xl:col-span-4 xl:row-span-1',
    tone: 'emerald',
  },
  {
    id: 'special-subject',
    name: '科任樓',
    floors: ['1F~4F 科任教室', '北側獨立量體'],
    className: 'xl:col-span-2 xl:row-span-1',
    tone: 'amber',
  },
  {
    id: 'cheng-zheng',
    name: '誠正樓',
    subtitle: '2834',
    floors: ['1F~4F 一般教室', 'B1 地下空間', '教室量體集中'],
    notes: ['位於校園中央偏東', '與知心樓南北相鄰'],
    className: 'xl:col-span-4 xl:row-span-2',
    tone: 'blue',
  },
  {
    id: 'zhi-xin',
    name: '知心樓',
    subtitle: '2833',
    floors: ['1F~4F 教室', 'B1 玩具圖書館 / 展示'],
    className: 'xl:col-span-4 xl:row-span-1',
    tone: 'emerald',
  },
  {
    id: 'office-strip',
    name: '辦公室 / 教師區',
    floors: ['導師辦公室', '科任教師列', '行政協作空間'],
    className: 'xl:col-span-3 xl:row-span-2',
    tone: 'slate',
  },
];

const toneClasses: Record<NonNullable<BuildingCard['tone']>, { card: string; label: string }> = {
  amber: {
    card: 'border-amber-200 bg-amber-50/80',
    label: 'bg-amber-300 text-amber-950',
  },
  blue: {
    card: 'border-sky-200 bg-sky-50/80',
    label: 'bg-sky-300 text-sky-950',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/80',
    label: 'bg-emerald-300 text-emerald-950',
  },
  slate: {
    card: 'border-slate-200 bg-slate-50/90',
    label: 'bg-slate-300 text-slate-950',
  },
};

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
            <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-slate-900">校園建物導覽</h2>
            <p className="mt-2 text-slate-600 leading-7">
              依照你提供的學校平面圖重新整理成數位版，將主要建物用區塊方式呈現，方便在系統內快速辨識位置與樓層分布。
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 max-w-md">
            <Info size={18} className="mt-0.5 flex-shrink-0 text-slate-500" />
            <p>目前先以主要建物與動線為主做直觀版重繪；若你要補每間教室、科任或電話分機，我可以再往下細化。</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Building2 size={18} />
            建物配置示意
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Compass size={16} />
            北向以上方為主
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 auto-rows-[minmax(180px,auto)]">
          {BUILDINGS.map((building) => {
            const tone = toneClasses[building.tone ?? 'amber'];
            return (
              <article
                key={building.id}
                className={`relative rounded-2xl border p-4 lg:p-5 shadow-sm ${tone.card} ${building.className}`}
              >
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${tone.label}`}>
                  {building.name}
                </div>
                {building.subtitle && (
                  <p className="mt-2 text-sm font-medium text-slate-700">{building.subtitle}</p>
                )}
                <div className="mt-4 space-y-2">
                  {building.floors.map((floor) => (
                    <div key={floor} className="rounded-lg bg-white/80 border border-white px-3 py-2 text-sm text-slate-700">
                      {floor}
                    </div>
                  ))}
                </div>
                {building.notes && (
                  <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                    {building.notes.map((note) => (
                      <p key={note}>• {note}</p>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900">快速定位建議</h3>
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
              北側以 <span className="font-semibold text-slate-900">敬業樓、科任樓、活動中心</span> 為主。
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
              中央軸線可先找 <span className="font-semibold text-slate-900">行政樓</span>，再往東西辨識各樓棟。
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
              東側主要教學量體為 <span className="font-semibold text-slate-900">誠正樓</span>。
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-700">
              南側可由 <span className="font-semibold text-slate-900">知心樓</span> 進行定位。
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900">說明</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600 leading-6">
            <p>此頁為系統內導覽版，重點放在建物辨識與相對位置，不是精密建築圖。</p>
            <p>如果你之後提供更清楚的掃描檔、原始平面圖 PDF 或希望補上各處室名稱，我可以再做成更完整的正式版。</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CampusMap;
