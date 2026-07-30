export function getAdminHTML() {
    return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>מערכת נוכחות - פאנל ניהול</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            body { font-family: system-ui, -apple-system, sans-serif; }
            .modal-active { overflow: hidden; }
            @media print {
                body { background: white !important; padding: 0 !important; }
                nav, .print-hide { display: none !important; }
                #reports-view { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; }
                table { border-collapse: collapse; width: 100%; border: 1px solid black; }
                th, td { border: 1px solid black !important; padding: 6px !important; color: black !important; }
                .bg-yellow-100 { background-color: #FEF9C3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bg-yellow-50\\/50 { background-color: #FEFCE8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bg-gray-200 { background-color: #E5E7EB !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bg-gray-300 { background-color: #D1D5DB !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .bg-gray-50 { background-color: #F9FAFB !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body class="bg-gray-100 min-h-screen">

        <!-- מסך התחברות -->
        <div id="login-screen" class="min-h-screen flex items-center justify-center hidden print-hide">
            <div class="bg-white p-8 rounded-xl shadow-2xl w-96 max-w-full">
                <div class="text-center mb-6">
                    <i class="fas fa-shield-alt text-4xl text-blue-600 mb-3"></i>
                    <h2 class="text-2xl font-bold text-gray-800">התחברות למערכת</h2>
                </div>
                <input type="password" id="password-input" placeholder="הכנס סיסמה" class="w-full px-4 py-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg">
                <button onclick="login()" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-lg">היכנס</button>
            </div>
        </div>

        <!-- מודל הוספה / עריכת תלמיד -->
        <div id="student-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 print-hide transition-opacity">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4">
                <div class="flex justify-between items-center mb-6">
                    <h3 id="modal-title" class="text-xl font-bold text-gray-800">הוספת תלמיד חדש</h3>
                    <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">קוד אישי (מספר)</label>
                        <input type="number" id="stu-code" class="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">שם פרטי</label>
                            <input type="text" id="stu-first" class="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">משפחה</label>
                            <input type="text" id="stu-last" class="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">כיתה</label>
                        <input type="text" id="stu-class" class="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    </div>
                </div>
                <div class="mt-8 flex justify-end gap-3">
                    <button onclick="closeModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold transition-colors">ביטול</button>
                    <button onclick="saveStudent()" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-colors shadow">שמור תלמיד</button>
                </div>
            </div>
        </div>

        <!-- מודל שליחת אימייל -->
        <div id="email-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 print-hide transition-opacity">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 m-4">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-bold text-gray-800">שליחת דוח למייל</h3>
                    <button onclick="closeEmailModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">כתובות אימייל (מופרדות בפסיק):</label>
                    <input type="text" id="report-emails" class="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left" dir="ltr" placeholder="test@example.com">
                </div>
                <div class="mt-8 flex justify-end gap-3">
                    <button onclick="closeEmailModal()" class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold transition-colors">ביטול</button>
                    <button onclick="sendEmail(this)" class="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-colors shadow flex items-center"><i class="fas fa-paper-plane ml-2"></i>שלח</button>
                </div>
            </div>
        </div>

        <!-- המסך הראשי -->
        <div id="app-screen" class="hidden">
            <!-- סרגל ניווט -->
            <nav class="bg-blue-700 text-white shadow-md sticky top-0 z-40 print-hide">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <div class="flex items-center">
                            <span class="text-xl font-bold ml-8"><i class="fas fa-graduation-cap ml-2"></i>ניהול נוכחות</span>
                            <div class="flex space-x-reverse space-x-2">
                                <button id="tab-reports" onclick="switchTab('reports')" class="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-800">דוח נוכחות</button>
                                <button id="tab-students" onclick="switchTab('students')" class="px-4 py-2 rounded-lg font-medium transition-colors hover:bg-blue-600">ניהול תלמידים</button>
                            </div>
                        </div>
                        <button onclick="logout()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors"><i class="fas fa-sign-out-alt ml-2"></i>התנתק</button>
                    </div>
                </div>
            </nav>

            <main class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                
                <!-- תצוגת דוחות -->
                <div id="reports-view" class="bg-white rounded-2xl shadow-sm border px-6 py-6">
                    <div class="flex flex-wrap gap-4 items-center mb-6 bg-gray-50 p-5 rounded-xl border border-gray-100 justify-between print-hide">
                        <div class="flex items-center gap-3">
                            <label class="block text-sm font-bold text-gray-700">בחר שבוע:</label>
                            <button onclick="changeWeek(-1)" class="bg-white border hover:bg-gray-100 px-3 py-1.5 rounded text-sm shadow-sm transition-colors" title="שבוע קודם"><i class="fas fa-chevron-right"></i></button>
                            <input type="date" id="report-date" onchange="loadReports()" class="border px-3 py-1.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-40">
                            <button onclick="changeWeek(1)" class="bg-white border hover:bg-gray-100 px-3 py-1.5 rounded text-sm shadow-sm transition-colors" title="שבוע הבא"><i class="fas fa-chevron-left"></i></button>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.print()" class="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 font-bold shadow transition-colors"><i class="fas fa-print ml-2"></i>הדפס / שמור כ-PDF</button>
                            <button onclick="openEmailModal()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow transition-colors"><i class="fas fa-envelope ml-2"></i>שלח במייל</button>
                        </div>
                    </div>
                    
                    <div id="report-container">
                        <div class="text-center text-gray-500 py-20 text-lg"><i class="fas fa-circle-notch fa-spin ml-2"></i>טוען נתונים...</div>
                    </div>
                </div>

                <!-- תצוגת תלמידים -->
                <div id="students-view" class="bg-white rounded-2xl shadow-sm border px-6 py-6 hidden print-hide">
                    
                    <!-- סרגל כלים (חיפוש, סינון, כפתור הוספה) -->
                    <div class="flex flex-wrap gap-4 items-center mb-6 bg-gray-50 p-5 rounded-xl border border-gray-100 justify-between">
                        <div class="flex flex-wrap gap-4 items-center w-full md:w-auto">
                            <div class="relative">
                                <i class="fas fa-search absolute right-3 top-3 text-gray-400"></i>
                                <input type="text" id="search-student" oninput="renderStudents()" placeholder="חיפוש לפי שם או קוד..." class="border pl-4 pr-10 py-2 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none">
                            </div>
                            <select id="filter-class" onchange="renderStudents()" class="border px-4 py-2 rounded-lg min-w-[120px] focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="">כל הכיתות</option>
                            </select>
                        </div>
                        <button onclick="openModal('add')" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold shadow transition-colors"><i class="fas fa-plus ml-2"></i>הוסף תלמיד</button>
                    </div>

                    <!-- פעולות מרובות (Bulk) -->
                    <div class="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                        <span class="font-bold text-gray-700 text-sm bg-gray-200 px-3 py-1 rounded-full"><i class="fas fa-layer-group ml-1"></i>פעולות מרובות</span>
                        <input type="text" id="bulk-class-input" placeholder="שם כיתה לעדכון" class="border px-4 py-2 rounded-lg w-48 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <button onclick="applyBulkClass()" class="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow transition-colors">החל על המסומנים</button>
                    </div>

                    <div class="overflow-x-auto rounded-lg border">
                        <table class="w-full text-right border-collapse">
                            <thead>
                                <tr class="bg-gray-100 text-gray-700 border-b">
                                    <th class="p-4 w-10 text-center"><input type="checkbox" id="cb-all" onclick="toggleSelectAll()" class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"></th>
                                    <th class="p-4 font-bold">קוד</th>
                                    <th class="p-4 font-bold">שם פרטי</th>
                                    <th class="p-4 font-bold">משפחה</th>
                                    <th class="p-4 font-bold">כיתה</th>
                                    <th class="p-4 font-bold text-center">פעולות</th>
                                </tr>
                            </thead>
                            <tbody id="students-tbody">
                                <!-- תלמידים ירונדרו כאן -->
                            </tbody>
                        </table>
                        <div id="no-students-msg" class="hidden text-center text-gray-500 py-10 font-medium">לא נמצאו תלמידים תואמים לחיפוש.</div>
                    </div>
                </div>

            </main>
        </div>

        <script>
            const basePath = window.location.pathname.endsWith('/') ? window.location.pathname.slice(0, -1) : window.location.pathname;
            const API_BASE = basePath.includes('/tfila') ? '/tfila' : '';
            
            let currentMode = 'add';
            let allStudents = [];

            function checkAuth() {
                if (!localStorage.getItem('admin_pass')) {
                    document.getElementById('login-screen').classList.remove('hidden');
                    document.getElementById('app-screen').classList.add('hidden');
                } else {
                    document.getElementById('login-screen').classList.add('hidden');
                    document.getElementById('app-screen').classList.remove('hidden');
                    switchTab('reports');
                }
            }

            async function login() {
                const pass = document.getElementById('password-input').value;
                if(!pass) return;
                
                try {
                    const res = await fetch(API_BASE + '/login', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({password: pass})
                    });
                    
                    if (res.ok) {
                        localStorage.setItem('admin_pass', pass);
                        checkAuth();
                    } else {
                        const data = await res.json();
                        alert(data.error || 'שגיאת התחברות');
                    }
                } catch (e) {
                    alert('שגיאת תקשורת עם השרת');
                }
            }

            function logout() {
                localStorage.removeItem('admin_pass');
                checkAuth();
            }

            async function apiCall(endpoint, method = 'GET', body = null) {
                const pass = localStorage.getItem('admin_pass');
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Pass': pass
                    }
                };
                if (body) options.body = JSON.stringify(body);
                
                const res = await fetch(API_BASE + endpoint, options);
                if (res.status === 401) {
                    logout();
                    throw new Error('Unauthorized');
                }
                const isJson = res.headers.get('content-type')?.includes('application/json');
                const data = isJson ? await res.json() : await res.text();
                
                if (!res.ok) throw new Error(data.error || 'API Error');
                return data;
            }

            function switchTab(tab) {
                document.getElementById('reports-view').classList.add('hidden');
                document.getElementById('students-view').classList.add('hidden');
                
                document.getElementById('tab-reports').classList.remove('bg-blue-800');
                document.getElementById('tab-students').classList.remove('bg-blue-800');
                
                document.getElementById(tab + '-view').classList.remove('hidden');
                document.getElementById('tab-' + tab).classList.add('bg-blue-800');
                
                if (tab === 'reports') loadReports();
                if (tab === 'students') loadStudents();
            }

            function changeWeek(offset) {
                const dateInput = document.getElementById('report-date');
                const current = new Date(dateInput.value || new Date());
                current.setDate(current.getDate() + (offset * 7));
                dateInput.value = current.toISOString().split('T')[0];
                loadReports();
            }

            async function toggleVacation(dateStr, isVacation) {
                try {
                    await apiCall('/toggle-vacation', 'POST', { date: dateStr, isVacation });
                    loadReports();
                } catch (e) {
                    alert('שגיאה בעדכון יום חופש: ' + e.message);
                }
            }

            async function loadReports() {
                try {
                    const dateVal = document.getElementById('report-date').value;
                    const endpoint = dateVal ? '/reports?date=' + dateVal : '/reports';
                    document.getElementById('report-container').innerHTML = '<div class="text-center text-blue-500 py-20 text-lg"><i class="fas fa-circle-notch fa-spin ml-2"></i>טוען נתונים...</div>';
                    
                    const data = await apiCall(endpoint);
                    renderReportTable(data);
                } catch (e) {
                    document.getElementById('report-container').innerHTML = '<div class="text-red-500 font-bold p-4 text-center text-lg">שגיאה בטעינת נתונים</div>';
                }
            }

            function renderReportTable(data) {
                let headersHTML = '';
                let subHeadersHTML = '';
                
                const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

                data.daysToShow.forEach(d => {
                    const isToday = d.dateStr === todayStr;
                    const isVacation = d.isVacation;
                    
                    // צביעה אפורה מיוחדת ליום חופש
                    const bgClass = isVacation ? 'bg-gray-300' : (isToday ? 'bg-yellow-100' : 'bg-gray-100');
                    const textClass = isVacation ? 'text-gray-800' : (isToday ? 'text-yellow-800' : 'text-gray-700');
                    const todaySpan = isToday && !isVacation ? '<br><span class="text-xs text-yellow-600 font-normal">(היום)</span>' : '';
                    const vacSpan = isVacation ? '<br><span class="text-xs font-bold text-gray-700 mt-1 block">אין לימודים</span>' : '';
                    const btnLabel = isVacation ? 'בטל חופש' : 'הגדר כחופש';
                    const actionBtn = \`<br><button onclick="toggleVacation('\${d.dateStr}', \${!isVacation})" class="text-xs text-blue-600 hover:text-blue-800 print-hide mt-1 p-1 bg-white/50 rounded shadow-sm">\${btnLabel}</button>\`;
                    
                    headersHTML += \`<th colspan="2" class="border-b border-l border-r p-3 text-center \${bgClass} \${textClass}">\${d.name}\${todaySpan}\${vacSpan}\${actionBtn}</th>\`;
                    
                    const subBgClass = isVacation ? 'bg-gray-200' : 'bg-gray-50';
                    subHeadersHTML += \`
                        <th class="border p-2 text-center text-sm font-normal text-gray-500 \${subBgClass} w-16">זמן</th>
                        <th class="border p-2 text-center text-sm font-normal text-gray-500 \${subBgClass} w-16">התנהגות</th>
                    \`;
                });

                let rowsHTML = '';
                data.report.forEach(student => {
                    let cells = '';
                    data.daysToShow.forEach(day => {
                        const isToday = day.dateStr === todayStr;
                        const isVacation = day.isVacation;
                        
                        // גם תאי הנתונים צבועים באפור בחופש
                        const cellBg = isVacation ? 'bg-gray-200' : (isToday ? 'bg-yellow-50/50' : 'bg-white');
                        const status = student.weeklyStatus[day.index];
                        
                        let timeContent = '';
                        if (status.type === 'ok') timeContent = '<span class="text-green-600 font-bold text-lg">V</span>';
                        else if (status.type === 'absence') timeContent = '<span class="text-red-600 font-bold text-2xl leading-none">-</span>';
                        else if (status.type === 'late') timeContent = \`<span class="text-orange-600 text-xs font-bold bg-orange-100 px-1 py-0.5 rounded">\${status.minutes} דק'</span>\`;

                        cells += \`
                            <td class="border p-2 text-center align-middle \${cellBg}">\${timeContent}</td>
                            <td class="border p-2 text-center align-middle font-bold text-lg \${cellBg} \${status.behaviorMark === 'ב' ? 'text-red-500' : 'text-gray-700'}">\${status.behaviorMark}</td>
                        \`;
                    });
                    rowsHTML += \`
                        <tr class="hover:bg-blue-50/50 transition-colors">
                            <td class="border p-3 font-bold text-gray-800 whitespace-nowrap">\${student.first_name}</td>
                            <td class="border p-3 font-bold text-gray-800 whitespace-nowrap">\${student.last_name}</td>
                            <td class="border p-3 text-gray-600 text-center">\${student.class_name || ''}</td>
                            \${cells}
                        </tr>
                    \`;
                });

                const parashaText = data.parasha ? ' - ' + data.parasha : '';
                const yearText = data.heYear ? ' ' + data.heYear : '';
                
                document.getElementById('report-container').innerHTML = \`
                    <h2 class="text-2xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-2">
                        <i class="far fa-calendar-alt text-blue-600 print-hide"></i>
                        דוח נוכחות שבועי\${parashaText}\${yearText}
                    </h2>
                    <div class="overflow-x-auto rounded-xl border border-gray-200" style="border-radius: 0; border: none;">
                        <table class="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="border p-4 bg-gray-200 text-gray-800 font-bold w-32">שם פרטי</th>
                                    <th rowspan="2" class="border p-4 bg-gray-200 text-gray-800 font-bold w-32">משפחה</th>
                                    <th rowspan="2" class="border p-4 bg-gray-200 text-gray-800 font-bold w-20">כיתה</th>
                                    \${headersHTML}
                                </tr>
                                <tr>\${subHeadersHTML}</tr>
                            </thead>
                            <tbody>\${rowsHTML}</tbody>
                        </table>
                    </div>
                \`;
            }

            function openEmailModal() {
                document.getElementById('email-modal').classList.remove('hidden');
                document.getElementById('email-modal').classList.add('flex');
                document.body.classList.add('modal-active');
            }
            
            function closeEmailModal() {
                document.getElementById('email-modal').classList.add('hidden');
                document.getElementById('email-modal').classList.remove('flex');
                document.body.classList.remove('modal-active');
            }

            async function sendEmail(btnElement) {
                const emails = document.getElementById('report-emails').value.trim();
                const dateVal = document.getElementById('report-date').value;
                if (!emails) return alert('נא להזין לפחות כתובת אימייל אחת');
                
                const originalContent = btnElement.innerHTML;
                btnElement.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i>שולח...';
                btnElement.disabled = true;

                try {
                    const res = await apiCall(\`/send-email?email=\${encodeURIComponent(emails)}&date=\${dateVal}\`, 'POST');
                    alert(res.message || 'המייל נשלח בהצלחה!');
                    closeEmailModal();
                } catch (e) {
                    alert('שגיאה בשליחת המייל: ' + e.message);
                } finally {
                    btnElement.innerHTML = originalContent;
                    btnElement.disabled = false;
                }
            }

            async function loadStudents() {
                try {
                    const data = await apiCall('/students');
                    allStudents = data.data; 
                    updateClassFilter();
                    renderStudents();
                } catch(e) {
                    alert('שגיאה בטעינת תלמידים');
                }
            }

            function updateClassFilter() {
                const classes = [...new Set(allStudents.map(s => s.class_name).filter(Boolean))].sort();
                const select = document.getElementById('filter-class');
                const currentVal = select.value;
                select.innerHTML = '<option value="">כל הכיתות</option>' + classes.map(c => \`<option value="\${c}">\${c}</option>\`).join('');
                select.value = currentVal;
            }

            function renderStudents() {
                const term = document.getElementById('search-student').value.toLowerCase();
                const cls = document.getElementById('filter-class').value;
                const tbody = document.getElementById('students-tbody');
                const emptyMsg = document.getElementById('no-students-msg');
                tbody.innerHTML = '';
                
                const filtered = allStudents.filter(s => {
                    const matchTerm = (s.first_name || '').toLowerCase().includes(term) || 
                                      (s.last_name || '').toLowerCase().includes(term) || 
                                      String(s.code).includes(term);
                    const matchCls = cls ? s.class_name === cls : true;
                    return matchTerm && matchCls;
                });

                if (filtered.length === 0) {
                    emptyMsg.classList.remove('hidden');
                } else {
                    emptyMsg.classList.add('hidden');
                    filtered.forEach(s => {
                        const safeClass = s.class_name ? s.class_name.replace(/'/g, "\\'") : '';
                        const safeFirst = s.first_name ? s.first_name.replace(/'/g, "\\'") : '';
                        const safeLast = s.last_name ? s.last_name.replace(/'/g, "\\'") : '';
                        
                        tbody.innerHTML += \`
                            <tr class="border-b hover:bg-gray-50 transition-colors">
                                <td class="p-4 text-center"><input type="checkbox" class="student-cb w-4 h-4 rounded text-blue-600 cursor-pointer" value="\${s.code}"></td>
                                <td class="p-4 font-mono text-gray-500 font-medium">\${s.code}</td>
                                <td class="p-4 font-bold text-gray-800">\${s.first_name}</td>
                                <td class="p-4 font-bold text-gray-800">\${s.last_name}</td>
                                <td class="p-4"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">\${s.class_name || '-'}</span></td>
                                <td class="p-4 text-center">
                                    <button onclick="openModal('edit', '\${s.code}', '\${safeFirst}', '\${safeLast}', '\${safeClass}')" class="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-full transition-colors mx-1" title="ערוך"><i class="fas fa-edit"></i></button>
                                    <button onclick="deleteStudent('\${s.code}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors mx-1" title="מחק"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        \`;
                    });
                }
            }

            function openModal(mode, code='', first='', last='', cls='') {
                currentMode = mode;
                document.getElementById('modal-title').innerText = mode === 'add' ? 'הוספת תלמיד חדש' : 'עריכת תלמיד';
                document.getElementById('stu-code').value = code;
                document.getElementById('stu-code').disabled = (mode === 'edit');
                document.getElementById('stu-first').value = first;
                document.getElementById('stu-last').value = last;
                document.getElementById('stu-class').value = cls;
                
                document.getElementById('student-modal').classList.remove('hidden');
                document.getElementById('student-modal').classList.add('flex');
                document.body.classList.add('modal-active');
            }

            function closeModal() {
                document.getElementById('student-modal').classList.add('hidden');
                document.getElementById('student-modal').classList.remove('flex');
                document.body.classList.remove('modal-active');
            }

            async function saveStudent() {
                const code = document.getElementById('stu-code').value.trim();
                const first_name = document.getElementById('stu-first').value.trim();
                const last_name = document.getElementById('stu-last').value.trim();
                const class_name = document.getElementById('stu-class').value.trim();
                
                if (!code || !first_name || !last_name) return alert('חובה להזין קוד, שם פרטי ושם משפחה');
                
                const endpoint = currentMode === 'add' ? '/add-student' : '/update-student';
                
                try {
                    await apiCall(endpoint, 'POST', { code, first_name, last_name, class_name });
                    closeModal();
                    loadStudents();
                } catch(e) {
                    alert('שגיאה: ' + e.message);
                }
            }

            async function deleteStudent(code) {
                if(!confirm('האם אתה בטוח שברצונך למחוק תלמיד זה? כל דיווחי הנוכחות שלו יימחקו גם כן!')) return;
                try {
                    await apiCall('/delete-student', 'POST', { code });
                    loadStudents();
                } catch(e) {
                    alert('שגיאה במחיקה: ' + e.message);
                }
            }

            function toggleSelectAll() {
                const isChecked = document.getElementById('cb-all').checked;
                document.querySelectorAll('.student-cb').forEach(cb => {
                    if (cb.closest('tr').style.display !== 'none') {
                        cb.checked = isChecked;
                    }
                });
            }

            async function applyBulkClass() {
                const newClass = document.getElementById('bulk-class-input').value.trim();
                const checkboxes = document.querySelectorAll('.student-cb:checked');
                const codes = Array.from(checkboxes).map(cb => cb.value);
                
                if (codes.length === 0) return alert('אנא סמן תלמידים בטבלה תחילה');
                if (!newClass) return alert('אנא הזן את שם הכיתה החדש');
                
                if(!confirm(\`האם אתה בטוח שברצונך לשנות כיתה ל-\${codes.length} תלמידים?\`)) return;

                try {
                    const res = await apiCall('/bulk-update-students', 'POST', { studentCodes: codes, className: newClass });
                    alert(res.message || 'עודכנו בהצלחה');
                    document.getElementById('bulk-class-input').value = '';
                    document.getElementById('cb-all').checked = false;
                    loadStudents();
                } catch(e) {
                    alert('שגיאה בעדכון מרובה: ' + e.message);
                }
            }

            window.onload = () => {
                const today = new Date();
                const options = { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' };
                const dateStr = new Intl.DateTimeFormat('en-CA', options).format(today);
                document.getElementById('report-date').value = dateStr;
                
                checkAuth();
                
                document.getElementById('password-input').addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') login();
                });
            };
        </script>
    </body>
    </html>
    `;
}
