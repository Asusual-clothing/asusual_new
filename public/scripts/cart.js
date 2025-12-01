document.addEventListener("DOMContentLoaded", function () {
    updateCart();

    const couponApplied = document.querySelector('.coupon-success');

    if (couponApplied) {
        document.querySelectorAll('.cart-remove').forEach(btn => {
            btn.style.opacity = "0.4";
            btn.style.pointerEvents = "none";
            btn.title = "Remove coupon to edit cart";
        });
    }

    document.addEventListener('click', async function (e) {
        if (e.target.classList.contains('increase')) await handleQuantityIncrease(e);
        if (e.target.classList.contains('decrease')) await handleQuantityDecrease(e);
        if (e.target.classList.contains('cart-remove')) await handleRemoveItem(e);
        if (e.target.id === 'proceed-to-order') handleProceedToOrder();
        if (e.target.id === 'cancel-order') handleCancelOrder();
    });

    checkPaymentReturn();
});



// ===============================
// QUANTITY HANDLERS
// ===============================

async function handleQuantityIncrease(e) {
    const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.dataset.size;

    try {
        const response = await fetch(`/cart/check-stock/${productId}/${encodeURIComponent(size)}`);
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        const currentQuantity = parseInt(quantityElem.textContent);

        if (data.availableStock > currentQuantity) {
            const newQuantity = currentQuantity + 1;
            quantityElem.textContent = newQuantity;
            await updateQuantityInDatabase(productId, size, newQuantity);
            await updateCart();
        } else {
            alert("No more stock available for this size.");
        }

    } catch (error) {
        console.error(error);
    }
}

async function handleQuantityDecrease(e) {
    const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.dataset.size;
    const currentQuantity = parseInt(quantityElem.textContent);

    if (currentQuantity > 1) {
        const newQuantity = currentQuantity - 1;
        quantityElem.textContent = newQuantity;
        await updateQuantityInDatabase(productId, size, newQuantity);
        await updateCart();
    }
}

// ===============================
// REMOVE ITEM
// ===============================

async function handleRemoveItem(e) {
      const couponApplied = document.querySelector('.coupon-success');

    if (couponApplied) {
        alert("⚠️ Please remove the applied coupon/offer before modifying cart items.");
        return;
    }

    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.dataset.size;

    try {
        const response = await fetch('/cart/remove-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, size })
        });

        const data = await response.json();

        if (data.success) {
            cartItem.remove();
            await updateCart();
            if (data.cartSummary?.itemCount === 0) location.reload();
        }

    } catch (error) {
        console.error(error);
    }
}

// ===============================
// ORDER FLOW
// ===============================

function handleProceedToOrder() {
    document.getElementById('proceed-to-order').style.display = 'none';
    document.getElementById('shipping-form-container').style.display = 'block';
}

function handleCancelOrder() {
    document.getElementById('proceed-to-order').style.display = 'block';
    document.getElementById('shipping-form-container').style.display = 'none';
}

// ===============================
// PAYMENT SUBMISSION (BACKEND TOTAL ONLY)
// ===============================

async function handleOrderSubmit() {
    const button = document.getElementById('cashfree-payment-btn');
    const originalButtonContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "Processing...";

    try {
        const shippingAddress = {
            line1: shipping-line1.value,
            line2: shipping-line2.value,
            city: shipping-city.value,
            state: shipping-state.value,
            postalCode: shipping-postalCode.value,
            country: shipping-country.value,
            contactNumber: shipping-contactNumber.value
        };

        const response = await fetch('/payment/process-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ shippingAddress }) // ✅ NO AMOUNT SENT FROM FRONTEND
        });

        const result = await response.json();

        if (!result.success) throw new Error(result.message);

        window.location.href = result.checkoutPageUrl;

    } catch (error) {
        console.error(error);
        button.disabled = false;
        button.innerHTML = originalButtonContent;
    }
}

// ===============================
// FETCH CART SUMMARY FROM BACKEND
// ===============================

async function updateCart() {
    try {
        const response = await fetch('/cart/summary');
        const data = await response.json();

        if (!data.success) return;

        document.getElementById("total-items").textContent = data.totalItems;
        document.getElementById("total-price").textContent = data.subtotal;
        document.querySelector(".total-line span:last-child").textContent = `Rs ${data.finalTotal}`;
        document.querySelector(".cart-items-count").textContent = `${data.totalItems} items`;

    } catch (error) {
        console.error("Failed to update cart from backend");
    }
}

// ===============================
// UPDATE QUANTITY DB
// ===============================

async function updateQuantityInDatabase(productId, size, quantity) {
    await fetch('/cart/update-quantity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, size, quantity })
    });
}

// ===============================
// PAYMENT RETURN STATUS
// ===============================

function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('paymentStatus');
    const orderId = urlParams.get('orderId');

    if (paymentStatus && orderId) {
        if (paymentStatus === 'success') {
            showNotification('Payment Successful', 'success');
            setTimeout(() => location.href = `/order-success/${orderId}`, 2000);
        } else {
            showNotification('Payment Failed', 'error');
            setTimeout(() => location.href = `/order-failed/${orderId}`, 2000);
        }
    }
}

// ===============================
// NOTIFICATION
// ===============================

function showNotification(message, type = 'success') {
    alert(message);
}
