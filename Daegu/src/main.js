// --- KẾT NỐI SUPABASE ---
const SUPABASE_URL = 'https://ozlyjhhtchxsjkhmiyuw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHlqaGh0Y2h4c2praG1peXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDQ1NjMsImV4cCI6MjA4NzkyMDU2M30.SHvMOBG7lFz7b-igzY91CFQqhU-i5hlqAErPG5vkT2g';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CÁC BIẾN TOÀN CỤC VÀ HÀM TIỆN ÍCH
// ==========================================
let currentCustomerType = 'normal';
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
    const tabs = ['khuvuc', 'nhahang', 'thucdon'];
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
// TAB 1: KHU VỰC VÀ TÁCH GỘP
// ==========================================
async function loadTablesFromCloud() {
    const grid = document.getElementById('table-grid');
    const emptyState = document.getElementById('empty-state');
    const populatedState = document.getElementById('populated-state');
    const headerAddBtn = document.getElementById('header-add-btn');

    const cachedHTML = localStorage.getItem('pos_table_cache');
    if (cachedHTML) {
        grid.innerHTML = cachedHTML; emptyState.classList.add('hidden'); populatedState.classList.remove('hidden'); headerAddBtn.classList.remove('hidden');
    }
    const { data: tables, error: tableErr } = await supabaseClient.from('tables_active').select('*').order('created_at', { ascending: true });
    if (tableErr) return;
    const { data: items } = await supabaseClient.from('order_items').select('table_num, price, quantity');
    const tableTotals = {};
    if (items) items.forEach(item => { if (!tableTotals[item.table_num]) tableTotals[item.table_num] = 0; tableTotals[item.table_num] += item.price * item.quantity; });

    let newHTML = '';
    tables.forEach(table => {
        const vipTag = table.is_vip ? '<span class="text-red-500 text-xs font-bold ml-1">(VIP)</span>' : '';
        const totalAmount = tableTotals[table.table_num] || 0;
        newHTML += `<div class="receipt-wrapper cursor-pointer active:scale-95 transition-transform" data-table-num="${table.table_num}" onclick="window.location.href='menu.html?table=${table.table_num}&vip=${table.is_vip}'"><div class="receipt-card p-3"><div class="flex justify-between items-center mb-2"><span class="text-gray-700 font-mono text-xs">${table.order_id}</span><span class="text-[#0056a3] font-bold text-base">${totalAmount.toLocaleString()} đ</span></div><hr class="border-[--card-border] mb-2"><div class="text-center"><div class="table-name-display text-gray-800 text-base mb-1 font-medium">Bàn ${table.table_num} ${vipTag}</div><div class="text-xs text-green-600 font-medium tracking-wide">Đang phục vụ</div></div></div></div>`;
    });

    grid.innerHTML = newHTML;
    if (tables.length > 0) {
        emptyState.classList.add('hidden'); populatedState.classList.remove('hidden'); headerAddBtn.classList.remove('hidden');
        localStorage.setItem('pos_table_cache', newHTML);
    } else {
        emptyState.classList.remove('hidden'); populatedState.classList.add('hidden'); headerAddBtn.classList.add('hidden');
        localStorage.removeItem('pos_table_cache');
    }
}
function toggleShift() {
    const btn = document.getElementById('btn-shift'), text = document.getElementById('shift-text'), icon = document.getElementById('shift-icon');
    if (!isShiftOpen) {
        if(confirm('MỞ CA bán hàng mới?')) { isShiftOpen = true; btn.className = "bg-red-500 text-white px-4 py-2 rounded font-medium shadow active:bg-red-600 transition flex items-center gap-2"; text.innerText = "Đóng ca"; icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M10 11V7a2 2 0 114 0v4"></path>`; }
    } else {
        if(confirm('CHỐT SỔ và ĐÓNG CA?')) { isShiftOpen = false; btn.className = "bg-green-600 text-white px-4 py-2 rounded font-medium shadow active:bg-green-700 transition flex items-center gap-2"; text.innerText = "Mở ca"; icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>`; }
    }
}
function openAddTableModal() { document.getElementById('add-table-modal').classList.remove('hidden'); document.getElementById('table-number-input').value = ''; setTimeout(() => document.getElementById('table-number-input').focus(), 100); }
function closeAddTableModal() { document.getElementById('add-table-modal').classList.add('hidden'); }
function selectCustomerType(type) {
    currentCustomerType = type;
    document.getElementById('btn-normal').className = type === 'normal' ? "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-medium text-[#0056a3]" : "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
    document.getElementById('btn-vip').className = type === 'vip' ? "flex-1 py-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-sm rounded text-sm font-medium" : "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
}
function generateOrderId() { return '#' + Math.random().toString(36).substring(2, 7).toUpperCase(); }
async function createNewTable() {
    const tableNum = document.getElementById('table-number-input').value.trim();
    if (!tableNum) return alert("Vui lòng nhập số bàn!");
    if (document.querySelector(`.receipt-wrapper[data-table-num="${tableNum}"]`)) return alert(`Bàn ${tableNum} đã có khách!`);
    const { error } = await supabaseClient.from('tables_active').insert([{ table_num: tableNum, order_id: generateOrderId(), is_vip: currentCustomerType === 'vip' }]);
    if (error) return alert("Lỗi khi tạo bàn trên máy chủ!");
    loadTablesFromCloud(); closeAddTableModal();
}
const grid = document.getElementById('table-grid'); const contextMenu = document.getElementById('context-menu');
function showContextMenu(x, y, tableNum) { activeContextMenuTable = tableNum; contextMenu.classList.remove('hidden'); contextMenu.style.left = `${Math.min(x, window.innerWidth - 150)}px`; contextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`; setTimeout(() => { contextMenu.classList.remove('scale-95', 'opacity-0'); contextMenu.classList.add('scale-100', 'opacity-100'); }, 10); }
document.addEventListener('click', (e) => { if (!e.target.closest('#context-menu')) { contextMenu.classList.add('scale-95', 'opacity-0'); setTimeout(() => contextMenu.classList.add('hidden'), 100); } });
grid.addEventListener('contextmenu', (e) => { const card = e.target.closest('.receipt-wrapper'); if (card) { e.preventDefault(); showContextMenu(e.pageX, e.pageY, card.dataset.tableNum); } });
grid.addEventListener('touchstart', (e) => { const card = e.target.closest('.receipt-wrapper'); if (card) { pressTimer = setTimeout(() => { showContextMenu(e.touches[0].pageX, e.touches[0].pageY, card.dataset.tableNum); }, 500); } });
grid.addEventListener('touchend', () => clearTimeout(pressTimer)); grid.addEventListener('touchmove', () => clearTimeout(pressTimer));
async function handleMenuAction(action) {
    contextMenu.classList.add('hidden'); currentActionType = action;
    if (action === 'delete') { if (confirm(`Xóa Bàn ${activeContextMenuTable}?`)) { await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable); loadTablesFromCloud(); } return; }
    const actionNames = { move: 'Chuyển Bàn', split: 'Tách Bàn', merge: 'Gộp Bàn' };
    document.getElementById('action-modal-title').innerText = `${actionNames[action]} ${activeContextMenuTable}`; document.getElementById('action-target-input').value = ''; document.getElementById('action-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('action-target-input').focus(), 100);
}
function closeActionModal() { document.getElementById('action-modal').classList.add('hidden'); }
async function confirmAction() {
    const targetNum = document.getElementById('action-target-input').value.trim();
    if (!targetNum || targetNum === activeContextMenuTable) return alert('Lỗi số bàn!');
    if (currentActionType === 'move') {
        if (document.querySelector(`.receipt-wrapper[data-table-num="${targetNum}"]`)) return alert(`Bàn ${targetNum} đã có khách!`);
        const { data: sourceData } = await supabaseClient.from('tables_active').select('*').eq('table_num', activeContextMenuTable).single();
        await supabaseClient.from('tables_active').insert([{ table_num: targetNum, order_id: sourceData.order_id, is_vip: sourceData.is_vip }]);
        await supabaseClient.from('order_items').update({ table_num: targetNum }).eq('table_num', activeContextMenuTable);
        await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable);
        closeActionModal(); loadTablesFromCloud(); 
    } else { closeActionModal(); openTransferModal(activeContextMenuTable, targetNum, currentActionType); }
}
async function openTransferModal(source, target, action) {
    transferSource = source; transferTarget = target;
    document.getElementById('transfer-title').innerText = `${action === 'split' ? 'TÁCH MÓN' : 'GỘP MÓN'}: Bàn ${source} ➔ Bàn ${target}`;
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
window.onload = () => { 
    loadUIScale(); // Load lại cỡ chữ đã lưu
    switchTab('khuvuc'); 
};

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
    if (salesChartInstance) salesChartInstance.destroy();
    if (labels.length > 0) { salesChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: chartData, backgroundColor: ['#0056a3', '#f97316', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } } }); }
}

