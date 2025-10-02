export const convertDate = (s) => {
  const days = Math.floor(s / (24 * 60 * 60));
  let remainingSeconds = s;
  if (days !== 0) {
    remainingSeconds -= days * (24 * 60 * 60);
  }

  const date = new Date(0);
  date.setSeconds(remainingSeconds);

  let dayString = '';
  const timeString = date.toISOString().substring(11, 19);
  if (days === 1) {
    dayString = '1 day, ';
  } else if (days > 1) {
    dayString = days + ' days, ';
  }
  return '[' + dayString + timeString + ']';
};
