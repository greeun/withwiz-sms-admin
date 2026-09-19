'use client';

import { useState, useEffect } from 'react';
import { useSmsAdminConfig } from './SmsAdminProvider';
import { MAX_PAGE_SIZE, SMS_ENDPOINTS } from '../constants';
import type { SmsTemplateListItemJson } from '../types';

interface TemplateSelectorProps {
  onSelect: (template: SmsTemplateListItemJson) => void;
  currentType: string;
  currentSubject: string;
  currentContent: string;
  currentImageUrl: string;
}

export function TemplateSelector({
  onSelect,
  currentType,
  currentSubject,
  currentContent,
  currentImageUrl,
}: TemplateSelectorProps) {
  const { fetcher, basePath } = useSmsAdminConfig();
  const [templates, setTemplates] = useState<SmsTemplateListItemJson[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetcher(`${basePath}${SMS_ENDPOINTS.templates}?limit=${MAX_PAGE_SIZE}`);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data?.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts a single fetch on mount (loadTemplates calls setLoading)
    loadTemplates();
  }, []);

  async function handleSave() {
    if (!saveName.trim() || !currentContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetcher(`${basePath}${SMS_ENDPOINTS.templates}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          type: currentType,
          subject: currentSubject || null,
          content: currentContent,
          imageUrl: currentImageUrl || null,
        }),
      });
      if (res.ok) {
        setSaveOpen(false);
        setSaveName("");
        loadTemplates();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={(e) => {
          const t = templates.find((t) => t.id === e.target.value);
          if (t) onSelect(t);
          e.target.value = "";
        }}
        className="admin-select"
        defaultValue=""
        disabled={loading}
      >
        <option value="" disabled>
          {loading ? "불러오는 중..." : "템플릿 불러오기"}
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            [{t.type}] {t.name}
          </option>
        ))}
      </select>

      <button
        className="admin-btn-secondary"
        style={{ padding: "4px 12px", fontSize: "0.85rem" }}
        disabled={!currentContent.trim()}
        onClick={() => setSaveOpen(true)}
      >
        템플릿으로 저장
      </button>

      {saveOpen && (
        <div className="admin-modal-overlay" onClick={() => setSaveOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-modal-title">템플릿 저장</h3>
            <div className="admin-form-group">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="템플릿 이름"
                autoFocus
              />
            </div>
            <p style={{ fontSize: "0.8rem", color: "#888" }}>
              현재 작성 중인 메시지를 [{currentType}] 템플릿으로 저장합니다.
            </p>
            <div className="admin-modal-footer">
              <button className="admin-btn-secondary" onClick={() => setSaveOpen(false)}>
                취소
              </button>
              <button
                className="admin-btn-primary"
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
