/**
 * Pure formatting and local-date helpers used by the timer and the view.
 * Zero dependencies, no DOM.
 * All times work in the local timezone (via process.env.TZ).
 */

/**
 * Format seconds as decimal hours with exactly two decimals.
 * Half-up rounding, negatives treated as 0.
 * e.g. 27000 -> "7.50", 18 -> "0.01"
 */
export function formatDecimalHours(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hours = (seconds / 3600) * 100;
  // Half-up rounding with float artifact avoidance
  const rounded = Math.round(hours + 1e-9) / 100;
  return rounded.toFixed(2);
}

/**
 * Format seconds as zero-padded HH:MM, floored to whole minutes.
 * Negatives treated as "00:00", no cap at 24 hours.
 * e.g. 27000 -> "07:30", 90000 -> "25:00"
 */
export function formatHHMM(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Convert epoch ms to local date YYYY-MM-DD using process timezone.
 * e.g. epoch of 2026-09-10 00:30 local -> "2026-09-10"
 */
export function dayKey(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Return epoch ms of local midnight beginning that day.
 * e.g. "2026-09-10" -> ms of 2026-09-10 00:00:00 local
 */
export function startOfDay(dayKeyStr: string): number {
  const parts = dayKeyStr.split("-").map(Number) as [number, number, number];
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  return new Date(year, month - 1, day).getTime();
}

/**
 * Increment day key by one day, handling month and year boundaries.
 * e.g. "2026-09-30" -> "2026-10-01", "2026-12-31" -> "2027-01-01"
 */
export function nextDayKey(dayKeyStr: string): string {
  const parts = dayKeyStr.split("-").map(Number) as [number, number, number];
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return dayKey(date.getTime());
}

/**
 * Format day key as long English day name and date without year.
 * e.g. "2026-09-10" -> "Wednesday 10 September"
 */
export function formatDayLong(dayKeyStr: string): string {
  const ms = startOfDay(dayKeyStr);
  const date = new Date(ms);
  const dayName = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
  }).format(date);
  const day = date.getDate();
  const monthName = new Intl.DateTimeFormat("en-GB", {
    month: "long",
  }).format(date);
  return `${dayName} ${day} ${monthName}`;
}

/**
 * Format day key as short English day name and date.
 * e.g. "2026-09-10" -> "Wed 10 Sep"
 * Note: We trim "Sept" to "Sep" for consistency.
 */
export function formatDayShort(dayKeyStr: string): string {
  const ms = startOfDay(dayKeyStr);
  const date = new Date(ms);
  const dayName = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
  }).format(date);
  const day = date.getDate();
  let monthName = new Intl.DateTimeFormat("en-GB", {
    month: "short",
  }).format(date);
  // Handle "Sept" -> "Sep" for consistency
  if (monthName === "Sept") {
    monthName = "Sep";
  }
  return `${dayName} ${day} ${monthName}`;
}

/**
 * Return ISO-8601 week number (Monday start) for a day key.
 * e.g. "2026-09-10" -> { year: 2026, week: 37 }
 * Note: week year can differ from calendar year (e.g., 2027-01-01 is in 2026-W53)
 */
export function isoWeek(dayKeyStr: string): { year: number; week: number } {
  const ms = startOfDay(dayKeyStr);
  const date = new Date(ms);

  // ISO 8601 week calculation
  // Start with January 4th of the year (always in week 1)
  const january4 = new Date(date.getFullYear(), 0, 4);
  const january4Day = january4.getDay();

  // Find the Monday of week 1
  // If January 4 is Mon (1), week 1 starts on that Monday
  // If January 4 is Tue-Sun, week 1 starts on the previous Monday
  const weekOneMonday = new Date(january4);
  weekOneMonday.setDate(
    january4.getDate() - (january4Day === 0 ? 6 : january4Day - 1)
  );

  // If our date is before week one Monday, it's in the last week of the previous year
  if (date < weekOneMonday) {
    const december31 = new Date(date.getFullYear() - 1, 11, 31);
    return isoWeek(dayKey(december31.getTime()));
  }

  // If our date is in the next year's week 1, return next year
  const nextYearJanuary4 = new Date(date.getFullYear() + 1, 0, 4);
  const nextYearJanuary4Day = nextYearJanuary4.getDay();
  const nextYearWeekOneMonday = new Date(nextYearJanuary4);
  nextYearWeekOneMonday.setDate(
    nextYearJanuary4.getDate() -
      (nextYearJanuary4Day === 0 ? 6 : nextYearJanuary4Day - 1)
  );

  if (date >= nextYearWeekOneMonday) {
    const january1Next = new Date(date.getFullYear() + 1, 0, 1);
    return isoWeek(dayKey(january1Next.getTime()));
  }

  // Calculate week number as days since week one Monday, divided by 7
  // Round, not floor: a DST change makes one day 23 or 25 hours long.
  const daysSinceWeekOneMonday = Math.round(
    (date.getTime() - weekOneMonday.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.floor(daysSinceWeekOneMonday / 7) + 1;

  return { year: date.getFullYear(), week };
}

/**
 * Format ISO week as YYYY-Www.
 * e.g. "2026-09-10" -> "2026-W37"
 */
export function weekKey(dayKeyStr: string): string {
  const week = isoWeek(dayKeyStr);
  return `${week.year}-W${String(week.week).padStart(2, "0")}`;
}

/**
 * Return label for a day's week, relative to today's week.
 * "This week" if same ISO week, "WeekNN" for other weeks.
 * e.g. weekLabel("2026-09-08", "2026-09-10") -> "This week"
 * e.g. weekLabel("2026-09-04", "2026-09-10") -> "Week 36"
 */
export function weekLabel(dayKeyStr: string, todayKeyStr: string): string {
  const week = isoWeek(dayKeyStr);
  const todayWeek = isoWeek(todayKeyStr);

  if (week.year === todayWeek.year && week.week === todayWeek.week) {
    return "This week";
  }

  return `Week ${week.week}`;
}
