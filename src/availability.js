// Generate availability text for next 2 weeks with rules:
// - 1h increments
// - Business hours configurable (default 9:00-17:00 local)
// - Personal/out-of-office hours configurable (default weekdays 18:00-22:00, weekends 10:00-22:00)
// - Exclude UK public holidays
// - Add 1h padding before/after meetings with non-online location

const UK_BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json";

// Helper function to get account email from account ID for logging
async function getAccountEmail(accountId) {
  try {
    const { accounts } = await chrome.storage.sync.get(["accounts"]);
    const account = (accounts || []).find(acc => acc.id === accountId);
    return account ? account.email : accountId;
  } catch (error) {
    return accountId; // Fallback to account ID if we can't get email
  }
}

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

function formatDayAvailability(date, freeIntervals, context, personalHours, showTimezone = true) {
  const dayName = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = date.toLocaleDateString(undefined, { month: "long", day: "2-digit" });
  if (freeIntervals.length === 0) return `${dayName}, ${dateStr} - Unavailable`;
  
  // For personal context, use special phrasing patterns
  if (context === "personal") {
    return formatPersonalAvailability(date, dateStr, freeIntervals, personalHours, showTimezone);
  }
  
  // For work context, use existing logic
  const totalFreeMs = freeIntervals.reduce((m, s) => m + (s.end - s.start), 0);
  const fullDay = freeIntervals.length === 1 && totalFreeMs >= 8 * 60 * 60 * 1000;
  const mostDay = totalFreeMs >= 5 * 60 * 60 * 1000; // 5+ hours
  if (fullDay) return `${dayName}, ${dateStr} - Anytime`;
  if (mostDay) {
    // Find exceptions for "Most of the day"
    const exceptions = findMostOfDayExceptions(freeIntervals, context === "personal" ? personalHours : null, showTimezone);
    if (exceptions.length > 0) {
      return `${dayName}, ${dateStr} - Most of the day, except ${exceptions.join(", ")}`;
    }
    return `${dayName}, ${dateStr} - Most of the day`;
  }
  return `${dayName}, ${dateStr} - ${freeIntervals.map(s => `${fmtTime(s.start, showTimezone)}-${fmtTime(s.end, showTimezone)}`).join(" and ")}`;
}

