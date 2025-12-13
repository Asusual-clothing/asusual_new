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
        if (e.target.closest('#cashfree-payment-btn')) handleOrderSubmit();


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
// Validate required shipping fields
function validateShippingForm() {
    const requiredFields = [
        "shipping-line1",
        "shipping-city",
        "shipping-state",
        "shipping-postalCode",
        "shipping-country",
        "shipping-contactNumber"
    ];

    for (let id of requiredFields) {
        const input = document.getElementById(id);

        if (!input || input.value.trim() === "") {
            alert(`Please fill out the ${input.previousElementSibling.innerText.replace("*", "")} field.`);
            input.focus();
            return false;
        }
    }

    // Extra validation
    const postal = document.getElementById("shipping-postalCode").value;
    if (!/^\d{6}$/.test(postal)) {
        alert("Please enter a valid 6-digit postal code.");
        return false;
    }

    const contact = document.getElementById("shipping-contactNumber").value;
    if (!/^\d{10}$/.test(contact)) {
        alert("Please enter a valid 10-digit contact number.");
        return false;
    }

    return true; // All good
}

async function handleOrderSubmit() {
    const button = document.getElementById('cashfree-payment-btn');
    const originalButtonContent = button.innerHTML;

    // ❗ STOP if validation fails
    if (!validateShippingForm()) {
        return;
    }

    button.disabled = true;
    button.innerHTML = "Processing...";

    try {
        const eventId = window.__checkoutEventId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        window.__checkoutEventId = eventId;
        const shippingAddress = {
            line1: document.getElementById('shipping-line1').value,
            line2: document.getElementById('shipping-line2').value,
            city: document.getElementById('shipping-city').value,
            state: document.getElementById('shipping-state').value,
            postalCode: document.getElementById('shipping-postalCode').value,
            country: document.getElementById('shipping-country').value,
            contactNumber: document.getElementById('shipping-contactNumber').value
        };

        const response = await fetch('/payment/process-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(eventId ? { 'x-fb-event-id': eventId } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ shippingAddress, event_id: eventId })
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Something went wrong!");
            throw new Error(result.message);
        }

        window.location.href = result.checkoutPageUrl;

    } catch (error) {
        console.error(error);
        alert(error.message || "Something went wrong!");
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
