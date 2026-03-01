// --- KẾT NỐI SUPABASE ---
// Nhớ dán URL và API KEY của bạn vào 2 dòng này nhé!
const SUPABASE_URL = 'https://ozlyjhhtchxsjkhmiyuw.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHlqaGh0Y2h4c2praG1peXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDQ1NjMsImV4cCI6MjA4NzkyMDU2M30.SHvMOBG7lFz7b-igzY91CFQqhU-i5hlqAErPG5vkT2g';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Data Món ăn giả lập
const MENU_ITEMS = [
    { id: 'm1', name: 'Ba chỉ bò Mỹ nướng', price: 89000, vipPrice: 109000, img: '🥩', toppings: [] },
    { id: 'm2', name: 'Thịt heo Iberico', price: 129000, vipPrice: 159000, img: '🥓', toppings: [] },
    { id: 'm3', name: 'Lẩu Thái Tomyum', price: 250000, vipPrice: 280000, img: '🥘', toppings: [
        { id: 't1', name: 'Thêm mì tôm', price: 10000 },
        { id: 't2', name: 'Thêm đậu hũ', price: 15000 },
        { id: 't3', name: 'Nước lẩu thêm', price: 0 }
    ]},
    { id: 'm4', name: 'Trà Sữa Oolong', price: 35000, vipPrice: 45000, img: '🧋', toppings: [
        { id: 't4', name: 'Trân châu trắng', price: 10000 },
        { id: 't5', name: 'Up size L', price: 15000 }
    ]},
    { id: 'm7', name: 'Mì Cay Hải Sản', price: 55000, vipPrice: 70000, img: '🍜', toppings: [
        { id: 't6', name: 'Thêm nửa gói mì', price: 5000 },
        { id: 't7', name: 'Thêm xúc xích', price: 10000 },
        { id: 't8', name: 'Cấp 7', price: 0 }
    ]}
];

let cart = [];
let currentTable = '';
let isVipTable = false;

let activeMenuItem = null; 
let modalQuantity = 1;
let modalBasePrice = 0;

let discountData = { type: 'percent', value: 0 }; // Lưu thông tin giảm giá
let finalBillTotal = 0; // Tổng tiền cuối cùng sau khi giảm

// ==========================================
// KHI TRANG LOAD: LẤY BÀN & TẢI GIỎ HÀNG TỪ MÂY
// ==========================================
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentTable = urlParams.get('table') || 'Trống';
    isVipTable = urlParams.get('vip') === 'true';

    const vipTag = isVipTable ? '<span class="text-red-500 text-sm ml-2 font-bold px-2 py-0.5 bg-red-100 rounded">(VIP)</span>' : '';
    document.getElementById('table-title').innerHTML = `Bàn ${currentTable} ${vipTag}`;
    
    renderMenu();
    await loadCartFromCloud(); 
};

async function loadCartFromCloud() {
    const { data, error } = await supabaseClient
        .from('order_items')
        .select('*')
        .eq('table_num', currentTable)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(error);
        return alert("Lỗi tải giỏ hàng từ máy chủ!");
    }

    cart = data.map(item => ({
        db_id: item.id, 
        id: item.item_id,
        name: item.name,
        currentPrice: item.price,
        quantity: item.quantity,
        toppings: item.toppings || [],
        note: item.note || '',
        isServed: item.is_served,
        isCustom: item.is_custom
    }));
    
    renderCart();
}