// ==========================================
// TAB 3: QUẢN LÝ THỰC ĐƠN VÀ TOPPING
// ==========================================
async function loadAdminMenu() {
    const { data: cats } = await supabaseClient.from('menu_categories').select('*').order('sort_order', { ascending: true });
    const { data: items } = await supabaseClient.from('menu_items').select('*').order('created_at', { ascending: false });
    
    // FIX LỖI 400: Đổi order từ 'created_at' sang 'name' vì bảng toppings không có cột created_at
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

    // Nút Tất cả (Đã thêm select-none và khóa touch-callout của iOS)
    const allCls = adminActiveCategory === 'all' ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-[#0056a3] text-white shadow-sm shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 shrink-0 select-none';
    container.insertAdjacentHTML('beforeend', `<button onclick="setAdminCategory('all')" class="${allCls}" style="-webkit-touch-callout: none;">Tất cả món</button>`);

    // Các thẻ danh mục bình thường
    adminCategories.forEach(cat => {
        const cls = adminActiveCategory === cat.id ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-[#0056a3] text-white shadow-sm shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 shrink-0 select-none';
        
        // ĐÃ SỬA: Thêm ontouchstart, ontouchend để tương thích 100% với iOS
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

    // Nút Topping (Màu cam tách biệt)
    const topCls = adminActiveCategory === 'topping' ? 'px-4 py-1.5 rounded-full text-sm font-bold bg-orange-500 text-white shadow-sm ml-auto shrink-0 select-none' : 'px-4 py-1.5 rounded-full text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 ml-auto shrink-0 select-none';
    container.insertAdjacentHTML('beforeend', `<button onclick="setAdminCategory('topping')" class="${topCls} whitespace-nowrap" style="-webkit-touch-callout: none;">✨ Món thêm / Topping</button>`);
}

function setAdminCategory(id) {
    adminActiveCategory = id;
    renderAdminFilterBar();
    renderAdminContent();
}

function renderAdminContent() {
    const itemList = document.getElementById('admin-item-list');
    const topList = document.getElementById('admin-topping-list');
    const title = document.getElementById('admin-list-title');
    const btnAdd = document.getElementById('btn-add-entity');

    if (adminActiveCategory === 'topping') {
        itemList.classList.add('hidden');
        topList.classList.remove('hidden');
        topList.classList.add('flex');
        title.innerText = 'Danh sách Món thêm / Topping';
        btnAdd.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg> <span>Thêm Topping</span>';
        btnAdd.className = 'text-sm font-bold bg-orange-500 text-white px-3 py-2 rounded-lg shadow-md hover:bg-orange-600 flex items-center gap-1';
        btnAdd.onclick = openToppingModal;

        topList.innerHTML = '';
        if (adminToppings.length === 0) topList.innerHTML = '<p class="text-center text-gray-400 py-5">Chưa có topping nào.</p>';
        adminToppings.forEach(t => {
            const usedCount = adminItems.filter(i => i.toppings && i.toppings.some(top => top.id === t.id)).length;
            topList.insertAdjacentHTML('beforeend', `
                <div onclick="editTopping('${t.id}')" class="bg-white border border-orange-200 rounded-lg p-3 flex justify-between items-center cursor-pointer hover:bg-orange-50 transition shadow-sm">
                    <div>
                        <h4 class="font-bold text-orange-700">${t.name}</h4>
                        <p class="text-xs text-orange-500 mt-0.5">Đang áp dụng cho ${usedCount} món</p>
                    </div>
                    <span class="font-bold text-[#0056a3]">+${t.price.toLocaleString()}đ</span>
                </div>
            `);
        });

    } else {
        itemList.classList.remove('hidden');
        topList.classList.add('hidden');
        topList.classList.remove('flex');
        title.innerText = 'Danh sách món ăn chính';
        btnAdd.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg> <span>Thêm món</span>';
        btnAdd.className = 'text-sm font-bold bg-[#0056a3] text-white px-3 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-1';
        btnAdd.onclick = openItemModal;

        itemList.innerHTML = '';
        const filtered = adminActiveCategory === 'all' ? adminItems : adminItems.filter(i => i.category_id === adminActiveCategory);
        
        filtered.forEach(item => {
            const catName = adminCategories.find(c => c.id === item.category_id)?.name || 'Khác';
            const opacityClass = item.is_active ? '' : 'opacity-50 grayscale';
            const topBadge = (item.toppings && item.toppings.length > 0) ? `<span class="absolute top-2 right-2 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>` : '';
            
            itemList.insertAdjacentHTML('beforeend', `
                <div onclick="editItem('${item.id}')" class="relative bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex gap-3 cursor-pointer hover:shadow-md active:scale-95 transition ${opacityClass}">
                    ${topBadge}
                    <div class="w-14 h-14 bg-gray-50 rounded flex items-center justify-center text-3xl border border-gray-100 shrink-0">${item.img}</div>
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
    document.getElementById('item-id').value = ''; document.getElementById('item-name').value = '';
    document.getElementById('item-price').value = ''; document.getElementById('item-vip-price').value = '';
    document.getElementById('item-icon').value = '🍲'; document.getElementById('item-is-active').checked = true;
    
    const sel = document.getElementById('item-category'); sel.innerHTML = '<option value="">- Chọn thẻ -</option>'; adminCategories.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));
    
    // Ẩn khu vực xem topping vì món mới chưa có topping
    document.getElementById('item-modal-toppings-container').classList.add('hidden');
    
    document.getElementById('btn-delete-item').classList.add('hidden'); 
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
    document.getElementById('item-icon').value = item.img || ''; 
    document.getElementById('item-is-active').checked = item.is_active;
    
    const sel = document.getElementById('item-category'); sel.innerHTML = '<option value="">- Chọn thẻ -</option>'; adminCategories.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${c.id}" ${c.id===item.category_id?'selected':''}>${c.name}</option>`));
    
    // XỬ LÝ HIỂN THỊ CÁC TOPPING ĐANG ÁP DỤNG TRONG MÓN NÀY
    const topsContainer = document.getElementById('item-modal-toppings-container');
    const topsList = document.getElementById('item-modal-toppings-list');
    
    if (item.toppings && item.toppings.length > 0) {
        topsList.innerHTML = item.toppings.map(t => 
            `<span class="px-2 py-1 bg-white border border-orange-200 text-orange-700 text-xs rounded shadow-sm font-medium">${t.name} (+${t.price.toLocaleString()}đ)</span>`
        ).join('');
    } else {
        topsList.innerHTML = '<span class="text-xs text-gray-400 italic mt-1 pl-1">Món này chưa có Topping nào.</span>';
    }
    topsContainer.classList.remove('hidden');
    
    document.getElementById('btn-delete-item').classList.remove('hidden'); 
    document.getElementById('item-modal').classList.remove('hidden');
}

function closeItemModal() { document.getElementById('item-modal').classList.add('hidden'); }

async function saveItem() {
    const id = document.getElementById('item-id').value, name = document.getElementById('item-name').value.trim(), price = parseInt(document.getElementById('item-price').value), vip_price = parseInt(document.getElementById('item-vip-price').value) || price, category_id = document.getElementById('item-category').value, img = document.getElementById('item-icon').value.trim() || '🍲', is_active = document.getElementById('item-is-active').checked;
    if (!name || isNaN(price) || !category_id) return alert("Nhập đủ thông tin!");
    if (id) await supabaseClient.from('menu_items').update({name, price, vip_price, category_id, img, is_active}).eq('id', id); else await supabaseClient.from('menu_items').insert([{name, price, vip_price, category_id, img, is_active}]);
    closeItemModal(); loadAdminMenu();
}

async function deleteItem() { if(confirm("Xóa vĩnh viễn món này?")) { await supabaseClient.from('menu_items').delete().eq('id', document.getElementById('item-id').value); closeItemModal(); loadAdminMenu(); } }

// --- QUẢN LÝ TOPPING (Gắn vào nhiều món) ---
function openToppingModal() {
    document.getElementById('topping-modal-title').innerText = "Thêm Topping Mới";
    document.getElementById('topping-id').value = '';
    document.getElementById('topping-name').value = '';
    document.getElementById('topping-price').value = '';
    document.getElementById('topping-search-item').value = '';
    document.getElementById('btn-delete-topping').classList.add('hidden');
    
    const filterCat = document.getElementById('topping-filter-cat');
    filterCat.innerHTML = '<option value="all">Tất cả thẻ</option>';
    adminCategories.forEach(c => filterCat.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));

    renderToppingItemCheckboxes(); 
    document.getElementById('topping-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('topping-name').focus(), 100);
}

function editTopping(toppingId) {
    const top = adminToppings.find(t => t.id === toppingId);
    if(!top) return;
    
    document.getElementById('topping-modal-title').innerText = "Sửa Topping";
    document.getElementById('topping-id').value = top.id;
    document.getElementById('topping-name').value = top.name;
    document.getElementById('topping-price').value = top.price;
    document.getElementById('topping-search-item').value = '';
    document.getElementById('btn-delete-topping').classList.remove('hidden');

    const filterCat = document.getElementById('topping-filter-cat');
    filterCat.innerHTML = '<option value="all">Tất cả thẻ</option>';
    adminCategories.forEach(c => filterCat.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.name}</option>`));

    renderToppingItemCheckboxes(toppingId);
    document.getElementById('topping-modal').classList.remove('hidden');
}

function closeToppingModal() { document.getElementById('topping-modal').classList.add('hidden'); }

function renderToppingItemCheckboxes(currentToppingId = null) {
    const container = document.getElementById('topping-item-checkboxes');
    const searchTerm = removeVietnameseTones(document.getElementById('topping-search-item').value.toLowerCase());
    const filterCat = document.getElementById('topping-filter-cat').value;
    const tId = currentToppingId || document.getElementById('topping-id').value; 

    container.innerHTML = '';
    
    adminItems.forEach(item => {
        if (filterCat !== 'all' && item.category_id !== filterCat) return;
        if (searchTerm && !removeVietnameseTones(item.name.toLowerCase()).includes(searchTerm)) return;

        const hasThisTopping = item.toppings && item.toppings.some(t => t.id === tId);
        const checkedState = hasThisTopping ? 'checked' : '';

        container.insertAdjacentHTML('beforeend', `
            <label class="flex items-center justify-between p-2 rounded hover:bg-white border border-transparent hover:border-orange-100 cursor-pointer transition">
                <div class="flex items-center gap-2 flex-1">
                    <input type="checkbox" value="${item.id}" class="topping-item-checkbox w-4 h-4 accent-orange-500" ${checkedState}>
                    <span class="text-sm font-medium text-gray-700">${item.name}</span>
                </div>
            </label>
        `);
    });
    
    if(container.innerHTML === '') container.innerHTML = '<p class="text-xs text-gray-400 p-2">Không tìm thấy món phù hợp.</p>';
}

async function saveTopping() {
    const id = document.getElementById('topping-id').value;
    const name = document.getElementById('topping-name').value.trim();
    const price = parseInt(document.getElementById('topping-price').value) || 0;

    if (!name) return alert("Vui lòng nhập tên Topping!");

    let finalToppingId = id;
    if (id) {
        await supabaseClient.from('toppings').update({ name, price }).eq('id', id);
    } else {
        const { data } = await supabaseClient.from('toppings').insert([{ name, price }]).select('id').single();
        if(data) finalToppingId = data.id;
    }

    const checkedCheckboxes = document.querySelectorAll('.topping-item-checkbox:checked');
    const selectedItemIds = Array.from(checkedCheckboxes).map(cb => cb.value);
    const toppingObj = { id: finalToppingId, name: name, price: price };

    const updatePromises = adminItems.map(item => {
        let currentToppings = item.toppings || [];
        const isSelected = selectedItemIds.includes(item.id);
        const hasTopping = currentToppings.some(t => t.id === finalToppingId);

        if (isSelected && !hasTopping) {
            currentToppings.push(toppingObj);
            return supabaseClient.from('menu_items').update({ toppings: currentToppings }).eq('id', item.id);
        } else if (!isSelected && hasTopping) {
            currentToppings = currentToppings.filter(t => t.id !== finalToppingId);
            return supabaseClient.from('menu_items').update({ toppings: currentToppings }).eq('id', item.id);
        } else if (isSelected && hasTopping) {
            currentToppings = currentToppings.map(t => t.id === finalToppingId ? toppingObj : t);
            return supabaseClient.from('menu_items').update({ toppings: currentToppings }).eq('id', item.id);
        }
        return null; 
    }).filter(p => p !== null);

    await Promise.all(updatePromises);
    closeToppingModal();
    loadAdminMenu(); 
}

async function deleteTopping() {
    const tId = document.getElementById('topping-id').value;
    if (!confirm("Xóa vĩnh viễn Topping này khỏi toàn bộ hệ thống?")) return;

    await supabaseClient.from('toppings').delete().eq('id', tId);

    const updatePromises = adminItems.map(item => {
        let currentToppings = item.toppings || [];
        if (currentToppings.some(t => t.id === tId)) {
            const newToppings = currentToppings.filter(t => t.id !== tId);
            return supabaseClient.from('menu_items').update({ toppings: newToppings }).eq('id', item.id);
        }
        return null;
    }).filter(p => p !== null);

    await Promise.all(updatePromises);
    closeToppingModal();
    loadAdminMenu();
}

// ==========================================
// LOGIC CÀI ĐẶT (ZOOM UI)
// ==========================================
function setUIScale(size) {
    // Đổi cỡ chữ gốc của thẻ html -> Toàn bộ Tailwind rem sẽ tự động phình to
    document.documentElement.style.fontSize = size + 'px';
    
    // Lưu vào LocalStorage để F5 không bị mất
    localStorage.setItem('pos_ui_scale', size);
    
    // Cập nhật con số hiển thị
    document.getElementById('ui-scale-display').innerText = size + 'px';
}

function loadUIScale() {
    const savedSize = localStorage.getItem('pos_ui_scale') || '16';
    document.documentElement.style.fontSize = savedSize + 'px';
    
    const slider = document.getElementById('ui-scale-slider');
    if(slider) slider.value = savedSize;
    
    const display = document.getElementById('ui-scale-display');
    if(display) display.innerText = savedSize + 'px';
}