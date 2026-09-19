'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { byteLength, isValidMobilePhone, normalizePhone, type SmsType, type SmsRemainCounts } from '@withwiz/sms-core';
import { RecipientList, type Recipient } from './RecipientList';
import { TemplateSelector } from './TemplateSelector';
import { useSmsAdminConfig } from './SmsAdminProvider';
import {
  ALLOWED_IMAGE_ACCEPT,
  ALLOWED_IMAGE_MIME,
  MAX_CONTENT_BYTES,
  REMAIN_LOW_THRESHOLD,
  REMAIN_WARN_THRESHOLD,
  SMS_ENDPOINTS,
  SUBJECT_MAX_BYTES,
} from '../constants';

export interface SmsSendFormProps {
  /**
   * Project-specific recipient picker UI, such as selecting a whole class.
   * Call the onAddRecipients callback the form passes in to hand the selection back.
   */
  recipientPicker?: (onAddRecipients: (recipients: Recipient[]) => void) => ReactNode;
  /** Called once the send finishes. Navigation is left to the consumer. */
  onSent?: (messageId: string) => void;
  /** Identifier of the screen that triggered the send */
  source?: string;
  /**
   * Called when the top delivery history button is clicked. Navigation is left to the
   * consumer. The button is not rendered when this is omitted.
   *
   * The original rendered this button with useRouter directly, but page paths differ
   * between projects, so it is taken as a callback instead. This prop is an addition
   * that the brief does not specify.
   */
  onNavigateToHistory?: () => void;
  /**
   * Called when the top template management button is clicked. Navigation is left to the
   * consumer. The button is not rendered when this is omitted.
   *
   * The original rendered this button with useRouter directly, but page paths differ
   * between projects, so it is taken as a callback instead. This prop is an addition
   * that the brief does not specify.
   */
  onNavigateToTemplates?: () => void;
}

