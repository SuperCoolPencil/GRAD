import { format, parse, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays, subDays, getDay, isBefore, isEqual } from 'date-fns';

// Consistent date format for database and API interactions
const DATE_FORMAT_ISO = 'yyyy-MM-dd';

// Consistent time format
const TIME_FORMAT_24H = 'HH:mm';

/**
 * Formats a Date object into a 'yyyy-MM-dd' string.
 * @param date The date to format.
 * @returns The formatted date string.
 */
export const formatDateToISO = (date: Date): string => {
  // Ensure the date is treated as UTC to avoid timezone issues when formatting to YYYY-MM-DD
  // This creates a new Date object from the UTC components of the original date
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return format(utcDate, DATE_FORMAT_ISO);
};

/**
 * Parses a 'yyyy-MM-dd' string into a Date object.
 * @param dateString The date string to parse.
 * @returns The parsed Date object.
 */
export const parseISOToDate = (dateString: string): Date => {
  return parse(dateString, DATE_FORMAT_ISO, new Date());
};

/**
 * Formats a Date object into a time string (e.g., '14:30').
 * @param date The date to format.
 * @returns The formatted time string.
 */
export const formatTimeTo24H = (date: Date): string => {
  return format(date, TIME_FORMAT_24H);
};

/**
 * Parses a time string (e.g., '14:30') into a Date object on a reference date.
 * @param timeString The time string to parse.
 * @returns The parsed Date object.
 */
export const parse24HToDate = (timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Gets the start of the week for a given date.
 * @param date The date to get the week start for.
 * @param weekStartsOn The index of the first day of the week (0 for Sunday).
 * @returns The Date object for the start of the week.
 */
export const getWeekStartDate = (date: Date, weekStartsOn: 0 | 1 = 0): Date => {
  return startOfWeek(date, { weekStartsOn });
};

/**
 * Gets the end of the week for a given date.
 * @param date The date to get the week end for.
 * @param weekStartsOn The index of the first day of the week (0 for Sunday).
 * @returns The Date object for the end of the week.
 */
export const getWeekEndDate = (date: Date, weekStartsOn: 0 | 1 = 0): Date => {
  return endOfWeek(date, { weekStartsOn });
};

/**
 * Returns the start of a given day.
 * @param date The date.
 * @returns The start of the day.
 */
export const getStartOfDay = (date: Date): Date => {
  return startOfDay(date);
};

/**
 * Checks if a date is in the past (before the start of today).
 * @param date The date to check.
 * @returns True if the date is in the past.
 */
export const isDateInPast = (date: Date): boolean => {
  return isBefore(date, startOfDay(new Date()));
};

/**
 * Checks if two dates are the same day.
 * @param dateLeft The first date.
 * @param dateRight The second date.
 * @returns True if the dates are on the same day.
 */
export const isSameDay = (dateLeft: Date, dateRight: Date): boolean => {
  return isEqual(startOfDay(dateLeft), startOfDay(dateRight));
};

/**
 * Adds a specified number of days to a date.
 * @param date The date to add days to.
 * @param amount The number of days to add.
 * @returns The new date.
 */
export const addDaysToDate = (date: Date, amount: number): Date => {
  return addDays(date, amount);
};

/**
 * Subtracts a specified number of days from a date.
 * @param date The date to subtract days from.
 * @param amount The number of days to subtract.
 * @returns The new date.
 */
export const subDaysFromDate = (date: Date, amount: number): Date => {
  return subDays(date, amount);
};

/**
 * Gets the day of the week (0 for Sunday, 6 for Saturday).
 * @param date The date.
 * @returns The day of the week.
 */
export const getDayOfWeek = (date: Date): number => {
  return getDay(date);
};

/**
 * Converts a day of the week index to its string representation.
 * @param dayIndex The index of the day (0 for Sunday).
 * @returns The name of the day (e.g., 'Sunday').
 */
export const dayIndexToName = (dayIndex: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] || '';
};
