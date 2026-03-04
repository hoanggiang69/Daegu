// --- KẾT NỐI SUPABASE ---
const SUPABASE_URL = 'https://ozlyjhhtchxsjkhmiyuw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHlqaGh0Y2h4c2praG1peXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDQ1NjMsImV4cCI6MjA4NzkyMDU2M30.SHvMOBG7lFz7b-igzY91CFQqhU-i5hlqAErPG5vkT2g';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// ĐỒNG BỘ CỠ CHỮ TỪ CÀI ĐẶT
// ==========================================
const savedSize = localStorage.getItem('pos_ui_scale') || '16';
document.documentElement.style.fontSize = savedSize + 'px';

// ==========================================
// CÁC BIẾN TOÀN CỤC
// ==========================================
let allCategories = [];
let allMenuItems = [];
let activeCategoryId = 'all';
let currentSearchTerm = ''; 

let cart = [];
let currentTable = '';
let isVipTable = false;

let activeMenuItem = null; 
let modalQuantity = 1;
let modalBasePrice = 0;

let discountData = { type: 'percent', value: 0 }; 
let finalBillTotal = 0; 

// ==========================================
// HÀM CHUYỂN ĐỔI TIẾNG VIỆT KHÔNG DẤU
// ==========================================
function removeVietnameseTones(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); 
}

// ==========================================
// KHI TRANG LOAD: KÉO THỰC ĐƠN VÀ GIỎ HÀNG TỪ MÂY
// ==========================================
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTable = urlParams.get('table') || 'Trống';
    isVipTable = urlParams.get('vip') === 'true';

    const vipTag = isVipTable ? '<span class="text-red-500 text-sm ml-2 font-bold px-2 py-0.5 bg-red-100 rounded">(VIP)</span>' : '';
    document.getElementById('table-title').innerHTML = `Bàn ${currentTable} ${vipTag}`;
    
    await loadMenuDataFromCloud();
    await loadCartFromCloud(); 
};

// --- TẢI DANH MỤC & MÓN ĂN TỪ DB ---
async function loadMenuDataFromCloud() {
    const { data: cats } = await supabaseClient.from('menu_categories').select('*').order('sort_order', { ascending: true });
    allCategories = cats || [];

    const { data: items } = await supabaseClient.from('menu_items').select('*').eq('is_active', true).order('created_at', { ascending: false });
    allMenuItems = items || [];

    renderCategoryButtons();
    renderMenu();
}

function renderCategoryButtons() {
    const catContainer = document.getElementById('menu-categories');
    catContainer.innerHTML = '';

    const allBtnClass = activeCategoryId === 'all'
        ? 'px-5 py-2 rounded-full text-sm font-medium bg-[#0056a3] text-white whitespace-nowrap shadow-sm transition'
        : 'px-5 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap transition';
    
    catContainer.insertAdjacentHTML('beforeend', `<button onclick="filterMenu('all')" class="${allBtnClass}">Tất cả</button>`);

    allCategories.forEach(cat => {
        const btnClass = activeCategoryId === cat.id
            ? 'px-5 py-2 rounded-full text-sm font-medium bg-[#0056a3] text-white whitespace-nowrap shadow-sm transition'
            : 'px-5 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap transition';
        catContainer.insertAdjacentHTML('beforeend', `<button onclick="filterMenu('${cat.id}')" class="${btnClass}">${cat.name}</button>`);
    });
}

function searchMenu() {
    currentSearchTerm = document.getElementById('search-input').value.trim();
    renderMenu(); 
}

function filterMenu(categoryId) {
    activeCategoryId = categoryId;
    document.getElementById('search-input').value = '';
    currentSearchTerm = '';
    renderCategoryButtons();
    renderMenu();
}

