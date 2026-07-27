export function getCurrentIsraelTime() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    
    const date = new Intl.DateTimeFormat('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { ...options, hour: '2-digit', minute: '2-digit' }).format(now);
    
    return { date, time };
}

export function isSaturday(dateString) {
    const d = new Date(dateString);
    return d.getDay() === 6;
}
