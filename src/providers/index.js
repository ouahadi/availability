// Simple provider abstraction to allow future non-Google calendars
// Supports multiple accounts and providers

import { fetchCalendarList, fetchEventsForCalendars, fetchCalendarListForAccounts, fetchEventsForAccounts } from "../calendar.js";

export const CalendarProvider = {
  async listCalendars(clientId, accountIds = null) {
    if (accountIds && accountIds.length > 0) {
      return await fetchCalendarListForAccounts(clientId, accountIds);
    }
    return await fetchCalendarList(clientId);
  },
  async listEventsInRange(clientId, calendarIds, timeMinIso, timeMaxIso, accountIds = null) {
    if (accountIds && accountIds.length > 0) {
      return await fetchEventsForAccounts(clientId, accountIds, calendarIds, timeMinIso, timeMaxIso);
    }
    return await fetchEventsForCalendars(clientId, calendarIds, timeMinIso, timeMaxIso);
  }
};


