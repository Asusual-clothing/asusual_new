// /scripts/cart.js - Updated with proper discount calculation

document.addEventListener("DOMContentLoaded", function () {
    // Initialize cart on page load
    updateCart();

    // Event delegation for dynamic elements
    document.addEventListener('click', async function (e) {
        // Quantity increase
        if (e.target.classList.contains('increase')) {
            await handleQuantityIncrease(e);
        }

        // Quantity decrease
        if (e.target.classList.contains('decrease')) {
            await handleQuantityDecrease(e);
        }

        // Remove item
        if (e.target.classList.contains('cart-remove')) {
            await handleRemoveItem(e);
        }

        // Proceed to order
        if (e.target.id === 'proceed-to-order') {
            handleProceedToOrder();
        }

        // Cancel order
        if (e.target.id === 'cancel-order') {
            handleCancelOrder();
        }
    });

    // Submit Order Form
    const shippingFormElement = document.getElementById('shipping-form');
    if (shippingFormElement) {
        shippingFormElement.addEventListener('submit', async function (e) {
            e.preventDefault();
            await handleOrderSubmit(e);
        });
    }

    // Check for payment return on page load
    checkPaymentReturn();
});

// Handle quantity increase
async function handleQuantityIncrease(e) {
    const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.dataset.size;

    try {
        const response = await fetch(`/cart/check-stock/${productId}/${encodeURIComponent(size)}`);
        const data = await response.json();
    

        if (!data.success) {
            throw new Error(data.error || 'Failed to check stock');
        }

        const currentQuantity = parseInt(quantityElem.textContent);

        // Only increase if stock is available
        if (data.availableStock > currentQuantity) {
            const newQuantity = currentQuantity + 1;
            quantityElem.textContent = newQuantity;
            updateCart();
            await updateQuantityInDatabase(productId, size, newQuantity);

            // Hide any previous message
            const messageElem = e.target.parentElement.querySelector('.quantity-message');
            messageElem.style.display = 'none';
            
            showNotification('Quantity updated successfully', 'success');
        } else {
            // Show message that maximum quantity reached
            const messageElem = e.target.parentElement.querySelector('.quantity-message');
            messageElem.textContent = `No more items available in this size`;
            messageElem.style.display = 'block';
            showNotification('Maximum quantity reached for this size', 'warning');
        }
    } catch (error) {
        console.error('Error checking stock:', error);
        showNotification('Error checking product availability', 'error');
    }
}

// Handle quantity decrease
async function handleQuantityDecrease(e) {
    const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.dataset.size;
    const currentQuantity = parseInt(quantityElem.textContent);
    
    if (currentQuantity > 1) {
        const newQuantity = currentQuantity - 1;
        quantityElem.textContent = newQuantity;
        updateCart();
        await updateQuantityInDatabase(productId, size, newQuantity);

        // Hide any previous message when decreasing
        const messageElem = e.target.parentElement.querySelector('.quantity-message');
        messageElem.style.display = 'none';
        
        showNotification('Quantity updated successfully', 'success');
    } else {
        showNotification('Quantity cannot be less than 1', 'warning');
    }
}

// Handle remove item
async function handleRemoveItem(e) {
    const cartItem = e.target.closest('.cart-item');
    const productId = cartItem.dataset.productId;
    const size = cartItem.querySelector('.cart-item-size').textContent.replace('Size: ', '').trim();

    try {
        const response = await fetch('/cart/remove-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId,
                size
            })
        });

        const data = await response.json();

        if (data.success) {
            cartItem.remove();
            updateCart();
            showNotification('Item removed from cart', 'success');
            
            // If cart is empty, reload page after a delay
            if (data.cartSummary && data.cartSummary.itemCount === 0) {
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
        } else {
            showNotification(data.message || 'Error removing item', 'error');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        showNotification('Error removing item from cart', 'error');
    }
}

// Handle proceed to order
function handleProceedToOrder() {
    const proceedBtn = document.getElementById('proceed-to-order');
    const shippingForm = document.getElementById('shipping-form-container');
    
    if (proceedBtn && shippingForm) {
        proceedBtn.style.display = 'none';
        shippingForm.style.display = 'block';
    }
}

// Handle cancel order
function handleCancelOrder() {
    const proceedBtn = document.getElementById('proceed-to-order');
    const shippingForm = document.getElementById('shipping-form-container');
    
    if (proceedBtn && shippingForm) {
        proceedBtn.style.display = 'block';
        shippingForm.style.display = 'none';
    }
}

