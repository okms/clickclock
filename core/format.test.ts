import { describe, it, expect } from "vitest";
import {
  formatDecimalHours,
  formatHHMM,
  dayKey,
  startOfDay,
  nextDayKey,
  formatDayLong,
  formatDayShort,
  isoWeek,
  weekKey,
  weekLabel,
} from "./format";

describe("formatDecimalHours", () => {
  it("DISP-03: formats seconds as decimal hours with exactly two decimals, half-up rounding", () => {
    expect(formatDecimalHours(27000)).toBe("7.50");
    expect(formatDecimalHours(0)).toBe("0.00");
    expect(formatDecimalHours(3599)).toBe("1.00");
    expect(formatDecimalHours(18)).toBe("0.01");
    expect(formatDecimalHours(3618)).toBe("1.01");
    expect(formatDecimalHours(-5)).toBe("0.00");
    expect(formatDecimalHours(33372)).toBe("9.27");
  });
});

describe("formatHHMM", () => {
  it("DISP-03: formats seconds as zero-padded HH:MM, floored to whole minutes, no cap at 24", () => {
    expect(formatHHMM(27000)).toBe("07:30");
    expect(formatHHMM(3599)).toBe("00:59");
    expect(formatHHMM(90000)).toBe("25:00");
    expect(formatHHMM(-5)).toBe("00:00");
    expect(formatHHMM(59)).toBe("00:00");
  });
});

describe("dayKey", () => {
  it("DISP-07: converts epoch ms to local date YYYY-MM-DD using process timezone", () => {
    // 2026-09-10 at 00:30 local time
    expect(dayKey(new Date(2026, 8, 10, 0, 30).getTime())).toBe("2026-09-10");
    // 2026-09-09 at 23:59:59 local time
    expect(dayKey(new Date(2026, 8, 9, 23, 59, 59).getTime())).toBe("2026-09-09");
  });
});

describe("startOfDay", () => {
  it("DISP-07: returns epoch ms of local midnight beginning that day", () => {
    expect(startOfDay("2026-09-10")).toBe(
      new Date(2026, 8, 10).getTime()
    );
  });
});

describe("nextDayKey", () => {
  it("DISP-07: increments day key, handling month and year boundaries", () => {
    expect(nextDayKey("2026-09-30")).toBe("2026-10-01");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
    expect(nextDayKey("2028-02-28")).toBe("2028-02-29");
  });
});

describe("DST transitions (Europe/Oslo)", () => {
  it("DISP-07: handles spring forward (23 hour day)", () => {
    const ms1 = startOfDay("2026-03-29");
    const ms2 = startOfDay("2026-03-30");
    expect(ms2 - ms1).toBe(23 * 3600 * 1000);
  });

  it("DISP-07: handles fall back (25 hour day)", () => {
    const ms1 = startOfDay("2026-10-25");
    const ms2 = startOfDay("2026-10-26");
    expect(ms2 - ms1).toBe(25 * 3600 * 1000);
  });
});

describe("formatDayLong", () => {
  it("DISP-07: formats day key as 'Wednesday 9 September' (English, no year)", () => {
    expect(formatDayLong("2026-09-09")).toBe("Wednesday 9 September");
  });

  it("DISP-07: handles different day of week", () => {
    expect(formatDayShort("2026-09-08")).toBe("Tue 8 Sep");
  });
});

describe("formatDayShort", () => {
  it("DISP-07: formats day key as 'Thu 10 Sep'", () => {
    expect(formatDayShort("2026-09-10")).toBe("Thu 10 Sep");
  });
});

describe("isoWeek", () => {
  it("DISP-07/HIST-02: returns ISO-8601 week number (Monday start)", () => {
    expect(isoWeek("2026-09-10")).toEqual({ year: 2026, week: 37 });
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
  });
});

describe("weekKey", () => {
  it("HIST-02: the Monday after a DST spring-forward starts a new ISO week", () => {
    expect(isoWeek("2026-03-29")).toEqual({ year: 2026, week: 13 });
    expect(isoWeek("2026-03-30")).toEqual({ year: 2026, week: 14 });
    expect(isoWeek("2026-10-26")).toEqual({ year: 2026, week: 44 });
  });

  it("HIST-02: formats week as YYYY-Www", () => {
    expect(weekKey("2026-09-10")).toBe("2026-W37");
  });
});

describe("weekLabel", () => {
  it("HIST-02: returns 'This week' if same ISO week as todayKey", () => {
    expect(weekLabel("2026-09-08", "2026-09-10")).toBe("This week");
  });

  it("HIST-02: returns 'WeekNN' for past weeks", () => {
    expect(weekLabel("2026-09-04", "2026-09-10")).toBe("Week 36");
  });

  it("HIST-02: handles Sunday belonging to same Monday-start week", () => {
    expect(weekLabel("2026-09-13", "2026-09-10")).toBe("This week");
  });
});
