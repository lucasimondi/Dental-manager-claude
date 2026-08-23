export function getVisibleWeekDays(weekStart, hiddenWeekdays = []) {
  const start = new Date(weekStart);
  const hidden = new Set(hiddenWeekdays.map(Number));
  const allDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
  const visibleDays = allDays.filter((day) => !hidden.has(day.getDay()));
  return visibleDays.length > 0 ? visibleDays : allDays;
}
