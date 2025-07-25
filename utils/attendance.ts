export const calculateAttendancePercentage = (presents: number, absents: number): number => {
  const totalClasses = presents + absents;
  if (totalClasses === 0) {
    return 100;
  }
  return Math.round((presents / totalClasses) * 100);
};
