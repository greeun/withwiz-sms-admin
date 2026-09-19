'use client';

import { useState, useEffect } from 'react';
import { useSmsAdminConfig } from './SmsAdminProvider';
import { SMS_ENDPOINTS } from '../constants';
import { formatDateTime } from './date';
import type { SmsMessageDetailJson } from '../types';

export interface SmsDetailViewProps {
  messageId: string;
  /** Called when the back-to-list button is clicked. The button is not rendered when this
   *  is omitted. */
  onBack?: () => void;
}

export function SmsDetailView({ messageId, onBack }: SmsDetailViewProps) {
  const { fetcher, basePath, resolveImageUrl } = useSmsAdminConfig();
  const [message, setMessage] = useState<SmsMessageDetailJson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetcher(`${basePath}${SMS_ENDPOINTS.detail(messageId)}`);
        if (res.ok) {
          const json = await res.json();
          setMessage(json.data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [messageId, fetcher, basePath]);

  if (loading) {
    return <div className="admin-empty">불러오는 중...</div>;
  }

  if (!message) {
    return <div className="admin-empty">발송 기록을 찾을 수 없습니다.</div>;
  }

  function statusBadge(status: string) {
    switch (status) {
      case "SENT":
        return <span className="admin-badge-success">성공</span>;
      case "FAILED":
        return <span className="admin-badge-error">실패</span>;
      default:
        return <span className="admin-badge-type">대기</span>;
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">발송 상세</h1>
        <div className="admin-header-actions">
          {onBack && (
            <button className="admin-btn-secondary" onClick={onBack}>
              목록으로
            </button>
          )}
        </div>
      </div>

      <div style={{ border: "1px solid #e5e5e5", padding: 16, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, fontSize: "0.875rem" }}>
          <div>
            <span style={{ color: "#888" }}>유형</span>
            <div style={{ marginTop: 4 }}>
              <span className="admin-badge-type">{message.type}</span>
            </div>
          </div>
          <div>
            <span style={{ color: "#888" }}>상태</span>
            <div style={{ marginTop: 4 }}>{statusBadge(message.status)}</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>발송일시</span>
            <div style={{ marginTop: 4 }}>{formatDateTime(message.createdAt)}</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>발신번호</span>
            <div style={{ marginTop: 4 }}>{message.sender}</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>총 건수</span>
            <div style={{ marginTop: 4 }}>{message.totalCount}건</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>성공</span>
            <div style={{ marginTop: 4, color: "#16a34a" }}>{message.successCount ?? 0}건</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>실패</span>
            <div style={{ marginTop: 4, color: "#dc2626" }}>{message.failCount ?? 0}건</div>
          </div>
          <div>
            <span style={{ color: "#888" }}>출처</span>
            <div style={{ marginTop: 4 }}>{message.source ?? "-"}</div>
          </div>
        </div>
      </div>

      {message.status === "FAILED" && (message.errCode || message.errMessage) && (
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            borderRadius: 4,
            padding: 16,
            marginBottom: 24,
            fontSize: "0.875rem",
          }}
        >
          <h2 style={{ marginBottom: 8, fontSize: "0.875rem", fontWeight: 600, color: "#dc2626" }}>
            발송 실패 사유
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, color: "#7f1d1d" }}>
            <span style={{ color: "#b91c1c" }}>상태코드</span>
            <span style={{ fontFamily: "monospace" }}>{message.errCode ?? "-"}</span>
            <span style={{ color: "#b91c1c" }}>메시지</span>
            <span style={{ whiteSpace: "pre-wrap" }}>{message.errMessage ?? "-"}</span>
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #e5e5e5", padding: 16, marginBottom: 24 }}>
        <h2 style={{ marginBottom: 8, fontSize: "0.875rem", fontWeight: 500, color: "#888" }}>메시지 내용</h2>
        {message.subject && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>제목:</span>
            <span style={{ marginLeft: 8, fontWeight: 500 }}>{message.subject}</span>
          </div>
        )}
        <div style={{ whiteSpace: "pre-wrap", borderRadius: 4, background: "#f9f9f9", padding: 12, fontSize: "0.875rem" }}>{message.content}</div>
        {message.imageUrl && (
          <div style={{ marginTop: 12 }}>
            <img
              src={resolveImageUrl(message.imageUrl, "sm")}
              alt="MMS 이미지"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallback) return;
                img.dataset.fallback = "1";
                img.src = message.imageUrl!;
              }}
              style={{ height: 128, borderRadius: 4, border: "1px solid #e5e5e5", objectFit: "cover" }}
            />
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #e5e5e5", borderRadius: 4 }}>
        <div style={{ borderBottom: "1px solid #e5e5e5", background: "#f9f9f9", padding: "12px 16px" }}>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 500 }}>수신자 ({message.recipients.length}명)</h2>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 48, textAlign: "center" }}>No</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {message.recipients.map((r, i) => (
              <tr key={r.id}>
                <td style={{ textAlign: "center", color: "#888" }}>{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.phone}</td>
                <td>{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
