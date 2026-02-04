/**
 * Utility function to format time from 24-hour to 12-hour AM/PM format
 * @param time24 - Time string in 24-hour format (HH:MM or HH:MM:SS)
 * @returns Time string in 12-hour format (h:MM AM/PM)
 */
export function formatTime12Hour(time24: string): string {
    if (!time24) return '';

    // Extract hours and minutes from HH:MM or HH:MM:SS
    const [hoursStr, minutesStr] = time24.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = minutesStr;

    // Determine AM/PM
    const period = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${hours12}:${minutes} ${period}`;
}