export function SmsSendForm({
  recipientPicker,
  onSent,
  source,
  onNavigateToHistory,
  onNavigateToTemplates,
}: SmsSendFormProps) {
  const { fetcher, basePath, onUploadImage, resolveImageUrl, notify, recipientStorageKey } = useSmsAdminConfig();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [type, setType] = useState<SmsType>("SMS");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [remain, setRemain] = useState<SmsRemainCounts | null>(null);
  const [remainLoading, setRemainLoading] = useState(true);
  const [remainError, setRemainError] = useState(false);

  const loadRemain = useCallback(async () => {
    setRemainLoading(true);
    setRemainError(false);
    try {
      const res = await fetcher(`${basePath}${SMS_ENDPOINTS.remain}`);
      const json = await res.json();
      if (json.success) {
        setRemain(json.data);
      } else {
        setRemainError(true);
      }
    } catch {
      setRemainError(true);
    } finally {
      setRemainLoading(false);
    }
  }, [fetcher, basePath]);

  useEffect(() => {
    loadRemain();
  }, [loadRemain]);

  useEffect(() => {
    const stored = sessionStorage.getItem(recipientStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Recipient[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecipients(parsed);
        }
      } catch {}
      sessionStorage.removeItem(recipientStorageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on first render, then cleared.
  }, []);

  const handleRemoveRecipient = useCallback((index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddRecipient = useCallback((recipient: Recipient) => {
    setRecipients((prev) => [...prev, recipient]);
  }, []);

  /** Adds only recipients whose number is not already present. Compared digits-only. */
  const addRecipients = useCallback((incoming: Recipient[]) => {
    setRecipients((prev) => {
      const seen = new Set(prev.map((r) => normalizePhone(r.phone)));
      const merged = [...prev];
      for (const r of incoming) {
        const key = normalizePhone(r.phone);
        // Skip entries with an empty number. The original mergeDedupe applied the same
        // rule as `if (!key || seen.has(key)) continue`, so it is carried over verbatim.
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(r);
      }
      return merged;
    });
  }, []);

  const invalidCount = recipients.filter((r) => !isValidMobilePhone(r.phone)).length;

  const contentBytes = byteLength(content);
  const subjectBytes = byteLength(subject);
  const maxContentBytes = MAX_CONTENT_BYTES[type];
  const maxSubjectBytes = SUBJECT_MAX_BYTES;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_MIME.some((mime) => file.type.startsWith(mime))) {
      notify.error("JPEG 이미지만 업로드 가능합니다.");
      return;
    }

    if (!onUploadImage) {
      notify.error("이미지 업로드 기능이 설정되지 않았습니다.");
      return;
    }

    setUploading(true);
    try {
      const url = await onUploadImage(file);
      setImageUrl(url);
      notify.success("이미지가 업로드되었습니다.");
    } catch {
      notify.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSend() {
    if (recipients.length === 0) {
      notify.error("수신자를 선택해주세요.");
      return;
    }
    if (invalidCount > 0) {
      notify.error(`연락처 오류 ${invalidCount}건을 목록에서 제거한 뒤 발송해주세요.`);
      return;
    }
    if (!content.trim()) {
      notify.error("메시지 내용을 입력해주세요.");
      return;
    }
    if (contentBytes > maxContentBytes) {
      notify.error(`메시지가 ${maxContentBytes}byte를 초과합니다.`);
      return;
    }
    if ((type === "LMS" || type === "MMS") && !subject.trim()) {
      notify.error("LMS/MMS는 제목이 필수입니다.");
      return;
    }

    if (!confirm(`${recipients.length}명에게 ${type} 메시지를 발송하시겠습니까?`)) return;

    setSending(true);
    try {
      const res = await fetcher(`${basePath}${SMS_ENDPOINTS.send}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: type !== "SMS" ? subject : undefined,
          content,
          imageUrl: type === "MMS" ? imageUrl : undefined,
          recipients,
          source,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const { successCount, failCount } = json.data;
        if (failCount > 0) {
          notify.warning(`발송 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
        } else {
          notify.success(`${successCount}건 발송 성공`);
        }
        onSent?.(json.data.messageId);
      } else {
        notify.error(json.error?.message || "발송에 실패했습니다.");
      }
    } catch {
      notify.error("발송 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  }

  function handleTemplateSelect(template: {
    type: string;
    subject: string | null;
    content: string;
    imageUrl: string | null;
  }) {
    setType(template.type as SmsType);
    setSubject(template.subject ?? "");
    setContent(template.content);
    setImageUrl(template.imageUrl ?? "");
  }

  const tabs: SmsType[] = ["SMS", "LMS", "MMS"];

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">메시지 발송</h1>
        <div className="admin-header-actions">
          {onNavigateToHistory && (
            <button className="admin-btn-secondary" onClick={onNavigateToHistory}>
              발송 기록
            </button>
          )}
          {onNavigateToTemplates && (
            <button className="admin-btn-secondary" onClick={onNavigateToTemplates}>
              템플릿 관리
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "10px 14px",
          background: "var(--admin-bg-muted, #f8fafc)",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          fontSize: "0.875rem",
        }}
      >
        <strong style={{ fontWeight: 600 }}>잔여 발송 가능 건수</strong>
        {remainLoading ? (
          <span style={{ color: "#6b7280" }}>조회 중...</span>
        ) : remainError ? (
          <span style={{ color: "var(--color-error, #ef4444)" }}>조회 실패</span>
        ) : remain ? (
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(["SMS", "LMS", "MMS"] as const).map((t) => {
              const value = t === "SMS" ? remain.sms : t === "LMS" ? remain.lms : remain.mms;
              const active = type === t;
              // Color by remaining level: low (red) / warn (orange) / ok (green)
              const level =
                value < REMAIN_LOW_THRESHOLD ? "low" : value < REMAIN_WARN_THRESHOLD ? "warn" : "ok";
              const palette = {
                low: { fg: "#b91c1c", bg: "#fee2e2", bd: "#fca5a5" },
                warn: { fg: "#b45309", bg: "#fef3c7", bd: "#fcd34d" },
                ok: { fg: "#15803d", bg: "#dcfce7", bd: "#86efac" },
              }[level];
              return (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 10px",
                    borderRadius: 999,
                    color: palette.fg,
                    background: palette.bg,
                    border: `1px solid ${active ? palette.fg : palette.bd}`,
                    fontWeight: active ? 700 : 500,
                  }}
                  title={level === "low" ? "잔여 건수 부족" : level === "warn" ? "잔여 건수 주의" : "충분"}
                >
                  {t} {value.toLocaleString()}건
                </span>
              );
            })}
          </span>
        ) : null}
        <button
          className="admin-btn-secondary"
          onClick={loadRemain}
          disabled={remainLoading}
          style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "0.8125rem" }}
        >
          새로고침
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 320px", minWidth: 300 }}>
          {recipientPicker?.(addRecipients)}

          <RecipientList recipients={recipients} onRemove={handleRemoveRecipient} onAdd={handleAddRecipient} />
        </div>

        <div style={{ flex: "1.4 1 420px", minWidth: 360 }}>
          <div className="admin-tabs" style={{ marginBottom: 12 }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setType(t)} className={`admin-tab${type === t ? " active" : ""}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <TemplateSelector
            onSelect={handleTemplateSelect}
            currentType={type}
            currentSubject={subject}
            currentContent={content}
            currentImageUrl={imageUrl}
          />
        </div>

        {type !== "SMS" && (
          <div className="admin-form-group">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label>제목</label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: subjectBytes > maxSubjectBytes ? "var(--color-error, #ef4444)" : undefined,
                  fontWeight: subjectBytes > maxSubjectBytes ? "bold" : undefined,
                }}
              >
                {subjectBytes}/{maxSubjectBytes} byte
              </span>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </div>
        )}

        <div className="admin-form-group">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label>내용</label>
            <span
              style={{
                fontSize: "0.75rem",
                color: contentBytes > maxContentBytes ? "var(--color-error, #ef4444)" : undefined,
                fontWeight: contentBytes > maxContentBytes ? "bold" : undefined,
              }}
            >
              {contentBytes}/{maxContentBytes} byte
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지 내용을 입력하세요"
            rows={type === "SMS" ? 3 : 8}
          />
        </div>

        {type === "MMS" && (
          <div className="admin-form-group">
            <label>이미지 (JPEG)</label>
            {imageUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={resolveImageUrl(imageUrl, "thumb")}
                  alt="MMS 이미지"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.dataset.fallback) return;
                    img.dataset.fallback = "1";
                    img.src = imageUrl;
                  }}
                  style={{ height: 80, width: 80, borderRadius: 4, border: "1px solid #e5e7eb", objectFit: "cover" }}
                />
                <button className="admin-btn-secondary" onClick={() => setImageUrl("")}>
                  제거
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept={ALLOWED_IMAGE_ACCEPT}
                onChange={handleImageUpload}
                disabled={uploading}
                style={{ fontSize: "0.875rem" }}
              />
            )}
            {uploading && <p style={{ marginTop: 4, fontSize: "0.75rem" }}>업로드 중...</p>}
          </div>
        )}
        </div>
      </div>

      <div className="admin-form-actions">
        <button
          className="admin-btn-primary"
          onClick={handleSend}
          disabled={sending || recipients.length === 0 || invalidCount > 0 || !content.trim()}
          style={{ minWidth: 128 }}
          title={invalidCount > 0 ? `연락처 오류 ${invalidCount}건을 제거 후 발송할 수 있습니다.` : undefined}
        >
          {sending ? "발송 중..." : `${type} 발송 (${recipients.length}명)`}
        </button>
      </div>
    </div>
  );
}