function formatPersonalAvailability(date, dateStr, freeIntervals, personalHours, showTimezone = true) {
  // Determine if weekday or weekend
  const dow = date.getDay(); // 0 Sun, 6 Sat
  const isWeekend = dow === 0 || dow === 6;
  
  // Define time periods
  const morning = { start: 10, end: 13 }; // 10 AM - 1 PM
  const afternoon = { start: 13, end: 17 }; // 1 PM - 5 PM
  const evening = isWeekend 
    ? { start: personalHours?.weekends?.startHour || 10, end: personalHours?.weekends?.endHour || 22 }
    : { start: personalHours?.weekdays?.startHour || 18, end: personalHours?.weekdays?.endHour || 22 };
  
  // Check if we have full evening availability
  const fullEvening = checkFullPeriod(freeIntervals, evening.start, evening.end, date);
  
  // Check for partial evening (after a specific time)
  const partialEvening = checkPartialEvening(freeIntervals, evening.start, evening.end, date);
  
  // Check for morning availability
  const fullMorning = checkFullPeriod(freeIntervals, morning.start, morning.end, date);
  
  // Check for afternoon availability
  const fullAfternoon = checkFullPeriod(freeIntervals, afternoon.start, afternoon.end, date);
  
  // Check for full day
  const fullDayStart = isWeekend ? 10 : 10;
  const fullDayEnd = isWeekend ? 22 : 22;
  const fullDay = checkFullPeriod(freeIntervals, fullDayStart, fullDayEnd, date);
  
  // Find the earliest availability start time
  const earliestStart = freeIntervals.length > 0 
    ? Math.min(...freeIntervals.map(i => i.start.getHours() * 60 + i.start.getMinutes()))
    : null;
  
  // Check if availability is within evening period (even if not full)
  const hasEveningAvailability = checkEveningAvailability(freeIntervals, evening.start, evening.end, date);
  
  // Check if availability spans both afternoon and evening
  const spansAfternoonAndEvening = checkSpansAfternoonAndEvening(freeIntervals, afternoon, evening, date);
  
  // Determine the best phrasing
  if (fullDay) {
    return `${dateStr}, anytime`;
  }
  
  // Check if availability starts in afternoon and extends into evening
  if (earliestStart !== null && spansAfternoonAndEvening) {
    const startHour = Math.floor(earliestStart / 60);
    const startMin = earliestStart % 60;
    // Only format as "afternoon after X or evening" if it starts after the afternoon start time
    if (startHour > afternoon.start || (startHour === afternoon.start && startMin > 0)) {
      const timeStr = formatTimeForDisplay(startHour, startMin, showTimezone);
      return `${dateStr}, afternoon after ${timeStr} or evening`;
    }
    // If it starts exactly at afternoon start, just say "afternoon or evening"
    if (startHour === afternoon.start && startMin === 0) {
      return `${dateStr}, afternoon or evening`;
    }
  }
  
  // If we have evening availability (full or partial) and no morning/afternoon
  if (hasEveningAvailability && !fullMorning && !fullAfternoon) {
    // Check if it's full evening
    if (fullEvening) {
      return `${dateStr}, evening`;
    }
    // Otherwise, check if it starts later than the defined evening start
    if (earliestStart !== null && earliestStart >= evening.start * 60) {
      const startHour = Math.floor(earliestStart / 60);
      const startMin = earliestStart % 60;
      if (startHour > evening.start || (startHour === evening.start && startMin > 0)) {
        const timeStr = formatTimeForDisplay(startHour, startMin, showTimezone);
        return `${dateStr}, evening after ${timeStr}`;
      }
    }
    // Default to "evening" if it's within evening period
    return `${dateStr}, evening`;
  }
  
  // Check if availability starts later than defined periods (but doesn't span to evening)
  if (earliestStart !== null && !hasEveningAvailability) {
    // If starts in afternoon but after the defined afternoon start
    if (earliestStart >= afternoon.start * 60 && earliestStart < evening.start * 60) {
      const startHour = Math.floor(earliestStart / 60);
      const startMin = earliestStart % 60;
      if (startHour > afternoon.start || (startHour === afternoon.start && startMin > 0)) {
        const timeStr = formatTimeForDisplay(startHour, startMin, showTimezone);
        return `${dateStr}, afternoon after ${timeStr}`;
      }
    }
  }
  
  if (partialEvening && !fullMorning && !fullAfternoon) {
    const timeStr = formatTimeForDisplay(partialEvening, 0, showTimezone);
    return `${dateStr}, after ${timeStr}`;
  }
  
  if (fullMorning && fullAfternoon && !fullEvening) {
    return `${dateStr}, morning or afternoon`;
  }
  
  if (fullMorning && fullEvening && !fullAfternoon) {
    return `${dateStr}, morning or evening`;
  }
  
  if (fullAfternoon && fullEvening && !fullMorning) {
    return `${dateStr}, afternoon or evening`;
  }
  
  if (fullMorning && !fullAfternoon && !fullEvening) {
    return `${dateStr}, morning`;
  }
  
  if (fullAfternoon && !fullMorning && !fullEvening) {
    return `${dateStr}, afternoon`;
  }
  
  // If no patterns match, fall back to time ranges
  return `${dateStr} - ${freeIntervals.map(s => `${fmtTime(s.start, showTimezone)}-${fmtTime(s.end, showTimezone)}`).join(" and ")}`;
}

function formatTimeForDisplay(hours, minutes, showTimezone) {
  const date = new Date(0, 0, 0, hours, minutes);
  return date.toLocaleTimeString([], { hour: "numeric", minute: minutes > 0 ? "2-digit" : undefined, hour12: true });
}

function checkFullPeriod(freeIntervals, startHour, endHour, date) {
  // Check if we have continuous availability for the entire period
  // Use the date to create proper timestamps
  const baseDate = date || new Date();
  const periodStart = new Date(baseDate);
  periodStart.setHours(startHour, 0, 0, 0);
  const periodEnd = new Date(baseDate);
  periodEnd.setHours(endHour, 0, 0, 0);
  
  // Find intervals that cover this period
  const coveringIntervals = freeIntervals.filter(interval => {
    // Check if interval starts at or before period start and ends at or after period end
    return interval.start.getTime() <= periodStart.getTime() && interval.end.getTime() >= periodEnd.getTime();
  });
  
  return coveringIntervals.length > 0;
}

