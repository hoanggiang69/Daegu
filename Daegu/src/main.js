// --- KẾT NỐI SUPABASE ---
const SUPABASE_URL = 'https://ozlyjhhtchxsjkhmiyuw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHlqaGh0Y2h4c2praG1peXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDQ1NjMsImV4cCI6MjA4NzkyMDU2M30.SHvMOBG7lFz7b-igzY91CFQqhU-i5hlqAErPG5vkT2g';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CÁC BIẾN TOÀN CỤC VÀ HÀM TIỆN ÍCH
// ==========================================
let isShiftOpen = false;
let isDatePickerInitialized = false;
let salesChartInstance = null;

let adminCategories = [];
let adminItems = [];
let adminToppings = [];
let adminActiveCategory = 'all'; 

let activeContextMenuTable = null; 
let currentActionType = null; 
let pressTimer; 
let transferItems = [];
let transferSource = '';
let transferTarget = '';

function getLocalDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
function formatDateVN(dateString) {
    if (!dateString) return '--/--/----';
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
}
function removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// ==========================================
// ĐIỀU HƯỚNG TAB
// ==========================================
function switchTab(tabName) {
    const tabs = ['khuvuc', 'nhahang', 'thucdon', 'caidat']; 
    
    tabs.forEach(tab => {
        document.getElementById(`nav-${tab}`).classList.remove('text-[#0056a3]');
        document.getElementById(`nav-${tab}`).classList.add('text-gray-400');
        document.getElementById(`${tab}-state`).classList.add('hidden');
    });

    document.getElementById(`nav-${tabName}`).classList.replace('text-gray-400', 'text-[#0056a3]');
    document.getElementById(`${tabName}-state`).classList.remove('hidden');
    document.getElementById('tab-khuvuc-header').classList.add('hidden');

    if (tabName === 'khuvuc') {
        document.getElementById('tab-khuvuc-header').classList.remove('hidden');
        loadTablesFromCloud(); 
    } else if (tabName === 'nhahang') {
        if (!isDatePickerInitialized) {
            flatpickr("#report-date", { locale: "vn", dateFormat: "Y-m-d", defaultDate: "today", disableMobile: "true", 
                onChange: function(sel, dateStr) { document.getElementById('display-date').innerText = formatDateVN(dateStr); loadDashboard(); }
            });
            document.getElementById('custom-date-btn').addEventListener('click', () => document.getElementById('report-date')._flatpickr.open());
            isDatePickerInitialized = true;
        }
        const todayStr = getLocalDateString();
        document.getElementById('display-date').innerText = formatDateVN(todayStr);
        document.getElementById('report-date').value = todayStr;
        loadDashboard(); 
    } else if (tabName === 'thucdon') {
        loadAdminMenu();
    }
}

