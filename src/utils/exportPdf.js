// ============================================================
// FILE: src/utils/exportPdf.js
// FIX: Phone storage mein download hoga — browser nahi
// ============================================================

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';

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

const statusColor = (status) => {
  const s = status?.toLowerCase() || '';
  if (s.includes('submit') || s.includes('complet')) return '#10B981';
  if (s.includes('reject')) return '#EF4444';
  if (s.includes('process')) return '#F59E0B';
  return '#003366';
};

const generateHtml = (app) => {
  const title = app.jobTitle || app.serviceTitle || 'Application';
  const fees  = app.feeDetails || {};
  const form  = app.formData  || {};
  const status = app.status   || 'Processing';
  const sColor = statusColor(status);

  const formRows = Object.entries(form)
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding:10px 15px;color:#64748B;font-weight:600;width:40%;border-bottom:1px solid #F1F5F9;">${k}</td>
        <td style="padding:10px 15px;color:#1E293B;font-weight:700;border-bottom:1px solid #F1F5F9;">${v}</td>
      </tr>
    `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#F8FAFC;color:#1E293B;}
    .page{max-width:800px;margin:0 auto;background:#fff;min-height:100vh;}
    .header{background:linear-gradient(135deg,#003366,#1a5276);padding:35px 40px;color:white;}
    .logo{font-size:28px;font-weight:900;letter-spacing:1px;}
    .logo span{color:#F59E0B;}
    .header-sub{font-size:13px;opacity:.7;margin-top:4px;}
    .doc-title{font-size:15px;font-weight:700;margin-top:18px;opacity:.9;}
    .status-badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:900;background:${sColor}22;color:${sColor};border:2px solid ${sColor};margin-top:12px;}
    .body{padding:35px 40px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:30px;}
    .info-card{background:#F8FAFC;border-radius:12px;padding:16px;border-left:4px solid #003366;}
    .info-label{font-size:10px;font-weight:900;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;}
    .info-value{font-size:15px;font-weight:800;color:#1E293B;}
    .section{margin-bottom:28px;}
    .section-title{font-size:13px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #E2E8F0;}
    table{width:100%;border-collapse:collapse;}
    .fee-card{background:#EBF5FB;border-radius:12px;padding:20px;}
    .fee-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #BFDBFE;}
    .fee-row:last-child{border-bottom:none;}
    .fee-label{color:#1a5276;font-size:13px;font-weight:600;}
    .fee-val{font-weight:800;color:#003366;}
    .fee-total{background:#003366;color:white;border-radius:10px;padding:14px 20px;display:flex;justify-content:space-between;margin-top:10px;}
    .fee-total-label{font-size:14px;font-weight:700;}
    .fee-total-val{font-size:20px;font-weight:900;}
    .discount{color:#10B981;font-weight:800;}
    .footer{border-top:2px solid #E2E8F0;padding:20px 40px;display:flex;justify-content:space-between;align-items:center;margin-top:30px;}
    .footer-left{font-size:11px;color:#94A3B8;}
    .footer-right{font-size:11px;color:#94A3B8;text-align:right;}
    .seal{font-size:10px;color:#10B981;font-weight:800;}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80px;font-weight:900;color:rgba(0,51,102,0.04);pointer-events:none;white-space:nowrap;}
  </style>
</head>
<body>
<div class="page">
  <div class="watermark">SewaOne</div>
  <div class="header">
    <div class="logo">Sewa<span>One</span></div>
    <div class="header-sub">Unified Government Services Portal</div>
    <div class="doc-title">Application Confirmation Receipt</div>
    <span class="status-badge">${status.toUpperCase()}</span>
  </div>
  <div class="body">
    <div class="info-grid">
      <div class="info-card"><div class="info-label">Tracking ID</div><div class="info-value">#${app.trackingId || 'N/A'}</div></div>
      <div class="info-card"><div class="info-label">Application Type</div><div class="info-value">${app.appType === 'job' ? 'Job Application' : 'Citizen Service'}</div></div>
      <div class="info-card" style="grid-column:1/-1;"><div class="info-label">Service / Job Name</div><div class="info-value" style="font-size:17px;">${title}</div></div>
      <div class="info-card"><div class="info-label">Submitted On</div><div class="info-value" style="font-size:13px;">${formatDate(app.timestamp)}</div></div>
      <div class="info-card"><div class="info-label">Payment Method</div><div class="info-value">${app.paymentMethod?.toUpperCase() || 'N/A'}</div></div>
    </div>
    ${formRows ? `<div class="section"><div class="section-title">Submitted Information</div><table><tbody>${formRows}</tbody></table></div>` : ''}
    ${fees.totalPaid !== undefined ? `
    <div class="section">
      <div class="section-title">Payment Summary</div>
      <div class="fee-card">
        ${fees.govFee ? `<div class="fee-row"><span class="fee-label">Government Fee</span><span class="fee-val">Rs.${fees.govFee}</span></div>` : ''}
        ${fees.serviceFee ? `<div class="fee-row"><span class="fee-label">SewaOne Service Fee</span><span class="fee-val">Rs.${fees.serviceFee}</span></div>` : ''}
        ${fees.discount ? `<div class="fee-row"><span class="fee-label">Coupon Discount</span><span class="fee-val discount">-Rs.${fees.discount}</span></div>` : ''}
        <div class="fee-total"><span class="fee-total-label">Total Paid</span><span class="fee-total-val">Rs.${fees.totalPaid}</span></div>
      </div>
    </div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-left">Generated by SewaOne App<br><span class="seal">Digitally Verified Document</span></div>
    <div class="footer-right">Tracking ID: #${app.trackingId || 'N/A'}<br>${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
</div>
</body>
</html>`;
};

// ── Main Export Function ──────────────────────────────────
export const exportApplicationPdf = async (application) => {
  try {
    const html      = generateHtml(application);
    const title     = application.jobTitle || application.serviceTitle || 'Application';
    const trackId   = application.trackingId || Date.now();
    const fileName  = `SewaOne_${trackId}.pdf`;

    // Step 1: HTML → PDF
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    // Step 2: Move to documentDirectory with proper name
    const destUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: uri, to: destUri });

    // Step 3: ✅ Save to phone Downloads/Gallery
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status === 'granted') {
      // Save to media library (Downloads folder)
      const asset = await MediaLibrary.createAssetAsync(destUri);
      try {
        // Try to move to Downloads album
        const album = await MediaLibrary.getAlbumAsync('Download');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('Download', asset, false);
        }
      } catch {}

      Alert.alert(
        '✅ PDF Saved!',
        `File phone ke Downloads folder mein save ho gayi:\n${fileName}\n\nShare karna chahte hain?`,
        [
          { text: 'Share', onPress: async () => {
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: title });
          }},
          { text: 'OK', style: 'cancel' }
        ]
      );
    } else {
      // Permission nahi mili — Share dialog kholo
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Application Receipt — ${title}`,
          UTI: 'com.adobe.pdf',
        });
      }
    }

    return { success: true, uri: destUri };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
