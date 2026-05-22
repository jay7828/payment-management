const dayjs = require("dayjs");

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderModeRows = (paymentsByMode) => {
  const entries = Object.entries(paymentsByMode || {});
  if (!entries.length) {
    return `<tr><td colspan="2" style="padding:8px;color:#5E7894;">No payments</td></tr>`;
  }
  return entries
    .map(
      ([mode, amount]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E8EFF7;color:#18324A;">${escapeHtml(mode)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E8EFF7;text-align:right;font-weight:600;color:#18324A;">${fmt(amount)}</td>
    </tr>`
    )
    .join("");
};

const renderPaymentTable = (payments) => {
  if (!payments.length) {
    return `<p style="margin:8px 0 0;color:#5E7894;font-size:13px;">No payments recorded this month.</p>`;
  }

  const rows = payments
    .map(
      (p) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #EEF3FA;font-size:13px;color:#18324A;">${escapeHtml(p.customerName)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEF3FA;font-size:13px;color:#5E7894;">${p.paymentDate ? dayjs(p.paymentDate).format("DD MMM") : "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEF3FA;font-size:13px;color:#5E7894;">${escapeHtml(p.mode)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEF3FA;font-size:13px;text-align:right;font-weight:600;color:#1FA971;">${fmt(p.amount)}</td>
    </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;background:#FFFFFF;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F3F7FC;">
          <th align="left" style="padding:10px;font-size:11px;color:#5E7894;text-transform:uppercase;">Customer</th>
          <th align="left" style="padding:10px;font-size:11px;color:#5E7894;text-transform:uppercase;">Date</th>
          <th align="left" style="padding:10px;font-size:11px;color:#5E7894;text-transform:uppercase;">Mode</th>
          <th align="right" style="padding:10px;font-size:11px;color:#5E7894;text-transform:uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const renderSiteSection = (site) => {
  const share = site.collection.sharePercent ? `${site.collection.sharePercent.toFixed(1)}% of total` : "—";

  return `
    <div style="margin:24px 0 0;border:1px solid #C9DAEE;border-radius:14px;overflow:hidden;background:#FFFFFF;">
      <div style="background:linear-gradient(135deg,#1D66C2 0%,#2F80ED 100%);padding:16px 20px;">
        <div style="font-size:20px;font-weight:700;color:#FFFFFF;">${escapeHtml(site.siteName)}</div>
        <div style="font-size:13px;color:#D9E8FF;margin-top:4px;">${site.customerCount} customers · ${site.collection.transactionCount} payments · ${share}</div>
      </div>
      <div style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
          <tr>
            <td width="25%" style="padding:8px;background:#F3F7FC;border-radius:8px;">
              <div style="font-size:11px;color:#5E7894;text-transform:uppercase;">Collected</div>
              <div style="font-size:18px;font-weight:700;color:#1FA971;margin-top:4px;">${fmt(site.collection.total)}</div>
            </td>
            <td width="8"></td>
            <td width="25%" style="padding:8px;background:#F3F7FC;border-radius:8px;">
              <div style="font-size:11px;color:#5E7894;text-transform:uppercase;">Billed</div>
              <div style="font-size:18px;font-weight:700;color:#18324A;margin-top:4px;">${fmt(site.billing.totalBilled)}</div>
            </td>
            <td width="8"></td>
            <td width="25%" style="padding:8px;background:#F3F7FC;border-radius:8px;">
              <div style="font-size:11px;color:#5E7894;text-transform:uppercase;">Bill paid</div>
              <div style="font-size:18px;font-weight:700;color:#18324A;margin-top:4px;">${fmt(site.billing.totalBillPaid)}</div>
            </td>
            <td width="8"></td>
            <td width="25%" style="padding:8px;background:#F3F7FC;border-radius:8px;">
              <div style="font-size:11px;color:#5E7894;text-transform:uppercase;">Bill due</div>
              <div style="font-size:18px;font-weight:700;color:#D95A5A;margin-top:4px;">${fmt(site.billing.totalBillDue)}</div>
            </td>
          </tr>
        </table>
        <div style="font-size:13px;font-weight:700;color:#18324A;margin-bottom:6px;">Payment modes</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;">
          <tbody>${renderModeRows(site.collection.paymentsByMode)}</tbody>
        </table>
        <div style="font-size:13px;font-weight:700;color:#18324A;">Payment list</div>
        ${renderPaymentTable(site.payments)}
      </div>
    </div>`;
};

const formatSalesReportHtml = (report) => {
  const siteSections = (report.siteReports || []).map(renderSiteSection).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#FFFFFF;border-radius:16px;border:1px solid #C9DAEE;overflow:hidden;box-shadow:0 4px 20px rgba(18,48,80,0.08);">
      <div style="background:linear-gradient(135deg,#18324A 0%,#1D66C2 100%);padding:28px 24px;text-align:center;">
        <div style="font-size:12px;color:#B8D4F8;letter-spacing:1px;text-transform:uppercase;">Monthly Payment Report</div>
        <div style="font-size:28px;font-weight:700;color:#FFFFFF;margin-top:8px;">${escapeHtml(report.monthLabel)}</div>
        <div style="font-size:13px;color:#D9E8FF;margin-top:6px;">Generated ${dayjs(report.generatedAt).format("DD MMM YYYY, h:mm A")}</div>
      </div>
      <div style="padding:24px;">
        <div style="font-size:14px;font-weight:700;color:#18324A;margin-bottom:12px;">Overall summary</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:10px;background:#EAF8F4;border-radius:10px;border:1px solid #B5E7DE;">
              <div style="font-size:11px;color:#5E7894;">Total collected</div>
              <div style="font-size:22px;font-weight:700;color:#1FA971;margin-top:4px;">${fmt(report.sales.totalCollection)}</div>
              <div style="font-size:12px;color:#5E7894;margin-top:2px;">${report.sales.transactionCount} transactions</div>
            </td>
            <td width="12"></td>
            <td width="50%" style="padding:10px;background:#FFF4E8;border-radius:10px;border:1px solid #F7CC9D;">
              <div style="font-size:11px;color:#5E7894;">Outstanding due</div>
              <div style="font-size:22px;font-weight:700;color:#EE9B32;margin-top:4px;">${fmt(report.customers.totalOutstandingDue)}</div>
              <div style="font-size:12px;color:#5E7894;margin-top:2px;">${report.customers.activeCustomers} active customers</div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#5E7894;">Bills created</td>
            <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:600;color:#18324A;">${report.billing.billsCreated}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#5E7894;">Total billed</td>
            <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:600;color:#18324A;">${fmt(report.billing.totalBilled)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#5E7894;">New customers</td>
            <td style="padding:8px 0;font-size:13px;text-align:right;font-weight:600;color:#18324A;">${report.customers.newCustomers}</td>
          </tr>
        </table>
        <div style="margin-top:28px;padding-top:8px;border-top:2px solid #E8EFF7;">
          <div style="font-size:16px;font-weight:700;color:#18324A;">Site-wise breakdown</div>
          <div style="font-size:13px;color:#5E7894;margin-top:4px;">Payments and billing grouped by each site</div>
        </div>
        ${siteSections || `<p style="color:#5E7894;font-size:13px;">No site activity for this month.</p>`}
      </div>
      <div style="padding:16px 24px;background:#F3F7FC;border-top:1px solid #E8EFF7;text-align:center;font-size:12px;color:#5E7894;">
        Payment Management · Dukaan Ledger
      </div>
    </div>
  </div>
</body>
</html>`;
};

const formatSalesReportText = (report) => {
  const lines = [
    `MONTHLY PAYMENT REPORT — ${report.monthLabel}`,
    `Generated: ${dayjs(report.generatedAt).format("DD MMM YYYY, HH:mm")}`,
    "",
    "═══ OVERALL ═══",
    `Collected: ${fmt(report.sales.totalCollection)} (${report.sales.transactionCount} txns)`,
    `Billed: ${fmt(report.billing.totalBilled)} | Due on bills: ${fmt(report.billing.totalBillDue)}`,
    `Outstanding: ${fmt(report.customers.totalOutstandingDue)} | New customers: ${report.customers.newCustomers}`,
    ""
  ];

  for (const site of report.siteReports || []) {
    lines.push(`═══ SITE: ${site.siteName.toUpperCase()} ═══`);
    lines.push(
      `Collected ${fmt(site.collection.total)} (${site.collection.transactionCount} txns, ${site.collection.sharePercent}% of total)`
    );
    lines.push(
      `Billing: ${site.billing.billsCreated} bills | Billed ${fmt(site.billing.totalBilled)} | Due ${fmt(site.billing.totalBillDue)}`
    );
    for (const [mode, amount] of Object.entries(site.collection.paymentsByMode || {})) {
      lines.push(`  ${mode}: ${fmt(amount)}`);
    }
    if (site.payments.length) {
      lines.push("Payments:");
      for (const p of site.payments) {
        const date = p.paymentDate ? dayjs(p.paymentDate).format("DD MMM") : "—";
        lines.push(`  • ${p.customerName} | ${date} | ${p.mode} | ${fmt(p.amount)}`);
      }
    } else {
      lines.push("  (no payments)");
    }
    lines.push("");
  }

  return lines.join("\n");
};

module.exports = {
  formatSalesReportHtml,
  formatSalesReportText
};