// ==========================================
// TAB 1: KHU VỰC, TẠO ĐƠN VÀ TÁCH GỘP BÀN
// ==========================================
async function loadTablesFromCloud() {
    const { data: tables, error } = await supabaseClient.from('tables_active').select('*').order('created_at', { ascending: true });
    if (error || !tables) return;

    let tableTotals = {};
    if (tables.length > 0) {
        const activeTableNums = tables.map(t => t.table_num);
        const { data: allItems } = await supabaseClient.from('order_items').select('table_num, price, quantity').in('table_num', activeTableNums);
        if (allItems) {
            allItems.forEach(item => {
                if (!tableTotals[item.table_num]) tableTotals[item.table_num] = 0;
                tableTotals[item.table_num] += (item.price * item.quantity);
            });
        }
    }

    // --- CÁC BIẾN GIAO DIỆN ---
    const emptyState = document.getElementById('empty-table-state');
    const takeawaySection = document.getElementById('takeaway-section');
    const dineinSection = document.getElementById('dinein-section');
    const takeawayGrid = document.getElementById('takeaway-grid');
    const dineinGrid = document.getElementById('dinein-grid');
    
    takeawayGrid.innerHTML = '';
    dineinGrid.innerHTML = '';

    // --- LOGIC HIỂN THỊ TRẠNG THÁI TRỐNG ---
    if (tables.length === 0) {
        // Nếu không có bàn nào: Hiện nút to, ẩn hết các khu vực lưới
        if (emptyState) emptyState.classList.remove('hidden');
        if (takeawaySection) takeawaySection.classList.add('hidden');
        if (dineinSection) dineinSection.classList.add('hidden');
        return; // Dừng hàm luôn
    }

    // Nếu CÓ bàn: Ẩn nút to, bật khu vực lưới tại quán lên
    if (emptyState) emptyState.classList.add('hidden');
    if (dineinSection) dineinSection.classList.remove('hidden');

    let hasTakeaway = false;

    // --- VÒNG LẶP VẼ THẺ BÀN (Giữ nguyên như cũ) ---
    tables.forEach(table => {
        const isTakeaway = table.table_num.startsWith('Ship -');
        const shortName = isTakeaway ? table.table_num.replace('Ship - ', '') : table.table_num;
        
        const totalAmount = tableTotals[table.table_num] || 0;
        const createdDate = new Date(table.created_at);
        const formattedTime = `${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
        const vipBadge = table.is_vip ? `<span class="bg-gradient-to-r from-orange-400 to-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 shadow-sm">VIP</span>` : '';

        if (isTakeaway) {
            takeawayGrid.insertAdjacentHTML('beforeend', `
                <div data-table-num="${table.table_num}" onclick="window.location.href='menu.html?table=${encodeURIComponent(table.table_num)}'" 
                     class="receipt-wrapper bg-orange-50 border-2 border-orange-300 rounded-xl p-3 flex flex-col cursor-pointer shadow-sm hover:shadow-md transition active:scale-95 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-2 w-full border-b border-orange-200 pb-2">
                        <div class="w-full overflow-hidden">
                            <span class="font-bold text-orange-700 text-base truncate block">${shortName}</span>
                            <p class="text-[10px] text-orange-500 font-mono mt-0.5">Mã: ${table.order_id}</p>
                        </div>
                        <div class="flex flex-col items-end pl-1 shrink-0"><span class="text-xl">🛵</span></div>
                    </div>
                    <div class="w-full space-y-1 mt-1">
                        <div class="flex justify-between text-[11px]">
                            <span class="text-orange-600/70 font-medium">Giờ đặt:</span>
                            <span class="font-bold text-orange-800">${formattedTime}</span>
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span class="text-orange-600/70 font-medium">Đợi ship/mang về:</span>
                            <span class="font-bold text-red-500 time-counter" data-time="${table.created_at}">00:00</span>
                        </div>
                    </div>
                    <div class="w-full mt-3 pt-2 border-t border-orange-200 flex justify-between items-center">
                        <span class="text-xs font-bold text-orange-600">Tổng:</span>
                        <span class="font-bold text-orange-700 text-sm">${totalAmount.toLocaleString()}đ</span>
                    </div>
                </div>
            `);
            hasTakeaway = true; 
        } else {
            dineinGrid.insertAdjacentHTML('beforeend', `
                <div data-table-num="${table.table_num}" onclick="window.location.href='menu.html?table=${encodeURIComponent(table.table_num)}'" 
                     class="receipt-wrapper bg-white border-2 border-[#0056a3] rounded-xl p-3 flex flex-col cursor-pointer shadow-sm hover:shadow-md transition active:scale-95 relative overflow-hidden">
                    <div class="flex justify-between items-start mb-2 w-full border-b border-gray-100 pb-2">
                        <div class="w-full overflow-hidden flex items-center">
                            <span class="font-bold text-[#0056a3] text-base truncate block">Bàn ${shortName}</span>
                            ${vipBadge}
                        </div>
                        <div class="flex flex-col items-end pl-1 shrink-0"><span class="text-xl">🍽️</span></div>
                    </div>
                    <p class="text-[10px] text-gray-400 font-mono mb-2">Mã: ${table.order_id}</p>
                    <div class="w-full space-y-1">
                        <div class="flex justify-between text-[11px]">
                            <span class="text-gray-500 font-medium">Giờ vào:</span>
                            <span class="font-bold text-gray-700">${formattedTime}</span>
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span class="text-gray-500 font-medium">Thời gian ngồi:</span>
                            <span class="font-bold text-[#0056a3] time-counter" data-time="${table.created_at}">00:00</span>
                        </div>
                    </div>
                    <div class="w-full mt-3 pt-2 border-t border-gray-100 flex justify-between items-center">
                        <span class="text-xs font-bold text-gray-500">Tổng:</span>
                        <span class="font-bold text-[#0056a3] text-sm">${totalAmount.toLocaleString()}đ</span>
                    </div>
                </div>
            `);
        }
    });

    if (hasTakeaway) takeawaySection.classList.remove('hidden');
    else takeawaySection.classList.add('hidden');

    updateAllTimers();
}

// LOGIC MỞ ĐƠN TẠI BÀN / MANG VỀ
let currentOrderType = 'dinein';
let currentCustomerType = 'normal'; // Khôi phục biến VIP

function openTableModal() {
    document.getElementById('table-modal').classList.remove('hidden');
    document.getElementById('step-1-choose').classList.remove('hidden');
    document.getElementById('step-2-input').classList.add('hidden');
    document.getElementById('table-input').value = '';
    document.getElementById('takeaway-input').value = '';
    selectCustomerType('normal'); // Mặc định reset về khách lẻ
}

function selectOrderType(type) {
    currentOrderType = type;
    document.getElementById('step-1-choose').classList.add('hidden');
    document.getElementById('step-2-input').classList.remove('hidden');
    
    if (type === 'dinein') {
        document.getElementById('form-dinein').classList.remove('hidden');
        document.getElementById('form-takeaway').classList.add('hidden');
        document.getElementById('table-input').focus();
    } else {
        document.getElementById('form-takeaway').classList.remove('hidden');
        document.getElementById('form-dinein').classList.add('hidden');
        document.getElementById('takeaway-input').focus();
    }
}

// Khôi phục hàm chuyển đổi VIP / Normal
function selectCustomerType(type) {
    currentCustomerType = type;
    const btnNormal = document.getElementById('btn-normal');
    const btnVip = document.getElementById('btn-vip');
    if(btnNormal && btnVip) {
        btnNormal.className = type === 'normal' ? "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-medium text-[#0056a3]" : "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
        btnVip.className = type === 'vip' ? "flex-1 py-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-sm rounded text-sm font-medium" : "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
    }
}

function closeTableModal() {
    document.getElementById('table-modal').classList.add('hidden');
}

// HÀM CHỐT TẠO ĐƠN (Đã sửa lỗi không lưu bàn)
async function confirmOpenTable() {
    let finalTableName = "";
    let isVip = false;
    
    if (currentOrderType === 'dinein') {
        const tNum = document.getElementById('table-input').value.trim();
        if(!tNum) return alert("Vui lòng nhập số bàn!");
        
        // Kiểm tra bàn trùng lặp trên giao diện
        if (document.querySelector(`.receipt-wrapper[data-table-num="${tNum}"]`)) {
            return alert(`Bàn ${tNum} đang có khách!`);
        }
        finalTableName = tNum;
        isVip = currentCustomerType === 'vip';
    } else {
        let cName = document.getElementById('takeaway-input').value.trim();
        if (!cName) {
            const now = new Date();
            const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            cName = `Khách (${timeString})`;
        }
        finalTableName = "Ship - " + cName; 
        isVip = false; // Đơn ship mặc định không có VIP
    }

    // --- BƯỚC QUAN TRỌNG NHẤT: LƯU LÊN SUPABASE TRƯỚC ---
    const { error } = await supabaseClient.from('tables_active').insert([{ 
        table_num: finalTableName, 
        order_id: generateOrderId(), 
        is_vip: isVip 
    }]);

    if (error) {
        return alert("Lỗi khi tạo bàn trên máy chủ: " + error.message);
    }

    // --- LƯU THÀNH CÔNG RỒI MỚI CHUYỂN SANG TRANG GỌI MÓN ---
    window.location.href = `menu.html?table=${encodeURIComponent(finalTableName)}`;
}

// LOGIC TÁCH / GỘP BÀN
function generateOrderId() { return '#' + Math.random().toString(36).substring(2, 7).toUpperCase(); }
const contextMenu = document.getElementById('context-menu');
const khuvucState = document.getElementById('khuvuc-state'); // Đã sửa ID bám dính

function showContextMenu(x, y, tableNum) { 
    activeContextMenuTable = tableNum; 
    contextMenu.classList.remove('hidden'); 
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 150)}px`; 
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`; 
    setTimeout(() => { contextMenu.classList.remove('scale-95', 'opacity-0'); contextMenu.classList.add('scale-100', 'opacity-100'); }, 10); 
}

document.addEventListener('click', (e) => { 
    if (!e.target.closest('#context-menu') && contextMenu) { 
        contextMenu.classList.add('scale-95', 'opacity-0'); 
        setTimeout(() => contextMenu.classList.add('hidden'), 100); 
    } 
});

if(khuvucState) {
    khuvucState.addEventListener('contextmenu', (e) => { const card = e.target.closest('.receipt-wrapper'); if (card) { e.preventDefault(); showContextMenu(e.pageX, e.pageY, card.dataset.tableNum); } });
    khuvucState.addEventListener('touchstart', (e) => { const card = e.target.closest('.receipt-wrapper'); if (card) { pressTimer = setTimeout(() => { showContextMenu(e.touches[0].pageX, e.touches[0].pageY, card.dataset.tableNum); }, 500); } });
    khuvucState.addEventListener('touchend', () => clearTimeout(pressTimer)); 
    khuvucState.addEventListener('touchmove', () => clearTimeout(pressTimer));
}

async function handleMenuAction(action) {
    contextMenu.classList.add('hidden'); currentActionType = action;
    if (action === 'delete') { if (confirm(`Hủy Đơn/Bàn ${activeContextMenuTable} này?`)) { await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable); await supabaseClient.from('order_items').delete().eq('table_num', activeContextMenuTable); loadTablesFromCloud(); } return; }
    const actionNames = { move: 'Chuyển Bàn', split: 'Tách Bàn', merge: 'Gộp Bàn' };
    document.getElementById('action-modal-title').innerText = `${actionNames[action]} ${activeContextMenuTable}`; document.getElementById('action-target-input').value = ''; document.getElementById('action-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('action-target-input').focus(), 100);
}
function closeActionModal() { document.getElementById('action-modal').classList.add('hidden'); }

async function confirmAction() {
    const targetNum = document.getElementById('action-target-input').value.trim();
    if (!targetNum || targetNum === activeContextMenuTable) return alert('Lỗi số bàn đích!');
    if (currentActionType === 'move') {
        if (document.querySelector(`.receipt-wrapper[data-table-num="${targetNum}"]`)) return alert(`Bàn đích ${targetNum} đã có khách!`);
        const { data: sourceData } = await supabaseClient.from('tables_active').select('*').eq('table_num', activeContextMenuTable).single();
        await supabaseClient.from('tables_active').insert([{ table_num: targetNum, order_id: sourceData.order_id, is_vip: sourceData.is_vip }]);
        await supabaseClient.from('order_items').update({ table_num: targetNum }).eq('table_num', activeContextMenuTable);
        await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable);
        closeActionModal(); loadTablesFromCloud(); 
    } else { closeActionModal(); openTransferModal(activeContextMenuTable, targetNum, currentActionType); }
}

async function openTransferModal(source, target, action) {
    transferSource = source; transferTarget = target;
    document.getElementById('transfer-title').innerText = `${action === 'split' ? 'TÁCH MÓN' : 'GỘP MÓN'}: ${source} ➔ ${target}`;
    const { data } = await supabaseClient.from('order_items').select('*').eq('table_num', source).order('created_at', { ascending: true });
    if (!data || data.length === 0) return alert("Bàn trống!");
    transferItems = data.map(item => ({ ...item, transferQty: 1, selected: false }));
    const listContainer = document.getElementById('transfer-item-list'); listContainer.innerHTML = '';
    transferItems.forEach((item, index) => {
        listContainer.insertAdjacentHTML('beforeend', `<div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm" id="transfer-row-${index}"><div class="flex items-start gap-3 flex-1 cursor-pointer" onclick="document.getElementById('chk-${index}').click()"><input type="checkbox" id="chk-${index}" class="mt-1 w-5 h-5 accent-[#0056a3]" onchange="toggleTransferItem(${index})"><div><p class="text-sm font-bold text-gray-800">${item.name}</p><p class="text-xs text-gray-500 mt-1">${item.price.toLocaleString()} đ</p></div></div><div class="flex items-center gap-2 bg-gray-100 rounded-md p-1 opacity-40 pointer-events-none" id="qty-ctrl-${index}"><button onclick="changeTransferQty(${index}, -1)" class="w-6 h-6 bg-white rounded shadow-sm font-bold">-</button><span id="transfer-qty-${index}" class="w-4 text-center text-sm font-bold text-[#0056a3]">1</span><span class="text-xs text-gray-400">/ ${item.quantity}</span><button onclick="changeTransferQty(${index}, 1)" class="w-6 h-6 bg-white rounded shadow-sm text-[#0056a3] font-bold">+</button></div></div>`);
    });
    document.getElementById('transfer-modal').classList.remove('hidden');
}

function toggleTransferItem(index) {
    const isChecked = document.getElementById(`chk-${index}`).checked; transferItems[index].selected = isChecked;
    const ctrl = document.getElementById(`qty-ctrl-${index}`), row = document.getElementById(`transfer-row-${index}`);
    if (isChecked) { ctrl.classList.remove('opacity-40', 'pointer-events-none'); row.classList.add('border-[#0056a3]', 'bg-blue-50/30'); } else { ctrl.classList.add('opacity-40', 'pointer-events-none'); row.classList.remove('border-[#0056a3]', 'bg-blue-50/30'); }
}

function changeTransferQty(index, change) {
    const item = transferItems[index], newQty = item.transferQty + change;
    if (newQty >= 1 && newQty <= item.quantity) { item.transferQty = newQty; document.getElementById(`transfer-qty-${index}`).innerText = newQty; }
}

function closeTransferModal() { document.getElementById('transfer-modal').classList.add('hidden'); }

async function executeTransfer() {
    const selected = transferItems.filter(i => i.selected); if (selected.length === 0) return alert('Tick chọn món!');
    const { data: tExist } = await supabaseClient.from('tables_active').select('table_num').eq('table_num', transferTarget).single();
    if (!tExist) { const { data: sData } = await supabaseClient.from('tables_active').select('is_vip').eq('table_num', transferSource).single(); await supabaseClient.from('tables_active').insert([{ table_num: transferTarget, order_id: generateOrderId(), is_vip: sData ? sData.is_vip : false }]); }
    for (let item of selected) {
        if (item.transferQty === item.quantity) { await supabaseClient.from('order_items').update({ table_num: transferTarget }).eq('id', item.id); } 
        else { await supabaseClient.from('order_items').update({ quantity: item.quantity - item.transferQty }).eq('id', item.id); await supabaseClient.from('order_items').insert([{ table_num: transferTarget, item_id: item.item_id, name: item.name, price: item.price, quantity: item.transferQty, toppings: item.toppings, note: item.note, is_served: item.is_served, is_custom: item.is_custom }]); }
    }
    const { data: rem } = await supabaseClient.from('order_items').select('id').eq('table_num', transferSource);
    if (!rem || rem.length === 0) await supabaseClient.from('tables_active').delete().eq('table_num', transferSource);
    closeTransferModal(); loadTablesFromCloud(); 
}

// ==========================================
// TAB 2: LOGIC NHÀ HÀNG (BÁO CÁO & BIỂU ĐỒ)
// ==========================================
async function loadDashboard() {
    const selectedDate = document.getElementById('report-date').value;
    if (!selectedDate) return;
    const startOfDay = new Date(`${selectedDate}T00:00:00+07:00`).toISOString();
    const endOfDay = new Date(`${selectedDate}T23:59:59+07:00`).toISOString();
    const { data: receipts } = await supabaseClient.from('receipts').select('total_amount, items_summary').gte('created_at', startOfDay).lte('created_at', endOfDay);
    if (!receipts) return;
    document.getElementById('dashboard-revenue').innerText = receipts.reduce((sum, r) => sum + r.total_amount, 0).toLocaleString() + ' đ';
    document.getElementById('dashboard-orders').innerText = receipts.length + ' đơn';
    const itemCounts = {};
    receipts.forEach(r => { if (r.items_summary) r.items_summary.forEach(i => { if (!itemCounts[i.name]) itemCounts[i.name] = 0; itemCounts[i.name] += i.qty; }); });
    const labels = Object.keys(itemCounts), chartData = Object.values(itemCounts), ctx = document.getElementById('salesChart');
    if(ctx) {
        if (salesChartInstance) salesChartInstance.destroy();
        if (labels.length > 0) { salesChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: chartData, backgroundColor: ['#0056a3', '#f97316', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } } }); }
    }
}

