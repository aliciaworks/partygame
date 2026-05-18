export type RoomStatus = "healthy" | "warning" | "critical";

export type RoomRecord = {
  name: string;
  region: string;
  players: number;
  maxPlayers: number;
  tick: string;
  ping: string;
  status: RoomStatus;
  antiCheat: string;
};

export type MetricCard = {
  label: string;
  value: string;
  delta: string;
  detail: string;
};

export type AlertRecord = {
  title: string;
  body: string;
  tone: "danger" | "warning" | "info";
};

export type EventRecord = {
  time: string;
  title: string;
  detail: string;
};

export const metrics: MetricCard[] = [
  {
    label: "Active rooms",
    value: "128",
    delta: "+12%",
    detail: "Across 4 edge regions",
  },
  {
    label: "Players online",
    value: "1,842",
    delta: "+146",
    detail: "Peak concurrency in the last hour",
  },
  {
    label: "Cheat blocks",
    value: "38",
    delta: "+9",
    detail: "Movement, replay, and purchase rejections",
  },
  {
    label: "Auth success",
    value: "99.7%",
    delta: "-0.1%",
    detail: "Native token verification and refresh",
  },
];

export const rooms: RoomRecord[] = [
  {
    name: "rift-echo",
    region: "iad",
    players: 14,
    maxPlayers: 20,
    tick: "20 Hz",
    ping: "48 ms",
    status: "healthy",
    antiCheat: "0 violations",
  },
  {
    name: "golden-arcade",
    region: "fra",
    players: 19,
    maxPlayers: 20,
    tick: "20 Hz",
    ping: "62 ms",
    status: "warning",
    antiCheat: "2 rubberbands",
  },
  {
    name: "night-market",
    region: "sin",
    players: 7,
    maxPlayers: 12,
    tick: "20 Hz",
    ping: "39 ms",
    status: "healthy",
    antiCheat: "1 replay reject",
  },
  {
    name: "last-lobby",
    region: "sfo",
    players: 18,
    maxPlayers: 18,
    tick: "18 Hz",
    ping: "91 ms",
    status: "critical",
    antiCheat: "5 invalid moves",
  },
];

export const alerts: AlertRecord[] = [
  {
    title: "Replay pattern detected",
    body: "Three purchase requests reused the same idempotency key from the same device fingerprint.",
    tone: "danger",
  },
  {
    title: "Rate limit saturation",
    body: "NA-East room creation traffic is at 88% of the minute window threshold.",
    tone: "warning",
  },
  {
    title: "Token refresh stable",
    body: "Google and Apple native session renewal is currently succeeding without cookie fallback.",
    tone: "info",
  },
];

export const events: EventRecord[] = [
  {
    time: "15:41",
    title: "Room closed",
    detail: "last-lobby drained after the match timer expired.",
  },
  {
    time: "15:38",
    title: "Anti-cheat trigger",
    detail:
      "player-92 exceeded max-speed thresholds twice in under 10 seconds.",
  },
  {
    time: "15:31",
    title: "Purchase confirmed",
    detail: "inventory bundle redeemed with a unique idempotency key.",
  },
];