function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = '';

    let filteredItems = activeCategoryId === 'all' ? allMenuItems : allMenuItems.filter(item => item.category_id === activeCategoryId);

    if (currentSearchTerm) {
        const normalizedSearch = removeVietnameseTones(currentSearchTerm.toLowerCase());
        filteredItems = filteredItems.filter(item => removeVietnameseTones(item.name.toLowerCase()).includes(normalizedSearch));
    }

    if(filteredItems.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">Không tìm thấy món nào phù hợp!</div>';
        return;
    }

    filteredItems.forEach(item => {
        const displayPrice = isVipTable ? item.vip_price : item.price;
        const cardHTML = `
            <div onclick="openItemOptions('${item.id}')" class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md active:scale-95 transition-all flex flex-col">
                <div class="h-24 bg-gray-50 flex items-center justify-center text-5xl border-b border-gray-100">${item.img}</div>
                <div class="p-3 flex flex-col flex-1 justify-between">
                    <h3 class="text-sm font-medium text-gray-800 leading-tight mb-2 line-clamp-2">${item.name}</h3>
                    <p class="text-[#0056a3] font-bold">${displayPrice.toLocaleString()} đ</p>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// ==========================================
// KÉO GIỎ HÀNG TỪ MÂY
// ==========================================
async function loadCartFromCloud() {
    const { data, error } = await supabaseClient.from('order_items').select('*').eq('table_num', currentTable).order('created_at', { ascending: true });
    if (error) return alert("Lỗi tải giỏ hàng từ máy chủ!");

    cart = data.map(item => ({
        db_id: item.id, id: item.item_id, name: item.name, currentPrice: item.price,
        quantity: item.quantity, toppings: item.toppings || [], note: item.note || '',
        isServed: item.is_served, isCustom: item.is_custom,
        time_added: item.time_added, 
        printed: item.printed || false, 
        is_cancelled: item.is_cancelled || false
    }));
    
    renderCart();
}

// ==========================================
// LOGIC MODAL TÙY CHỈNH MÓN
// ==========================================
function openItemOptions(itemId) {
    const item = allMenuItems.find(i => i.id === itemId);
    if(!item) return;

    activeMenuItem = item;
    modalBasePrice = isVipTable ? item.vip_price : item.price;
    modalQuantity = 1;

    document.getElementById('modal-item-name').innerText = item.name;
    document.getElementById('modal-item-qty').innerText = modalQuantity;
    document.getElementById('modal-item-note').value = '';
    
    document.getElementById('modal-topping-section').classList.remove('hidden');
    const toppingList = document.getElementById('modal-topping-list');
    
    if (item.toppings && item.toppings.length > 0) {
        toppingList.innerHTML = item.toppings.map(t => `
            <label class="flex items-center justify-between p-2 rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                <div class="flex items-center gap-2">
                    <input type="checkbox" value="${t.id}" data-name="${t.name}" data-price="${t.price}" class="topping-checkbox w-4 h-4 accent-[#0056a3]" onchange="updateModalTotal()">
                    <span class="text-sm text-gray-700">${t.name}</span>
                </div>
                <span class="text-xs font-medium text-gray-500">${t.price > 0 ? '+' + t.price.toLocaleString() + 'đ' : 'Miễn phí'}</span>
            </label>
        `).join('');
    } else {
        toppingList.innerHTML = ''; 
    }

    document.getElementById('custom-topping-form').classList.add('hidden');
    document.getElementById('custom-topping-name').value = '';
    document.getElementById('custom-topping-price').value = '';

    updateModalTotal();
    document.getElementById('item-option-modal').classList.remove('hidden');
}

function closeItemOptions() { document.getElementById('item-option-modal').classList.add('hidden'); }

function changeModalQty(change) {
    if (modalQuantity + change >= 1) {
        modalQuantity += change;
        document.getElementById('modal-item-qty').innerText = modalQuantity;
        updateModalTotal();
    }
}

function toggleCustomToppingForm() {
    const form = document.getElementById('custom-topping-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) document.getElementById('custom-topping-name').focus();
}

function addCustomTopping() {
    const name = document.getElementById('custom-topping-name').value.trim();
    const price = parseInt(document.getElementById('custom-topping-price').value.trim()) || 0; 
    if (!name) return alert('Vui lòng nhập tên Topping!');
    
    const toppingList = document.getElementById('modal-topping-list');
    toppingList.insertAdjacentHTML('beforeend', `
        <label class="flex items-center justify-between p-2 rounded border border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors">
            <div class="flex items-center gap-2">
                <input type="checkbox" checked data-name="${name} (Tùy chọn)" data-price="${price}" class="topping-checkbox w-4 h-4 accent-orange-500" onchange="updateModalTotal()">
                <span class="text-sm text-orange-700 font-medium">${name}</span>
            </div>
            <span class="text-xs font-bold text-orange-600">${price > 0 ? '+' + price.toLocaleString() + 'đ' : 'Miễn phí'}</span>
        </label>
    `);
    
    document.getElementById('custom-topping-name').value = ''; 
    document.getElementById('custom-topping-price').value = '';
    document.getElementById('custom-topping-form').classList.add('hidden');
    updateModalTotal();
}

function updateModalTotal() {
    let toppingTotal = 0;
    document.querySelectorAll('.topping-checkbox:checked').forEach(cb => toppingTotal += parseInt(cb.dataset.price));
    document.getElementById('modal-temp-total').innerText = ((modalBasePrice + toppingTotal) * modalQuantity).toLocaleString() + ' đ';
}

async function saveItemToCart() {
    let selectedToppings = [];
    let toppingPrice = 0;
    document.querySelectorAll('.topping-checkbox:checked').forEach(cb => {
        selectedToppings.push(cb.dataset.name);
        toppingPrice += parseInt(cb.dataset.price);
    });

    const note = document.getElementById('modal-item-note').value.trim();
    const finalPricePerItem = modalBasePrice + toppingPrice;
    const currentTimeStr = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});

    const existingIndex = cart.findIndex(i => 
        i.id === activeMenuItem.id && JSON.stringify(i.toppings) === JSON.stringify(selectedToppings) && 
        i.note === note && i.isCustom !== true && i.printed === false && i.time_added === currentTimeStr 
    );

    if (existingIndex > -1) {
        const existingItem = cart[existingIndex];
        const newQty = existingItem.quantity + modalQuantity;
        const { error } = await supabaseClient.from('order_items').update({ quantity: newQty }).eq('id', existingItem.db_id);
        if (!error) existingItem.quantity = newQty;
    } else {
        const newItem = {
            table_num: currentTable, item_id: activeMenuItem.id, name: activeMenuItem.name, price: finalPricePerItem,
            quantity: modalQuantity, toppings: selectedToppings, note: note, is_served: false, is_custom: false,
            time_added: currentTimeStr, printed: false, is_cancelled: false
        };
        const { data, error } = await supabaseClient.from('order_items').insert([newItem]).select();
        if (!error && data) {
            cart.push({
                db_id: data[0].id, id: data[0].item_id, name: data[0].name, currentPrice: data[0].price,
                quantity: data[0].quantity, toppings: data[0].toppings, note: data[0].note, 
                isServed: data[0].is_served, isCustom: data[0].is_custom,
                time_added: data[0].time_added, printed: data[0].printed, is_cancelled: data[0].is_cancelled
            });
        }
    }
    closeItemOptions();
    renderCart();
}

// ==========================================
// MODAL MÓN TÙY CHỌN 
// ==========================================
function openCustomItemModal() {
    document.getElementById('custom-name').value = ''; document.getElementById('custom-price').value = '';
    document.getElementById('custom-qty').value = '1'; document.getElementById('custom-note').value = '';
    document.getElementById('custom-item-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('custom-name').focus(), 100);
}
function closeCustomItemModal() { document.getElementById('custom-item-modal').classList.add('hidden'); }

async function saveCustomItem() {
    const name = document.getElementById('custom-name').value.trim();
    const price = parseInt(document.getElementById('custom-price').value);
    const qty = parseInt(document.getElementById('custom-qty').value);
    const note = document.getElementById('custom-note').value.trim();

    if (!name || isNaN(price) || isNaN(qty) || qty < 1) return alert('Nhập Tên, Giá, Số lượng hợp lệ!');

    const newItem = {
        table_num: currentTable, item_id: 'custom_' + Date.now(), name: name, price: price,
        quantity: qty, toppings: [], note: note, is_served: false, is_custom: true,
        time_added: new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}), 
        printed: false, is_cancelled: false 
    };

    const { data, error } = await supabaseClient.from('order_items').insert([newItem]).select();
    if (!error && data) {
        cart.push({
            db_id: data[0].id, id: data[0].item_id, name: data[0].name, currentPrice: data[0].price,
            quantity: data[0].quantity, toppings: data[0].toppings, note: data[0].note, isServed: data[0].is_served, isCustom: data[0].is_custom,
            time_added: data[0].time_added, printed: data[0].printed, is_cancelled: data[0].is_cancelled
        });
    }
    closeCustomItemModal();
    renderCart();
}

// ==========================================
// CÁC HÀM CẬP NHẬT GIỎ HÀNG (SUPABASE)
// ==========================================
async function updateQty(index, change) {
    const item = cart[index];
    if (item.printed) return alert("Món này Bếp đang làm rồi! Bác vui lòng bấm vào Menu bên trái để order đợt mới nhé.");

    const newQty = item.quantity + change;
    if (newQty <= 0) {
        await supabaseClient.from('order_items').delete().eq('id', item.db_id);
        cart.splice(index, 1);
    } else {
        await supabaseClient.from('order_items').update({ quantity: newQty }).eq('id', item.db_id);
        cart[index].quantity = newQty;
    }
    renderCart();
}

async function toggleServed(index) {
    const item = cart[index];
    const newStatus = !item.isServed;
    await supabaseClient.from('order_items').update({ is_served: newStatus }).eq('id', item.db_id);
    cart[index].isServed = newStatus;
    renderCart();
}

async function clearCart() {
    if(cart.length > 0 && confirm('Xóa toàn bộ món trong giỏ?')) {
        await supabaseClient.from('order_items').delete().eq('table_num', currentTable); 
        cart = [];
        renderCart();
    }
}

// ==========================================
// VẼ & TÍNH TIỀN GIỎ HÀNG
// ==========================================
function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    let subtotal = 0;

    if (cart.length === 0) {
        cartContainer.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-70"><p class="text-sm">Chưa có món nào</p></div>`;
        document.getElementById('cart-subtotal').innerText = '0 đ';
        document.getElementById('cart-total').innerText = '0 đ';
        document.getElementById('discount-display-row').classList.add('hidden');
        finalBillTotal = 0;
        return;
    }

    cartContainer.innerHTML = '';
    cart.forEach((item, index) => {
        if (item.is_cancelled) return;
        subtotal += item.currentPrice * item.quantity;
        const servedClass = item.isServed ? 'opacity-50 bg-green-50' : 'bg-white';
        const checkboxState = item.isServed ? 'checked' : '';
        const customBadge = item.isCustom ? '<span class="text-[10px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded ml-1">Ngoài menu</span>' : '';

        let extraInfo = '';
        if (item.toppings && item.toppings.length > 0) extraInfo += `<p class="text-xs text-gray-500 mt-0.5">+ ${item.toppings.join(', ')}</p>`;
        if (item.note) extraInfo += `<p class="text-xs text-orange-500 italic mt-0.5">Lưu ý: ${item.note}</p>`;

        cartContainer.insertAdjacentHTML('beforeend', `
            <div class="flex items-start gap-3 p-3 mb-2 rounded-lg border border-gray-100 shadow-sm transition-colors ${servedClass}">
                <input type="checkbox" class="w-5 h-5 mt-1 accent-green-600 rounded cursor-pointer" ${checkboxState} onchange="toggleServed(${index})">
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-800 leading-tight ${item.isServed ? 'line-through text-gray-500' : ''}">${item.name} ${customBadge}</h4>
                    ${extraInfo}
                    <p class="text-sm font-bold text-[#0056a3] mt-1.5">${(item.currentPrice * item.quantity).toLocaleString()} đ</p>
                </div>
                
                ${item.printed ? `
                <div class="flex flex-col items-center justify-center gap-1 bg-green-50/50 rounded-lg p-2 shrink-0 border border-green-200 min-w-[44px]">
                    <svg class="w-4 h-4 text-green-600 mb-0.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                    <span class="text-base font-black text-green-700">x${item.quantity}</span>
                </div>
                ` : `
                <div class="flex flex-col items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                    <button onclick="updateQty(${index}, 1)" class="w-7 h-7 flex justify-center items-center bg-white rounded shadow-sm text-[#0056a3] font-bold active:scale-95">+</button>
                    <span class="w-full text-center text-sm font-medium py-1">${item.quantity}</span>
                    <button onclick="updateQty(${index}, -1)" class="w-7 h-7 flex justify-center items-center bg-white rounded shadow-sm text-gray-600 font-bold active:scale-95">-</button>
                </div>
                `}
            </div>
        `);
    });

    document.getElementById('cart-subtotal').innerText = subtotal.toLocaleString() + ' đ';

    let discountAmount = 0;
    const discountRow = document.getElementById('discount-display-row');
    if (discountData.value > 0) {
        discountRow.classList.remove('hidden');
        if (discountData.type === 'percent') {
            discountAmount = subtotal * (discountData.value / 100);
            document.getElementById('discount-label').innerText = `(${discountData.value}%)`;
        } else {
            discountAmount = discountData.value;
            document.getElementById('discount-label').innerText = ``;
        }
        document.getElementById('discount-amount-display').innerText = '-' + discountAmount.toLocaleString() + ' đ';
    } else {
        discountRow.classList.add('hidden');
    }

    finalBillTotal = subtotal - discountAmount;
    if (finalBillTotal < 0) finalBillTotal = 0; 
    document.getElementById('cart-total').innerText = finalBillTotal.toLocaleString() + ' đ';
}

// ==========================================
// LOGIC GIẢM GIÁ
// ==========================================
function openDiscountModal() {
    if (cart.length === 0) return alert("Giỏ hàng trống!");
    document.getElementById('discount-input').value = discountData.value > 0 ? discountData.value : '';
    setDiscountType(discountData.type);
    document.getElementById('discount-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('discount-input').focus(), 100);
}
function closeDiscountModal() { document.getElementById('discount-modal').classList.add('hidden'); }

function setDiscountType(type) {
    discountData.type = type;
    const btnPct = document.getElementById('btn-discount-percent');
    const btnAmt = document.getElementById('btn-discount-amount');
    const unit = document.getElementById('discount-unit');
    if (type === 'percent') {
        btnPct.className = "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-bold text-[#0056a3]";
        btnAmt.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
        unit.innerText = '%';
    } else {
        btnAmt.className = "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-bold text-[#0056a3]";
        btnPct.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500";
        unit.innerText = 'đ';
    }
}

function applyDiscount() {
    let val = parseInt(document.getElementById('discount-input').value) || 0;
    if (val < 0) val = 0;
    if (discountData.type === 'percent' && val > 100) val = 100;
    discountData.value = val;
    closeDiscountModal(); renderCart();
}
function removeDiscount() { discountData.value = 0; renderCart(); }

// ==========================================
// LOGIC THANH TOÁN & IN BILL
// ==========================================
function openPaymentModal() {
    if (cart.length === 0) return alert("Bàn chưa gọi món!");
    document.getElementById('pay-table-name').innerText = currentTable;
    document.getElementById('pay-total-amount').innerText = finalBillTotal.toLocaleString() + ' đ';
    document.getElementById('pay-customer-cash').value = finalBillTotal;
    calculateChange();
    document.getElementById('payment-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('pay-customer-cash').select(), 100);
}

function closePaymentModal() { document.getElementById('payment-modal').classList.add('hidden'); }

function calculateChange() {
    const cash = parseInt(document.getElementById('pay-customer-cash').value) || 0;
    const changeAmount = cash - finalBillTotal;
    const changeEl = document.getElementById('pay-change-amount');
    if (changeAmount < 0) {
        changeEl.innerText = "Chưa đủ tiền!"; changeEl.className = "text-lg font-bold text-red-500";
    } else {
        changeEl.innerText = changeAmount.toLocaleString() + ' đ'; changeEl.className = "text-xl font-bold text-green-600";
    }
}

// ĐÃ GỘP 2 HÀM CONFIRM PAYMENT LÀM 1 VÀ XỬ LÝ LỖI
async function confirmPayment(isPrintBill) {
    const cash = parseInt(document.getElementById('pay-customer-cash').value) || 0;
    if (cash < finalBillTotal) return alert("Khách đưa chưa đủ tiền thanh toán!");
    const changeAmount = cash - finalBillTotal;

    const { data: tableData } = await supabaseClient.from('tables_active').select('order_id').eq('table_num', currentTable).single();
    const orderId = tableData ? tableData.order_id : 'UNKNOWN';
    const itemsSummary = cart.map(item => ({ name: item.name, qty: item.quantity, price: item.currentPrice }));

    const { error: receiptErr } = await supabaseClient.from('receipts').insert([{
        order_id: orderId, table_num: currentTable, total_amount: finalBillTotal,
        discount_amount: discountData.value, cash_received: cash, change_returned: changeAmount, items_summary: itemsSummary
    }]);

    if (receiptErr) return alert("Lỗi lưu hóa đơn: " + receiptErr.message);

    await supabaseClient.from('tables_active').delete().eq('table_num', currentTable);
    alert(`✅ Đã thanh toán Bàn ${currentTable}!\nThu: ${finalBillTotal.toLocaleString()} đ`);

    if (isPrintBill) {
        printTicket('bill', false); 
        window.onafterprint = () => { window.location.href = 'index.html'; };
        setTimeout(() => { window.location.href = 'index.html'; }, 2000); // Dự phòng
    } else {
        window.location.href = 'index.html';
    }
}

// ==========================================
// TẮT AUTOCOMPLETE & MENU 3 CHẤM
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input, textarea').forEach(input => {
        input.setAttribute('autocomplete', 'off'); 
        input.setAttribute('spellcheck', 'false'); 
    });
});

