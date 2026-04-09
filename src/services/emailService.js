/**
 * Email Service for Samskruthi Foods
 * Handles all transactional emails with branded HTML templates
 * 
 * Uses Nodemailer with Gmail SMTP (free for low volume)
 * 
 * Required environment variables:
 * - SMTP_HOST (default: smtp.gmail.com)
 * - SMTP_PORT (default: 587)
 * - SMTP_USER (Gmail address)
 * - SMTP_PASS (Gmail App Password)
 * - SMTP_FROM_EMAIL (default: same as SMTP_USER)
 * - SMTP_FROM_NAME (default: Samskruthi Foods)
 */

import nodemailer from 'nodemailer';

// Brand Colors
const BRAND_COLORS = {
  maroon: '#800000',
  gold: '#FFD700',
  yellow: '#FFF9E6',
  lightMaroon: '#A52A2A',
  cream: '#FFFACD',
  white: '#FFFFFF',
  textDark: '#333333',
  textLight: '#666666'
};

// Business Info
const BUSINESS_INFO = {
  name: 'Samskruthi Foods',
  address: '41, Road No. 1, Srinivasa Nagar Bank Colony, Kanuru, AP 520008',
  phone: '085006 77977',
  hours: 'Open · Closes 9:30 PM',
  website: 'https://samskruthifoods.vercel.app',
  email: 'support@samskruthifoods.com'
};

// Create transporter (lazy initialization)
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Debug logs for production troubleshooting
    console.log(`📧 Email Config Check:`);
    console.log(`   Host: ${host}`);
    console.log(`   Port: ${port}`);
    console.log(`   User: ${user ? '✓ Set' : '✗ Missing'}`);
    console.log(`   Pass: ${pass ? '✓ Set' : '✗ Missing'}`);

    if (!user || !pass) {
      console.error('❌ CRITICAL: Email service NOT configured. Set SMTP_USER and SMTP_PASS in environment variables.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // Use TLS for port 587, SSL for 465
      auth: { user, pass },
      // Add timeout for Render environment
      connectionTimeout: 5000,
      socketTimeout: 5000,
      // Reject unauthorized certificates in production
      tls: { rejectUnauthorized: true }
    });

    // Test connection on first initialization
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP transporter error:', error.message);
        console.error('   This could be: wrong password, blocked account, incorrect host/port');
      } else {
        console.log('✅ SMTP transporter verified and ready');
      }
    });
  }
  return transporter;
};

/**
 * Generate HTML for product items table (without images)
 */
