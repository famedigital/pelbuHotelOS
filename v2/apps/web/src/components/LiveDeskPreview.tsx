import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bed,
  CheckCircle2,
  Clock,
  Coffee,
  CreditCard,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  MoonStar,
  Receipt,
  Search,
  ShieldCheck,
  Sun,
  Truck,
  Users,
  UtensilsCrossed,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Smartphone,
  Compass,
} from "lucide-react";
import { InnoraLogo } from "@hos-v2/ui";

type PreviewMode = "desk" | "stayview" | "audit" | "guide" | "driver" | "kds";
type DeskFilter = "arrivals" | "inHouse" | "departures";

export function LiveDeskPreview() {
  const [mode, setMode] = useState<PreviewMode>("desk");
  const [theme, setTheme] = useState<"midnight" | "light">("midnight");
  const [deskFilter, setDeskFilter] = useState<DeskFilter>("arrivals");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const triggerAction = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3200);
  };

  const isDark = theme === "midnight";

  return (
    <div className={`preview-container ${isDark ? "dark-theme" : "light-theme"}`}>
      {/* Top Chrome Toolbar */}
      <div className="preview-topbar">
        <div className="preview-topbar-left">
          <div className="window-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <div className="preview-hotel-badge">
            <InnoraLogo size="sm" variant={isDark ? "sovereign" : "platinum"} showText={false} />
            <div className="hotel-title-group">
              <span className="hotel-name">Pelbu Suites</span>
              <span className="hotel-stars">★★★★</span>
              <span className="hotel-sub">Paro Valley · desk.innorahotel.com</span>
            </div>
          </div>
        </div>

        <div className="preview-mode-tabs">
          <button
            type="button"
            className={`mode-tab ${mode === "desk" ? "active" : ""}`}
            onClick={() => setMode("desk")}
          >
            <LayoutGrid className="size-3.5" />
            <span>Desk Cockpit</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "stayview" ? "active" : ""}`}
            onClick={() => setMode("stayview")}
          >
            <Bed className="size-3.5" />
            <span>StayView Rack</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "audit" ? "active" : ""}`}
            onClick={() => setMode("audit")}
          >
            <ShieldCheck className="size-3.5" />
            <span>Night Audit</span>
            <span className="tab-pill-ready">96%</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "guide" ? "active" : ""}`}
            onClick={() => setMode("guide")}
          >
            <Compass className="size-3.5" />
            <span>Guide PWA</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "driver" ? "active" : ""}`}
            onClick={() => setMode("driver")}
          >
            <Truck className="size-3.5" />
            <span>Driver Hub</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "kds" ? "active" : ""}`}
            onClick={() => setMode("kds")}
          >
            <UtensilsCrossed className="size-3.5" />
            <span>Kitchen KDS</span>
          </button>
        </div>

        <div className="preview-topbar-right">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(isDark ? "light" : "midnight")}
            title={`Switch to ${isDark ? "Light" : "Midnight"} Glass`}
          >
            {isDark ? <Sun className="size-3.5 text-amber-400" /> : <MoonStar className="size-3.5 text-slate-700" />}
            <span className="theme-toggle-label">{isDark ? "Midnight" : "Light"}</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="preview-canvas">
        <AnimatePresence mode="wait">
          {mode === "desk" && (
            <motion.div
              key="desk"
              className="desk-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* Desk Mission Bar */}
              <div className="desk-subbar">
                <div className="desk-filters">
                  <button
                    type="button"
                    className={`filter-btn ${deskFilter === "arrivals" ? "active" : ""}`}
                    onClick={() => setDeskFilter("arrivals")}
                  >
                    <span>Arrivals</span>
                    <span className="counter-chip">3</span>
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${deskFilter === "inHouse" ? "active" : ""}`}
                    onClick={() => setDeskFilter("inHouse")}
                  >
                    <span>In-House</span>
                    <span className="counter-chip counter-cyan">18</span>
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${deskFilter === "departures" ? "active" : ""}`}
                    onClick={() => setDeskFilter("departures")}
                  >
                    <span>Departures</span>
                    <span className="counter-chip counter-amber">5</span>
                  </button>
                </div>

                <div className="desk-metrics">
                  <div className="metric-cell">
                    <span className="metric-label">Occupancy</span>
                    <span className="metric-val text-emerald-400">82% (24/30)</span>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Till Vault</span>
                    <span className="metric-val text-amber-300 font-mono">Nu. 48,250</span>
                  </div>
                  <div className="metric-cell">
                    <span className="metric-label">Biz Date</span>
                    <span className="metric-val font-mono">30 Sep 2026</span>
                  </div>
                  <div className="metric-cell hidden-sm">
                    <span className="metric-label">Live Sync</span>
                    <span className="metric-val text-emerald-400 font-mono">14ms · Ultra</span>
                  </div>
                </div>
              </div>

              {/* Meal Board Notice Banner */}
              <div className="meal-mission-banner">
                <div className="meal-tag">
                  <Coffee className="size-4 text-amber-400" />
                  <strong>Tiger's Nest Mission:</strong>
                  <span>14 Pack Breakfasts queued for 06:00 AM (Kitchen Tagged · Dorji Tshering Guide)</span>
                </div>
                <button
                  type="button"
                  className="quick-action-link"
                  onClick={() => triggerAction("14 Tiger's Nest packed breakfasts confirmed with Executive Chef!")}
                >
                  Confirm Pass →
                </button>
              </div>

              {/* Dynamic Guest Ledger Cards */}
              <div className="guest-cards-grid">
                {deskFilter === "arrivals" && (
                  <>
                    <div className="guest-card">
                      <div className="guest-card-header">
                        <div className="guest-name-row">
                          <span className="country-flag">🇧🇹</span>
                          <strong className="guest-name">Tenzin Norbu & Group (8 Pax)</strong>
                          <span className="badge-agent">Yangphel Adventure</span>
                        </div>
                        <span className="room-pill">Room 204 · Deluxe Mountain</span>
                      </div>
                      <div className="guest-card-body">
                        <div className="guest-meta-grid">
                          <div>
                            <span className="meta-k">Dates:</span> 30 Sep – 03 Oct (3 Nts)
                          </div>
                          <div>
                            <span className="meta-k">Plan:</span> MAP (Breakfast + Dinner)
                          </div>
                          <div>
                            <span className="meta-k">Guide:</span> Dorji Tshering (#G-4428)
                          </div>
                          <div>
                            <span className="meta-k">Folio:</span>{" "}
                            <span className="text-emerald-400 font-mono font-bold">Nu. 0.00 Balanced</span>
                          </div>
                        </div>
                      </div>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="action-btn btn-primary"
                          onClick={() => triggerAction("Checked in Room 204! RFID Keycard cut & guide notified.")}
                        >
                          <KeyRound className="size-3.5" />
                          <span>Check In (1-Tap)</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("StayHub Master Folio opened: Nu. 216,000 corporate voucher linked.")}
                        >
                          <Receipt className="size-3.5" />
                          <span>StayHub Folio</span>
                        </button>
                      </div>
                    </div>

                    <div className="guest-card">
                      <div className="guest-card-header">
                        <div className="guest-name-row">
                          <span className="country-flag">🇺🇸</span>
                          <strong className="guest-name">Dr. Marcus & Eleanor Vance</strong>
                          <span className="badge-agent">Druk Asia</span>
                        </div>
                        <span className="room-pill">Room 301 · Valley Vista Suite</span>
                      </div>
                      <div className="guest-card-body">
                        <div className="guest-meta-grid">
                          <div>
                            <span className="meta-k">Flight:</span> KB-402 (PBH Landed 13:45)
                          </div>
                          <div>
                            <span className="meta-k">Plan:</span> AP (All Meals)
                          </div>
                          <div>
                            <span className="meta-k">Special:</span> Tiger's Nest Early Breakfast
                          </div>
                          <div>
                            <span className="meta-k">Folio:</span>{" "}
                            <span className="text-emerald-400 font-mono font-bold">Nu. 0.00 Pre-settled</span>
                          </div>
                        </div>
                      </div>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="action-btn btn-primary"
                          onClick={() => triggerAction("Room 301 assigned! Welcome ginger tea chime dispatched to lobby.")}
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Fast Check-In</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("DRC Police Immigration manifest exported for Dr. Marcus Vance.")}
                        >
                          <FileCheck2 className="size-3.5" />
                          <span>RBP Manifest</span>
                        </button>
                      </div>
                    </div>

                    <div className="guest-card">
                      <div className="guest-card-header">
                        <div className="guest-name-row">
                          <span className="country-flag">🇯🇵</span>
                          <strong className="guest-name">Kenji & Aoi Sato</strong>
                          <span className="badge-agent">Direct Booking</span>
                        </div>
                        <span className="room-pill">Room 105 · Ground Garden</span>
                      </div>
                      <div className="guest-card-body">
                        <div className="guest-meta-grid">
                          <div>
                            <span className="meta-k">ETA:</span> 16:30 (Dochula drive)
                          </div>
                          <div>
                            <span className="meta-k">Plan:</span> CP (Bed & Breakfast)
                          </div>
                          <div>
                            <span className="meta-k">Extra Bed:</span> Rollaway Confirmed
                          </div>
                          <div>
                            <span className="meta-k">Security Deposit:</span>{" "}
                            <span className="text-amber-400 font-mono">Nu. 5,000 Hold</span>
                          </div>
                        </div>
                      </div>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="action-btn btn-primary"
                          onClick={() => triggerAction("Room 105 ready! Rollaway bed inspected by Housekeeping.")}
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Ready for Arrival</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("Credit pre-auth sent to guest phone.")}
                        >
                          <CreditCard className="size-3.5" />
                          <span>Pre-Auth Gate</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {deskFilter === "inHouse" && (
                  <>
                    <div className="guest-card">
                      <div className="guest-card-header">
                        <div className="guest-name-row">
                          <span className="country-flag">🇩🇪</span>
                          <strong className="guest-name">Helmut & Gertrude Weber</strong>
                          <span className="badge-agent">Blue Poppy Tours</span>
                        </div>
                        <span className="room-pill">Room 202 · Heritage Balcony</span>
                      </div>
                      <div className="guest-card-body">
                        <div className="guest-meta-grid">
                          <div>
                            <span className="meta-k">Stay:</span> Night 2 of 4
                          </div>
                          <div>
                            <span className="meta-k">Plan:</span> MAP
                          </div>
                          <div>
                            <span className="meta-k">Bar Charges:</span> Nu. 1,450 (KOT #108)
                          </div>
                          <div>
                            <span className="meta-k">Personal Folio:</span>{" "}
                            <span className="text-amber-400 font-mono font-bold">Nu. 1,450 Due</span>
                          </div>
                        </div>
                      </div>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("Room 202 Post-charge drawer: Red Rice + Ara flight added.")}
                        >
                          <UtensilsCrossed className="size-3.5" />
                          <span>Charge KOT</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("StayHub Split-Folio: Room on Agent, Mini-bar on Personal.")}
                        >
                          <Receipt className="size-3.5" />
                          <span>Dual-Folio Gate</span>
                        </button>
                      </div>
                    </div>

                    <div className="guest-card">
                      <div className="guest-card-header">
                        <div className="guest-name-row">
                          <span className="country-flag">🇬🇧</span>
                          <strong className="guest-name">Lord Arthur Pendelton</strong>
                          <span className="badge-agent">VIP Luxury Tailored</span>
                        </div>
                        <span className="room-pill">Room 304 · Royal Suite</span>
                      </div>
                      <div className="guest-card-body">
                        <div className="guest-meta-grid">
                          <div>
                            <span className="meta-k">Stay:</span> Night 3 of 5
                          </div>
                          <div>
                            <span className="meta-k">Plan:</span> AP + Butler Service
                          </div>
                          <div>
                            <span className="meta-k">Laundry:</span> 6 Items Returned Clean
                          </div>
                          <div>
                            <span className="meta-k">Personal Folio:</span>{" "}
                            <span className="text-emerald-400 font-mono font-bold">Nu. 0.00 Settled</span>
                          </div>
                        </div>
                      </div>
                      <div className="guest-card-actions">
                        <button
                          type="button"
                          className="action-btn btn-secondary"
                          onClick={() => triggerAction("Royal Suite butler request logged.")}
                        >
                          <Sparkles className="size-3.5" />
                          <span>VIP Service</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {deskFilter === "departures" && (
                  <div className="guest-card">
                    <div className="guest-card-header">
                      <div className="guest-name-row">
                        <span className="country-flag">🇸🇬</span>
                        <strong className="guest-name">Tan Wei Ming & Family</strong>
                        <span className="badge-agent">Bhutan Travel Club</span>
                      </div>
                      <span className="room-pill">Room 104 · Ground Deluxe</span>
                    </div>
                    <div className="guest-card-body">
                      <div className="guest-meta-grid">
                        <div>
                          <span className="meta-k">Departure:</span> 11:30 AM (PBH Flight)
                        </div>
                        <div>
                          <span className="meta-k">Master Folio:</span> Nu. 84,000 (Agent Voucher)
                        </div>
                        <div>
                          <span className="meta-k">Personal Incidentals:</span>{" "}
                          <span className="text-emerald-400 font-mono font-bold">Nu. 0.00 (Zero Drift)</span>
                        </div>
                        <div>
                          <span className="meta-k">DRC BST-3 Tax:</span> Gapless PSBN-2026-0922
                        </div>
                      </div>
                    </div>
                    <div className="guest-card-actions">
                      <button
                        type="button"
                        className="action-btn btn-primary"
                        onClick={() => triggerAction("Room 104 checked out! Room released to Housekeeping as 'Dirty'.")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Settle & Check Out (Nu. 0.00)</span>
                      </button>
                      <button
                        type="button"
                        className="action-btn btn-secondary"
                        onClick={() => triggerAction("Official DRC BST-3 Tax Invoice printed with gapless QR.")}
                      >
                        <FileCheck2 className="size-3.5" />
                        <span>Print BST-3 Bill</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === "stayview" && (
            <motion.div
              key="stayview"
              className="stayview-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="stayview-header">
                <div>
                  <h4 className="stayview-title">Room Rack & Visual Tape Chart</h4>
                  <p className="stayview-desc">
                    30 Rooms · Real-time visual status, booking ribbons, and housekeeping sync across 3 floors.
                  </p>
                </div>
                <div className="stayview-legend">
                  <span className="legend-item"><span className="legend-dot bg-emerald-500" /> Clean (18)</span>
                  <span className="legend-item"><span className="legend-dot bg-amber-500" /> Dirty (6)</span>
                  <span className="legend-item"><span className="legend-dot bg-cyan-500" /> Occupied (24)</span>
                  <span className="legend-item"><span className="legend-dot bg-rose-500" /> OOO (2)</span>
                </div>
              </div>

              <div className="rack-grid">
                {/* Floor 3 */}
                <div className="rack-floor">
                  <div className="floor-label">Floor 3 · Panoramic Mountain Suites</div>
                  <div className="rooms-row">
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 301 · Dr. Marcus Vance (Druk Asia)")}>
                      <span className="room-num">301</span>
                      <span className="room-guest">M. Vance · Druk Asia</span>
                      <span className="room-badge badge-map">AP</span>
                    </div>
                    <div className="room-tile clean" onClick={() => triggerAction("Room 302 is clean & inspected!")}>
                      <span className="room-num">302</span>
                      <span className="room-guest text-emerald-400">Available</span>
                      <span className="room-badge">Clean</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 303 · Tenzin Norbu (Yangphel)")}>
                      <span className="room-num">303</span>
                      <span className="room-guest">T. Norbu · Yangphel</span>
                      <span className="room-badge badge-map">MAP</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 304 · Lord Arthur (Royal Suite)")}>
                      <span className="room-num">304</span>
                      <span className="room-guest">A. Pendelton (VIP)</span>
                      <span className="room-badge badge-vip">VIP</span>
                    </div>
                  </div>
                </div>

                {/* Floor 2 */}
                <div className="rack-floor">
                  <div className="floor-label">Floor 2 · Heritage Deluxe</div>
                  <div className="rooms-row">
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 201 · H. Weber (Blue Poppy)")}>
                      <span className="room-num">201</span>
                      <span className="room-guest">H. Weber · Blue Poppy</span>
                      <span className="room-badge badge-map">MAP</span>
                    </div>
                    <div className="room-tile dirty" onClick={() => triggerAction("Room 202 flagged for priority housekeeping.")}>
                      <span className="room-num">202</span>
                      <span className="room-guest text-amber-400">Cleaning Required</span>
                      <span className="room-badge badge-dirty">Dirty</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 203 · K. Sato (Direct)")}>
                      <span className="room-num">203</span>
                      <span className="room-guest">K. Sato · Direct</span>
                      <span className="room-badge">CP</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 204 · Yangphel Tour Group Leader")}>
                      <span className="room-num">204</span>
                      <span className="room-guest">Yangphel Group #1</span>
                      <span className="room-badge badge-map">MAP</span>
                    </div>
                  </div>
                </div>

                {/* Floor 1 */}
                <div className="rack-floor">
                  <div className="floor-label">Floor 1 · Garden & Courtyard</div>
                  <div className="rooms-row">
                    <div className="room-tile clean" onClick={() => triggerAction("Room 101 · Inspected & ready.")}>
                      <span className="room-num">101</span>
                      <span className="room-guest text-emerald-400">Available</span>
                      <span className="room-badge">Clean</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 102 · Druk Asia Family")}>
                      <span className="room-num">102</span>
                      <span className="room-guest">Druk Asia Fam</span>
                      <span className="room-badge">EP</span>
                    </div>
                    <div className="room-tile ooo" onClick={() => triggerAction("Room 103 under annual timber polish.")}>
                      <span className="room-num">103</span>
                      <span className="room-guest text-rose-400">Timber Polish</span>
                      <span className="room-badge badge-ooo">OOO</span>
                    </div>
                    <div className="room-tile occupied" onClick={() => triggerAction("Room 104 · Settle folio on departure.")}>
                      <span className="room-num">104</span>
                      <span className="room-guest">T. Wei Ming</span>
                      <span className="room-badge">MAP</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "audit" && (
            <motion.div
              key="audit"
              className="audit-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="audit-header">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-emerald-400" />
                    <h4 className="audit-title">Automated Night Audit Cockpit</h4>
                  </div>
                  <p className="audit-desc">
                    Zero-rounding fiscal roll, DRC BST-3 tax closure, and gapless PSBN voucher generation in 1 tap.
                  </p>
                </div>
                <div className="audit-score-card">
                  <span className="score-val">96%</span>
                  <span className="score-label">Readiness Score</span>
                </div>
              </div>

              <div className="audit-gates-list">
                <div className="gate-row passed">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <div className="gate-text">
                    <strong>Gate 1: Room Assignment Integrity</strong>
                    <span>All 24 in-house stays have verified room keys & registered guest passports.</span>
                  </div>
                  <span className="gate-status text-emerald-400">PASSED</span>
                </div>

                <div className="gate-row passed">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <div className="gate-text">
                    <strong>Gate 2: Departures Settlement</strong>
                    <span>5 of 5 today's departures checked out with zero personal folio drift (≤ Nu. 0.50).</span>
                  </div>
                  <span className="gate-status text-emerald-400">SETTLED</span>
                </div>

                <div className="gate-row passed">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <div className="gate-text">
                    <strong>Gate 3: Cashier Till Reconciliation</strong>
                    <span>Physical drawer cash Nu. 32,500 matches ledger shift balance perfectly.</span>
                  </div>
                  <span className="gate-status text-emerald-400">RECONCILED</span>
                </div>

                <div className="gate-row passed">
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  <div className="gate-text">
                    <strong>Gate 4: DRC BST-3 Tax Posting</strong>
                    <span>10% Service Charge + 5% Bhutan Sales Tax computed on Nu. 184,200 net yield.</span>
                  </div>
                  <span className="gate-status text-emerald-400">LOCKED</span>
                </div>

                <div className="gate-row warning">
                  <AlertCircle className="size-4 text-amber-400 shrink-0" />
                  <div className="gate-text">
                    <strong>Gate 5: Room 202 Mini-Bar Verification</strong>
                    <span>Unposted Nu. 450 Apple juice check in progress with Housekeeping.</span>
                  </div>
                  <span className="gate-status text-amber-400">AUTO-RESOLVE</span>
                </div>
              </div>

              <div className="audit-action-bar">
                <button
                  type="button"
                  className="execute-audit-btn"
                  onClick={() => triggerAction("Night audit completed! Business date rolled to 01 Oct 2026. DRC report sent to GM email.")}
                >
                  <MoonStar className="size-4" />
                  <span>Execute Night Audit & Roll Date to 01 Oct 2026</span>
                </button>
              </div>
            </motion.div>
          )}

          {mode === "guide" && (
            <motion.div
              key="guide"
              className="companion-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mobile-mockup-frame">
                <div className="mobile-screen">
                  <div className="mobile-header">
                    <Compass className="size-4 text-amber-400" />
                    <strong>Guide Companion PWA</strong>
                    <span className="text-[11px] text-zinc-400">License #G-4428</span>
                  </div>

                  <div className="mobile-body">
                    <div className="group-active-card">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wide">Active Tour Group</span>
                          <h5 className="font-bold text-[15px] m-0">Yangphel 8-Pax Paro Expedition</h5>
                        </div>
                        <span className="badge-agent">In-House</span>
                      </div>
                      <p className="text-[12px] text-zinc-400 mt-1 mb-0">Rooms 204, 301, 303 · Check-out 03 Oct</p>
                    </div>

                    <div className="companion-action-box">
                      <strong className="text-[13px] flex items-center gap-1.5 text-zinc-100">
                        <Coffee className="size-3.5 text-amber-400" />
                        Tiger's Nest Breakfast Dispatch
                      </strong>
                      <p className="text-[12px] text-zinc-400 my-1">
                        Hike departure at 06:15 AM. 8 vegetarian sandwich boxes + boiled eggs + ginger honey flasks.
                      </p>
                      <button
                        type="button"
                        className="companion-btn"
                        onClick={() => triggerAction("14 Box breakfasts dispatched directly to KDS pass for 05:45 AM!")}
                      >
                        Dispatch 8 Box Breakfasts to Kitchen →
                      </button>
                    </div>

                    <div className="companion-dietary-row">
                      <span className="dietary-pill">3x Jain Pure Veg</span>
                      <span className="dietary-pill">1x Gluten Free</span>
                      <span className="dietary-pill">4x Standard Non-Veg</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="companion-explainer">
                <h4 className="text-[18px] font-bold mb-2">No more lost WhatsApp voice notes.</h4>
                <p className="text-[14px] text-zinc-400 leading-relaxed mb-4">
                  Bhutanese tour guides can never find the front desk phone at 9:00 PM when guests ask for early Tiger's Nest packed meals.
                  With Innora's dedicated Guide Companion, licensed guides submit breakfast packs, dietary tags, and coaster bus bay requirements straight to the hotel ledger.
                </p>
                <div className="feature-bullets">
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Real-time dietary matrix synced directly to chef's KDS screen.</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>No front desk staff phone calls or forgotten whiteboard notes.</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Works offline across Chele La and Dochula mountain passes.</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "driver" && (
            <motion.div
              key="driver"
              className="companion-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mobile-mockup-frame">
                <div className="mobile-screen">
                  <div className="mobile-header">
                    <Truck className="size-4 text-cyan-400" />
                    <strong>Fleet Driver Hub PWA</strong>
                    <span className="text-[11px] text-zinc-400">Toyota Coaster</span>
                  </div>

                  <div className="mobile-body">
                    <div className="driver-profile-card">
                      <strong className="text-[14px]">Karma Wangdi</strong>
                      <span className="text-[12px] text-zinc-400">Vehicle: BP-1-A2045 (22-Seater Coaster)</span>
                    </div>

                    <div className="driver-assignment-grid">
                      <div className="assignment-tile">
                        <span className="tile-k">Driver Dorm Bed</span>
                        <strong className="tile-v text-emerald-400">Bed B-02 (Wing C)</strong>
                        <span className="text-[10px] text-zinc-400">Clean linens · Key #14</span>
                      </div>
                      <div className="assignment-tile">
                        <span className="tile-k">Bus Bay Parking</span>
                        <strong className="tile-v text-cyan-400">Bay #3 (Courtyard)</strong>
                        <span className="text-[10px] text-zinc-400">Plug-in heater ready</span>
                      </div>
                    </div>

                    <div className="companion-action-box">
                      <strong className="text-[13px] text-zinc-100">Dochula Diesel Cash Advance</strong>
                      <p className="text-[12px] text-zinc-400 my-1">
                        Advance Nu. 3,500 for mountain pass refuel charged to Yangphel Corporate Ledger.
                      </p>
                      <button
                        type="button"
                        className="companion-btn"
                        onClick={() => triggerAction("Nu. 3,500 fuel advance approved from Desk Cashier Vault!")}
                      >
                        Request Cash Advance →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="companion-explainer">
                <h4 className="text-[18px] font-bold mb-2">Driver bed chaos solved forever.</h4>
                <p className="text-[14px] text-zinc-400 leading-relaxed mb-4">
                  In peak festival season, drivers sleeping in coaster buses or arguing over dorm bunks ruins the luxury guest experience.
                  Innora explicitly manages driver dorm beds, coaster bus parking slots, and fuel advances as first-class citizens in the hotel ledger.
                </p>
                <div className="feature-bullets">
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Every coaster driver gets a clean bed and assigned parking bay before arrival.</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Diesel and road cash advances linked directly to Tour Operator folios.</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "kds" && (
            <motion.div
              key="kds"
              className="kds-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="kds-header">
                <div>
                  <h4 className="kds-title">KDS · Kitchen Display Screen</h4>
                  <p className="kds-desc">Sub-frame live order chimes, allergen tags, and packed breakfast counters.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="kds-status-pill">
                    <span className="live-ping" />
                    Live Ticket Pass: 3 Active
                  </span>
                </div>
              </div>

              <div className="kds-tickets-grid">
                <div className="kds-ticket urgent">
                  <div className="ticket-top">
                    <span className="ticket-num">TICKET #104</span>
                    <span className="ticket-time urgent">06:00 AM RUSH</span>
                  </div>
                  <div className="ticket-dest">TIGER'S NEST EXPEDITION (Guide: Dorji)</div>
                  <div className="ticket-items">
                    <div className="ticket-item">
                      <span className="qty">14x</span>
                      <span className="item-name">Packed Box Breakfast</span>
                    </div>
                    <div className="ticket-sub">8x Veg Club, 6x Yak Cheese & Egg, 14x Apple, 14x Juice</div>
                  </div>
                  <button
                    type="button"
                    className="ticket-btn"
                    onClick={() => triggerAction("Ticket #104 marked Packed & Ready at Front Desk!")}
                  >
                    Mark 14 Boxes Ready
                  </button>
                </div>

                <div className="kds-ticket">
                  <div className="ticket-top">
                    <span className="ticket-num">TICKET #105</span>
                    <span className="ticket-time">12 min ago</span>
                  </div>
                  <div className="ticket-dest">ROOM 204 · DINING PASS</div>
                  <div className="ticket-items">
                    <div className="ticket-item">
                      <span className="qty">2x</span>
                      <span className="item-name">Traditional Ema Datshi</span>
                    </div>
                    <div className="ticket-item">
                      <span className="qty">1x</span>
                      <span className="item-name">Paro Red Rice Platter</span>
                    </div>
                    <div className="ticket-item">
                      <span className="qty">2x</span>
                      <span className="item-name">Suja (Butter Tea)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ticket-btn"
                    onClick={() => triggerAction("Ticket #105 dispatched to Service Waiter for Room 204!")}
                  >
                    Pass to Waiter
                  </button>
                </div>

                <div className="kds-ticket">
                  <div className="ticket-top">
                    <span className="ticket-num">TICKET #106</span>
                    <span className="ticket-time">4 min ago</span>
                  </div>
                  <div className="ticket-dest">COURTYARD LOUNGE · BAR</div>
                  <div className="ticket-items">
                    <div className="ticket-item">
                      <span className="qty">2x</span>
                      <span className="item-name">Druk 11000 Premium Craft</span>
                    </div>
                    <div className="ticket-item">
                      <span className="qty">1x</span>
                      <span className="item-name">Warm Ara with Butter</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ticket-btn"
                    onClick={() => triggerAction("Bar ticket #106 served! Auto-billed to Lounge Folio.")}
                  >
                    Served & Billed
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Notice Toast */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            className="preview-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <Sparkles className="size-4 text-amber-300" />
            <span>{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