function toggleMenuOptions() {
    document.getElementById('menu-options-dropdown').classList.toggle('hidden');
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('menu-options-dropdown');
    const button = event.target.closest('button[onclick="toggleMenuOptions()"]');
    if (!button && dropdown && !dropdown.classList.contains('hidden')) dropdown.classList.add('hidden');
});

// ==========================================
// BẢNG LỊCH SỬ & HỦY MÓN
// ==========================================
function openHistoryModal() {
    document.getElementById('menu-options-dropdown').classList.add('hidden');
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    if(cart.length === 0) {
        container.innerHTML = '<p class="text-center text-sm text-gray-400 italic py-10">Chưa có lịch sử gọi món nào.</p>';
    } else {
        cart.forEach((item, index) => {
            const timeStr = item.time_added || 'Vừa xong';
            const isCancelled = item.is_cancelled;
            const textStyle = isCancelled ? 'line-through text-gray-400' : 'text-gray-800 font-bold';
            const statusBadge = isCancelled ? '<span class="text-xs text-red-500 font-bold ml-2">(Đã Hủy)</span>' : (item.printed ? '<span class="text-xs text-green-600 font-bold ml-2">✓ Đã báo Bếp</span>' : '');
            const itemQuantity = item.quantity || 1;
            
            container.innerHTML += `
                <div class="flex justify-between items-start border-b border-gray-100 pb-2 mb-2">
                    <div class="flex gap-3">
                        <span class="text-xs font-bold text-gray-400 mt-1">${timeStr}</span>
                        <div>
                            <p class="${textStyle} text-sm">${item.name} ${statusBadge}</p>
                            <p class="text-xs text-gray-500">Số lượng: x${itemQuantity}</p>
                        </div>
                    </div>
                    ${!isCancelled ? `<button onclick="cancelItemHistory(${index})" class="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 active:scale-95 transition font-bold">Hủy</button>` : ''}
                </div>
            `;
        });
    }
    document.getElementById('history-modal').classList.remove('hidden');
}

