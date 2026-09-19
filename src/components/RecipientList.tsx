'use client';

import { useState } from 'react';
import { formatKoreanPhone, isValidMobilePhone } from '@withwiz/sms-core';
import { useSmsAdminConfig } from './SmsAdminProvider';
import { PHONE_INPUT_MAX_LENGTH } from '../constants';

export interface Recipient {
  name: string;
  phone: string;
  /** Child details when the contact is a parent (filled in by sources such as briefing) */
  studentName?: string;
  studentGrade?: string;
}

interface RecipientListProps {
  recipients: Recipient[];
  onRemove: (index: number) => void;
  onAdd?: (recipient: Recipient) => void;
}

export function RecipientList({ recipients, onRemove, onAdd }: RecipientListProps) {
  const { notify } = useSmsAdminConfig();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const invalidCount = recipients.filter((r) => !isValidMobilePhone(r.phone)).length;
  const hasStudentInfo = recipients.some((r) => r.studentName || r.studentGrade);

  function handleAdd() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      notify.error("이름을 입력해주세요.");
      return;
    }
    if (!isValidMobilePhone(trimmedPhone)) {
      notify.error("올바른 전화번호를 입력해주세요. (예: 010-1234-5678)");
      return;
    }

    const normalizedPhone = trimmedPhone.replace(/\D/g, "");
    const isDuplicate = recipients.some((r) => r.phone.replace(/\D/g, "") === normalizedPhone);
    if (isDuplicate) {
      notify.error("이미 추가된 전화번호입니다.");
      return;
    }

    onAdd?.({ name: trimmedName, phone: formatKoreanPhone(normalizedPhone) });
    setName("");
    setPhone("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontWeight: 600, fontSize: "0.95rem" }}>
          수신자 ({recipients.length}명)
          {invalidCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: "0.85rem", fontWeight: 600, color: "var(--color-error, #dc2626)" }}>
              · 연락처 오류 {invalidCount}건 — 제거 후 발송하세요
            </span>
          )}
        </label>
      </div>

      {onAdd && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            className="admin-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="이름"
            style={{ width: 112 }}
          />
          <input
            type="tel"
            inputMode="numeric"
            className="admin-input"
            value={phone}
            onChange={(e) => setPhone(formatKoreanPhone(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder="010-1234-5678"
            style={{ width: 160 }}
            maxLength={PHONE_INPUT_MAX_LENGTH}
          />
          <button
            type="button"
            className="admin-btn-secondary"
            style={{ padding: "4px 12px", fontSize: "0.85rem" }}
            onClick={handleAdd}
          >
            추가
          </button>
        </div>
      )}

      {recipients.length === 0 ? (
        <div className="admin-empty">
          수신자가 없습니다. 위에서 직접 추가하거나 입학 설명회 신청 관리 등에서 선택해주세요.
        </div>
      ) : (
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>전화번호</th>
                {hasStudentInfo && <th>학생</th>}
                {hasStudentInfo && <th>학년</th>}
                <th>제거</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r, i) => {
                const valid = isValidMobilePhone(r.phone);
                return (
                  <tr
                    key={`${r.phone}-${i}`}
                    style={valid ? undefined : { background: "var(--color-error-bg, #fef2f2)" }}
                  >
                    <td>{r.name || <span style={{ color: "#bbb" }}>이름없음</span>}</td>
                    <td>
                      {r.phone ? (
                        <span style={valid ? undefined : { color: "var(--color-error, #dc2626)" }}>{r.phone}</span>
                      ) : (
                        <span style={{ color: "#bbb" }}>없음</span>
                      )}
                      {!valid && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "var(--color-error, #dc2626)",
                          }}
                        >
                          불가능
                        </span>
                      )}
                    </td>
                    {hasStudentInfo && <td>{r.studentName || "-"}</td>}
                    {hasStudentInfo && <td>{r.studentGrade || "-"}</td>}
                    <td>
                      <button
                        className="admin-table-actions-delete"
                        style={{ padding: 0 }}
                        onClick={() => onRemove(i)}
                      >
                        ✕
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
  );
}