// ==========================================
// TAB 3: QUẢN LÝ THỰC ĐƠN VÀ TOPPING
// ==========================================
async function loadAdminMenu() {
    const { data: cats } = await supabaseClient.from('menu_categories').select('*').order('sort_order', { ascending: true });
    const { data: items } = await supabaseClient.from('menu_items').select('*').order('created_at', { ascending: false });
    const { data: tops } = await supabaseClient.from('toppings').select('*').order('name', { ascending: true });
    
    adminCategories = cats || [];
    adminItems = items || [];
    adminToppings = tops || [];

    renderAdminFilterBar();
    renderAdminContent();
}

function renderAdminFilterBar() {
    const container = document.getElementById('admin-category-list');
    container.innerHTML = '';

    const allCls = adminActiveCategory === 'all' ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-[#0056a3] text-white shadow-sm shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 shrink-0 select-none';
    container.insertAdjacentHTML('beforeend', `<button onclick="setAdminCategory('all')" class="${allCls}" style="-webkit-touch-callout: none;">Tất cả món</button>`);

    adminCategories.forEach(cat => {
        const cls = adminActiveCategory === cat.id ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-[#0056a3] text-white shadow-sm shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 shrink-0 select-none';
        
        container.insertAdjacentHTML('beforeend', `
            <button 
                onclick="setAdminCategory('${cat.id}')" 
                oncontextmenu="editCategory('${cat.id}', '${cat.name}'); return false;" 
                ontouchstart="pressTimer = setTimeout(() => editCategory('${cat.id}', '${cat.name}'), 600)"
                ontouchend="clearTimeout(pressTimer)"
                ontouchmove="clearTimeout(pressTimer)"
                class="${cls}" 
                style="-webkit-touch-callout: none;" 
                title="Click giữ để sửa">${cat.name}
            </button>
        `);
    });

    const topCls = adminActiveCategory === 'topping' ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-orange-500 text-white shadow-sm ml-auto shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 ml-auto shrink-0 select-none';
    container.insertAdjacentHTML('beforeend', `<button onclick="setAdminCategory('topping')" class="${topCls} whitespace-nowrap" style="-webkit-touch-callout: none;">✨ Món thêm / Topping</button>`);
}

function setAdminCategory(id) {
    adminActiveCategory = id;
    renderAdminFilterBar();
    renderAdminContent();
}

function renderAdminContent() {
    const itemList = document.getElementById('admin-items-grid');
    if(!itemList) return; // Nếu HTML cũ chưa có admin-items-grid thì bỏ qua để không lỗi
    const title = document.getElementById('admin-list-title');

    if (adminActiveCategory === 'topping') {
        title.innerText = 'Danh sách Món thêm / Topping (Tính năng đang bảo trì)';
        itemList.innerHTML = '<p class="text-center text-gray-400 py-5 w-full">Vui lòng quay lại thẻ Tất cả món.</p>';
        return;
    }

    title.innerText = 'Danh sách món ăn chính';
    itemList.innerHTML = '';
    const filtered = adminActiveCategory === 'all' ? adminItems : adminItems.filter(i => i.category_id === adminActiveCategory);
    
    filtered.forEach(item => {
        const catName = adminCategories.find(c => c.id === item.category_id)?.name || 'Khác';
        const opacityClass = item.is_active ? '' : 'opacity-50 grayscale';
        const topBadge = (item.toppings && item.toppings.length > 0) ? `<span class="absolute top-2 right-2 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>` : '';
        
        itemList.insertAdjacentHTML('beforeend', `
            <div onclick="editItem('${item.id}')" class="relative bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex gap-3 cursor-pointer hover:shadow-md active:scale-95 transition ${opacityClass}">
                ${topBadge}
                <div class="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl border border-gray-100 shrink-0">${item.img || '🍲'}</div>
                <div class="flex-1 overflow-hidden">
                    <h4 class="font-bold text-gray-800 text-sm truncate">${item.name}</h4>
                    <p class="text-xs text-gray-500 mb-1">${catName}</p>
                    <div class="flex gap-2 items-end">
                        <span class="text-sm font-bold text-[#0056a3]">${item.price.toLocaleString()}đ</span>
                    </div>
                </div>
            </div>
        `);
    });
}

// --- QUẢN LÝ THẺ (Danh mục) ---
function openCategoryModal() { document.getElementById('category-modal-title').innerText = "Thêm Thẻ Mới"; document.getElementById('cat-id').value = ''; document.getElementById('cat-name').value = ''; document.getElementById('btn-delete-cat').classList.add('hidden'); document.getElementById('category-modal').classList.remove('hidden'); }
function editCategory(id, name) { document.getElementById('category-modal-title').innerText = "Sửa Thẻ"; document.getElementById('cat-id').value = id; document.getElementById('cat-name').value = name; document.getElementById('btn-delete-cat').classList.remove('hidden'); document.getElementById('category-modal').classList.remove('hidden'); }
function closeCategoryModal() { document.getElementById('category-modal').classList.add('hidden'); }
async function saveCategory() {
    const id = document.getElementById('cat-id').value, name = document.getElementById('cat-name').value.trim();
    if (!name) return alert("Vui lòng nhập tên thẻ!");
    if (id) await supabaseClient.from('menu_categories').update({ name }).eq('id', id); else await supabaseClient.from('menu_categories').insert([{ name, sort_order: adminCategories.length + 1 }]);
    closeCategoryModal(); loadAdminMenu();
}
async function deleteCategory() {
    if (confirm("Xóa thẻ này?")) { await supabaseClient.from('menu_categories').delete().eq('id', document.getElementById('cat-id').value); closeCategoryModal(); loadAdminMenu(); }
}

// --- QUẢN LÝ MÓN ĂN CHÍNH ---
function openItemModal() {
    if (adminCategories.length === 0) return alert("Vui lòng tạo ít nhất 1 Thẻ (Danh mục) trước!");
    
    document.getElementById('item-modal-title').innerText = "Thêm Món Mới";
    document.getElementById('item-id').value = ''; 
    document.getElementById('item-name').value = '';
    document.getElementById('item-price').value = ''; 
    document.getElementById('item-vip-price').value = '';
    document.getElementById('item-is-active').checked = true;

    // Phép thuật Emoji
    document.getElementById('item-icon').value = '🍲'; 
    document.getElementById('btn-icon-select').innerText = '🍲'; 
    document.getElementById('emoji-picker').classList.add('hidden'); 
    
    // Đổ danh sách thẻ vào Select Box
    const sel = document.getElementById('item-category'); 
    sel.innerHTML = '<option value="">- Chọn thẻ -</option>'; 
    adminCategories.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));
    
    // Hiện Modal
    document.getElementById('item-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('item-name').focus(), 100);
}

function editItem(id) {
    const item = adminItems.find(i => i.id === id); if(!item) return;
    
    document.getElementById('item-modal-title').innerText = "Sửa Món"; 
    document.getElementById('item-id').value = item.id; 
    document.getElementById('item-name').value = item.name; 
    document.getElementById('item-price').value = item.price; 
    document.getElementById('item-vip-price').value = item.vip_price; 
    document.getElementById('item-is-active').checked = item.is_active;

    // Phép thuật Emoji
    const iconToSet = item.img || '🍲';
    document.getElementById('item-icon').value = iconToSet; 
    document.getElementById('btn-icon-select').innerText = iconToSet; 
    document.getElementById('emoji-picker').classList.add('hidden'); 
    
    // Đổ danh sách thẻ
    const sel = document.getElementById('item-category'); 
    sel.innerHTML = '<option value="">- Chọn thẻ -</option>'; 
    adminCategories.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${c.id}" ${c.id === item.category_id ? 'selected' : ''}>${c.name}</option>`));
    
    // Hiện Modal
    document.getElementById('item-modal').classList.remove('hidden');
}

function closeItemModal() { document.getElementById('item-modal').classList.add('hidden'); }

async function saveItem() {
    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value.trim();
    const price = parseInt(document.getElementById('item-price').value);
    const vip_price = parseInt(document.getElementById('item-vip-price').value) || price;
    const category_id = document.getElementById('item-category').value;
    const img = document.getElementById('item-icon').value.trim() || '🍲';
    const is_active = document.getElementById('item-is-active').checked;
    
    if (!name || isNaN(price) || !category_id) return alert("Nhập đủ thông tin Tên, Giá và Chọn Thẻ!");
    
    if (id) {
        await supabaseClient.from('menu_items').update({name, price, vip_price, category_id, img, is_active}).eq('id', id); 
    } else {
        await supabaseClient.from('menu_items').insert([{name, price, vip_price, category_id, img, is_active}]);
    }
    
    closeItemModal(); 
    loadAdminMenu();
}

async function deleteItem() { 
    if(confirm("Xóa vĩnh viễn món này?")) { 
        await supabaseClient.from('menu_items').delete().eq('id', document.getElementById('item-id').value); 
        closeItemModal(); 
        loadAdminMenu(); 
    } 
}


// ==========================================
// KHO EMOJI ĐỒ ĂN THỨC UỐNG
// ==========================================
const foodEmojis = [
    '🍲','🍜','🍚','🍛','🍣','🍱','🥟','🍤','🍙','🍘','🍥','🥠','🍢','🍡','🍧','🍨','🍦','🥧','🍰','🍮','🎂','🧁','🍭','🍬','🍫','🍿','🍩','🍪','🥐','🍞','🥖','🥨','🥞','🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🥗','🥣','🧈','🧂','🥫','🍠','🥔','🧅','🧄','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🍅','🥥','🥑','🍆','🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥝','🥤','🧋','🧃','🧉','🥛','☕','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🧊','🌶️','🔥','🍋‍🟩'
];

function initEmojiPicker() {
    const grid = document.getElementById('emoji-grid');
    if(!grid) return;
    grid.innerHTML = '';
    foodEmojis.forEach(emoji => {
        grid.insertAdjacentHTML('beforeend', `
            <button type="button" onclick="selectEmoji('${emoji}')" class="p-1 hover:bg-blue-50 rounded cursor-pointer transition transform hover:scale-125 active:scale-95">
                ${emoji}
            </button>
        `);
    });
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    if (picker.classList.contains('hidden')) {
        if (document.getElementById('emoji-grid').children.length === 0) {
            initEmojiPicker();
        }
        picker.classList.remove('hidden');
    } else {
        picker.classList.add('hidden');
    }
}

function selectEmoji(emoji) {
    document.getElementById('item-icon').value = emoji; 
    document.getElementById('btn-icon-select').innerText = emoji; 
    document.getElementById('emoji-picker').classList.add('hidden'); 
}

// ==========================================
// LOGIC CÀI ĐẶT (ZOOM UI)
// ==========================================
function setUIScale(size) {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('pos_ui_scale', size);
    if(document.getElementById('ui-scale-display')) {
        document.getElementById('ui-scale-display').innerText = size + 'px';
    }
}

function loadUIScale() {
    const savedSize = localStorage.getItem('pos_ui_scale') || '16';
    document.documentElement.style.fontSize = savedSize + 'px';
    const slider = document.getElementById('ui-scale-slider');
    if(slider) slider.value = savedSize;
    const display = document.getElementById('ui-scale-display');
    if(display) display.innerText = savedSize + 'px';
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

// --- KHỞI CHẠY KHI VÀO TRANG ---
window.onload = () => { 
    loadUIScale(); 
    switchTab('khuvuc'); 
};

// Đóng bảng Emoji nếu click ra ngoài
document.addEventListener('click', function(event) {
    const picker = document.getElementById('emoji-picker');
    const btn = document.getElementById('btn-icon-select');
    if (picker && btn && !picker.classList.contains('hidden') && !picker.contains(event.target) && !btn.contains(event.target)) {
        picker.classList.add('hidden');
    }
});

// ==========================================
// BỘ ĐẾM THỜI GIAN THỰC (TIMER) CHO CÁC THẺ BÀN
// ==========================================
function updateAllTimers() {
    const timerElements = document.querySelectorAll('.time-counter');
    if (timerElements.length === 0) return;

    const now = new Date();
    
    timerElements.forEach(el => {
        const startTime = new Date(el.getAttribute('data-time'));
        
        // Tính toán khoảng cách thời gian bằng mili-giây
        const diffMs = now - startTime;
        
        // Tránh lỗi giờ âm
        if (diffMs < 0) {
            el.innerText = "00:00";
            return;
        }

        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        // Format hiển thị hh:mm
        el.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // KIỂM TRA XEM ĐÂY LÀ ĐƠN SHIP HAY BÀN TẠI QUÁN
        const isTakeaway = el.closest('#takeaway-grid') !== null;

        if (isTakeaway) {
            // 🛵 ĐƠN SHIP: Quá 30 phút là báo động đỏ nhấp nháy
            if (totalMinutes >= 30) {
                el.classList.add('text-red-600', 'animate-pulse');
                el.classList.remove('text-red-500'); 
            }
        } else {
            // 🍽️ BÀN TẠI QUÁN: Khách ngồi 1-2 tiếng bình thường. 
            // (Tùy chọn: Để 180 phút - tức 3 tiếng mới chuyển màu cam nhắc khéo, còn không thì bỏ qua)
            if (totalMinutes >= 180) {
                el.classList.add('text-orange-500');
                el.classList.remove('text-[#0056a3]');
            }
        }
    });
}

// Cứ mỗi 30 giây (30000ms), hệ thống sẽ quét và cập nhật lại thời gian một lần
// Dùng setInterval() gán cho một biến để tránh bị chạy chồng chéo nếu chuyển tab
if (window.posTimerInterval) clearInterval(window.posTimerInterval);
window.posTimerInterval = setInterval(updateAllTimers, 30000);