function closeHistoryModal() { document.getElementById('history-modal').classList.add('hidden'); }

async function cancelItemHistory(index) {
    const item = cart[index];
    const { error } = await supabaseClient.from('order_items').update({ is_cancelled: true }).eq('id', item.db_id);
    if (error) {
        alert("Lỗi khi hủy món: " + error.message);
    } else {
        item.is_cancelled = true; 
        openHistoryModal();       
        renderCart();             
    }
}

// ==========================================
// CHUẨN BỊ DỮ LIỆU IN
// ==========================================
function preparePrintData(onlyNew = false) {
    const rawTableName = document.getElementById('table-title').innerText.replace('(VIP)', '').trim();
    const isTakeaway = rawTableName.toLowerCase().includes('ship') || rawTableName.toLowerCase().includes('mang về');
    const orderType = isTakeaway ? 'ĐI SHIP / MANG VỀ' : 'ĂN TẠI CHỖ';
    
    const timeNow = new Date().toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    let timeIn = timeNow;
    if (cart.length > 0 && cart[0].time_added) timeIn = cart[0].time_added;
    
    let orderId = cart.length > 0 ? "ORD" + String(cart[0].db_id || Date.now()).slice(-4) : "---";
    
    document.querySelectorAll('#kitchen-order-type, #bar-order-type, #bill-order-type').forEach(el => el.innerText = orderType);
    document.querySelectorAll('#kitchen-table-name, #bar-table-name, #bill-table-name').forEach(el => el.innerText = rawTableName);
    document.querySelectorAll('#kitchen-time-in, #bar-time-in, #bill-time-in').forEach(el => el.innerText = timeIn);
    document.querySelectorAll('#kitchen-time-print, #bar-time-print, #bill-time-out').forEach(el => el.innerText = timeNow);
    document.querySelectorAll('#kitchen-order-id, #bar-order-id, #bill-order-id').forEach(el => el.innerText = orderId);
    
    const kitchenContainer = document.getElementById('kitchen-items');
    const barContainer = document.getElementById('bar-items');
    const billContainer = document.getElementById('bill-items');
    
    if(!kitchenContainer || !barContainer || !billContainer) return { hasKitchen: false, hasBar: false };

    kitchenContainer.innerHTML = ''; barContainer.innerHTML = ''; billContainer.innerHTML = '';
    let hasKitchen = false, hasBar = false;
    
    cart.forEach((item) => {
        if (item.is_cancelled) return; 
        
        const itemQuantity = item.quantity || 1;
        const itemTime = item.time_added || timeNow; 
        
        let noteHtml = '';
        if(item.toppings && item.toppings.length > 0) {
            item.toppings.forEach(t => {
                const toppingName = typeof t === 'string' ? t : (t.name || '');
                if (toppingName) noteHtml += `+ ${toppingName}<br>`;
            });
        }
        if(item.note) noteHtml += `* ${item.note}`;
        
        const ticketItemHtml = `
            <div class="flex justify-between items-start font-bold text-base mt-2 border-b border-dashed border-gray-200 pb-1">
                <span class="flex-1 pr-2">${item.name} <span class="text-xs font-normal text-gray-500">(${itemTime})</span></span>
                <span class="w-8 text-right text-lg">x${itemQuantity}</span>
            </div>
            ${noteHtml ? `<div class="italic text-sm pl-3 font-serif text-gray-800 border-l-2 border-black ml-1 leading-tight py-1 bg-gray-50">${noteHtml}</div>` : ''}
        `;

        if (!onlyNew || !item.printed) {
            const cat = (item.category || item.name || '').toLowerCase(); 
            const isDrink = cat.includes('uống') || cat.includes('nước') || cat.includes('trà') || cat.includes('cafe') || cat.includes('coca') || cat.includes('bia');
            
            if (isDrink) { barContainer.innerHTML += ticketItemHtml; hasBar = true; } 
            else { kitchenContainer.innerHTML += ticketItemHtml; hasKitchen = true; }
        }

        billContainer.innerHTML += `
            <tr>
                <td class="py-1 border-b border-gray-100">${item.name} <span class="text-[10px] text-gray-400">(${itemTime})</span><br><span class="italic text-xs font-serif text-gray-600">${noteHtml}</span></td>
                <td class="py-1 text-center font-bold border-b border-gray-100">${itemQuantity}</td>
                <td class="py-1 text-right border-b border-gray-100">${(item.currentPrice * itemQuantity).toLocaleString()}</td>
            </tr>
        `;
    });
    
    document.getElementById('bill-subtotal').innerText = document.getElementById('cart-subtotal') ? document.getElementById('cart-subtotal').innerText : '0đ';
    document.getElementById('bill-discount').innerText = document.getElementById('discount-amount-display') ? document.getElementById('discount-amount-display').innerText : '0đ';
    document.getElementById('bill-total-amount').innerText = document.getElementById('cart-total') ? document.getElementById('cart-total').innerText : '0đ';
    
    return { hasKitchen, hasBar };
}

