// --- KẾT NỐI SUPABASE ---
const SUPABASE_URL = 'https://ozlyjhhtchxsjkhmiyuw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHlqaGh0Y2h4c2praG1peXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDQ1NjMsImV4cCI6MjA4NzkyMDU2M30.SHvMOBG7lFz7b-igzY91CFQqhU-i5hlqAErPG5vkT2g';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Các biến trạng thái
let currentCustomerType = 'normal';
let activeContextMenuTable = null; 
let currentActionType = null; 
let pressTimer; 
let isShiftOpen = false;

// ==========================================
// KÉO DỮ LIỆU TỪ MÂY XUỐNG KHI MỞ APP 
// ==========================================
async function loadTablesFromCloud() {
    const { data: tables, error: tableErr } = await supabaseClient.from('tables_active').select('*').order('created_at', { ascending: true });
    
    if (tableErr) {
        console.error("Lỗi tải bàn:", tableErr);
        return alert("Không thể tải dữ liệu từ máy chủ. Kiểm tra mạng!");
    }

    const { data: items, error: itemErr } = await supabaseClient.from('order_items').select('table_num, price, quantity');
    
    const tableTotals = {};
    if (items) {
        items.forEach(item => {
            if (!tableTotals[item.table_num]) tableTotals[item.table_num] = 0; 
            tableTotals[item.table_num] += item.price * item.quantity; 
        });
    }

    const grid = document.getElementById('table-grid');
    grid.innerHTML = ''; 

    tables.forEach(table => {
        const vipTag = table.is_vip ? '<span class="text-red-500 text-xs font-bold ml-1">(VIP)</span>' : '';
        const totalAmount = tableTotals[table.table_num] || 0;

        const cardHTML = `
            <div class="receipt-wrapper cursor-pointer active:scale-95 transition-transform" 
                 data-table-num="${table.table_num}" 
                 data-is-vip="${table.is_vip}"
                 onclick="window.location.href='menu.html?table=${table.table_num}&vip=${table.is_vip}'">
                <div class="receipt-card p-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-gray-700 font-mono text-xs">${table.order_id}</span>
                        <span class="text-[#0056a3] font-bold text-base">${totalAmount.toLocaleString()} đ</span>
                    </div>
                    <hr class="border-[--card-border] mb-2">
                    <div class="text-center">
                        <div class="table-name-display text-gray-800 text-base mb-1 font-medium">Bàn ${table.table_num} ${vipTag}</div>
                        <div class="text-xs text-green-600 font-medium tracking-wide">Đang phục vụ</div>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });

    toggleState(tables.length > 0);
}

window.onload = () => {
    loadTablesFromCloud();
};

// ==========================================
// TẠO BÀN MỚI
// ==========================================
async function createNewTable() {
    const tableNum = document.getElementById('table-number-input').value.trim();
    if (!tableNum) return alert("Vui lòng nhập số bàn!");

    if (document.querySelector(`.receipt-wrapper[data-table-num="${tableNum}"]`)) {
        return alert(`Bàn ${tableNum} đã có khách!`);
    }

    const orderId = generateOrderId();
    const isVip = currentCustomerType === 'vip';

    const { data, error } = await supabaseClient.from('tables_active').insert([
        { table_num: tableNum, order_id: orderId, is_vip: isVip }
    ]);

    if (error) {
        console.error(error);
        return alert("Lỗi khi tạo bàn trên máy chủ: " + error.message);
    }

    loadTablesFromCloud();
    closeAddTableModal();
}

// ==========================================
// XỬ LÝ MENU NGỮ CẢNH (CHUYỂN, XÓA, GỘP)
// ==========================================
async function handleMenuAction(action) {
    contextMenu.classList.add('hidden'); 
    currentActionType = action;

    if (action === 'delete') {
        if (confirm(`Xác nhận XÓA Bàn ${activeContextMenuTable}?`)) {
            const { error } = await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable);
            if (error) return alert("Lỗi khi xóa trên máy chủ!");
            loadTablesFromCloud();
        }
        return;
    }

    const actionNames = { move: 'Chuyển Bàn', split: 'Tách Bàn', merge: 'Gộp Bàn' };
    document.getElementById('action-modal-title').innerText = `${actionNames[action]} ${activeContextMenuTable}`;
    document.getElementById('action-target-input').value = '';
    document.getElementById('action-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('action-target-input').focus(), 100);
}

async function confirmAction() {
    const targetNum = document.getElementById('action-target-input').value.trim();
    if (!targetNum) return alert('Vui lòng nhập số bàn đích!');
    if (targetNum === activeContextMenuTable) return alert('Lỗi: Bàn đích không được trùng với bàn hiện tại!');

    const targetExists = document.querySelector(`.receipt-wrapper[data-table-num="${targetNum}"]`);

    if (currentActionType === 'move') {
        if (targetExists) return alert(`Lỗi: Bàn ${targetNum} đã có khách! Tính năng Chuyển bàn không được phép trùng.`);
        
        const { data: sourceData } = await supabaseClient.from('tables_active').select('*').eq('table_num', activeContextMenuTable).single();
        
        const { error: insertErr } = await supabaseClient.from('tables_active').insert([{
            table_num: targetNum, order_id: sourceData.order_id, is_vip: sourceData.is_vip
        }]);
        if (insertErr) return alert("Lỗi tạo bàn đích: " + insertErr.message);

        await supabaseClient.from('order_items').update({ table_num: targetNum }).eq('table_num', activeContextMenuTable);
        await supabaseClient.from('tables_active').delete().eq('table_num', activeContextMenuTable);
        
        closeActionModal();
        loadTablesFromCloud(); 

    } else if (currentActionType === 'split' || currentActionType === 'merge') {
        closeActionModal();
        openTransferModal(activeContextMenuTable, targetNum, currentActionType);
    }
}

// ==========================================
// LOGIC CHUYỂN MÓN (TÁCH/GỘP)
// ==========================================
let transferItems = [];
let transferSource = '';
let transferTarget = '';

async function openTransferModal(source, target, action) {
    transferSource = source;
    transferTarget = target;
    const actionText = action === 'split' ? 'TÁCH MÓN' : 'GỘP MÓN';
    document.getElementById('transfer-title').innerText = `${actionText}: Bàn ${source} ➔ Bàn ${target}`;

    const { data, error } = await supabaseClient.from('order_items').select('*').eq('table_num', source).order('created_at', { ascending: true });
    
    if (error || !data) return alert("Lỗi tải danh sách món ăn từ máy chủ!");
    if (data.length === 0) return alert("Bàn này chưa gọi món nào để chuyển!");

    transferItems = data.map(item => ({
        ...item,
        transferQty: 1, 
        selected: false
    }));

    const listContainer = document.getElementById('transfer-item-list');
    listContainer.innerHTML = '';

    transferItems.forEach((item, index) => {
        const noteHtml = item.note ? `<p class="text-xs text-orange-500 italic mt-0.5">Lưu ý: ${item.note}</p>` : '';
        const toppingsHtml = (item.toppings && item.toppings.length) ? `<p class="text-xs text-gray-500 mt-0.5">+ ${item.toppings.join(', ')}</p>` : '';

        listContainer.insertAdjacentHTML('beforeend', `
            <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm transition-colors" id="transfer-row-${index}">
                <div class="flex items-start gap-3 flex-1 cursor-pointer" onclick="document.getElementById('chk-${index}').click()">
                    <input type="checkbox" id="chk-${index}" class="mt-1 w-5 h-5 accent-[#0056a3] cursor-pointer" onchange="toggleTransferItem(${index})">
                    <div>
                        <p class="text-sm font-bold text-gray-800">${item.name}</p>
                        ${toppingsHtml}
                        ${noteHtml}
                        <p class="text-xs text-gray-500 mt-1">${item.price.toLocaleString()} đ/sp</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 bg-gray-100 rounded-md p-1 opacity-40 pointer-events-none transition-opacity" id="qty-ctrl-${index}">
                    <button onclick="changeTransferQty(${index}, -1)" class="w-6 h-6 bg-white rounded shadow-sm text-gray-600 font-bold active:scale-95">-</button>
                    <span id="transfer-qty-${index}" class="w-4 text-center text-sm font-bold text-[#0056a3]">1</span>
                    <span class="text-xs text-gray-400 font-medium">/ ${item.quantity}</span>
                    <button onclick="changeTransferQty(${index}, 1)" class="w-6 h-6 bg-white rounded shadow-sm text-[#0056a3] font-bold active:scale-95">+</button>
                </div>
            </div>
        `);
    });

    document.getElementById('transfer-modal').classList.remove('hidden');
}

function toggleTransferItem(index) {
    const isChecked = document.getElementById(`chk-${index}`).checked;
    transferItems[index].selected = isChecked;
    
    const ctrl = document.getElementById(`qty-ctrl-${index}`);
    const row = document.getElementById(`transfer-row-${index}`);
    
    if (isChecked) {
        ctrl.classList.remove('opacity-40', 'pointer-events-none');
        row.classList.add('border-[#0056a3]', 'bg-blue-50/30'); 
    } else {
        ctrl.classList.add('opacity-40', 'pointer-events-none');
        row.classList.remove('border-[#0056a3]', 'bg-blue-50/30');
    }
}

function changeTransferQty(index, change) {
    const item = transferItems[index];
    const newQty = item.transferQty + change;
    if (newQty >= 1 && newQty <= item.quantity) {
        item.transferQty = newQty;
        document.getElementById(`transfer-qty-${index}`).innerText = newQty;
    }
}

function closeTransferModal() {
    document.getElementById('transfer-modal').classList.add('hidden');
}

async function executeTransfer() {
    const selectedItems = transferItems.filter(i => i.selected);
    if (selectedItems.length === 0) return alert('Vui lòng tick chọn ít nhất 1 món để chuyển đi!');

    const { data: targetExists } = await supabaseClient.from('tables_active').select('table_num').eq('table_num', transferTarget).single();

    if (!targetExists) {
        const { data: sourceData } = await supabaseClient.from('tables_active').select('is_vip').eq('table_num', transferSource).single();
        await supabaseClient.from('tables_active').insert([{
            table_num: transferTarget,
            order_id: generateOrderId(), 
            is_vip: sourceData ? sourceData.is_vip : false
        }]);
    }

    for (let item of selectedItems) {
        if (item.transferQty === item.quantity) {
            await supabaseClient.from('order_items').update({ table_num: transferTarget }).eq('id', item.id);
        } else {
            await supabaseClient.from('order_items').update({ quantity: item.quantity - item.transferQty }).eq('id', item.id);
            const newItem = {
                table_num: transferTarget, item_id: item.item_id, name: item.name, price: item.price,
                quantity: item.transferQty, toppings: item.toppings, note: item.note, is_served: item.is_served, is_custom: item.is_custom
            };
            await supabaseClient.from('order_items').insert([newItem]);
        }
    }

    const { data: remainingItems } = await supabaseClient.from('order_items').select('id').eq('table_num', transferSource);
    if (!remainingItems || remainingItems.length === 0) {
        await supabaseClient.from('tables_active').delete().eq('table_num', transferSource);
    }

    alert(`✅ Đã chuyển thành công món sang Bàn ${transferTarget}!`);
    closeTransferModal();
    loadTablesFromCloud(); 
}

// ==========================================
// CÁC HÀM TIỆN ÍCH UI CƠ BẢN (MỞ/ĐÓNG CA, TAB, MODAL)
// ==========================================
function toggleShift() {
    const btn = document.getElementById('btn-shift');
    const text = document.getElementById('shift-text');
    const icon = document.getElementById('shift-icon');

    if (!isShiftOpen) {
        if(confirm('Bạn có chắc chắn muốn MỞ CA bán hàng mới?')) {
            isShiftOpen = true;
            btn.className = "bg-red-500 text-white px-4 py-2 rounded font-medium shadow active:bg-red-600 active:scale-95 transition flex items-center gap-2";
            text.innerText = "Đóng ca";
            icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M10 11V7a2 2 0 114 0v4"></path>`;
        }
    } else {
        if(confirm('Bạn có chắc chắn muốn CHỐT SỔ và ĐÓNG CA?')) {
            isShiftOpen = false;
            btn.className = "bg-green-600 text-white px-4 py-2 rounded font-medium shadow active:bg-green-700 active:scale-95 transition flex items-center gap-2";
            text.innerText = "Mở ca";
            icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>`;
        }
    }
}

function switchTab(tabName) {
    const emptyState = document.getElementById('empty-state');
    const populatedState = document.getElementById('populated-state');
    const dashboardState = document.getElementById('dashboard-state');
    const khuvucHeader = document.getElementById('tab-khuvuc-header');
    const headerAddBtn = document.getElementById('header-add-btn');
    const grid = document.getElementById('table-grid');
    const navKhuVuc = document.getElementById('nav-khuvuc');
    const navNhaHang = document.getElementById('nav-nhahang');

    if (tabName === 'khuvuc') {
        navKhuVuc.classList.replace('text-gray-400', 'text-[#0056a3]');
        navNhaHang.classList.replace('text-[#0056a3]', 'text-gray-400');
        dashboardState.classList.add('hidden');
        khuvucHeader.classList.remove('hidden'); 
        if (grid.children.length > 0) {
            populatedState.classList.remove('hidden');
            headerAddBtn.classList.remove('hidden');
        } else {
            emptyState.classList.remove('hidden');
            headerAddBtn.classList.add('hidden');
        }
    } else if (tabName === 'nhahang') {
        navNhaHang.classList.replace('text-gray-400', 'text-[#0056a3]');
        navKhuVuc.classList.replace('text-[#0056a3]', 'text-gray-400');
        emptyState.classList.add('hidden');
        populatedState.classList.add('hidden');
        khuvucHeader.classList.add('hidden');
        dashboardState.classList.remove('hidden');
        document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
    }
}

function toggleState(hasTables) {
    const emptyState = document.getElementById('empty-state');
    const populatedState = document.getElementById('populated-state');
    const headerAddBtn = document.getElementById('header-add-btn'); 
    if (hasTables) {
        emptyState.classList.add('hidden');
        populatedState.classList.remove('hidden');
        headerAddBtn.classList.remove('hidden'); 
    } else {
        emptyState.classList.remove('hidden');
        populatedState.classList.add('hidden');
        headerAddBtn.classList.add('hidden'); 
    }
}

function openAddTableModal() {
    document.getElementById('add-table-modal').classList.remove('hidden');
    document.getElementById('table-number-input').value = '';
    setTimeout(() => document.getElementById('table-number-input').focus(), 100);
}

function closeAddTableModal() {
    document.getElementById('add-table-modal').classList.add('hidden');
}

function selectCustomerType(type) {
    currentCustomerType = type;
    const btnNormal = document.getElementById('btn-normal');
    const btnVip = document.getElementById('btn-vip');
    if (type === 'normal') {
        btnNormal.className = "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-medium text-[#0056a3] transition-all";
        btnVip.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500 transition-all";
    } else {
        btnVip.className = "flex-1 py-1.5 bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-sm rounded text-sm font-medium transition-all";
        btnNormal.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500 transition-all";
    }
}

function generateOrderId() {
    return '#' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function closeActionModal() {
    document.getElementById('action-modal').classList.add('hidden');
}

// Sự kiện Menu Ngữ Cảnh (Click giữ)
const grid = document.getElementById('table-grid');
const contextMenu = document.getElementById('context-menu');

function showContextMenu(x, y, tableNum) {
    activeContextMenuTable = tableNum;
    contextMenu.classList.remove('hidden');
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 150)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    setTimeout(() => {
        contextMenu.classList.remove('scale-95', 'opacity-0');
        contextMenu.classList.add('scale-100', 'opacity-100');
    }, 10);
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
        contextMenu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => contextMenu.classList.add('hidden'), 100);
    }
});

grid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.receipt-wrapper');
    if (card) {
        e.preventDefault(); 
        showContextMenu(e.pageX, e.pageY, card.dataset.tableNum);
    }
});

grid.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.receipt-wrapper');
    if (card) {
        pressTimer = setTimeout(() => {
            const touch = e.touches[0];
            showContextMenu(touch.pageX, touch.pageY, card.dataset.tableNum);
        }, 500); 
    }
});
grid.addEventListener('touchend', () => clearTimeout(pressTimer));
grid.addEventListener('touchmove', () => clearTimeout(pressTimer));