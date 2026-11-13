export const TELEGRAM_NAV = [
  { to: "/telegram", end: true, label: "Overview" },
  { to: "/telegram/chats", end: false, label: "Chats" },
  { to: "/telegram/docs", end: false, label: "Docs" },
  { to: "/telegram/bills", end: false, label: "Bills" },
  { to: "/telegram/payments", end: false, label: "Payments" },
  { to: "/telegram/alerts", end: false, label: "Alerts" },
  { to: "/telegram/log", end: false, label: "Log" },
  { to: "/telegram/setup", end: false, label: "Setup" },
] as const;