// ==========================================
// ĐIỀU KHIỂN IN ẤN
// ==========================================
function printTicket(type, preventPrint = false) {
    document.getElementById('menu-options-dropdown').classList.add('hidden');
    
    const isAuto = (type === 'auto');
    const { hasKitchen, hasBar } = preparePrintData(isAuto); 
    
    const ticketKitchen = document.getElementById('ticket-kitchen');
    const ticketBar = document.getElementById('ticket-bar');
    const ticketBill = document.getElementById('ticket-bill');

    if (type === 'kitchen') {
        ticketKitchen.style.display = 'block'; ticketBar.style.display = 'none'; ticketBill.style.display = 'none';
    } else if (type === 'bar') {
        ticketKitchen.style.display = 'none'; ticketBar.style.display = 'block'; ticketBill.style.display = 'none';
    } else if (type === 'bill') {
        ticketKitchen.style.display = 'none'; ticketBar.style.display = 'none'; ticketBill.style.display = 'block';
    } else if (type === 'auto') {
        ticketKitchen.style.display = hasKitchen ? 'block' : 'none';
        ticketBar.style.display = hasBar ? 'block' : 'none';
        ticketBill.style.display = 'none';
    }

    if (!preventPrint) {
        setTimeout(() => { window.print(); }, 300);
    }
}

// ==========================================
// TRỞ VỀ VÀ BÁO BẾP
// ==========================================
let isSavingOrder = false;

async function goBack() {
    if (isSavingOrder) return; 
    isSavingOrder = true;

    const unprintedItems = cart.filter(item => !item.printed && !item.is_cancelled);

    if (unprintedItems.length > 0) {
        // Đổ chữ vào HTML trước khi đánh dấu Đã in
        printTicket('auto', true); 

        const statusEl = document.getElementById('table-status');
        if (statusEl) statusEl.innerText = "Đang lưu máy chủ...";

        unprintedItems.forEach(item => item.printed = true);

        for (let item of unprintedItems) {
            try {
                await supabaseClient.from('order_items').update({ printed: true }).eq('id', item.db_id);
            } catch (err) {
                console.error("Lỗi update DB món:", item.name);
            }
        }

        setTimeout(() => {
            window.onafterprint = () => { window.location.href = 'index.html'; };
            window.print();
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        }, 300);

    } else {
        window.location.href = 'index.html';
    }
}