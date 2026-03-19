// ============================================================
// FILE: src/utils/exportPdf.js
// FEATURE: Application ko PDF mein export karo
// USE: await exportApplicationPdf(application)
// ============================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// ── Format timestamp ──────────────────────────────────────
const formatDate = (ts) => {
  if (!ts) return 'N/A';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return 'N/A'; }
};

// ── Status color ──────────────────────────────────────────
const statusColor = (status) => {
  const s = status?.toLowerCase() || '';
  if (s.includes('submit') || s.includes('complet')) return '#10B981';
  if (s.includes('reject')) return '#EF4444';
  if (s.includes('process')) return '#F59E0B';
  return '#003366';
};

// ── Generate HTML ─────────────────────────────────────────
const generateHtml = (app) => {
  const title = app.jobTitle || app.serviceTitle || 'Application';
  const fees = app.feeDetails || {};
  const form = app.formData || {};
  const status = app.status || 'Processing';
  const sColor = statusColor(status);

  // Form data rows
  const formRows = Object.entries(form)
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding:10px 15px; color:#64748B; font-weight:600; width:40%; border-bottom:1px solid #F1F5F9;">${k}</td>
        <td style="padding:10px 15px; color:#1E293B; font-weight:700; border-bottom:1px solid #F1F5F9;">${v}</td>
      </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #F8FAFC; color: #1E293B; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; min-height: 100vh; }

    /* Header */
    .header { background: linear-gradient(135deg, #003366, #1a5276); padding: 35px 40px; color: white; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: 1px; }
    .logo span { color: #F59E0B; }
    .header-sub { font-size: 13px; opacity: 0.7; margin-top: 4px; }
    .doc-title { font-size: 15px; font-weight: 700; margin-top: 18px; opacity: 0.9; }

    /* Status Badge */
    .status-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.5px;
      background: ${sColor}22;
      color: ${sColor};
      border: 2px solid ${sColor};
    }

    /* Body */
    .body { padding: 35px 40px; }

    /* Info Grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
    .info-card { background: #F8FAFC; border-radius: 12px; padding: 16px; border-left: 4px solid #003366; }
    .info-label { font-size: 10px; font-weight: 900; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
    .info-value { font-size: 15px; font-weight: 800; color: #1E293B; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section-title { font-size: 13px; font-weight: 900; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; }
    table { width: 100%; border-collapse: collapse; }

    /* Fee Card */
    .fee-card { background: #EBF5FB; border-radius: 12px; padding: 20px; }
    .fee-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #BFDBFE; }
    .fee-row:last-child { border-bottom: none; }
    .fee-label { color: #1a5276; font-size: 13px; font-weight: 600; }
    .fee-val { font-weight: 800; color: #003366; }
    .fee-total { background: #003366; color: white; border-radius: 10px; padding: 14px 20px; display: flex; justify-content: space-between; margin-top: 10px; }
    .fee-total-label { font-size: 14px; font-weight: 700; }
    .fee-total-val { font-size: 20px; font-weight: 900; }

    /* Discount */
    .discount { color: #10B981; font-weight: 800; }

    /* Footer */
    .footer { border-top: 2px solid #E2E8F0; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: 30px; }
    .footer-left { font-size: 11px; color: #94A3B8; }
    .footer-right { font-size: 11px; color: #94A3B8; text-align: right; }
    .seal { font-size: 10px; color: #10B981; font-weight: 800; }

    /* Watermark */
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80px; font-weight: 900; color: rgba(0,51,102,0.04); pointer-events: none; white-space: nowrap; }
  </style>
</head>
<body>
<div class="page">
  <div class="watermark">SewaOne</div>

  <!-- Header -->
  <div class="header">
    <div class="logo">Sewa<span>One</span></div>
    <div class="header-sub">Unified Government Services Portal</div>
    <div class="doc-title">📄 Application Confirmation Receipt</div>
    <div class="status-row">
      <span class="status-badge">${status.toUpperCase()}</span>
    </div>
  </div>

  <div class="body">

    <!-- Info Grid -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Tracking ID</div>
        <div class="info-value">#${app.trackingId || 'N/A'}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Application Type</div>
        <div class="info-value">${app.appType === 'job' ? '💼 Job Application' : '🏛️ Citizen Service'}</div>
      </div>
      <div class="info-card" style="grid-column: 1 / -1;">
        <div class="info-label">Service / Job Name</div>
        <div class="info-value" style="font-size:17px;">${title}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Submitted On</div>
        <div class="info-value" style="font-size:13px;">${formatDate(app.timestamp)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Payment Method</div>
        <div class="info-value">${app.paymentMethod?.toUpperCase() || 'N/A'}</div>
      </div>
    </div>

    <!-- Form Data -->
    ${formRows ? `
    <div class="section">
      <div class="section-title">📋 Submitted Information</div>
      <table>
        <tbody>${formRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- Fee Details -->
    ${fees.totalPaid !== undefined ? `
    <div class="section">
      <div class="section-title">💰 Payment Summary</div>
      <div class="fee-card">
        ${fees.govFee ? `<div class="fee-row"><span class="fee-label">Government Fee</span><span class="fee-val">₹${fees.govFee}</span></div>` : ''}
        ${fees.serviceFee ? `<div class="fee-row"><span class="fee-label">SewaOne Service Fee</span><span class="fee-val">₹${fees.serviceFee}</span></div>` : ''}
        ${fees.discount ? `<div class="fee-row"><span class="fee-label">Coupon Discount</span><span class="fee-val discount">-₹${fees.discount}</span></div>` : ''}
        <div class="fee-total">
          <span class="fee-total-label">Total Paid</span>
          <span class="fee-total-val">₹${fees.totalPaid}</span>
        </div>
      </div>
    </div>
    ` : ''}

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      Generated by SewaOne App<br>
      <span class="seal">✅ Digitally Verified Document</span>
    </div>
    <div class="footer-right">
      Tracking ID: #${app.trackingId || 'N/A'}<br>
      ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
    </div>
  </div>
</div>
</body>
</html>`;
};

// ── Main Export Function ──────────────────────────────────
export const exportApplicationPdf = async (application, userName = 'User') => {
  try {
    const html = generateHtml(application);
    const title = application.jobTitle || application.serviceTitle || 'Application';
    const trackId = application.trackingId || Date.now();

    // 1. HTML → PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // 2. Rename file meaningfully
    const fileName = `SewaOne_${trackId}.pdf`;
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: uri, to: newUri });

    // 3. Share / Download
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Application Receipt — ${title}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      return { success: false, error: 'Sharing not available on this device' };
    }

    return { success: true, uri: newUri };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