function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = '';
    MENU_ITEMS.forEach(item => {
        const displayPrice = isVipTable ? item.vipPrice : item.price;
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
// LOGIC MODAL TÙY CHỈNH MÓN
// ==========================================
function openItemOptions(itemId) {
    const item = MENU_ITEMS.find(i => i.id === itemId);
    activeMenuItem = item;
    modalBasePrice = isVipTable ? item.vipPrice : item.price;
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
    const nameInput = document.getElementById('custom-topping-name');
    const priceInput = document.getElementById('custom-topping-price');
    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value.trim()) || 0; 
    
    if (!name) return alert('Vui lòng nhập tên Topping!');
    
    const toppingList = document.getElementById('modal-topping-list');
    const customToppingHTML = `
        <label class="flex items-center justify-between p-2 rounded border border-orange-200 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors">
            <div class="flex items-center gap-2">
                <input type="checkbox" checked data-name="${name} (Tùy chọn)" data-price="${price}" class="topping-checkbox w-4 h-4 accent-orange-500" onchange="updateModalTotal()">
                <span class="text-sm text-orange-700 font-medium">${name}</span>
            </div>
            <span class="text-xs font-bold text-orange-600">${price > 0 ? '+' + price.toLocaleString() + 'đ' : 'Miễn phí'}</span>
        </label>
    `;
    toppingList.insertAdjacentHTML('beforeend', customToppingHTML);
    
    nameInput.value = ''; priceInput.value = '';
    document.getElementById('custom-topping-form').classList.add('hidden');
    updateModalTotal();
}

function updateModalTotal() {
    let toppingTotal = 0;
    document.querySelectorAll('.topping-checkbox:checked').forEach(cb => toppingTotal += parseInt(cb.dataset.price));
    document.getElementById('modal-temp-total').innerText = ((modalBasePrice + toppingTotal) * modalQuantity).toLocaleString() + ' đ';
}

// ==========================================
// THÊM MÓN VÀO GIỎ HÀNG (ĐẨY LÊN MÂY)
// ==========================================
async function saveItemToCart() {
    let selectedToppings = [];
    let toppingPrice = 0;
    document.querySelectorAll('.topping-checkbox:checked').forEach(cb => {
        selectedToppings.push(cb.dataset.name);
        toppingPrice += parseInt(cb.dataset.price);
    });

    const note = document.getElementById('modal-item-note').value.trim();
    const finalPricePerItem = modalBasePrice + toppingPrice;

    const existingIndex = cart.findIndex(i => 
        i.id === activeMenuItem.id &&
        JSON.stringify(i.toppings) === JSON.stringify(selectedToppings) &&
        i.note === note && i.isCustom !== true
    );

    if (existingIndex > -1) {
        const existingItem = cart[existingIndex];
        const newQty = existingItem.quantity + modalQuantity;
        
        const { error } = await supabaseClient.from('order_items').update({ quantity: newQty }).eq('id', existingItem.db_id);
        if (!error) existingItem.quantity = newQty;

    } else {
        const newItem = {
            table_num: currentTable,
            item_id: activeMenuItem.id,
            name: activeMenuItem.name,
            price: finalPricePerItem,
            quantity: modalQuantity,
            toppings: selectedToppings,
            note: note,
            is_served: false,
            is_custom: false
        };

        const { data, error } = await supabaseClient.from('order_items').insert([newItem]).select();
        
        if (!error && data) {
            cart.push({
                db_id: data[0].id,
                id: data[0].item_id,
                name: data[0].name,
                currentPrice: data[0].price,
                quantity: data[0].quantity,
                toppings: data[0].toppings,
                note: data[0].note,
                isServed: data[0].is_served,
                isCustom: data[0].is_custom
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

    if (!name || isNaN(price) || isNaN(qty) || qty < 1) return alert('Vui lòng nhập Tên món, Giá tiền và Số lượng hợp lệ!');

    const newItem = {
        table_num: currentTable,
        item_id: 'custom_' + Date.now(),
        name: name,
        price: price,
        quantity: qty,
        toppings: [],
        note: note,
        is_served: false,
        is_custom: true
    };

    const { data, error } = await supabaseClient.from('order_items').insert([newItem]).select();
        
    if (!error && data) {
        cart.push({
            db_id: data[0].id, id: data[0].item_id, name: data[0].name, currentPrice: data[0].price,
            quantity: data[0].quantity, toppings: data[0].toppings, note: data[0].note,
            isServed: data[0].is_served, isCustom: data[0].is_custom
        });
    }

    closeCustomItemModal();
    renderCart();
}

// ==========================================
// CÁC HÀM CẬP NHẬT TRỰC TIẾP LÊN MÂY
// ==========================================
async function updateQty(index, change) {
    const item = cart[index];
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
// RENDER GIỎ HÀNG (Cải tiến tính Giảm giá)
// ==========================================
function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    let subtotal = 0;

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                <p class="text-sm">Chưa có món nào</p>
            </div>
        `;
        document.getElementById('cart-subtotal').innerText = '0 đ';
        document.getElementById('cart-total').innerText = '0 đ';
        document.getElementById('discount-display-row').classList.add('hidden');
        finalBillTotal = 0;
        return;
    }

    cartContainer.innerHTML = '';
    cart.forEach((item, index) => {
        subtotal += item.currentPrice * item.quantity;
        
        const servedClass = item.isServed ? 'opacity-50 bg-green-50' : 'bg-white';
        const checkboxState = item.isServed ? 'checked' : '';
        const customBadge = item.isCustom ? '<span class="text-[10px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded ml-1">Ngoài menu</span>' : '';

        let extraInfo = '';
        if (item.toppings && item.toppings.length > 0) extraInfo += `<p class="text-xs text-gray-500 mt-0.5">+ ${item.toppings.join(', ')}</p>`;
        if (item.note) extraInfo += `<p class="text-xs text-orange-500 italic mt-0.5">Lưu ý: ${item.note}</p>`;

        const itemHTML = `
            <div class="flex items-start gap-3 p-3 mb-2 rounded-lg border border-gray-100 shadow-sm transition-colors ${servedClass}">
                <input type="checkbox" class="w-5 h-5 mt-1 accent-green-600 rounded cursor-pointer" ${checkboxState} onchange="toggleServed(${index})">
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-800 leading-tight ${item.isServed ? 'line-through text-gray-500' : ''}">
                        ${item.name} ${customBadge}
                    </h4>
                    ${extraInfo}
                    <p class="text-sm font-bold text-[#0056a3] mt-1.5">${(item.currentPrice * item.quantity).toLocaleString()} đ</p>
                </div>
                <div class="flex flex-col items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                    <button onclick="updateQty(${index}, 1)" class="w-7 h-7 flex justify-center items-center bg-white rounded shadow-sm text-[#0056a3] font-bold hover:bg-blue-50">+</button>
                    <span class="w-full text-center text-sm font-medium py-1">${item.quantity}</span>
                    <button onclick="updateQty(${index}, -1)" class="w-7 h-7 flex justify-center items-center bg-white rounded shadow-sm text-gray-600 font-bold hover:bg-gray-50">-</button>
                </div>
            </div>
        `;
        cartContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    // 1. Cập nhật Tạm tính
    document.getElementById('cart-subtotal').innerText = subtotal.toLocaleString() + ' đ';

    // 2. Tính toán Giảm giá
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

    // 3. Cập nhật Tổng thanh toán cuối cùng
    finalBillTotal = subtotal - discountAmount;
    if (finalBillTotal < 0) finalBillTotal = 0; // Tránh giảm giá lố tiền bill
    document.getElementById('cart-total').innerText = finalBillTotal.toLocaleString() + ' đ';
}

// ==========================================
// LOGIC MODAL GIẢM GIÁ
// ==========================================
function openDiscountModal() {
    if (cart.length === 0) return alert("Giỏ hàng trống!");
    document.getElementById('discount-input').value = discountData.value > 0 ? discountData.value : '';
    setDiscountType(discountData.type);
    document.getElementById('discount-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('discount-input').focus(), 100);
}

function closeDiscountModal() {
    document.getElementById('discount-modal').classList.add('hidden');
}

function setDiscountType(type) {
    discountData.type = type;
    const btnPct = document.getElementById('btn-discount-percent');
    const btnAmt = document.getElementById('btn-discount-amount');
    const unit = document.getElementById('discount-unit');

    if (type === 'percent') {
        btnPct.className = "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-bold text-[#0056a3] transition-all";
        btnAmt.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500 transition-all";
        unit.innerText = '%';
    } else {
        btnAmt.className = "flex-1 py-1.5 bg-white shadow-sm rounded text-sm font-bold text-[#0056a3] transition-all";
        btnPct.className = "flex-1 py-1.5 rounded text-sm font-medium text-gray-500 transition-all";
        unit.innerText = 'đ';
    }
}

function applyDiscount() {
    let val = parseInt(document.getElementById('discount-input').value) || 0;
    if (val < 0) val = 0;
    if (discountData.type === 'percent' && val > 100) val = 100;

    discountData.value = val;
    closeDiscountModal();
    renderCart();
}

function removeDiscount() {
    discountData.value = 0;
    renderCart();
}

// ==========================================
// LOGIC THANH TOÁN & TIỀN THỪA (TÍCH HỢP XÓA DB)
// ==========================================
function openPaymentModal() {
    if (cart.length === 0) return alert("Bàn này chưa gọi món nào!");
    
    document.getElementById('pay-table-name').innerText = currentTable;
    document.getElementById('pay-total-amount').innerText = finalBillTotal.toLocaleString() + ' đ';
    
    // Gợi ý luôn số tiền khách đưa bằng tổng bill (bấm cho nhanh)
    document.getElementById('pay-customer-cash').value = finalBillTotal;
    calculateChange(); // Tính tiền thừa luôn

    document.getElementById('payment-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('pay-customer-cash').select(), 100);
}

function closePaymentModal() {
    document.getElementById('payment-modal').classList.add('hidden');
}

function calculateChange() {
    const cashInput = document.getElementById('pay-customer-cash').value;
    const cash = parseInt(cashInput) || 0;
    const changeAmount = cash - finalBillTotal;
    const changeEl = document.getElementById('pay-change-amount');

    if (changeAmount < 0) {
        changeEl.innerText = "Chưa đủ tiền!";
        changeEl.className = "text-lg font-bold text-red-500";
    } else {
        changeEl.innerText = changeAmount.toLocaleString() + ' đ';
        changeEl.className = "text-xl font-bold text-green-600";
    }
}

async function confirmPayment() {
    const cash = parseInt(document.getElementById('pay-customer-cash').value) || 0;
    if (cash < finalBillTotal) return alert("Khách đưa chưa đủ tiền thanh toán!");

    // 1. Thực hiện lệnh Xóa bàn trên Supabase
    // Vì bảng order_items đã set ON DELETE CASCADE, nên chỉ cần xóa bàn là toàn bộ món ăn sẽ tự động bốc hơi theo.
    const { error } = await supabaseClient.from('tables_active').delete().eq('table_num', currentTable);
    
    if (error) {
        console.error(error);
        return alert("Lỗi khi chốt bill trên máy chủ: " + error.message);
    }

    // 2. Nếu thành công, in bill và quay về trang chủ
    console.log(`Đã in hóa đơn Bàn ${currentTable}. Tổng: ${finalBillTotal}, Giảm: ${discountData.value}`);
    window.location.href = 'index.html';
}

function goBack() { 
    console.log("Đã gửi lệnh in Bếp!");
    window.location.href = 'index.html'; 
}