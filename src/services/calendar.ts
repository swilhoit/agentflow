import { google } from 'googleapis';
import { logger } from '../utils/logger';

/**
 * Google Calendar Service
 * Provides access to Google Calendar API for event management
 */
export class CalendarService {
  private calendar;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Create a recurring event on specific days of the month
   */
  async createMonthlyRecurringEvent(
    summary: string,
    description: string,
    daysOfMonth: number[], // e.g., [1, 15] for 1st and 15th
    startTime: string = '09:00:00', // Default 9 AM
    endTime: string = '09:30:00', // Default 9:30 AM
    timeZone: string = 'America/Los_Angeles'
  ) {
    try {
      const events = [];

      for (const day of daysOfMonth) {
        // Calculate the next occurrence of this day
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), day);

        // If the day has passed this month, start from next month
        if (startDate < now) {
          startDate.setMonth(startDate.getMonth() + 1);
        }

        const startDateTime = `${startDate.toISOString().split('T')[0]}T${startTime}`;
        const endDateTime = `${startDate.toISOString().split('T')[0]}T${endTime}`;

        const event = {
          summary,
          description,
          start: {
            dateTime: startDateTime,
            timeZone,
          },
          end: {
            dateTime: endDateTime,
            timeZone,
          },
          recurrence: [
            'RRULE:FREQ=MONTHLY', // Repeat monthly
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 24 * 60 }, // 1 day before
              { method: 'popup', minutes: 60 }, // 1 hour before
            ],
          },
        };

        logger.info(`Creating calendar event: ${summary} on day ${day} of each month`);
        const response = await this.calendar.events.insert({
          calendarId: 'primary',
          requestBody: event,
        });

        events.push(response.data);
        logger.info(`✓ Created event: ${response.data.htmlLink}`);
      }

      return events;
    } catch (error) {
      logger.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  /**
   * List upcoming events
   */
  async listUpcomingEvents(maxResults: number = 10) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      logger.error('Failed to list calendar events:', error);
      throw error;
    }
  }

  /**
   * Delete an event by ID
   */
  async deleteEvent(eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
      logger.info(`✓ Deleted event: ${eventId}`);
    } catch (error) {
      logger.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  /**
   * Search for events by summary
   */
  async searchEvents(query: string) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        q: query,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      logger.error('Failed to search calendar events:', error);
      throw error;
    }
  }
}

export const calendarService = new CalendarService();
