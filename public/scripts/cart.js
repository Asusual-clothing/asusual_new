document.addEventListener("DOMContentLoaded", function () {
    // Initialize cart on page load
    updateCart();

    // Event delegation for dynamic elements
    document.addEventListener('click', async function (e) {
        // Quantity increase
        if (e.target.classList.contains('increase')) {
            const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
            const cartItem = e.target.closest('.cart-item');
            const productId = cartItem.dataset.productId;
            const size = cartItem.dataset.size;

            try {
                // First check available stock
                console.log('--- Increase clicked ---');
                console.log('Product ID:', productId);
                console.log('Size:', size);

                const response = await fetch(`/cart/check-stock/${productId}/${encodeURIComponent(size)}`);
                const data = await response.json();

                console.log('Stock check response:', data);


                if (!data.success) {
                    throw new Error(data.error || 'Failed to check stock');
                }

                const currentQuantity = parseInt(quantityElem.textContent);

                // Only increase if stock is available
                if (data.availableStock > currentQuantity) {
                    const newQuantity = currentQuantity + 1;
                    quantityElem.textContent = newQuantity;
                    updateCart();
                    updateQuantityInDatabase(quantityElem, newQuantity);

                    // Hide any previous message
                    const messageElem = e.target.parentElement.querySelector('.quantity-message');
                    messageElem.style.display = 'none';
                } else {
                    // Show message that maximum quantity reached
                    const messageElem = e.target.parentElement.querySelector('.quantity-message');
                    messageElem.textContent = `No more items available in this size`;
                    messageElem.style.display = 'block';
                }
            } catch (error) {
                console.error('Error checking stock:', error);
                showNotification('Error checking product availability', 'error');
            }
        }

        // Quantity decrease
        if (e.target.classList.contains('decrease')) {
            const quantityElem = e.target.parentElement.querySelector('.cart-quantity');
            const currentQuantity = parseInt(quantityElem.textContent);
            if (currentQuantity > 1) {
                const newQuantity = currentQuantity - 1;
                quantityElem.textContent = newQuantity;
                updateCart();
                updateQuantityInDatabase(quantityElem, newQuantity);

                // Hide any previous message when decreasing
                const messageElem = e.target.parentElement.querySelector('.quantity-message');
                messageElem.style.display = 'none';
            }
        }

        // Remove item
        if (e.target.classList.contains('cart-remove')) {
            const cartItem = e.target.closest('.cart-item');
            cartItem.remove();
            updateCart();
            removeItemFromDatabase(e.target);
        }

        // Proceed to order
        if (e.target.id === 'proceed-to-order') {
            e.target.style.display = 'none';
            document.getElementById('shipping-form-container').style.display = 'block';
        }

        // Cancel order
        if (e.target.id === 'cancel-order') {
            document.getElementById('proceed-to-order').style.display = 'block';
            document.getElementById('shipping-form-container').style.display = 'none';
        }
    });

    // Submit Order Form (for both COD and Online Payment)
    const shippingFormElement = document.getElementById('shipping-form');
    if (shippingFormElement) {
        shippingFormElement.addEventListener('submit', async function (e) {
            e.preventDefault();

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

                // Get cart total
                const totalAmount = parseFloat(document.querySelector(".total-line span:last-child").textContent.replace('Rs ', ''));

                // Process the order (always online payment)
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

                // Always redirect to payment gateway
                console.log('Redirecting to payment gateway:', result.checkoutPageUrl);
                window.location.href = result.checkoutPageUrl;

            } catch (error) {
                console.error('Order Error:', error);
                showNotification(error.message, 'error');
                button.disabled = false;
                button.innerHTML = originalButtonContent;
            }
        });
    }


    // Function to get cart items data
    function getCartItemsData() {
        return Array.from(document.querySelectorAll('.cart-item')).map(item => ({
            productId: item.dataset.productId,
            size: item.querySelector('.cart-item-size').textContent.replace('Size: ', '').trim(),
            quantity: parseInt(item.querySelector('.cart-quantity').textContent),
            price: parseFloat(item.dataset.price)
        }));
    }

    // Function to update cart totals
    function updateCart() {
        let totalItems = 0;
        let subtotal = 0;
        const shipping = parseFloat(document.querySelector('select option').textContent.match(/Rs(\d+\.\d{2})/)[1]);

        document.querySelectorAll(".cart-item").forEach(item => {
            const quantityElem = item.querySelector(".cart-quantity");
            const quantity = parseInt(quantityElem.textContent);
            const price = parseFloat(item.dataset.price);
            const itemTotalElem = item.querySelector(".item-total");

            const itemTotal = price * quantity;
            itemTotalElem.textContent = itemTotal.toFixed(2);
            totalItems += quantity;
            subtotal += itemTotal;
        });

        // Calculate discount if coupon is applied
        let discountAmount = 0;
        const couponElement = document.querySelector('.coupon-success');
        if (couponElement) {
            const couponText = couponElement.textContent;
            if (couponText.includes('%')) {
                const discountPercent = parseFloat(couponText.match(/(\d+)%/)[1]);
                discountAmount = subtotal * (discountPercent / 100);
            } else {
                const fixedDiscount = parseFloat(couponText.match(/Rs(\d+)/)[1]);
                discountAmount = Math.min(fixedDiscount, subtotal);
            }
        }

        // Update DOM elements
        document.getElementById("total-items").textContent = totalItems;
        document.getElementById("total-price").textContent = subtotal.toFixed(2);

        const discountedSubtotal = subtotal - discountAmount;
        const finalTotal = Math.max(0, discountedSubtotal + shipping);

        document.querySelector(".total-line span:last-child").textContent = `Rs ${finalTotal.toFixed(2)}`;

        const discountMessage = document.querySelector('.discount-message');
        if (discountAmount > 0) {
            if (!discountMessage) {
                const messageElement = document.createElement('p');
                messageElement.className = 'discount-message';
                messageElement.textContent = `You saved: Rs ${discountAmount.toFixed(2)}`;
                document.querySelector('.summary-total').insertBefore(messageElement, document.querySelector('.order_btn_animation'));
            } else {
                discountMessage.textContent = `You saved: Rs ${discountAmount.toFixed(2)}`;
            }
        } else if (discountMessage) {
            discountMessage.remove();
        }
    }

    // Helper functions for cart operations
    async function updateQuantityInDatabase(item, newQuantity) {
        const cartItem = item.closest('.cart-item');
        const productId = cartItem.dataset.productId;
        const size = cartItem.querySelector('.cart-item-size').textContent.replace('Size: ', '').trim();

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
                item.textContent = parseInt(item.textContent) - (newQuantity > parseInt(item.textContent) ? -1 : 1);
                updateCart();
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            item.textContent = parseInt(item.textContent) - (newQuantity > parseInt(item.textContent) ? -1 : 1);
            updateCart();
        }
    }

    async function removeItemFromDatabase(item) {
        const cartItem = item.closest('.cart-item');
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
            if (!data.success) {
                console.error('Error removing item:', data.message);
                document.querySelector('.cart-items-section').insertBefore(cartItem, document.querySelector('.cart-back'));
                updateCart();
            }
        } catch (error) {
            console.error('Error removing item:', error);
            document.querySelector('.cart-items-section').insertBefore(cartItem, document.querySelector('.cart-back'));
            updateCart();
        }
    }

    // Notification function
    function showNotification(message, type = 'success') {
        const notificationBar = document.querySelector('.notification-bar');
        if (notificationBar) {
            notificationBar.querySelector('.notification-text').textContent = message;
            notificationBar.style.backgroundColor =
                type === 'success' ? '#4CAF50' :
                    type === 'error' ? '#f44336' : '#2196F3';
            notificationBar.style.display = 'block';

            setTimeout(() => {
                notificationBar.style.display = 'none';
            }, 5000);
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

    checkPaymentReturn();
});