// Handle order submission
async function handleOrderSubmit(e) {
    const button = document.getElementById('cashfree-payment-btn');
    const originalButtonContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // Get shipping details
        const shippingAddress = {
            line1: document.getElementById('shipping-line1').value,
            line2: document.getElementById('shipping-line2').value,
            city: document.getElementById('shipping-city').value,
            state: document.getElementById('shipping-state').value,
            postalCode: document.getElementById('shipping-postalCode').value,
            country: document.getElementById('shipping-country').value,
            contactNumber: document.getElementById('shipping-contactNumber').value
        };

        // Validate shipping details
        if (!shippingAddress.line1 || !shippingAddress.city ||
            !shippingAddress.state || !shippingAddress.postalCode ||
            !shippingAddress.country || !shippingAddress.contactNumber) {
            throw new Error('Please fill in all required shipping details');
        }

        // Validate contact number format
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(shippingAddress.contactNumber)) {
            throw new Error('Please enter a valid 10-digit contact number');
        }

        // Get the FINAL discounted total amount
        const totalAmount = getFinalDiscountedTotal();

        if (totalAmount <= 0) {
            throw new Error('Invalid order total');
        }


        // Process the order with the discounted amount
        const response = await fetch('/payment/process-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shippingAddress,
                amount: totalAmount
            }),
            credentials: 'include'
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Failed to process order');
        }
        window.location.href = result.checkoutPageUrl;

    } catch (error) {
        console.error('Order Error:', error);
        showNotification(error.message, 'error');
        button.disabled = false;
        button.innerHTML = originalButtonContent;
    }
}

// Function to get the final discounted total including all discounts
function getFinalDiscountedTotal() {
    // Get the displayed total from the summary section
    const totalLineElem = document.querySelector(".total-line span:last-child");
    if (totalLineElem) {
        const totalText = totalLineElem.textContent.replace('Rs ', '').trim();
        return parseFloat(totalText);
    }
    
    // Fallback calculation if DOM element not found
    return calculateFinalTotal();
}

// Function to calculate final total with proper discount handling
function calculateFinalTotal() {
    let subtotal = 0;
    
    // Calculate subtotal from regular items (excluding free items)
    document.querySelectorAll(".cart-item:not(.free-item)").forEach(item => {
        const quantityElem = item.querySelector(".cart-quantity");
        const quantity = parseInt(quantityElem.textContent);
        const price = parseFloat(item.dataset.price);
        subtotal += price * quantity;
    });

    // Get shipping cost
    const shippingOption = document.querySelector('select option');
    let shipping = 0;
    if (shippingOption) {
        const shippingMatch = shippingOption.textContent.match(/Rs(\d+\.\d{2})/);
        if (shippingMatch) {
            shipping = parseFloat(shippingMatch[1]);
        }
    }

    // Calculate discount amount from applied coupon/offer
    const discountAmount = calculateDiscountAmount(subtotal);

    // Final total = subtotal + shipping - discount
    const finalTotal = Math.max(0, subtotal + shipping - discountAmount);
    
    return finalTotal;
}

// Function to calculate discount amount based on applied coupon/offer
function calculateDiscountAmount(subtotal) {
    const couponElement = document.querySelector('.coupon-success');
    if (!couponElement) return 0;

    const couponText = couponElement.textContent;
    let discountAmount = 0;

    // Check for coupon discount
    if (couponText.includes('Coupon:')) {
        if (couponText.includes('% off')) {
            // Percentage discount
            const discountPercent = parseFloat(couponText.match(/(\d+)% off/)[1]);
            discountAmount = subtotal * (discountPercent / 100);
        } else if (couponText.includes('Rs')) {
            // Flat discount
            const flatDiscount = parseFloat(couponText.match(/Rs(\d+) off/)[1]);
            discountAmount = Math.min(flatDiscount, subtotal);
        }
    }
    // Check for offer discount
    else if (couponText.includes('Offer:')) {
        if (couponText.includes('Rs') && couponText.includes('off') && !couponText.includes('Free item')) {
            // Flat discount offer
            const flatDiscount = parseFloat(couponText.match(/Rs(\d+) off/)[1]);
            discountAmount = Math.min(flatDiscount, subtotal);
        } else if (couponText.includes('% off')) {
            // Percentage discount offer
            const discountPercent = parseFloat(couponText.match(/(\d+)% off/)[1]);
            discountAmount = subtotal * (discountPercent / 100);
        }
        // For free_item offers, discount is 0 (free item is separate)
    }

    return discountAmount;
}