function checkEveningAvailability(freeIntervals, eveningStartHour, eveningEndHour, date) {
  // Check if any availability falls within the evening period
  const baseDate = date || new Date();
  const eveningStart = new Date(baseDate);
  eveningStart.setHours(eveningStartHour, 0, 0, 0);
  const eveningEnd = new Date(baseDate);
  eveningEnd.setHours(eveningEndHour, 0, 0, 0);
  
  return freeIntervals.some(interval => {
    // Check if interval overlaps with evening period
    return interval.start.getTime() < eveningEnd.getTime() && 
           interval.end.getTime() > eveningStart.getTime();
  });
}

function checkSpansAfternoonAndEvening(freeIntervals, afternoon, evening, date) {
  // Check if availability spans from afternoon into evening
  const baseDate = date || new Date();
  const afternoonStart = new Date(baseDate);
  afternoonStart.setHours(afternoon.start, 0, 0, 0);
  const afternoonEnd = new Date(baseDate);
  afternoonEnd.setHours(afternoon.end, 0, 0, 0);
  const eveningStart = new Date(baseDate);
  eveningStart.setHours(evening.start, 0, 0, 0);
  const eveningEnd = new Date(baseDate);
  eveningEnd.setHours(evening.end, 0, 0, 0);
  
  return freeIntervals.some(interval => {
    // Check if interval starts in afternoon period (or before) and extends into evening
    const startsInAfternoon = interval.start.getTime() <= afternoonEnd.getTime();
    const extendsIntoEvening = interval.end.getTime() >= eveningStart.getTime();
    // Also check if it spans across the gap between afternoon and evening
    return startsInAfternoon && extendsIntoEvening;
  });
}

function checkPartialEvening(freeIntervals, eveningStartHour, eveningEndHour, date) {
  // Check if we have evening availability starting after the normal evening start
  const baseDate = date || new Date();
  const eveningStart = new Date(baseDate);
  eveningStart.setHours(eveningStartHour, 0, 0, 0);
  const eveningEnd = new Date(baseDate);
  eveningEnd.setHours(eveningEndHour, 0, 0, 0);
  
  const eveningIntervals = freeIntervals.filter(interval => {
    // Check if interval overlaps with evening period
    return interval.start.getTime() >= eveningStart.getTime() && 
           interval.start.getTime() < eveningEnd.getTime() &&
           interval.end.getTime() >= eveningStart.getTime();
  });
  
  if (eveningIntervals.length > 0) {
    // Find the earliest evening start time
    const earliestInterval = eveningIntervals.reduce((earliest, interval) => 
      interval.start.getTime() < earliest.start.getTime() ? interval : earliest
    );
    const earliestStart = earliestInterval.start.getHours();
    if (earliestStart > eveningStartHour || 
        (earliestStart === eveningStartHour && earliestInterval.start.getMinutes() > 0)) {
      return earliestStart;
    }
  }
  
  return null;
}

function findMostOfDayExceptions(freeIntervals, personalHours, showTimezone = true) {
  // For work context, find gaps in a typical work day (9 AM - 5 PM)
  // For personal context, find gaps in the full day (10 AM - 10 PM)
  const startHour = personalHours ? 10 : 9;
  const endHour = personalHours ? 22 : 17;
  
  // If no free intervals, the whole day is busy
  if (freeIntervals.length === 0) {
    return [`${startHour.toString().padStart(2, '0')}:00 to ${endHour.toString().padStart(2, '0')}:00`];
  }
  
  // Create a list of all busy periods (gaps in free intervals)
  const busyPeriods = [];
  
  // Sort intervals by start time
  const sortedIntervals = freeIntervals.slice().sort((a, b) => a.start - b.start);
  
  // Use the first interval's date to establish the day window
  const baseDate = new Date(sortedIntervals[0].start);
  const dayStart = new Date(baseDate);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(baseDate);
  dayEnd.setHours(endHour, 0, 0, 0);
  
  // Check for gap at the beginning
  const firstInterval = sortedIntervals[0];
  if (firstInterval.start > dayStart) {
    busyPeriods.push(`${fmtTime(dayStart, showTimezone)} to ${fmtTime(firstInterval.start, showTimezone)}`);
  }
  
  // Check for gaps between intervals
  for (let i = 0; i < sortedIntervals.length - 1; i++) {
    const currentInterval = sortedIntervals[i];
    const nextInterval = sortedIntervals[i + 1];
    
    if (currentInterval.end < nextInterval.start) {
      busyPeriods.push(`${fmtTime(currentInterval.end, showTimezone)} to ${fmtTime(nextInterval.start, showTimezone)}`);
    }
  }
  
  // Check for gap at the end
  const lastInterval = sortedIntervals[sortedIntervals.length - 1];
  if (lastInterval.end < dayEnd) {
    busyPeriods.push(`${fmtTime(lastInterval.end, showTimezone)} to ${fmtTime(dayEnd, showTimezone)}`);
  }
  
  return busyPeriods;
}

