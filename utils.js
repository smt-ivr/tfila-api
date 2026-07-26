export function getCurrentIsraelTime() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    
    const date = new Intl.DateTimeFormat('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { ...options, hour: '2-digit', minute: '2-digit' }).format(now);
    
    return { date, time };
}

export function calculateLateMinutes(arrivedTime, targetTime) {
    const [arrH, arrM] = arrivedTime.split(':').map(Number);
    const [tarH, tarM] = targetTime.split(':').map(Number);
    
    const arrivedTotal = arrH * 60 + arrM;
    const targetTotal = tarH * 60 + tarM;
    
    const lateMinutes = arrivedTotal - targetTotal;
    
    return Math.max(0, lateMinutes);
}

// פונקציה לבדיקה האם התאריך נופל על יום שבת
export function isSaturday(dateString) {
    const d = new Date(dateString);
    return d.getDay() === 6; // 0=ראשון, ..., 6=שבת
}
