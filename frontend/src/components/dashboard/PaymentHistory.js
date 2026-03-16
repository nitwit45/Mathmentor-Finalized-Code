import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getPaymentHistory, getPaymentDetail, getMyProfile } from '../../services/api';
import {
  HiCurrencyPound,
  HiDocumentText,
  HiCalendar,
  HiArrowLeft,
  HiPrinter,
  HiCheckCircle,
  HiRefresh,
  HiXCircle,
  HiChevronRight,
  HiSearch,
  HiBookOpen,
  HiClock,
} from 'react-icons/hi';
import './PaymentHistory.css';

const STATUS_CONFIG = {
  succeeded: {
    label: 'Succeeded',
    icon: HiCheckCircle,
    className: 'pay-status-succeeded',
  },
  refunded: {
    label: 'Refunded',
    icon: HiRefresh,
    className: 'pay-status-refunded',
  },
  failed: {
    label: 'Failed',
    icon: HiXCircle,
    className: 'pay-status-failed',
  },
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSessionDate(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InvoiceView({ payment, onBack }) {
  const invoiceRef = useRef();

  function handlePrint() {
    const printContents = invoiceRef.current.innerHTML;
    const win = window.open('', '', 'width=800,height=900');
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${payment.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
            .inv-logo { font-size: 26px; font-weight: 800; letter-spacing: 0.05em; color: #b78a28; margin-bottom: 4px; }
            .inv-tagline { font-size: 13px; color: #666; margin-bottom: 32px; }
            .inv-header-row { display: flex; justify-content: space-between; margin-bottom: 32px; }
            .inv-number { font-size: 14px; color: #666; }
            .inv-number span { font-size: 22px; font-weight: 700; color: #1a1a1a; display: block; }
            .inv-status-badge { padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #dcfce7; color: #16a34a; }
            .inv-divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
            .inv-parties { display: flex; gap: 48px; margin-bottom: 32px; }
            .inv-party-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 6px; }
            .inv-party-name { font-weight: 600; font-size: 15px; color: #1a1a1a; }
            .inv-party-email { font-size: 13px; color: #666; }
            .inv-session-box { background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 32px; }
            .inv-session-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 12px; }
            .inv-session-topic { font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
            .inv-session-date { font-size: 13px; color: #555; margin-bottom: 4px; }
            .inv-session-duration { font-size: 13px; color: #555; }
            .inv-amount-row { display: flex; justify-content: space-between; font-size: 14px; color: #555; margin-bottom: 10px; }
            .inv-total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #1a1a1a; padding-top: 12px; border-top: 2px solid #e5e7eb; }
            .inv-footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    win.document.close();
    win.print();
    win.close();
  }

  const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.succeeded;

  return (
    <div className="invoice-view">
      <div className="invoice-toolbar">
        <button className="inv-back-btn" onClick={onBack}>
          <HiArrowLeft /> Back to History
        </button>
        <button className="inv-print-btn" onClick={handlePrint}>
          <HiPrinter /> Print Invoice
        </button>
      </div>

      <div className="invoice-card" ref={invoiceRef}>
        {/* Header */}
        <div className="inv-logo">Mathmentor</div>
        <p className="inv-tagline">Professional Tutoring Platform</p>

        <div className="inv-header-row">
          <div className="inv-number">
            INVOICE
            <span>{payment.invoice_number}</span>
          </div>
          <span className={`inv-status-badge ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>

        <hr className="inv-divider" />

        {/* Parties */}
        <div className="inv-parties">
          <div className="inv-party">
            <p className="inv-party-label">Bill From</p>
            <p className="inv-party-name">Mathmentor</p>
            <p className="inv-party-email">info@mathmentor.co.uk</p>
          </div>
          <div className="inv-party">
            <p className="inv-party-label">Bill To</p>
            <p className="inv-party-name">{payment.payer?.full_name}</p>
            <p className="inv-party-email">{payment.payer?.email}</p>
          </div>
        </div>

        <hr className="inv-divider" />

        {/* Session details */}
        <div className="inv-session-box">
          <p className="inv-session-label">Session Details</p>
          <p className="inv-session-topic">{payment.session_topic}</p>
          {payment.session_scheduled_time && (
            <p className="inv-session-date">
              <HiCalendar style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {formatSessionDate(payment.session_scheduled_time)}
            </p>
          )}
          <p className="inv-session-duration">Duration: {payment.session_duration} minutes</p>
        </div>

        {/* Amount breakdown */}
        <div className="inv-amounts">
          <div className="inv-amount-row">
            <span>Tutoring session ({payment.session_duration} min)</span>
            <span>£{parseFloat(payment.amount).toFixed(2)}</span>
          </div>
          <div className="inv-amount-row">
            <span>Platform fee</span>
            <span>£0.00</span>
          </div>
          <div className="inv-total-row">
            <span>Total Paid</span>
            <span>£{parseFloat(payment.amount).toFixed(2)}</span>
          </div>
        </div>

        <hr className="inv-divider" />

        {/* Metadata */}
        <div className="inv-meta">
          <div className="inv-meta-item">
            <span className="inv-meta-label">Payment Date</span>
            <span className="inv-meta-value">{formatDateTime(payment.paid_at)}</span>
          </div>
          {payment.stripe_payment_intent_id && (
            <div className="inv-meta-item">
              <span className="inv-meta-label">Transaction Reference</span>
              <span className="inv-meta-value inv-meta-mono">
                {payment.stripe_payment_intent_id}
              </span>
            </div>
          )}
        </div>

        <div className="inv-footer">
          <p>Thank you for using Mathmentor. This is an official invoice for your records.</p>
          <p style={{ marginTop: 4 }}>Questions? Contact us at support@mathmentor.com</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const isTutor = user?.role === 'TUTOR';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const promises = [getPaymentHistory()];
        if (isTutor) promises.push(getMyProfile());
        const results = await Promise.all(promises);
        if (results[0].success) setPayments(results[0].data);
        if (isTutor && results[1]?.success) setProfile(results[1].data);
      } catch (err) {
        console.error('Failed to load payment history:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isTutor]);

  async function openInvoice(payment) {
    setInvoiceLoading(true);
    try {
      const res = await getPaymentDetail(payment.id);
      if (res.success) {
        setSelectedPayment(res.data);
      }
    } catch {
      // Fall back to list data
      setSelectedPayment(payment);
    } finally {
      setInvoiceLoading(false);
    }
  }

  // Stats
  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const succeededCount = payments.filter(p => p.status === 'succeeded').length;
  const now = new Date();
  const thisMonthAmount = payments
    .filter(p => {
      const d = new Date(p.paid_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  const filtered = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.invoice_number?.toLowerCase().includes(q) ||
      p.session_topic?.toLowerCase().includes(q) ||
      p.payer?.full_name?.toLowerCase().includes(q) ||
      p.recipient?.full_name?.toLowerCase().includes(q)
    );
  });

  if (selectedPayment) {
    return <InvoiceView payment={selectedPayment} onBack={() => setSelectedPayment(null)} />;
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading payment history...</p>
      </div>
    );
  }

  const totalSessions = profile ? (parseInt(profile.total_sessions) || 0) : succeededCount;
  const totalHours = profile ? (parseFloat(profile.total_hours) || 0) : 0;

  return (
    <div className="payment-history-page">
      <div className="page-header">
        <h1>{isTutor ? 'Earnings' : 'Payment History'}</h1>
        <p>{isTutor ? 'Track your tutoring income' : 'Your payment records and invoices'}</p>
      </div>

      {/* Summary cards */}
      <div className={`pay-stats ${isTutor ? 'pay-stats-five' : ''}`}>
        <div className="pay-stat-card">
          <div className="pay-stat-icon total">
            <HiCurrencyPound />
          </div>
          <div className="pay-stat-body">
            <span className="pay-stat-value">£{totalAmount.toFixed(2)}</span>
            <span className="pay-stat-label">
              {isTutor ? 'Total Earned' : 'Total Paid'}
            </span>
          </div>
        </div>
        {isTutor && (
          <>
            <div className="pay-stat-card">
              <div className="pay-stat-icon sessions">
                <HiBookOpen />
              </div>
              <div className="pay-stat-body">
                <span className="pay-stat-value">{totalSessions}</span>
                <span className="pay-stat-label">Sessions Completed</span>
              </div>
            </div>
            <div className="pay-stat-card">
              <div className="pay-stat-icon hours">
                <HiClock />
              </div>
              <div className="pay-stat-body">
                <span className="pay-stat-value">{totalHours.toFixed(1)}</span>
                <span className="pay-stat-label">Hours Tutored</span>
              </div>
            </div>
          </>
        )}
        <div className="pay-stat-card">
          <div className="pay-stat-icon count">
            <HiDocumentText />
          </div>
          <div className="pay-stat-body">
            <span className="pay-stat-value">{succeededCount}</span>
            <span className="pay-stat-label">Successful Payments</span>
          </div>
        </div>
        <div className="pay-stat-card">
          <div className="pay-stat-icon month">
            <HiCalendar />
          </div>
          <div className="pay-stat-body">
            <span className="pay-stat-value">£{thisMonthAmount.toFixed(2)}</span>
            <span className="pay-stat-label">This Month</span>
          </div>
        </div>
      </div>

      {/* Search and list */}
      <div className="pay-list-section">
        <div className="pay-list-header">
          <h2>Transactions</h2>
          <div className="pay-search-wrap">
            <HiSearch className="pay-search-icon" />
            <input
              type="text"
              className="pay-search"
              placeholder="Search by topic, invoice, name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="pay-empty">
            <HiDocumentText className="pay-empty-icon" />
            <p>{payments.length === 0 ? 'No payment records yet.' : 'No results match your search.'}</p>
            {payments.length === 0 && (
              <p className="pay-empty-sub">
                {isTutor
                  ? 'Your earnings will appear here when students pay for sessions.'
                  : 'Your payment records will appear here after you pay for a session.'}
              </p>
            )}
          </div>
        ) : (
          <div className="pay-table-wrap">
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Session</th>
                  <th>{isTutor ? 'Student' : 'Tutor'}</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(payment => {
                  const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.succeeded;
                  const StatusIcon = statusCfg.icon;
                  const otherParty = isTutor ? payment.payer : payment.recipient;
                  return (
                    <tr key={payment.id} className="pay-row">
                      <td>
                        <span className="pay-invoice-num">{payment.invoice_number}</span>
                      </td>
                      <td>
                        <span className="pay-date">{formatDate(payment.paid_at)}</span>
                      </td>
                      <td>
                        <span className="pay-topic">{payment.session_topic}</span>
                        {payment.session_duration && (
                          <span className="pay-duration">{payment.session_duration} min</span>
                        )}
                      </td>
                      <td>
                        <span className="pay-person">{otherParty?.full_name || '—'}</span>
                      </td>
                      <td>
                        <span className={`pay-amount ${isTutor ? 'amount-credit' : 'amount-debit'}`}>
                          {isTutor ? '+' : ''}£{parseFloat(payment.amount).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className={`pay-status-badge ${statusCfg.className}`}>
                          <StatusIcon className="pay-status-icon-sm" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <button
                          className="inv-view-btn"
                          onClick={() => openInvoice(payment)}
                          disabled={invoiceLoading}
                        >
                          <HiChevronRight />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
