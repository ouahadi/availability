// Simple provider abstraction to allow future non-Google calendars
// For now, it delegates to Google Calendar implementation.

import { fetchCalendarList, fetchEventsForCalendars } from "../calendar.js";

export const CalendarProvider = {
  async listCalendars(clientId) {
    return await fetchCalendarList(clientId);
  },
  async listEventsInRange(clientId, calendarIds, timeMinIso, timeMaxIso) {
    return await fetchEventsForCalendars(clientId, calendarIds, timeMinIso, timeMaxIso);
  }
};


