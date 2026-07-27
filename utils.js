export function getCurrentIsraelTime() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    
    const date = new Intl.DateTimeFormat('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { ...options, hour: '2-digit', minute: '2-digit' }).format(now);
    
    return { date, time, rawDate: now };
}

export function isSaturday(dateString) {
    const d = new Date(dateString);
    return d.getDay() === 6;
}

// פונקציה חדשה: מקבלת תאריך ומחזירה את התאריך של יום ראשון ויום שישי באותו שבוע
export function getWeekRange(dateString) {
    const d = new Date(dateString);
    const day = d.getDay(); // 0 = ראשון
    
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    
    const friday = new Date(sunday);
    friday.setDate(sunday.getDate() + 5);

    const formatDate = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayOfMonth}`;
    };

    return {
        start: formatDate(sunday),
        end: formatDate(friday)
    };
}
