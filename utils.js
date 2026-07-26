// קבלת הזמן הנוכחי המדויק בשעון ישראל
export function getCurrentIsraelTime() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    
    const date = new Intl.DateTimeFormat('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { ...options, hour: '2-digit', minute: '2-digit' }).format(now);
    
    return { date, time };
}

// חישוב כמות דקות איחור
export function calculateLateMinutes(arrivedTime, targetTime) {
    const [arrH, arrM] = arrivedTime.split(':').map(Number);
    const [tarH, tarM] = targetTime.split(':').map(Number);
    
    const arrivedTotal = arrH * 60 + arrM;
    const targetTotal = tarH * 60 + tarM;
    
    const lateMinutes = arrivedTotal - targetTotal;
    
    // אם הגיע לפני הזמן, מחזיר 0 (אין איחור שלילי)
    return Math.max(0, lateMinutes);
}
