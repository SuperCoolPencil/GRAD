export const formatTime = (time: string, is24Hour: boolean): string => {
  if (typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) {
    return 'Invalid Time';
  }
  const [hours, minutes] = time.split(':');
  let hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return 'Invalid Time';
  }

  if (is24Hour) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }
};
