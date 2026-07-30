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
        </style>
    </head>
    <body class="bg-gray-100 min-h-screen">

        <!-- מסך התחברות -->
        <div id="login-screen" class="min-h-screen flex items-center justify-center hidden">
            <div class="bg-white p-8 rounded-xl shadow-lg w-96 max-w-full">
                <h2 class="text-2xl font-bold text-center mb-6 text-gray-800">התחברות למערכת</h2>
                <input type="password" id="password-input" placeholder="הכנס סיסמה" class="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:border-blue-500">
                <button onclick="login()" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold">היכנס</button>
            </div>
        </div>

        <!-- המסך הראשי -->
        <div id="app-screen" class="hidden">
            <!-- סרגל ניווט -->
            <nav class="bg-blue-700 text-white shadow-md">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <div class="flex items-center">
                            <span class="text-xl font-bold">פאנל ניהול נוכחות</span>
                            <div class="mr-10 flex space-x-reverse space-x-4">
                                <button id="tab-reports" onclick="switchTab('reports')" class="px-3 py-2 rounded-md font-medium bg-blue-800">דוח נוכחות</button>
                                <button id="tab-students" onclick="switchTab('students')" class="px-3 py-2 rounded-md font-medium hover:bg-blue-600">ניהול תלמידים</button>
                            </div>
                        </div>
                        <button onclick="logout()" class="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-bold shadow"><i class="fas fa-sign-out-alt ml-2"></i>התנתק</button>
                    </div>
                </div>
            </nav>

            <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                
                <!-- תצוגת דוחות -->
                <div id="reports-view" class="bg-white rounded-xl shadow px-6 py-6">
                    <div class="flex flex-wrap gap-4 items-end mb-6 bg-gray-50 p-4 rounded-lg border">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">בחר תאריך בשבוע המבוקש:</label>
                            <input type="date" id="report-date" onchange="loadReports()" class="border px-4 py-2 rounded-lg w-48">
                        </div>
                        <div class="mr-auto flex gap-2">
                            <input type="text" id="report-emails" placeholder="אימייל לשליחה (מופרד בפסיק)" class="border px-4 py-2 rounded-lg w-64 text-left" dir="ltr">
                            <button onclick="sendEmail()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold"><i class="fas fa-paper-plane ml-2"></i>שלח אימייל</button>
                        </div>
                    </div>
                    <div id="report-container">
                        <!-- הטבלה תרונדר כאן דינמית -->
                        <div class="text-center text-gray-500 py-10">טוען נתונים...</div>
                    </div>
                </div>

                <!-- תצוגת תלמידים -->
                <div id="students-view" class="bg-white rounded-xl shadow px-6 py-6 hidden">
                    
                    <!-- טופס הוספה/עריכה -->
                    <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex flex-wrap gap-3 items-end">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">קוד אישי</label>
                            <input type="text" id="stu-code" class="border px-3 py-1.5 rounded w-24">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">שם פרטי</label>
                            <input type="text" id="stu-first" class="border px-3 py-1.5 rounded w-32">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">משפחה</label>
                            <input type="text" id="stu-last" class="border px-3 py-1.5 rounded w-32">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 mb-1">כיתה</label>
                            <input type="text" id="stu-class" class="border px-3 py-1.5 rounded w-24">
                        </div>
                        <button onclick="saveStudent()" class="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 font-bold h-9">שמור</button>
                        <button onclick="clearForm()" class="bg-gray-400 text-white px-4 py-1.5 rounded hover:bg-gray-500 font-bold h-9 mr-auto">נקה</button>
                    </div>

                    <!-- פעולות מרובות (Bulk) -->
                    <div class="flex items-center gap-4 mb-4 pb-4 border-b">
                        <span class="font-bold text-gray-700">פעולות מרובות:</span>
                        <input type="text" id="bulk-class-input" placeholder="הכנס שם כיתה לשינוי" class="border px-3 py-1.5 rounded w-48 text-sm">
                        <button onclick="applyBulkClass()" class="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 text-sm font-bold">שנה כיתה למסומנים</button>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-right border-collapse">
                            <thead>
                                <tr class="bg-gray-100 text-gray-700">
                                    <th class="border-b p-3 w-10"><input type="checkbox" id="cb-all" onclick="toggleSelectAll()" class="w-4 h-4"></th>
                                    <th class="border-b p-3">קוד</th>
                                    <th class="border-b p-3">שם פרטי</th>
                                    <th class="border-b p-3">משפחה</th>
                                    <th class="border-b p-3">כיתה</th>
                                    <th class="border-b p-3">פעולות</th>
                                </tr>
                            </thead>
                            <tbody id="students-tbody">
                                <!-- תלמידים ירונדרו כאן -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </main>
        </div>

        <script>
            // זיהוי נתיב ה-API באופן אוטומטי (למקרה שהמערכת רצה תחת /tfila/)
            const basePath = window.location.pathname.endsWith('/') ? window.location.pathname.slice(0, -1) : window.location.pathname;
            const API_BASE = basePath.includes('/tfila') ? '/tfila' : '';
            
            let currentMode = 'add'; // 'add' or 'edit'

            // --- מערכת התחברות ואימות ---
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
                        alert('סיסמה שגויה או שגיאת שרת');
                    }
                } catch (e) {
                    alert('שגיאת התחברות');
                }
            }

            function logout() {
                localStorage.removeItem('admin_pass');
                checkAuth();
            }

            // פונקצית מעטפת לבקשות API שמוסיפה את הסיסמה בהדר
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
                
                if (!res.ok) {
                    throw new Error(data.error || 'API Error');
                }
                return data;
            }

            // --- ניווט טאבים ---
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

            // --- ניהול דוחות (טבלה דינמית) ---
            async function loadReports() {
                try {
                    const dateVal = document.getElementById('report-date').value;
                    const endpoint = dateVal ? '/reports?date=' + dateVal : '/reports';
                    const data = await apiCall(endpoint);
                    renderReportTable(data, dateVal);
                } catch (e) {
                    document.getElementById('report-container').innerHTML = '<div class="text-red-500 font-bold p-4 text-center">שגיאה בטעינת נתונים</div>';
                }
            }

            function renderReportTable(data, currentDateStr) {
                let headersHTML = '';
                let subHeadersHTML = '';
                
                data.daysToShow.forEach(d => {
                    const isToday = d.dateStr === currentDateStr;
                    const bgClass = isToday ? 'bg-yellow-200' : 'bg-gray-100';
                    const todaySpan = isToday ? '<br><span class="text-xs text-yellow-700">(היום)</span>' : '';
                    headersHTML += \`<th colspan="2" class="border p-2 text-center text-gray-700 \${bgClass}">\${d.name}\${todaySpan}</th>\`;
                    
                    const subBgClass = isToday ? 'bg-yellow-100' : 'bg-gray-50';
                    subHeadersHTML += \`
                        <th class="border p-1 text-center text-sm font-normal text-gray-600 \${subBgClass}">זמן</th>
                        <th class="border p-1 text-center text-sm font-normal text-gray-600 \${subBgClass}">התנהגות</th>
                    \`;
                });

                let rowsHTML = '';
                data.report.forEach(student => {
                    let cells = '';
                    data.daysToShow.forEach(day => {
                        const isToday = day.dateStr === currentDateStr;
                        const cellBg = isToday ? 'bg-yellow-50' : 'bg-white';
                        const status = student.weeklyStatus[day.index];
                        
                        let timeContent = '';
                        if (status.type === 'ok') timeContent = '<span class="text-green-600 font-bold text-lg">V</span>';
                        else if (status.type === 'absence') timeContent = '<span class="text-red-600 font-bold text-2xl leading-none">-</span>';
                        else if (status.type === 'late') timeContent = \`<span class="text-orange-600 text-sm font-bold">\${status.minutes} דק'</span>\`;

                        cells += \`
                            <td class="border p-2 text-center align-middle \${cellBg}">\${timeContent}</td>
                            <td class="border p-2 text-center align-middle font-bold text-lg \${cellBg}">\${status.behaviorMark}</td>
                        \`;
                    });
                    rowsHTML += \`
                        <tr class="hover:bg-blue-50 transition-colors">
                            <td class="border p-2 font-bold text-gray-800">\${student.first_name}</td>
                            <td class="border p-2 font-bold text-gray-800">\${student.last_name}</td>
                            <td class="border p-2 text-gray-600 text-center">\${student.class_name || ''}</td>
                            \${cells}
                        </tr>
                    \`;
                });

                const parashaText = data.parasha ? ' - ' + data.parasha : '';
                const yearText = data.heYear ? ' ' + data.heYear : '';
                
                document.getElementById('report-container').innerHTML = \`
                    <h2 class="text-2xl font-bold mb-4 text-center text-gray-800">
                        דוח נוכחות שבועי\${parashaText}\${yearText}
                    </h2>
                    <div class="overflow-x-auto border rounded-lg">
                        <table class="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="border p-3 bg-gray-200 text-gray-800 font-bold">שם פרטי</th>
                                    <th rowspan="2" class="border p-3 bg-gray-200 text-gray-800 font-bold">משפחה</th>
                                    <th rowspan="2" class="border p-3 bg-gray-200 text-gray-800 font-bold">כיתה</th>
                                    \${headersHTML}
                                </tr>
                                <tr>\${subHeadersHTML}</tr>
                            </thead>
                            <tbody>\${rowsHTML}</tbody>
                        </table>
                    </div>
                \`;
            }

            async function sendEmail() {
                const emails = document.getElementById('report-emails').value.trim();
                const dateVal = document.getElementById('report-date').value;
                if (!emails) return alert('נא להזין לפחות כתובת אימייל אחת');
                
                try {
                    const res = await apiCall(\`/send-email?email=\${encodeURIComponent(emails)}&date=\${dateVal}\`, 'POST');
                    alert(res.message || 'המייל נשלח בהצלחה!');
                } catch (e) {
                    alert('שגיאה בשליחת המייל: ' + e.message);
                }
            }

            // --- ניהול תלמידים ---
            async function loadStudents() {
                try {
                    const data = await apiCall('/students');
                    const tbody = document.getElementById('students-tbody');
                    tbody.innerHTML = '';
                    
                    data.data.forEach(s => {
                        const safeClass = s.class_name ? s.class_name.replace(/'/g, "\\'") : '';
                        const safeFirst = s.first_name ? s.first_name.replace(/'/g, "\\'") : '';
                        const safeLast = s.last_name ? s.last_name.replace(/'/g, "\\'") : '';
                        
                        tbody.innerHTML += \`
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3 text-center"><input type="checkbox" class="student-cb w-4 h-4 cursor-pointer" value="\${s.code}"></td>
                                <td class="p-3 font-mono text-gray-600">\${s.code}</td>
                                <td class="p-3 font-bold">\${s.first_name}</td>
                                <td class="p-3 font-bold">\${s.last_name}</td>
                                <td class="p-3">\${s.class_name || ''}</td>
                                <td class="p-3">
                                    <button onclick="editStudent('\${s.code}', '\${safeFirst}', '\${safeLast}', '\${safeClass}')" class="text-blue-600 hover:text-blue-800 ml-4 p-1"><i class="fas fa-edit"></i></button>
                                    <button onclick="deleteStudent('\${s.code}')" class="text-red-600 hover:text-red-800 p-1"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        \`;
                    });
                } catch(e) {
                    alert('שגיאה בטעינת תלמידים');
                }
            }

            function clearForm() {
                document.getElementById('stu-code').value = '';
                document.getElementById('stu-code').disabled = false;
                document.getElementById('stu-first').value = '';
                document.getElementById('stu-last').value = '';
                document.getElementById('stu-class').value = '';
                currentMode = 'add';
            }

            function editStudent(code, first, last, cls) {
                document.getElementById('stu-code').value = code;
                document.getElementById('stu-code').disabled = true; // הקוד לא ניתן לשינוי
                document.getElementById('stu-first').value = first;
                document.getElementById('stu-last').value = last;
                document.getElementById('stu-class').value = cls;
                currentMode = 'edit';
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
                    clearForm();
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

            // פעולות מרובות (Bulk)
            function toggleSelectAll() {
                const isChecked = document.getElementById('cb-all').checked;
                document.querySelectorAll('.student-cb').forEach(cb => cb.checked = isChecked);
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

            // הפעלה ראשונית
            window.onload = () => {
                const today = new Date();
                const options = { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' };
                const dateStr = new Intl.DateTimeFormat('en-CA', options).format(today);
                document.getElementById('report-date').value = dateStr;
                
                checkAuth();
                
                // הוספת לחיצה על אנטר בהתחברות
                document.getElementById('password-input').addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') login();
                });
            };
        </script>
    </body>
    </html>
    `;
}