function fmtTime(d, showTimezone = false) {
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  // Don't show timezone in individual time stamps - will be shown in header instead
  return timeStr;
}

function getDayWindow(date, context, workHours = { startHour: 9, endHour: 17 }, personalHours = { weekdays: { startHour: 18, endHour: 22 }, weekends: { startHour: 10, endHour: 22 } }) {
  const dow = date.getDay(); // 0 Sun, 6 Sat
  if (context === "personal") {
    if (dow === 0 || dow === 6) {
      // weekends
      return { start: setTimeLocal(date, personalHours.weekends.startHour, 0), end: setTimeLocal(date, personalHours.weekends.endHour, 0) };
    }
    // weekdays
    return { start: setTimeLocal(date, personalHours.weekdays.startHour, 0), end: setTimeLocal(date, personalHours.weekdays.endHour, 0) };
  }
  // work context, weekdays only
  if (dow === 0 || dow === 6) return { start: null, end: null };
  return { start: setTimeLocal(date, workHours.startHour, 0), end: setTimeLocal(date, workHours.endHour, 0) };
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

function splitIntoSlots(freeIntervals, slotDurationMinutes) {
  const slots = [];
  const slotDurationMs = slotDurationMinutes * 60 * 1000;
  for (const { start, end } of freeIntervals) {
    for (let t = new Date(start); t < end; t = new Date(t.getTime() + slotDurationMs)) {
      const nxt = new Date(t.getTime() + slotDurationMs);
      if (nxt <= end) slots.push({ start: new Date(t), end: nxt });
    }
  }
  return slots;
}

export async function generateAvailability(events, startDate, endDate, options = {}) {
  const { 
    context = "work", 
    mode = "approachable", 
    maxSlots = 3, 
    showTimezone = true,
    fullDayEventsBusyCalendars = new Set(),
    workHours = { startHour: 9, endHour: 17 },
    personalHours = { weekdays: { startHour: 18, endHour: 22 }, weekends: { startHour: 10, endHour: 22 } },
    timeBuffer = 0,
    slotDuration = 60
  } = options;
  
  console.log(`🚀 Generating availability with ${events.length} events from ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
  console.log(`⚙️  Time buffer: ${timeBuffer} minutes`);
  
  const sourceSummary = {};
  for (const ev of events) {
    if (ev.accountId && ev.calendarId) {
      const accountEmail = await getAccountEmail(ev.accountId);
      // Extract calendar name from prefixed calendar ID (e.g., "google_123:primary" -> "primary")
      const calendarName = ev.calendarId.includes(':') ? ev.calendarId.split(':').slice(1).join(':') : ev.calendarId;
      const source = `${accountEmail}:${calendarName}`;
      sourceSummary[source] = (sourceSummary[source] || 0) + 1;
    } else {
      sourceSummary['Unknown'] = (sourceSummary['Unknown'] || 0) + 1;
    }
  }
  console.log(`📊 Events by source:`, sourceSummary);
  
  const holidays = await fetchUkHolidaysSet();
  const now = new Date();
  const out = [];
  const allBusySlots = []; // Collect all busy mode slots across days
  const maxSlotsTotal = Math.max(0, Number(maxSlots) || 0);
  
  for (let d = startOfDayLocal(startDate); d <= endDate; d = addDays(d, 1)) {
    const { start: rawStart, end: rawEnd } = getDayWindow(d, context, workHours, personalHours);
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
      if (!ev.start || !ev.end) return false;
      const s = toLocalDate(ev.start);
      const e = toLocalDate(ev.end);
      
      // Include events that:
      // 1. Start on this day, OR
      // 2. Started before this day but end on or after this day (multi-day events)
      const dayStart = startOfDayLocal(d);
      const dayEnd = addDays(dayStart, 1);
      
      return (s >= dayStart && s < dayEnd) || (s < dayStart && e > dayStart);
    });
    
    // Log events being processed for this day
    if (dayEvents.length > 0) {
      const dayStr = d.toISOString().slice(0, 10);
      console.log(`📋 Processing ${dayEvents.length} events for ${dayStr}:`);
      for (const [idx, ev] of dayEvents.entries()) {
        if (ev.accountId && ev.calendarId) {
          const accountEmail = await getAccountEmail(ev.accountId);
          const calendarName = ev.calendarId.includes(':') ? ev.calendarId.split(':').slice(1).join(':') : ev.calendarId;
          console.log(`   ${idx + 1}. "${ev.summary}" (${ev.start}) - Account ${accountEmail}, Calendar ${calendarName}`);
        } else {
          console.log(`   ${idx + 1}. "${ev.summary}" (${ev.start}) - Unknown source`);
        }
      }
    }
    
    const busy = [];
    for (const ev of dayEvents) {
      if (!ev.start || !ev.end) continue;
      let s = toLocalDate(ev.start);
      let e = toLocalDate(ev.end);
      
      // Check if this is an all-day event (date-only format, no time)
      const isAllDay = ev.start.includes('T') === false && ev.end.includes('T') === false;
      
      // For all-day events, check if this calendar is configured to mark them as busy
      if (isAllDay) {
        // Check if this event's calendar is in the fullDayEventsBusyCalendars set
        const calendarId = ev.calendarId || ev.accountId;
        if (fullDayEventsBusyCalendars.has(calendarId)) {
          busy.push({ start: windowStart, end: windowEnd });
        }
        continue;
      }
      
      // Apply time buffer to all events (replaces the old 1-hour offline event buffer)
      if (timeBuffer > 0) {
        const bufferMs = timeBuffer * 60 * 1000;
        s = new Date(s.getTime() - bufferMs);
        e = new Date(e.getTime() + bufferMs);
      } else if (!isOnlineLocation(ev.location, ev.hangoutLink)) {
        // Fallback to old logic if no buffer is set: 1 hour for offline events
        s = new Date(s.getTime() - 60 * 60 * 1000);
        e = new Date(e.getTime() + 60 * 60 * 1000);
      }
      // clip to window
      if (e <= windowStart || s >= windowEnd) continue;
      busy.push({ start: new Date(Math.max(s.getTime(), windowStart.getTime())), end: new Date(Math.min(e.getTime(), windowEnd.getTime())) });
    }
    const mergedBusy = mergeIntervals(busy);
    let free = subtractBusyFromWindow(windowStart, windowEnd, mergedBusy);

    if (mode === "busy") {
      // Snap to slot duration increments for busy mode only
      const slotDurationMs = slotDuration * 60 * 1000;
      free = free.map(({ start, end }) => {
        const s = new Date(start);
        // Round start down to nearest slot duration boundary
        const startMinutes = s.getMinutes() + (s.getHours() * 60);
        const roundedMinutes = Math.floor(startMinutes / slotDuration) * slotDuration;
        s.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);
        
        const e = new Date(end);
        // Round end down to nearest slot duration boundary
        const endMinutes = e.getMinutes() + (e.getHours() * 60);
        const roundedEndMinutes = Math.floor(endMinutes / slotDuration) * slotDuration;
        e.setHours(Math.floor(roundedEndMinutes / 60), roundedEndMinutes % 60, 0, 0);
        
        return { start: s, end: e };
      }).filter(({ start, end }) => (end - start) >= slotDurationMs);
      const hourSlots = splitIntoSlots(free, slotDuration);
      // adjacency: slot is near any busy interval (within 1 hour)
      const adjacent = hourSlots.filter(slot => {
        for (const busy of mergedBusy) {
          // Check if slot is within 1 hour of any busy interval
          const slotStart = slot.start.getTime();
          const slotEnd = slot.end.getTime();
          const busyStart = busy.start.getTime();
          const busyEnd = busy.end.getTime();
          
          // Slot is adjacent if it's within 1 hour of busy interval
          const oneHour = 60 * 60 * 1000;
          return (Math.abs(slotStart - busyEnd) <= oneHour) || 
                 (Math.abs(slotEnd - busyStart) <= oneHour) ||
                 (slotStart < busyEnd && slotEnd > busyStart); // Overlapping
        }
        return false;
      });
      
      // Debug logging
      const dayStr = d.toISOString().slice(0, 10);
      console.log(`🔴 Busy mode - ${dayStr}: ${free.length} free intervals, ${hourSlots.length} hour slots, ${adjacent.length} adjacent slots`);
      if (mergedBusy.length > 0) {
        console.log(`   Busy intervals: ${mergedBusy.map(b => `${b.start.toLocaleTimeString()}-${b.end.toLocaleTimeString()}`).join(', ')}`);
      }
      if (adjacent.length > 0) {
        console.log(`   Adjacent slots: ${adjacent.map(s => `${s.start.toLocaleTimeString()}-${s.end.toLocaleTimeString()}`).join(', ')}`);
      }
      
      // Add slots to collection with date info
      for (const slot of adjacent) {
        allBusySlots.push({
          date: d,
          slot: slot,
          dayName: d.toLocaleDateString(undefined, { weekday: "long" }),
          dateStr: d.toLocaleDateString(undefined, { month: "long", day: "2-digit" })
        });
      }
      continue;
    }

    if (free.length) out.push(formatDayAvailability(d, free, context, personalHours, showTimezone));
  }
  
  // Process busy mode slots across all days
  if (mode === "busy") {
    console.log(`🔴 Busy mode processing: ${allBusySlots.length} total slots collected`);
    
    if (allBusySlots.length > 0) {
      // Group slots by date
      const slotsByDate = {};
      for (const item of allBusySlots) {
        const dateKey = item.date.toISOString().slice(0, 10);
        if (!slotsByDate[dateKey]) {
          slotsByDate[dateKey] = {
            date: item.date,
            dayName: item.dayName,
            dateStr: item.dateStr,
            slots: []
          };
        }
        slotsByDate[dateKey].slots.push(item.slot);
      }
      
      console.log(`🔴 Slots by date:`, Object.keys(slotsByDate).map(date => `${date}: ${slotsByDate[date].slots.length} slots`));
      
      // Distribute maxSlotsTotal across multiple days (aim for 2-3 days)
      const sortedDates = Object.keys(slotsByDate).sort();
      const maxDays = Math.min(3, sortedDates.length); // Use up to 3 days
      const slotsPerDay = Math.ceil(maxSlotsTotal / maxDays); // Distribute slots across days
      
      console.log(`🔴 Distribution strategy: ${maxSlotsTotal} slots across ${maxDays} days, ~${slotsPerDay} slots per day`);
      
      let remainingSlots = maxSlotsTotal;
      
      for (let i = 0; i < Math.min(maxDays, sortedDates.length) && remainingSlots > 0; i++) {
        const dateKey = sortedDates[i];
        const dayData = slotsByDate[dateKey];
        
        // Calculate how many slots to take from this day
        // For the last day, take all remaining slots
        const slotsToTake = (i === maxDays - 1) ? remainingSlots : Math.min(remainingSlots, slotsPerDay, dayData.slots.length);
        const selectedSlots = dayData.slots.slice(0, slotsToTake);
        
        console.log(`🔴 Processing ${dateKey}: taking ${slotsToTake} of ${dayData.slots.length} slots, ${remainingSlots} remaining`);
        
        if (selectedSlots.length > 0) {
          const line = `${dayData.dayName}, ${dayData.dateStr} - ${selectedSlots.map(s => `${fmtTime(s.start, showTimezone)}-${fmtTime(s.end, showTimezone)}`).join(" and ")}`;
          out.push(line);
          remainingSlots -= selectedSlots.length;
        }
      }
    } else {
      console.log(`🔴 No busy slots found across all days`);
    }
  }
  
  return out.join("\n");
}