// Function to update cart totals with proper discount calculation
function updateCart() {
    let totalItems = 0;
    let subtotal = 0;
    
    // Get shipping cost from the select option
    const shippingOption = document.querySelector('select option');
    let shipping = 0;
    if (shippingOption) {
        const shippingMatch = shippingOption.textContent.match(/Rs(\d+\.\d{2})/);
        if (shippingMatch) {
            shipping = parseFloat(shippingMatch[1]);
        }
    }

    // Calculate subtotal and update item totals (excluding free items)
    document.querySelectorAll(".cart-item:not(.free-item)").forEach(item => {
        const quantityElem = item.querySelector(".cart-quantity");
        const quantity = parseInt(quantityElem.textContent);
        const price = parseFloat(item.dataset.price);
        const itemTotalElem = item.querySelector(".item-total");

        const itemTotal = price * quantity;
        if (itemTotalElem) {
            itemTotalElem.textContent = itemTotal.toFixed(2);
        }
        totalItems += quantity;
        subtotal += itemTotal;
    });

    // Calculate discount amount
    const discountAmount = calculateDiscountAmount(subtotal);

    // Update DOM elements
    const totalItemsElem = document.getElementById("total-items");
    const totalPriceElem = document.getElementById("total-price");
    const totalLineElem = document.querySelector(".total-line span:last-child");

    if (totalItemsElem) totalItemsElem.textContent = totalItems;
    if (totalPriceElem) totalPriceElem.textContent = subtotal.toFixed(2);

    // Calculate final total (subtotal + shipping - discount)
    const finalTotal = Math.max(0, subtotal + shipping - discountAmount);

    if (totalLineElem) {
        totalLineElem.textContent = `Rs ${finalTotal.toFixed(2)}`;
    }

    // Update discount message
    const discountMessage = document.querySelector('.discount-message');
    if (discountAmount > 0) {
        if (!discountMessage) {
            const messageElement = document.createElement('p');
            messageElement.className = 'discount-message';
            messageElement.textContent = `You saved: Rs ${discountAmount.toFixed(2)}`;
            document.querySelector('.summary-total').appendChild(messageElement);
        } else {
            discountMessage.textContent = `You saved: Rs ${discountAmount.toFixed(2)}`;
        }
    } else if (discountMessage) {
        discountMessage.remove();
    }

    // Update items count in header
    const itemsCountElem = document.querySelector('.cart-items-count');
    if (itemsCountElem) {
        const regularItems = document.querySelectorAll('.cart-item:not(.free-item)').length;
        itemsCountElem.textContent = `${regularItems} items`;
    }
}

// Update quantity in database
async function updateQuantityInDatabase(productId, size, newQuantity) {
    try {
        const response = await fetch('/cart/update-quantity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId,
                size,
                quantity: newQuantity
            })
        });

        const data = await response.json();
        if (!data.success) {
            console.error('Error updating quantity:', data.message);
            showNotification(data.message || 'Error updating quantity', 'error');
            
            // Revert the quantity change in UI if backend update failed
            const cartItem = document.querySelector(`[data-product-id="${productId}"][data-size="${size}"]`);
            if (cartItem) {
                const quantityElem = cartItem.querySelector('.cart-quantity');
                const currentQuantity = parseInt(quantityElem.textContent);
                quantityElem.textContent = currentQuantity - (newQuantity > currentQuantity ? -1 : 1);
                updateCart();
            }
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
        showNotification('Error updating quantity in cart', 'error');
        
        // Revert the quantity change in UI
        const cartItem = document.querySelector(`[data-product-id="${productId}"][data-size="${size}"]`);
        if (cartItem) {
            const quantityElem = cartItem.querySelector('.cart-quantity');
            const currentQuantity = parseInt(quantityElem.textContent);
            quantityElem.textContent = currentQuantity - (newQuantity > currentQuantity ? -1 : 1);
            updateCart();
        }
    }
}

// Notification function
function showNotification(message, type = 'success') {
    const notificationBar = document.querySelector('.notification-bar');
    if (notificationBar) {
        const notificationText = notificationBar.querySelector('.notification-text');
        if (notificationText) {
            notificationText.textContent = message;
        }
        
        // Set background color based on type
        notificationBar.style.backgroundColor =
            type === 'success' ? '#4CAF50' :
            type === 'error' ? '#f44336' :
            type === 'warning' ? '#ff9800' : '#2196F3';
        
        notificationBar.style.display = 'block';

        // Auto hide after 5 seconds
        setTimeout(() => {
            notificationBar.style.display = 'none';
        }, 5000);
    } else {
        // Fallback: use alert if notification bar doesn't exist
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Check for payment return on page load
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('paymentStatus');
    const orderId = urlParams.get('orderId');

    if (paymentStatus && orderId) {
        if (paymentStatus === 'success') {
            showNotification('Payment successful! Your order has been placed.', 'success');
            setTimeout(() => {
                window.location.href = `/order-success/${orderId}`;
            }, 2000);
        } else {
            showNotification('Payment failed. Please try again.', 'error');
            setTimeout(() => {
                window.location.href = `/order-failed/${orderId}`;
            }, 2000);
        }
    }
}

// Export functions for potential reuse
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateCart,
        showNotification,
        handleQuantityIncrease,
        handleQuantityDecrease,
        handleRemoveItem,
        getFinalDiscountedTotal
    };
}