/**
 * Setup Payment Reminders
 * Creates recurring calendar events for payroll and loan payments on the 1st and 15th of each month
 */
import { calendarService } from '../src/services/calendar';
import { logger } from '../src/utils/logger';

async function setupPaymentReminders() {
  try {
    logger.info('Setting up payment reminders...');

    // Create recurring events for the 1st and 15th of each month
    const events = await calendarService.createMonthlyRecurringEvent(
      '💰 Payroll & Loan Payments Due',
      'Reminder: Process payroll and make loan payments today.',
      [1, 15], // 1st and 15th of each month
      '09:00:00', // 9 AM
      '09:30:00', // 9:30 AM
      'America/Los_Angeles'
    );

    logger.info(`✓ Successfully created ${events.length} recurring payment reminders`);

    // List upcoming events to verify
    logger.info('\nUpcoming payment reminders:');
    const upcoming = await calendarService.listUpcomingEvents(5);

    upcoming.forEach((event: any) => {
      const start = event.start.dateTime || event.start.date;
      logger.info(`  - ${event.summary} on ${new Date(start).toLocaleDateString()}`);
    });

    logger.info('\n✓ Payment reminders setup complete!');
    logger.info('  You will receive notifications:');
    logger.info('  - 1 day before (24 hours)');
    logger.info('  - 1 hour before');

  } catch (error) {
    logger.error('Failed to setup payment reminders:', error);
    process.exit(1);
  }
}

setupPaymentReminders();
