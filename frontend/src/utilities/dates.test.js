import { convertDate } from './dates';

describe('Date Utilities', () => {
  describe('convertDate', () => {
    it('should convert seconds to formatted duration string', () => {
      expect(convertDate(90061)).toEqual('[1 day, 01:01:01]'); // 86400 + 3600 + 60 + 1
      expect(convertDate(3661)).toEqual('[01:01:01]'); // 3600 + 60 + 1
      expect(convertDate(3600)).toEqual('[01:00:00]');
      expect(convertDate(61)).toEqual('[00:01:01]');
      expect(convertDate(1)).toEqual('[00:00:01]');
    });

    it('should handle multiple days', () => {
      expect(convertDate(172800)).toEqual('[2 days, 00:00:00]'); // 2 days
      expect(convertDate(259200)).toEqual('[3 days, 00:00:00]'); // 3 days
      expect(convertDate(345600)).toEqual('[4 days, 00:00:00]'); // 4 days
    });

    it('should handle zero seconds', () => {
      expect(convertDate(0)).toEqual('[00:00:00]');
    });

    it('should handle single day correctly', () => {
      expect(convertDate(86400)).toEqual('[1 day, 00:00:00]'); // exactly 1 day
      expect(convertDate(86401)).toEqual('[1 day, 00:00:01]'); // 1 day and 1 second
      expect(convertDate(90000)).toEqual('[1 day, 01:00:00]'); // 1 day and 1 hour
    });

    it('should handle partial seconds', () => {
      expect(convertDate(0.5)).toEqual('[00:00:00]'); // less than 1 second
      expect(convertDate(1.5)).toEqual('[00:00:01]'); // rounds down
      expect(convertDate(30.999)).toEqual('[00:00:30]'); // rounds down
    });

    it('should handle large durations', () => {
      expect(convertDate(604800)).toEqual('[7 days, 00:00:00]'); // 1 week
      expect(convertDate(2592000)).toEqual('[30 days, 00:00:00]'); // 30 days
    });

    it('should handle complex durations with days, hours, minutes, and seconds', () => {
      expect(convertDate(93661)).toEqual('[1 day, 02:01:01]'); // 1 day + 2 hours + 1 minute + 1 second
      expect(convertDate(183661)).toEqual('[2 days, 03:01:01]'); // 2 days + 3 hours + 1 minute + 1 second
    });

    it('should handle durations with only hours', () => {
      expect(convertDate(7200)).toEqual('[02:00:00]'); // 2 hours
      expect(convertDate(10800)).toEqual('[03:00:00]'); // 3 hours
    });

    it('should handle durations with only minutes', () => {
      expect(convertDate(60)).toEqual('[00:01:00]'); // 1 minute
      expect(convertDate(120)).toEqual('[00:02:00]'); // 2 minutes
      expect(convertDate(3540)).toEqual('[00:59:00]'); // 59 minutes
    });

    it('should handle durations just under 1 day', () => {
      expect(convertDate(86399)).toEqual('[23:59:59]'); // 1 second less than 1 day
    });

    it('should handle edge case of exactly 2 days', () => {
      expect(convertDate(172800)).toEqual('[2 days, 00:00:00]');
    });
  });
});
