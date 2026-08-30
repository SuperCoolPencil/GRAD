import { formatTime } from '../time';

describe('formatTime', () => {
  it('formats valid 24-hour times in both display modes', () => {
    expect(formatTime('00:05', true)).toBe('00:05');
    expect(formatTime('00:05', false)).toBe('12:05 AM');
    expect(formatTime('13:30', false)).toBe('01:30 PM');
  });

  it.each(['24:00', '12:60', '-1:00', 'noon', '12:3'])('rejects invalid time %s', time => {
    expect(formatTime(time, true)).toBe('Invalid Time');
  });
});
