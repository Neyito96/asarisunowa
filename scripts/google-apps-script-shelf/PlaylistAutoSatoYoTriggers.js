function installSatoYoAutoPlaylistTriggers() {
  const handler = "syncSatoYoAutoPlaylist";
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (existing.length) return { created: 0, existing: existing.length };
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(4).create();
  ScriptApp.newTrigger(handler).timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(12).create();
  return { created: 2, existing: 0 };
}