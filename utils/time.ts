export const formatTime = (time: string, is24Hour: boolean): string => {
  const [hours, minutes] = time.split(':');
  let hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);

  if (is24Hour) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${ampm}`;
  }
};