const generateProductsTable = (items) => {
  const rows = items.map(item => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px; text-align: left;">
        <div>
          <strong style="color: ${BRAND_COLORS.textDark}; display: block;">${item.name}</strong>
          <span style="color: ${BRAND_COLORS.textLight}; font-size: 13px; display: block;">${item.category} • ${item.weight}</span>
        </div>
      </td>
      <td style="padding: 12px; text-align: center; color: ${BRAND_COLORS.textLight};">
        ${item.quantity}
      </td>
      <td style="padding: 12px; text-align: right; font-weight: 600; color: ${BRAND_COLORS.maroon};">
        ₹${item.total.toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #ffffff;">
      <thead>
        <tr style="background: ${BRAND_COLORS.cream}; border-bottom: 2px solid ${BRAND_COLORS.maroon};">
          <th style="padding: 12px; text-align: left; color: ${BRAND_COLORS.maroon}; font-weight: 600;">Product</th>
          <th style="padding: 12px; text-align: center; color: ${BRAND_COLORS.maroon}; font-weight: 600;">Qty</th>
          <th style="padding: 12px; text-align: right; color: ${BRAND_COLORS.maroon}; font-weight: 600;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Generate 3-step progress indicator
 */
const generateProgressIndicator = (currentStatus) => {
  const steps = [
    { key: 'received', label: 'Order Received', icon: '📦' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🚚' },
    { key: 'delivered', label: 'Delivered', icon: '✅' }
  ];

  const statusIndex = {
    'pending': -1,
    'confirmed': 0,
    'processing': 0,
    'received': 0,
    'out_for_delivery': 1,
    'delivered': 2
  };

  const currentIndex = statusIndex[currentStatus] ?? -1;

  const stepHtml = steps.map((step, index) => {
    const isCompleted = index <= currentIndex;
    const isCurrent = index === currentIndex;
    
    return `
      <div style="text-align: center; flex: 1; position: relative;">
        <div style="
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: ${isCompleted ? BRAND_COLORS.maroon : '#E0E0E0'};
          color: ${isCompleted ? BRAND_COLORS.white : BRAND_COLORS.textLight};
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px auto;
          font-size: 20px;
          ${isCurrent ? `box-shadow: 0 0 0 4px ${BRAND_COLORS.gold}; border: 2px solid ${BRAND_COLORS.maroon};` : 'border: 2px solid transparent;'}
        ">
          ${step.icon}
        </div>
        <div style="
          font-size: 12px;
          font-weight: ${isCurrent ? '600' : '400'};
          color: ${isCompleted ? BRAND_COLORS.maroon : BRAND_COLORS.textLight};
        ">
          ${step.label}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 30px 0;
      padding: 20px;
      background: ${BRAND_COLORS.cream};
      border-radius: 12px;
      border: 1px solid #e8d700;
    ">
      ${stepHtml}
    </div>
  `;
};

/**
 * Generate order summary section
 */
const generateOrderSummary = (order) => {
  return `
    <div style="background: ${BRAND_COLORS.cream}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${BRAND_COLORS.maroon};">
      <h4 style="margin: 0 0 16px 0; color: ${BRAND_COLORS.maroon}; font-weight: 600;">Order Summary</h4>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight};">Subtotal</td>
          <td style="padding: 8px 0; text-align: right; color: ${BRAND_COLORS.textDark}; font-weight: 500;">₹${order.subtotal.toLocaleString('en-IN')}</td>
        </tr>
        ${order.discount > 0 ? `
          <tr>
            <td style="padding: 8px 0; color: #27ae60;">Discount ${order.couponCode ? `(${order.couponCode})` : ''}</td>
            <td style="padding: 8px 0; text-align: right; color: #27ae60; font-weight: 500;">-₹${order.discount.toLocaleString('en-IN')}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight};">Delivery</td>
          <td style="padding: 8px 0; text-align: right; color: ${BRAND_COLORS.textDark}; font-weight: 500;">${order.deliveryCharge > 0 ? `₹${order.deliveryCharge.toLocaleString('en-IN')}` : 'FREE'}</td>
        </tr>
        <tr style="border-top: 2px solid ${BRAND_COLORS.maroon};">
          <td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.maroon};">Total</td>
          <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: 700; color: ${BRAND_COLORS.maroon};">₹${order.totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
    </div>
  `;
};

/**
 * Base email template wrapper
 */
const emailWrapper = (title, content, trackOrderButton = true, orderId = '') => {
  const trackUrl = `${BUSINESS_INFO.website}/orders`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.yellow}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND_COLORS.yellow}; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLORS.maroon} 0%, ${BRAND_COLORS.lightMaroon} 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: ${BRAND_COLORS.gold}; font-size: 28px; font-weight: 700;">
                    🍽️ ${BUSINESS_INFO.name}
                  </h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                    Authentic Telugu Homemade Pickles & Sweets
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 30px; background-color: #fafafa;">
                  ${content}
                  
                  ${trackOrderButton ? `
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${trackUrl}" style="
                        display: inline-block;
                        background: ${BRAND_COLORS.maroon};
                        color: ${BRAND_COLORS.white};
                        text-decoration: none;
                        padding: 14px 32px;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 16px;
                      ">
                        Track Your Order →
                      </a>
                    </div>
                  ` : ''}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: ${BRAND_COLORS.cream}; padding: 24px; text-align: center;">
                  <p style="margin: 0 0 8px 0; color: ${BRAND_COLORS.maroon}; font-weight: 600;">
                    ${BUSINESS_INFO.name}
                  </p>
                  <p style="margin: 0 0 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 13px;">
                    📍 ${BUSINESS_INFO.address}
                  </p>
                  <p style="margin: 0 0 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 13px;">
                    📞 ${BUSINESS_INFO.phone} • ${BUSINESS_INFO.hours}
                  </p>
                  <p style="margin: 16px 0 0 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                    © ${new Date().getFullYear()} ${BUSINESS_INFO.name}. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Send email helper with admin notification
 * PRODUCTION-SAFE: Includes detailed error logging and timeout handling
 */
const sendEmail = async (to, subject, html) => {
  const transport = getTransporter();
  
  if (!transport) {
    console.warn(`⚠️ [MOCK MODE] Email not configured. Would send to ${to}: ${subject}`);
    return { success: false, error: 'SMTP not configured', mock: true };
  }

  const startTime = Date.now();
  const adminEmail = process.env.ADMIN_EMAIL || 'yash.freelancer17@gmail.com';

  try {
    const fromName = process.env.SMTP_FROM_NAME || BUSINESS_INFO.name;
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    if (!fromEmail) {
      throw new Error('SMTP_USER not configured - cannot send emails');
    }

    console.log(`📧 Sending email to ${to} | Subject: ${subject}`);

    // Send to customer with timeout protection
    const customerEmail = await Promise.race([
      transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        // Add headers for better deliverability
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Samskruthi Foods Mailer'
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email send timeout after 10s')), 10000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Customer email sent: ${to} | MessageID: ${customerEmail.messageId} | Duration: ${duration}ms`);

    // Send copy to admin (don't fail main operation if this fails)
    (async () => {
      try {
        const adminSubject = `[ADMIN COPY] ${subject}`;
        const adminEmail = process.env.ADMIN_EMAIL || 'yash.freelancer17@gmail.com';
        
        await Promise.race([
          transport.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to: adminEmail,
            subject: adminSubject,
            html,
            headers: {
              'X-Priority': '3',
              'X-Mailer': 'Samskruthi Foods Mailer'
            }
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Admin email timeout')), 5000)
          )
        ]);
        
        console.log(`📧 Admin copy sent to ${adminEmail}`);
      } catch (adminError) {
        console.error(`⚠️ Admin email failed (non-critical):`, adminError.message);
      }
    })();

    return { 
      success: true, 
      messageId: customerEmail.messageId,
      duration,
      to 
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // DETAILED ERROR LOGGING FOR PRODUCTION DEBUG
    console.error(`\n❌ EMAIL SEND FAILED (${duration}ms)`);
    console.error(`   Recipient: ${to}`);
    console.error(`   Subject: ${subject}`);
    console.error(`   Error Type: ${error.name}`);
    console.error(`   Error Message: ${error.message}`);
    
    if (error.message.includes('Invalid login')) {
      console.error(`   → CAUSE: Wrong Gmail password or account blocked`);
      console.error(`   → FIX: Verify SMTP_PASS is correct Gmail App Password`);
    } else if (error.message.includes('timeout')) {
      console.error(`   → CAUSE: Network timeout to SMTP server`);
      console.error(`   → FIX: Check if Render can reach smtp.gmail.com:587`);
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error(`   → CAUSE: Cannot connect to SMTP server`);
      console.error(`   → FIX: Verify SMTP_HOST and SMTP_PORT are correct`);
    }
    
    return { 
      success: false, 
      error: error.message,
      to,
      duration
    };
  }
};

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * 1. Payment Confirmation Email
 * Sent immediately after successful payment verification
 */
export const sendPaymentConfirmationEmail = async (order) => {
  const subject = `✅ Payment Confirmed - Order #${order.orderId}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="
        width: 80px;
        height: 80px;
        background: #E8F5E9;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin-bottom: 16px;
      ">
        ✅
      </div>
      <h2 style="margin: 0; color: ${BRAND_COLORS.maroon}; font-size: 24px;">
        Payment Successful!
      </h2>
      <p style="color: ${BRAND_COLORS.textLight}; margin: 8px 0 0 0;">
        Thank you for your order, ${order.customer.name}!
      </p>
    </div>
    
    <div style="background: #E8F5E9; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #2E7D32;">
        <strong>Order ID:</strong> ${order.orderId}<br>
        <strong>Amount Paid:</strong> ₹${order.totalAmount.toLocaleString('en-IN')}<br>
        <strong>Payment ID:</strong> ${order.payment.razorpayPaymentId || 'N/A'}
      </p>
    </div>
    
    <h3 style="color: ${BRAND_COLORS.maroon}; border-bottom: 2px solid ${BRAND_COLORS.gold}; padding-bottom: 8px;">
      Order Details
    </h3>
    
    ${generateProductsTable(order.items)}
    
    ${generateOrderSummary(order)}
    
    <div style="background: ${BRAND_COLORS.cream}; padding: 16px; border-radius: 8px; margin-top: 20px;">
      <h4 style="margin: 0 0 8px 0; color: ${BRAND_COLORS.maroon};">Delivery Address</h4>
      <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
        ${order.customer.name}<br>
        ${order.customer.address}<br>
        ${order.customer.state ? `${order.customer.state}, ` : ''}${order.customer.country} - ${order.customer.pincode}<br>
        📞 ${order.customer.mobile}
      </p>
    </div>
    
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-top: 24px; font-size: 14px;">
      We're preparing your order with love! You'll receive updates as it progresses.
    </p>
  `;

  return sendEmail(order.customer.email, subject, emailWrapper(subject, content, true, order.orderId));
};

/**
 * 2. Order Received Email
 * Sent when admin marks order as "received" (processing)
 */
export const sendOrderReceivedEmail = async (order) => {
  const subject = `📦 Order Received - #${order.orderId} is being prepared`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="
        width: 80px;
        height: 80px;
        background: ${BRAND_COLORS.cream};
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin-bottom: 16px;
      ">
        📦
      </div>
      <h2 style="margin: 0; color: ${BRAND_COLORS.maroon}; font-size: 24px;">
        We've Received Your Order!
      </h2>
      <p style="color: ${BRAND_COLORS.textLight}; margin: 8px 0 0 0;">
        Hi ${order.customer.name}, we're now preparing your delicious order!
      </p>
    </div>
    
    ${generateProgressIndicator('received')}
    
    <div style="background: #FFF3E0; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #FF9800;">
      <p style="margin: 0; color: #E65100; font-size: 14px;">
        <strong>🔥 Your order is being freshly prepared!</strong><br>
        We'll notify you when it's out for delivery.
      </p>
    </div>
    
    <h3 style="color: ${BRAND_COLORS.maroon}; border-bottom: 2px solid ${BRAND_COLORS.gold}; padding-bottom: 8px;">
      Your Order
    </h3>
    
    ${generateProductsTable(order.items)}
    
    ${generateOrderSummary(order)}
  `;

  return sendEmail(order.customer.email, subject, emailWrapper(subject, content, true, order.orderId));
};

/**
 * 3. Out for Delivery Email
 * Sent when admin marks order as "out_for_delivery"
 */
export const sendOutForDeliveryEmail = async (order) => {
  const subject = `🚚 Your Order is Out for Delivery - #${order.orderId}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="
        width: 80px;
        height: 80px;
        background: #E3F2FD;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin-bottom: 16px;
      ">
        🚚
      </div>
      <h2 style="margin: 0; color: ${BRAND_COLORS.maroon}; font-size: 24px;">
        Your Order is On Its Way!
      </h2>
      <p style="color: ${BRAND_COLORS.textLight}; margin: 8px 0 0 0;">
        Hi ${order.customer.name}, your order is out for delivery!
      </p>
    </div>
    
    ${generateProgressIndicator('out_for_delivery')}
    
    <div style="background: #E3F2FD; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1976D2;">
      <p style="margin: 0; color: #0D47A1; font-size: 14px;">
        <strong>🚀 Almost there!</strong><br>
        Our delivery partner is on the way to your address.
      </p>
    </div>
    
    <div style="background: ${BRAND_COLORS.cream}; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; color: ${BRAND_COLORS.maroon};">Delivery Address</h4>
      <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
        ${order.customer.name}<br>
        ${order.customer.address}<br>
        ${order.customer.state ? `${order.customer.state}, ` : ''}${order.customer.country} - ${order.customer.pincode}<br>
        📞 ${order.customer.mobile}
      </p>
    </div>
    
    <h3 style="color: ${BRAND_COLORS.maroon}; border-bottom: 2px solid ${BRAND_COLORS.gold}; padding-bottom: 8px;">
      Your Items
    </h3>
    
    ${generateProductsTable(order.items)}
    
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-top: 24px; font-size: 14px;">
      Please keep your phone handy. Our delivery partner may contact you.
    </p>
  `;

  return sendEmail(order.customer.email, subject, emailWrapper(subject, content, true, order.orderId));
};

/**
 * 4. Delivered Email
 * Sent when admin marks order as "delivered"
 */
export const sendDeliveredEmail = async (order) => {
  const subject = `✅ Order Delivered! - #${order.orderId}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="
        width: 80px;
        height: 80px;
        background: #E8F5E9;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        margin-bottom: 16px;
      ">
        🎉
      </div>
      <h2 style="margin: 0; color: ${BRAND_COLORS.maroon}; font-size: 24px;">
        Order Delivered!
      </h2>
      <p style="color: ${BRAND_COLORS.textLight}; margin: 8px 0 0 0;">
        Hi ${order.customer.name}, your order has been delivered!
      </p>
    </div>
    
    ${generateProgressIndicator('delivered')}
    
    <div style="background: #E8F5E9; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
      <p style="margin: 0 0 16px 0; color: #2E7D32; font-size: 16px;">
        <strong>Thank you for choosing ${BUSINESS_INFO.name}!</strong>
      </p>
      <p style="margin: 0; color: #388E3C; font-size: 14px;">
        We hope you enjoy our authentic homemade delicacies. 😋
      </p>
    </div>
    
    <h3 style="color: ${BRAND_COLORS.maroon}; border-bottom: 2px solid ${BRAND_COLORS.gold}; padding-bottom: 8px;">
      Order Summary
    </h3>
    
    ${generateProductsTable(order.items)}
    
    ${generateOrderSummary(order)}
    
    <div style="background: ${BRAND_COLORS.cream}; padding: 20px; border-radius: 8px; margin-top: 24px; text-align: center;">
      <h4 style="margin: 0 0 12px 0; color: ${BRAND_COLORS.maroon};">Loved our products?</h4>
      <p style="margin: 0 0 16px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
        Share your experience with friends and family!
      </p>
      <a href="${BUSINESS_INFO.website}" style="
        display: inline-block;
        background: ${BRAND_COLORS.gold};
        color: ${BRAND_COLORS.maroon};
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
      ">
        Order Again 🛒
      </a>
    </div>
    
    <p style="text-align: center; color: ${BRAND_COLORS.textLight}; margin-top: 24px; font-size: 13px;">
      Questions? Contact us at ${BUSINESS_INFO.phone}
    </p>
  `;

  return sendEmail(order.customer.email, subject, emailWrapper(subject, content, false, order.orderId));
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  const transport = getTransporter();
  
  if (!transport) {
    return { 
      success: false, 
      message: 'Email not configured. Set SMTP_USER and SMTP_PASS environment variables.' 
    };
  }

  try {
    await transport.verify();
    return { success: true, message: 'Email configuration is valid.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export default {
  sendPaymentConfirmationEmail,
  sendOrderReceivedEmail,
  sendOutForDeliveryEmail,
  sendDeliveredEmail,
  testEmailConfiguration
};
