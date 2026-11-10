import { useState, useMemo } from "react";
import { Calculator, CheckCircle2, DollarSign, Sparkles, TrendingUp, Zap } from "lucide-react";

export function RoiCalculator() {
  const [rooms, setRooms] = useState(28);
  const [occupancy, setOccupancy] = useState(72);
  const [peakMonths, setPeakMonths] = useState(4);

  const stats = useMemo(() => {
    // Average daily room nights per month
    const totalRoomNightsMonthly = rooms * (occupancy / 100) * 30;
    
    // Financial leakage calculation:
    // ~Nu. 450 per occupied room night in missed incidentals, unbilled laundry, lost rollaway charges, and rounding drifts
    const monthlyLeakagePrevented = Math.round(totalRoomNightsMonthly * 420);
    const annualLeakagePrevented = monthlyLeakagePrevented * 12;

    // Staff hours saved per month:
    // Manual night audit (~2.5 hrs/night = 75 hrs/mo) + manual check-in admin (10 min vs 1 min per arrival)
    const arrivalsMonthly = totalRoomNightsMonthly / 2.2; // avg stay 2.2 nights
    const checkinHoursSaved = Math.round((arrivalsMonthly * 9) / 60);
    const auditHoursSaved = 68; // ~2.2 hours saved every night
    const totalHoursSavedMonthly = checkinHoursSaved + auditHoursSaved;

    // DRC Tax filing speed:
    // Saves 2.5 days of manual bookkeeper reconciliation every month
    const taxReconDaysSaved = 2.5;

    return {
      monthlyLeakage: monthlyLeakagePrevented,
      annualLeakage: annualLeakagePrevented,
      hoursSavedMonthly: totalHoursSavedMonthly,
      taxDaysSaved: taxReconDaysSaved,
      checkinSpeedup: "12 min → 8 sec",
    };
  }, [rooms, occupancy, peakMonths]);

  return (
    <div className="roi-calculator-card">
      <div className="roi-header">
        <div className="flex items-center gap-2">
          <Calculator className="size-5 text-amber-400" />
          <h3 className="roi-title">Himalayan Hospitality Yield & Leakage Calculator</h3>
        </div>
        <p className="roi-subtitle">
          See exactly how much revenue leakage, manual audit time, and front-desk friction Innora eliminates for your property.
        </p>
      </div>

      <div className="roi-layout">
        {/* Sliders Side */}
        <div className="roi-sliders">
          <div className="slider-group">
            <div className="slider-label-row">
              <span className="slider-label">Property Keys / Rooms</span>
              <span className="slider-val text-amber-400 font-mono font-bold">{rooms} Rooms</span>
            </div>
            <input
              type="range"
              min="8"
              max="120"
              step="2"
              value={rooms}
              onChange={(e) => setRooms(Number(e.target.value))}
              className="roi-range"
            />
            <div className="slider-scale">
              <span>8 Boutique</span>
              <span>30 Mid-Scale</span>
              <span>60 Resort</span>
              <span>120 Flagship</span>
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-label-row">
              <span className="slider-label">Average Seasonal Occupancy</span>
              <span className="slider-val text-cyan-400 font-mono font-bold">{occupancy}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="95"
              step="5"
              value={occupancy}
              onChange={(e) => setOccupancy(Number(e.target.value))}
              className="roi-range"
            />
            <div className="slider-scale">
              <span>20% Low Season</span>
              <span>50% Shoulder</span>
              <span>75% High Season</span>
              <span>95% Tshechu Peak</span>
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-label-row">
              <span className="slider-label">Festival Peak Months per Year</span>
              <span className="slider-val text-emerald-400 font-mono font-bold">{peakMonths} Months</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={peakMonths}
              onChange={(e) => setPeakMonths(Number(e.target.value))}
              className="roi-range"
            />
            <div className="slider-scale">
              <span>1 Mo</span>
              <span>2 Mos</span>
              <span>4 Mos (Spring/Fall)</span>
              <span>6 Mos</span>
            </div>
          </div>
        </div>

        {/* Dynamic ROI Metrics Output */}
        <div className="roi-results-board">
          <div className="roi-kpi-main">
            <span className="kpi-kicker">Annual Financial Leakage Prevented</span>
            <div className="kpi-number text-emerald-400 font-mono">
              Nu. {stats.annualLeakage.toLocaleString()}
            </div>
            <span className="kpi-sub">
              Eliminating uncollected incidentals, unbilled rollaways, and dual-folio checkout disputes.
            </span>
          </div>

          <div className="roi-kpi-grid">
            <div className="roi-cell">
              <span className="cell-num text-amber-300 font-mono">{stats.hoursSavedMonthly} hrs</span>
              <span className="cell-label">Monthly Staff Hours Saved</span>
            </div>
            <div className="roi-cell">
              <span className="cell-num text-cyan-300 font-mono">{stats.checkinSpeedup}</span>
              <span className="cell-label">Group Check-In Acceleration</span>
            </div>
            <div className="roi-cell">
              <span className="cell-num text-emerald-300 font-mono">{stats.taxDaysSaved} Days</span>
              <span className="cell-label">DRC BST-3 Month-End Saved</span>
            </div>
            <div className="roi-cell">
              <span className="cell-num text-purple-300 font-mono">1 Tap</span>
              <span className="cell-label">Automated Night Audit Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
