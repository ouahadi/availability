// Generate availability text for next 2 weeks with rules:
// - 1h increments
// - Business hours 10:00-18:00 local
// - Exclude UK public holidays
// - Add 1h padding before/after meetings with non-online location

const UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";

function toLocalDate(date) {
  return new Date(date);
}

function startOfDayLocal(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function setTimeLocal(date, hours, minutes) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isOnlineLocation(location, hangoutLink) {
  if (hangoutLink) return true;
  if (!location) return true; // treat empty as online
  const loc = String(location).toLowerCase();
  return loc.includes("zoom") || loc.includes("meet.google.com") || loc.includes("teams.microsoft.com") || loc.includes("online") || loc.includes("virtual");
}

async function fetchUkHolidaysSet() {
  const resp = await fetch(UK_BANK_HOLIDAYS_URL);
  if (!resp.ok) return new Set();
  const data = await resp.json();
  // England and Wales
  const events = data?.["england-and-wales"]?.events || [];
  const set = new Set();
  for (const ev of events) set.add(ev.date); // YYYY-MM-DD
  return set;
}

function mergeIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = new Date(Math.max(last.end.getTime(), cur.end.getTime()));
    } else {
      out.push(cur);
    }
  }
  return out;
}

function subtractBusyFromWindow(windowStart, windowEnd, busyIntervals) {
  let free = [{ start: windowStart, end: windowEnd }];
  for (const busy of busyIntervals) {
    const next = [];
    for (const slot of free) {
      if (busy.end <= slot.start || busy.start >= slot.end) {
        next.push(slot);
        continue;
      }
      if (busy.start > slot.start) {
        next.push({ start: slot.start, end: new Date(busy.start) });
      }
      if (busy.end < slot.end) {
        next.push({ start: new Date(busy.end), end: slot.end });
      }
    }
    free = next;
  }
  return free;
}

function formatDayAvailability(date, freeIntervals) {
  const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = date.toLocaleDateString(undefined, { month: "long", day: "2-digit" });
  if (freeIntervals.length === 0) return `${dayName}, ${dateStr} - Unavailable`;
  // Compress to human friendly phrasing
  const totalFreeMs = freeIntervals.reduce((m, s) => m + (s.end - s.start), 0);
  const fullDay = freeIntervals.length === 1 && totalFreeMs >= 8 * 60 * 60 * 1000;
  const mostDay = totalFreeMs >= 5 * 60 * 60 * 1000; // 5+ hours
  if (fullDay) return `${dayName}, ${dateStr} - Anytime`;
  if (mostDay) {
    // Phrase as Most of the day
    return `${dayName}, ${dateStr} - Most of the day`;
  }
  return `${dayName}, ${dateStr} - ${freeIntervals.map(s => `${fmtTime(s.start)}-${fmtTime(s.end)}`).join(" and ")}`;
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getDayWindow(date, context) {
  const dow = date.getDay(); // 0 Sun, 6 Sat
  if (context === "personal") {
    if (dow === 0 || dow === 6) {
      // weekends 10:00-22:00
      return { start: setTimeLocal(date, 10, 0), end: setTimeLocal(date, 22, 0) };
    }
    // weekdays evenings 18:00-22:00
    return { start: setTimeLocal(date, 18, 0), end: setTimeLocal(date, 22, 0) };
  }
  // work context, weekdays only
  if (dow === 0 || dow === 6) return { start: null, end: null };
  return { start: setTimeLocal(date, 10, 0), end: setTimeLocal(date, 18, 0) };
}

function splitIntoHourSlots(freeIntervals) {
  const slots = [];
  for (const { start, end } of freeIntervals) {
    for (let t = new Date(start); t < end; t = new Date(t.getTime() + 60 * 60 * 1000)) {
      const nxt = new Date(t.getTime() + 60 * 60 * 1000);
      if (nxt <= end) slots.push({ start: new Date(t), end: nxt });
    }
  }
  return slots;
}

export async function generateAvailability(events, startDate, endDate, options = {}) {
  const { context = "work", mode = "approachable", maxSlots = 3 } = options;
  const holidays = await fetchUkHolidaysSet();
  const now = new Date();
  const out = [];
  let remainingSlots = Math.max(0, Number(maxSlots) || 0);
  for (let d = startOfDayLocal(startDate); d <= endDate; d = addDays(d, 1)) {
    if (mode === "busy" && remainingSlots <= 0) break;
    const { start: rawStart, end: rawEnd } = getDayWindow(d, context);
    if (!rawStart || !rawEnd) continue; // skip days outside context

    const isoDate = d.toISOString().slice(0, 10);
    if (context === "work" && holidays.has(isoDate)) continue; // skip UK holiday for work

    let windowStart = rawStart;
    const windowEnd = rawEnd;

    // For today, trim past time and round up to next full hour
    if (isSameDay(d, now)) {
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
        nextHour.setHours(nextHour.getHours() + 1);
      }
      if (nextHour > windowStart) windowStart = nextHour;
    }

    if (windowStart >= windowEnd) continue; // no time left today

    // build busy with padding for travel if needed
    const dayEvents = events.filter(ev => {
      const s = toLocalDate(ev.start);
      return isSameDay(s, d);
    });
    const busy = [];
    for (const ev of dayEvents) {
      if (!ev.start || !ev.end) continue;
      let s = toLocalDate(ev.start);
      let e = toLocalDate(ev.end);
      if (!isOnlineLocation(ev.location, ev.hangoutLink)) {
        s = new Date(s.getTime() - 60 * 60 * 1000);
        e = new Date(e.getTime() + 60 * 60 * 1000);
      }
      // clip to window
      if (e <= windowStart || s >= windowEnd) continue;
      busy.push({ start: new Date(Math.max(s.getTime(), windowStart.getTime())), end: new Date(Math.min(e.getTime(), windowEnd.getTime())) });
    }
    const mergedBusy = mergeIntervals(busy);
    let free = subtractBusyFromWindow(windowStart, windowEnd, mergedBusy);
    // Snap to 1h increments
    free = free.map(({ start, end }) => {
      const s = new Date(start);
      s.setMinutes(0, 0, 0);
      const e = new Date(end);
      if (e.getMinutes() !== 0) e.setHours(e.getHours(), 0, 0, 0);
      return { start: s, end: e };
    }).filter(({ start, end }) => (end - start) >= 60 * 60 * 1000);

    if (mode === "busy") {
      const hourSlots = splitIntoHourSlots(free);
      // adjacency: slot touches any busy edge
      const busyEdges = new Set();
      for (const b of mergedBusy) {
        busyEdges.add(b.start?.getTime());
        busyEdges.add(b.end?.getTime());
      }
      const adjacent = hourSlots.filter(s => busyEdges.has(s.start.getTime()) || busyEdges.has(s.end.getTime()));
      const limited = adjacent.slice(0, Math.max(0, remainingSlots));
      if (limited.length) {
        const line = `${d.toLocaleDateString(undefined, { weekday: "long" })}, ${d.toLocaleDateString(undefined, { month: "long", day: "2-digit" })} - ${limited.map(s => `${fmtTime(s.start)}-${fmtTime(s.end)}`).join(" and ")}`;
        out.push(line);
        remainingSlots -= limited.length;
      }
      continue;
    }

    if (free.length) out.push(formatDayAvailability(d, free));
  }
  return out.join("\n");
}


